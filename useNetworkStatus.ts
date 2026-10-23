import { useState, useEffect, useCallback } from 'react';
import { getQueuedOfflineActions, clearQueuedOfflineAction, QueuedOfflineAction } from '../lib/offlineDb';
import { api } from '../lib/api';

export function useNetworkStatus(onSynced?: () => void) {
  const [isOnline, setIsOnline] = useState<boolean>(() => {
    return typeof navigator !== 'undefined' ? navigator.onLine : true;
  });
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [syncedBannerMessage, setSyncedBannerMessage] = useState<string | null>(null);
  const [queuedCount, setQueuedCount] = useState<number>(0);

  const checkQueueCount = useCallback(async () => {
    try {
      const queue = await getQueuedOfflineActions();
      setQueuedCount(queue.length);
    } catch (e) {
      // Ignore
    }
  }, []);

  const syncQueue = useCallback(async () => {
    if (!navigator.onLine) return;
    try {
      const queue = await getQueuedOfflineActions();
      if (queue.length === 0) return;

      setIsSyncing(true);
      let syncedCount = 0;

      // Process queued actions sequentially with last-write-wins
      for (const item of queue) {
        try {
          if (item.type === 'ADD_EXPENSE') {
            await api.addExpense(item.trip_id, item.payload);
            syncedCount++;
          }
          if (item.id !== undefined) {
            await clearQueuedOfflineAction(item.id);
          }
        } catch (itemErr) {
          console.warn('Failed to sync item, will retry on next connection:', itemErr);
        }
      }

      setLastSyncedAt(new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      setSyncedBannerMessage(`Synced! Successfully uploaded ${syncedCount} offline change(s) to the server.`);

      setTimeout(() => {
        setSyncedBannerMessage(null);
      }, 5000);

      if (onSynced) onSynced();
      await checkQueueCount();
    } catch (err) {
      console.warn('Background sync error:', err);
    } finally {
      setIsSyncing(false);
    }
  }, [checkQueueCount, onSynced]);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      syncQueue();
    };

    const handleOffline = () => {
      setIsOnline(false);
      checkQueueCount();
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial check
    checkQueueCount();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [syncQueue, checkQueueCount]);

  return {
    isOnline,
    isSyncing,
    lastSyncedAt,
    syncedBannerMessage,
    queuedCount,
    syncQueue,
    refreshQueueCount: checkQueueCount,
  };
}
