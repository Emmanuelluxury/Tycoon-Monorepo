'use client';

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { PurchaseModal } from '@/components/ui/purchase-modal';
import { toast } from 'react-toastify';
import { ShopGrid } from '@/components/game/ShopGrid';
import type { ShopItemData } from '@/components/game/ShopItem';
import { sanitizeError } from '@/lib/errors/types';

interface ShopItem {
  id: number;
  name: string;
  description: string;
  type: 'skin' | 'board' | 'dice' | 'symbol' | 'theme' | 'card';
  price: string;
  currency: string;
  rarity: string;
  image_url?: string;
  is_owned?: boolean;
  stock_quantity?: number;
}

export function Marketplace() {
  const { t } = useTranslation('common');
  const [items, setItems] = useState<ShopItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>('all');
  const [selectedItem, setSelectedItem] = useState<ShopItem | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const fetchItems = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const typeParam = filter !== 'all' ? `&type=${filter}` : '';
      const response = await fetch(`/api/shop/items?page=1&limit=20${typeParam}`);
      if (!response.ok) {
        const err = new Error(`Failed to fetch items (${response.status})`);
        (err as Error & { status?: number }).status = response.status;
        throw err;
      }
      const result = await response.json();
      const data = result?.data;
      if (!Array.isArray(data)) {
        throw new Error('Invalid shop response');
      }
      setItems(data);
    } catch (err) {
      console.error('Error fetching items:', err);
      const sanitized = sanitizeError(err);
      setError(sanitized.userMessage);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  React.useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const handlePurchaseClick = (itemId: string) => {
    const item = items.find((i) => String(i.id) === itemId);
    if (!item || item.is_owned) return;
    setSelectedItem(item);
    setIsModalOpen(true);
  };

  const gridItems: ShopItemData[] = items.map((item) => ({
    id: item.id,
    name: item.name,
    description: item.description,
    price: item.price,
    type: item.type,
    currency: item.currency,
    rarity: item.rarity,
    disabled:
      item.is_owned ||
      (item.stock_quantity !== undefined && item.stock_quantity <= 0),
  }));

  const handleConfirmPurchase = async () => {
    if (!selectedItem) return;

    // Generate a unique idempotency key for this purchase attempt
    const idempotencyKey = crypto.randomUUID();
    
    // Capture previous state for rollback
    const previousItems = [...items];
    
    // Optimistically update the UI
    setItems(items.map(item => 
      item.id === selectedItem.id ? { ...item, is_owned: true } : item
    ));
    setIsModalOpen(false);

    try {
      const response = await fetch('/api/shop/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          shop_item_id: selectedItem.id, 
          quantity: 1,
          idempotency_key: idempotencyKey 
        }),
      });

      if (!response.ok) {
        let errorMessage = 'Purchase failed';
        try {
          const errorData = await response.json();
          errorMessage = errorData.message || errorMessage;
          
          // Specific conflict handling
          if (response.status === 409) {
            errorMessage = `Conflict: ${errorMessage}`;
          }
        } catch (e) {
          // If JSON parsing fails, use status text
          errorMessage = response.statusText || errorMessage;
        }
        throw new Error(errorMessage);
      }

      toast.success(`${selectedItem.name} purchased successfully!`, {
        position: "top-center",
        autoClose: 3000,
        theme: "dark",
      });
      
      // Full reconciliation with server state
      fetchItems(); 
    } catch (error) {
      const message = error instanceof Error ? error.message : 'An unknown error occurred';
      
      // Rollback on failure: Revert to the previous items state
      setItems(previousItems);
      
      toast.error(message, {
        position: "top-center",
        autoClose: 5000,
        theme: "dark",
      });
      
      // Re-fetch items just in case the optimistic update left the UI in an inconsistent state
      // even after manual rollback
      fetchItems();
    }
  };

  const filters = [
    { id: 'all', label: t('shop.filter_all') },
    { id: 'skin', label: t('shop.filter_skins') },
    { id: 'board', label: t('shop.filter_boards') },
  ];

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8 flex flex-col items-center justify-between gap-4 md:flex-row">
        <h1 className="text-3xl font-bold tracking-tight text-white">{t('shop.title')}</h1>
        <div className="flex gap-2">
          {filters.map((f) => (
            <Button
              key={f.id}
              variant={filter === f.id ? 'default' : 'outline'}
              aria-current={filter === f.id ? 'page' : undefined}
              onClick={() => setFilter(f.id)}
              className={filter === f.id ? 'bg-cyan-500 text-black' : 'border-neutral-800 text-neutral-400'}
            >
              {f.label}
            </Button>
          ))}
        </div>
      </div>

      <ShopGrid
        items={gridItems}
        isLoading={loading}
        error={error}
        onRetry={fetchItems}
        onPurchase={handlePurchaseClick}
        columns={4}
        telemetrySource="game_overlay"
      />

      {selectedItem && (
        <PurchaseModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onConfirm={handleConfirmPurchase}
          itemName={selectedItem.name}
          itemPrice={selectedItem.price}
          itemCurrency={selectedItem.currency}
        />
      )}
    </div>
  );
}
