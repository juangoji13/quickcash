'use client';

/* ============================================
 * QuickCash — useOfflineSync Hook
 * Hook reactivo para sincronización offline-first
 * con IndexedDB y sincronización automática en background
 * ============================================ */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  getPendingTransactions,
  queueOfflineTransaction,
  markTransactionsSynced,
  removeSyncedTransactions,
  type OfflineTransaction,
} from '@/lib/offline';

export interface UseOfflineSyncReturn {
  isOnline: boolean;
  pendingCount: number;
  isSyncing: boolean;
  lastSyncTime: string | null;
  syncNow: () => Promise<{ success: boolean; syncedCount: number; error?: string }>;
  recordOfflinePayment: (params: {
    paymentId: string;
    tenantId: string;
    collectorId: string;
    amountPaid: number;
    status: string;
    latitude?: number;
    longitude?: number;
    timestamp?: string;
  }) => Promise<OfflineTransaction>;
  refreshPendingCount: () => Promise<number>;
}

export function useOfflineSync(): UseOfflineSyncReturn {
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);

  // Evitar ejecuciones simultáneas de sincronización
  const syncingRef = useRef(false);

  // Consulta el total de transacciones pendientes en IndexedDB
  const refreshPendingCount = useCallback(async (): Promise<number> => {
    try {
      const pending = await getPendingTransactions();
      const count = pending.length;
      setPendingCount(count);
      return count;
    } catch (err) {
      console.warn('Error al verificar transacciones pendientes:', err);
      return 0;
    }
  }, []);

  // Función principal de sincronización contra el endpoint POST /api/v1/sync/route-transactions
  const syncNow = useCallback(async (): Promise<{
    success: boolean;
    syncedCount: number;
    error?: string;
  }> => {
    if (syncingRef.current) {
      return { success: false, syncedCount: 0, error: 'Sincronización en curso' };
    }

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      return { success: false, syncedCount: 0, error: 'Sin conexión a internet' };
    }

    syncingRef.current = true;
    setIsSyncing(true);

    try {
      const pending = await getPendingTransactions();

      if (pending.length === 0) {
        setPendingCount(0);
        setIsSyncing(false);
        syncingRef.current = false;
        return { success: true, syncedCount: 0 };
      }

      // Estructurar el payload por lote
      const payload = {
        transactions: pending.map((tx) => ({
          localId: tx.localId,
          paymentId: tx.paymentId,
          amountPaid: tx.amountPaid,
          status: tx.status,
          latitude: tx.latitude,
          longitude: tx.longitude,
          timestamp: tx.timestamp,
        })),
      };

      const response = await fetch('/api/v1/sync/route-transactions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `Error HTTP ${response.status}`);
      }

      const result = await response.json();
      const syncedIds: string[] = result.syncedIds || [];

      if (syncedIds.length > 0) {
        await markTransactionsSynced(syncedIds);
        await removeSyncedTransactions();
      }

      const remaining = await refreshPendingCount();
      const nowStr = new Date().toLocaleTimeString('es-CO', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
      setLastSyncTime(nowStr);

      return {
        success: true,
        syncedCount: syncedIds.length,
      };
    } catch (err: any) {
      console.warn('⚠️ Error durante la sincronización offline:', err);
      return {
        success: false,
        syncedCount: 0,
        error: err.message || 'Error desconocido de sincronización',
      };
    } finally {
      setIsSyncing(false);
      syncingRef.current = false;
    }
  }, [refreshPendingCount]);

  // Encola una transacción en IndexedDB para procesamiento offline
  const recordOfflinePayment = useCallback(
    async (params: {
      paymentId: string;
      tenantId: string;
      collectorId: string;
      amountPaid: number;
      status: string;
      latitude?: number;
      longitude?: number;
      timestamp?: string;
    }): Promise<OfflineTransaction> => {
      const tx = await queueOfflineTransaction({
        localId: `tx_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        paymentId: params.paymentId,
        tenantId: params.tenantId,
        collectorId: params.collectorId,
        amountPaid: params.amountPaid,
        status: params.status,
        latitude: params.latitude,
        longitude: params.longitude,
        timestamp: params.timestamp || new Date().toISOString(),
      });

      await refreshPendingCount();

      // Si estamos en línea, intentar sincronizar inmediatamente en segundo plano
      if (typeof navigator !== 'undefined' && navigator.onLine) {
        syncNow().catch((e) => console.warn('Background sync deferred:', e));
      }

      return tx;
    },
    [refreshPendingCount, syncNow]
  );

  // Escucha de eventos de red y chequeo inicial
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      // Auto-sync automático en segundo plano al recuperar conexión
      syncNow().catch(() => {});
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Revisión inicial de pendientes
    refreshPendingCount().then((count) => {
      if (count > 0 && typeof navigator !== 'undefined' && navigator.onLine) {
        syncNow().catch(() => {});
      }
    });

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [refreshPendingCount, syncNow]);

  return {
    isOnline,
    pendingCount,
    isSyncing,
    lastSyncTime,
    syncNow,
    recordOfflinePayment,
    refreshPendingCount,
  };
}

export default useOfflineSync;
