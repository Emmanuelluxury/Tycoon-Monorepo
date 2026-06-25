"use client";

import React, { useId } from "react";
import { AlertCircle, ExternalLink, Loader2, Wallet } from "lucide-react";
import { useNearWallet } from "@/components/providers/near-wallet-provider";
import { cn } from "@/lib/utils";

// SW-FE-034: explicit return type + named params prevent accidental swap of head/tail
function truncateAccount(id: string, head = 6, tail = 4): string {
  if (id.length <= head + tail + 1) return id;
  return `${id.slice(0, head)}...${id.slice(-tail)}`;
}

type NearWalletConnectVariant = "navbar" | "panel";

// SW-FE-034: explicit prop interface instead of inline object literal
interface NearWalletConnectProps {
  className?: string;
  /** `panel`: left-aligned for mobile slide-over menu. */
  variant?: NearWalletConnectVariant;
}

export function NearWalletConnect({
  className,
  variant = "navbar",
}: NearWalletConnectProps): React.ReactElement {
  const panel = variant === "panel";
  const { ready, initError, accountId, connect, disconnect, transactions } =
    useNearWallet();

  // SW-FE-033: stable id for aria-describedby on the error banner
  const errorId = useId();
  const statusId = useId();

  // SW-FE-034: narrow to the first element; `undefined` when the array is empty
  const latest: (typeof transactions)[number] | undefined = transactions[0];
  const showLoadingState: boolean = !ready && !initError;
  const showEmptyState: boolean = ready && !initError && !accountId;

  return (
    <div
      className={cn(
        "flex flex-col gap-1",
        panel ? "items-stretch text-left" : "items-end text-right",
        className,
      )}
    >
      {/* SW-FE-033: role="alert" is already set; add id so buttons can
          reference it via aria-describedby when present */}
      {initError !== null && (
        <div
          id={errorId}
          role="alert"
          className={cn(
            "flex max-w-[240px] items-start gap-2 rounded-lg border border-red-400/30 bg-red-400/10 px-3 py-2 text-left text-[10px] font-dm-sans text-red-200",
            panel ? "self-start" : "self-end",
          )}
        >
          <AlertCircle
            aria-hidden="true"
            className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-300"
          />
          <span className="leading-relaxed">{initError}</span>
        </div>
      )}

      {/* min-h reserves the button row height so surrounding layout does not
          shift when the wallet transitions between ready/not-ready states. */}
      <div
        className={cn(
          "flex min-h-[28px] flex-wrap items-center gap-2",
          panel ? "justify-start" : "justify-end",
        )}
      >
        {/* SW-FE-034: accountId is string | null — explicit null check */}
        {accountId !== null ? (
          <>
            {/* SW-FE-033: aria-label carries the full untruncated account id */}
            <span
              className="inline-flex items-center gap-1.5 rounded-full border border-[var(--tycoon-border)] bg-[var(--tycoon-card-bg)] px-3 py-1 text-[11px] font-dm-sans text-[var(--tycoon-text)]"
              title={accountId}
              aria-label={`Connected as ${accountId}`}
            >
              <Wallet
                aria-hidden="true"
                className="h-3.5 w-3.5 text-[var(--tycoon-accent)]"
              />
              {/* aria-hidden: screen readers get the full id from the parent aria-label */}
              <span className="font-mono" aria-hidden="true">
                {truncateAccount(accountId)}
              </span>
            </span>
            <button
              type="button"
              onClick={(): void => {
                void disconnect();
              }}
              aria-label={`Disconnect NEAR wallet ${accountId}`}
              className="rounded-full border border-[var(--tycoon-border)] bg-transparent px-3 py-1 text-[11px] font-dm-sans text-[var(--tycoon-text)]/80 transition-colors hover:text-[var(--tycoon-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--tycoon-accent)] focus:ring-offset-2"
            >
              Disconnect NEAR
            </button>
          </>
        ) : (
          // SW-FE-033: aria-describedby references the error banner when visible
          <button
            type="button"
            onClick={connect}
            disabled={!ready}
            aria-describedby={initError !== null ? errorId : undefined}
            className="inline-flex items-center gap-1.5 rounded-full border border-[var(--tycoon-border)] bg-[var(--tycoon-card-bg)] px-3 py-1.5 text-[11px] font-dm-sans font-medium text-[var(--tycoon-text)] transition-colors hover:bg-[var(--tycoon-accent)] hover:text-[#010F10] disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-[var(--tycoon-accent)] focus:ring-offset-2"
          >
            <Wallet aria-hidden="true" className="h-3.5 w-3.5" />
            Connect NEAR
          </button>
        )}
      </div>

      {showLoadingState && (
        <div
          data-testid="near-wallet-loading-state"
          role="status"
          aria-live="polite"
          className={cn(
            "flex max-w-[240px] items-start gap-2 rounded-lg border border-[var(--tycoon-border)]/80 bg-[var(--tycoon-card-bg)]/70 px-3 py-2 text-left text-[10px] font-dm-sans text-[var(--tycoon-text)]/70",
            panel ? "self-start" : "self-end",
          )}
        >
          <Loader2
            aria-hidden="true"
            className="mt-0.5 h-3.5 w-3.5 shrink-0 animate-spin text-[var(--tycoon-accent)]"
          />
          <span className="leading-relaxed">
            Preparing NEAR wallet support...
          </span>
        </div>
      )}

      {showEmptyState && (
        <div
          data-testid="near-wallet-empty-state"
          className={cn(
            "flex max-w-[240px] items-start gap-2 rounded-lg border border-[var(--tycoon-border)]/80 bg-[var(--tycoon-card-bg)]/70 px-3 py-2 text-left text-[10px] font-dm-sans text-[var(--tycoon-text)]/70",
            panel ? "self-start" : "self-end",
          )}
        >
          <Wallet
            aria-hidden="true"
            className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--tycoon-accent)]"
          />
          <span className="leading-relaxed">
            No NEAR wallet connected yet. Connect to sign in and submit
            transactions.
          </span>
        </div>
      )}

      {/* aria-live="polite" announces transaction status changes without
          interrupting the user. role="status" is implied by aria-live but
          explicit here for clarity. min-h prevents CLS. */}
      <div
        id={statusId}
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className={cn("min-h-[28px]", panel ? "items-start" : "items-end")}
      >
        {/* SW-FE-034: guard against undefined rather than truthy-coercing the object */}
        {latest !== undefined && (
          <div
            className={cn(
              "flex max-w-[280px] flex-col gap-0.5 rounded-lg border border-[var(--tycoon-border)]/80 bg-[#010F10]/80 px-2 py-1.5",
              panel ? "items-start" : "items-end",
            )}
          >
            <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-dm-sans text-[var(--tycoon-text)]/80">
              {latest.phase === "pending" && (
                <>
                  <Loader2
                    aria-hidden="true"
                    className="h-3 w-3 animate-spin text-[var(--tycoon-accent)]"
                  />
                  <span>Transaction pending...</span>
                </>
              )}
              {latest.phase === "confirmed" && (
                <span className="text-emerald-400/90">Confirmed</span>
              )}
              {latest.phase === "failed" && (
                <span className="text-red-400/90">Failed</span>
              )}
              <span className="font-mono text-[var(--tycoon-text)]/60">
                {latest.methodName}
              </span>
            </div>
            {/* SW-FE-034: errorMessage is string | undefined — guard with !== undefined */}
            {latest.errorMessage !== undefined && (
              <span className="text-[10px] text-red-400/90">
                {latest.errorMessage}
              </span>
            )}
            {/* SW-FE-034: both hash and explorerUrl must be non-nullish strings */}
            {latest.hash != null && latest.explorerUrl != null && (
              <a
                href={latest.explorerUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`View transaction ${latest.hash} on NEAR explorer (opens in new tab)`}
                className="inline-flex items-center gap-1 text-[10px] text-[var(--tycoon-accent)] hover:underline focus:outline-none focus:ring-2 focus:ring-[var(--tycoon-accent)] focus:ring-offset-1"
              >
                View on explorer
                <ExternalLink aria-hidden="true" className="h-3 w-3" />
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
  const panel = variant === "panel";
  const { ready, initError, accountId, connect, disconnect, transactions } =
    useNearWallet();

  // SW-FE-033: stable id for aria-describedby on the error banner
  const errorId = useId();
  const statusId = useId();

  const latest = transactions[0];
  const showLoadingState = !ready && !initError;
  const showEmptyState = ready && !initError && !accountId;

  return (
    <div
      className={cn(
        "flex flex-col gap-1",
        panel ? "items-stretch text-left" : "items-end text-right",
        className,
      )}
    >
      {/* SW-FE-033: role="alert" is already set; add id so buttons can
          reference it via aria-describedby when present */}
      {initError && (
        <div
          id={errorId}
          role="alert"
          className={cn(
            "flex max-w-[240px] items-start gap-2 rounded-lg border border-red-400/30 bg-red-400/10 px-3 py-2 text-left text-[10px] font-dm-sans text-red-200",
            panel ? "self-start" : "self-end",
          )}
        >
          <AlertCircle
            aria-hidden="true"
            className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-300"
          />
          <span className="leading-relaxed">{initError}</span>
        </div>
      )}

      {/* min-h reserves the button row height so surrounding layout does not
          shift when the wallet transitions between ready/not-ready states. */}
      <div
        className={cn(
          "flex min-h-[28px] flex-wrap items-center gap-2",
          panel ? "justify-start" : "justify-end",
        )}
      >
        {accountId ? (
          <>
            {/* SW-FE-033: aria-label carries the full untruncated account id */}
            <span
              className="inline-flex items-center gap-1.5 rounded-full border border-[var(--tycoon-border)] bg-[var(--tycoon-card-bg)] px-3 py-1 text-[11px] font-dm-sans text-[var(--tycoon-text)]"
              title={accountId}
              aria-label={`Connected as ${accountId}`}
            >
              <Wallet
                aria-hidden="true"
                className="h-3.5 w-3.5 text-[var(--tycoon-accent)]"
              />
              {/* aria-hidden: screen readers get the full id from the parent aria-label */}
              <span className="font-mono" aria-hidden="true">
                {truncateAccount(accountId)}
              </span>
            </span>
            <button
              type="button"
              onClick={() => {
                void disconnect();
              }}
              aria-label={`Disconnect NEAR wallet ${accountId}`}
              className="rounded-full border border-[var(--tycoon-border)] bg-transparent px-3 py-1 text-[11px] font-dm-sans text-[var(--tycoon-text)]/80 transition-colors hover:text-[var(--tycoon-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--tycoon-accent)] focus:ring-offset-2"
            >
              Disconnect NEAR
            </button>
          </>
        ) : (
          // SW-FE-033: aria-describedby references the error banner when visible
          <button
            type="button"
            onClick={connect}
            disabled={!ready}
            aria-describedby={initError ? errorId : undefined}
            className="inline-flex items-center gap-1.5 rounded-full border border-[var(--tycoon-border)] bg-[var(--tycoon-card-bg)] px-3 py-1.5 text-[11px] font-dm-sans font-medium text-[var(--tycoon-text)] transition-colors hover:bg-[var(--tycoon-accent)] hover:text-[#010F10] disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-[var(--tycoon-accent)] focus:ring-offset-2"
          >
            <Wallet aria-hidden="true" className="h-3.5 w-3.5" />
            Connect NEAR
          </button>
        )}
      </div>

      {showLoadingState && (
        <div
          data-testid="near-wallet-loading-state"
          role="status"
          aria-live="polite"
          className={cn(
            "flex max-w-[240px] items-start gap-2 rounded-lg border border-[var(--tycoon-border)]/80 bg-[var(--tycoon-card-bg)]/70 px-3 py-2 text-left text-[10px] font-dm-sans text-[var(--tycoon-text)]/70",
            panel ? "self-start" : "self-end",
          )}
        >
          <Loader2
            aria-hidden="true"
            className="mt-0.5 h-3.5 w-3.5 shrink-0 animate-spin text-[var(--tycoon-accent)]"
          />
          <span className="leading-relaxed">
            Preparing NEAR wallet support...
          </span>
        </div>
      )}

      {showEmptyState && (
        <div
          data-testid="near-wallet-empty-state"
          className={cn(
            "flex max-w-[240px] items-start gap-2 rounded-lg border border-[var(--tycoon-border)]/80 bg-[var(--tycoon-card-bg)]/70 px-3 py-2 text-left text-[10px] font-dm-sans text-[var(--tycoon-text)]/70",
            panel ? "self-start" : "self-end",
          )}
        >
          <Wallet
            aria-hidden="true"
            className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--tycoon-accent)]"
          />
          <span className="leading-relaxed">
            No NEAR wallet connected yet. Connect to sign in and submit
            transactions.
          </span>
        </div>
      )}

      {/* aria-live="polite" announces transaction status changes without
          interrupting the user. role="status" is implied by aria-live but
          explicit here for clarity. min-h prevents CLS. */}
      <div
        id={statusId}
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className={cn("min-h-[28px]", panel ? "items-start" : "items-end")}
      >
        {latest && (
          <div
            className={cn(
              "flex max-w-[280px] flex-col gap-0.5 rounded-lg border border-[var(--tycoon-border)]/80 bg-[#010F10]/80 px-2 py-1.5",
              panel ? "items-start" : "items-end",
            )}
          >
            <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-dm-sans text-[var(--tycoon-text)]/80">
              {latest.phase === "pending" && (
                <>
                  <Loader2
                    aria-hidden="true"
                    className="h-3 w-3 animate-spin text-[var(--tycoon-accent)]"
                  />
                  <span>Transaction pending...</span>
                </>
              )}
              {latest.phase === "confirmed" && (
                <span className="text-emerald-400/90">Confirmed</span>
              )}
              {latest.phase === "failed" && (
                <span className="text-red-400/90">Failed</span>
              )}
              <span className="font-mono text-[var(--tycoon-text)]/60">
                {latest.methodName}
              </span>
            </div>
            {latest.errorMessage && (
              <span className="text-[10px] text-red-400/90">
                {latest.errorMessage}
              </span>
            )}
            {latest.hash && latest.explorerUrl && (
              <a
                href={latest.explorerUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`View transaction ${latest.hash} on NEAR explorer (opens in new tab)`}
                className="inline-flex items-center gap-1 text-[10px] text-[var(--tycoon-accent)] hover:underline focus:outline-none focus:ring-2 focus:ring-[var(--tycoon-accent)] focus:ring-offset-1"
              >
                View on explorer
                <ExternalLink aria-hidden="true" className="h-3 w-3" />
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
