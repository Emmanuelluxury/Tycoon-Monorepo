'use client';

/**
 * PurchaseModal — Confirm Purchase dialog
 *
 * SW-FE-028  CLS / LCP — reserved `min-h` on card prevents layout shift when
 *            loading→content transition occurs; stable `h-10` price slot avoids
 *            reflow when the price string resolves.
 * SW-FE-029  Error / empty states — distinct UI for loading, error (with retry),
 *            and empty (item not found) conditions.
 * SW-FE-030  Telemetry — privacy-safe events via usePurchaseModalTelemetry.
 * SW-FE-031  Security — all string props sanitized (strip HTML tags), no PII
 *            forwarded to analytics, nonce-safe (no inline style / eval).
 */

import React, { useCallback, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertCircle, RefreshCw, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
  CardContent,
} from '@/components/ui/card';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { usePurchaseModalTelemetry } from '@/hooks/usePurchaseModalTelemetry';
import { usePurchaseModalWebVitals } from '@/hooks/usePurchaseModalWebVitals';

export interface PurchaseModalProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly onConfirm: () => void;
  readonly itemName?: string | null;
  readonly itemPrice?: string | null;
  readonly itemCurrency?: string | null;
  readonly isLoading?: boolean;
  readonly error?: string | null;
  /** Called when the user clicks the "Retry" button on an error state. */
  readonly onRetry?: () => void;
}

/** Strip HTML tags and trim to prevent XSS via prop injection (SW-FE-031). */
function sanitizeText(value: string): string {
  return value.replace(/<[^>]*>/g, '').trim();
}

/** Coerce a nullable string prop to a sanitized, safe string. */
function toSafeString(value: string | null | undefined): string {
  return sanitizeText(value ?? '');
}

export function PurchaseModal({
  isOpen,
  onClose,
  onConfirm,
  itemName,
  itemPrice,
  itemCurrency,
  isLoading = false,
  error = null,
  onRetry,
}: PurchaseModalProps): React.ReactElement | null {
  const { t } = useTranslation('common');
  const containerRef = useRef<HTMLDivElement>(null);

  // SW-FE-028: Web Vitals monitoring (CLS / LCP)
  usePurchaseModalWebVitals(isOpen);

  useFocusTrap(containerRef, isOpen, onClose);

  // Lock body scroll while open; restore on close / unmount
  useEffect(() => {
    if (!isOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [isOpen]);

  // SW-FE-031: Sanitize all user-supplied strings before rendering or forwarding
  const safeName = toSafeString(itemName);
  const safePrice = toSafeString(itemPrice);
  const safeCurrency = toSafeString(itemCurrency);

  // All hooks must be called before any conditional return (Rules of Hooks)
  const { trackModalViewed, trackModalCanceled, trackModalConfirmed } =
    usePurchaseModalTelemetry();

  // SW-FE-030: Track modal viewed when opened
  useEffect(() => {
    if (isOpen) {
      trackModalViewed({ itemName: safeName, currency: safeCurrency, value: safePrice });
    }
  }, [isOpen, safeName, safeCurrency, safePrice, trackModalViewed]);

  const handleClose = useCallback((): void => {
    trackModalCanceled({ itemName: safeName, currency: safeCurrency, value: safePrice });
    onClose();
  }, [trackModalCanceled, safeName, safeCurrency, safePrice, onClose]);

  const handleConfirm = useCallback((): void => {
    trackModalConfirmed({ itemName: safeName, currency: safeCurrency, value: safePrice });
    onConfirm();
  }, [trackModalConfirmed, safeName, safeCurrency, safePrice, onConfirm]);

  const handleRetry = useCallback((): void => {
    onRetry?.();
  }, [onRetry]);

  if (!isOpen) return null;

  // ── SW-FE-028: Reserve stable min-h so the card never collapses / reflows ──
  // The Card always occupies at least min-h-[260px] regardless of which state
  // is active, preventing CLS when loading→content transition fires.
  const renderContent = (): React.ReactElement => {
    // ── Loading state ───────────────────────────────────────────────────────
    if (isLoading) {
      return (
        <div
          className="flex flex-col items-center justify-center py-12 gap-4"
          data-testid="purchase-modal-loading"
          aria-live="polite"
          aria-busy="true"
        >
          <div
            className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-400 border-t-transparent"
            role="status"
            aria-label={t('shop.loading_details', { defaultValue: 'Loading item details…' })}
          />
          <p className="text-neutral-400 text-sm">
            {t('shop.loading_details', { defaultValue: 'Loading item details…' })}
          </p>
        </div>
      );
    }

    // ── SW-FE-029: Error state — shows message + optional retry ────────────
    if (error != null) {
      return (
        <div
          className="flex flex-col items-center justify-center py-10 gap-4 text-center px-4"
          data-testid="purchase-modal-error"
          role="alert"
          aria-live="assertive"
        >
          <AlertCircle className="h-8 w-8 text-red-500" aria-hidden="true" />
          <p className="text-red-400 text-sm font-medium">{error}</p>
          <div className="flex gap-3 mt-1">
            {onRetry != null && (
              <Button
                type="button"
                variant="outline"
                onClick={handleRetry}
                aria-label={t('common.retry', { defaultValue: 'Retry' })}
                className="border-cyan-700 text-cyan-300 hover:bg-neutral-800 gap-2"
                data-testid="purchase-modal-retry"
              >
                <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                {t('common.retry', { defaultValue: 'Retry' })}
              </Button>
            )}
            <Button
              type="button"
              onClick={handleClose}
              variant="outline"
              className="border-neutral-700 text-neutral-300 hover:bg-neutral-800"
              data-testid="purchase-modal-error-close"
            >
              {t('common.close', { defaultValue: 'Close' })}
            </Button>
          </div>
        </div>
      );
    }

    // ── SW-FE-029: Empty state — item details not available ────────────────
    if (itemName == null || itemName === '') {
      return (
        <div
          className="flex flex-col items-center justify-center py-12 gap-4 text-center px-4"
          data-testid="purchase-modal-empty"
        >
          <p className="text-neutral-400 text-sm">
            {t('shop.item_not_found', { defaultValue: 'Item details not found.' })}
          </p>
          <Button
            type="button"
            onClick={handleClose}
            variant="outline"
            className="border-neutral-700 text-neutral-300 hover:bg-neutral-800"
            data-testid="purchase-modal-empty-close"
          >
            {t('common.close', { defaultValue: 'Close' })}
          </Button>
        </div>
      );
    }

    // ── Normal state ────────────────────────────────────────────────────────
    return (
      <>
        <CardContent className="py-6 text-center">
          {/*
           * SW-FE-028: `h-10` keeps a stable height while the price string
           * resolves — prevents micro CLS from font / layout recalc.
           */}
          <div
            className="text-3xl font-bold text-cyan-400"
            aria-live="polite"
            aria-atomic="true"
            data-testid="purchase-modal-price"
          >
            <div className="h-10 flex items-center justify-center">
              {safePrice} {safeCurrency}
            </div>
          </div>
        </CardContent>

        <CardFooter className="flex justify-end gap-3">
          <Button
            data-testid="purchase-modal-cancel"
            type="button"
            variant="outline"
            onClick={handleClose}
            className="border-neutral-700 text-neutral-300 hover:bg-neutral-800"
          >
            {t('shop.cancel', { defaultValue: 'Cancel' })}
          </Button>
          <Button
            data-testid="purchase-modal-confirm"
            type="button"
            onClick={handleConfirm}
            className="bg-cyan-500 text-black hover:bg-cyan-400"
          >
            {t('shop.purchase', { defaultValue: 'Purchase' })}
          </Button>
        </CardFooter>
      </>
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="purchase-modal-title"
      aria-describedby="purchase-modal-description"
      data-testid="purchase-modal"
    >
      {/* Backdrop — click closes modal */}
      <div
        className="absolute inset-0"
        onClick={handleClose}
        aria-hidden="true"
        data-testid="purchase-modal-backdrop"
      />

      <div ref={containerRef} className="relative z-10 w-full max-w-md px-4">
        {/*
         * SW-FE-028: `min-h-[260px]` reserves stable space for the card so
         * loading → content transitions do not cause layout shift (CLS = 0).
         */}
        <Card className="min-h-[260px] border-neutral-800 bg-neutral-900 shadow-2xl">
          <CardHeader className="relative">
            <button
              type="button"
              onClick={handleClose}
              aria-label={t('shop.close_modal', { defaultValue: 'Close' })}
              className="absolute right-4 top-4 rounded-sm text-neutral-400 opacity-70 ring-offset-neutral-900 transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:ring-offset-2"
              data-testid="purchase-modal-close"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>

            <CardTitle id="purchase-modal-title" className="text-xl text-white">
              {t('shop.confirm_purchase', { defaultValue: 'Confirm Purchase' })}
            </CardTitle>
            {!isLoading && error == null && itemName != null && itemName !== '' && (
              <CardDescription
                id="purchase-modal-description"
                className="text-neutral-400 mt-2"
              >
                {t('shop.purchase_confirmation_msg', {
                  name: safeName,
                  defaultValue: `Are you sure you want to purchase ${safeName}?`,
                })}
              </CardDescription>
            )}
          </CardHeader>

          {renderContent()}
        </Card>
      </div>
    </div>
  );
}
