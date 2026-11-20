import { openOfflineDB, STORES, isIndexedDBAvailable } from './db';

export interface OfflineTransaction {
  localId: string;
  paymentId: string;
  tenantId: string;
  collectorId: string;
  amountPaid: number;
  status: string; // 'paid' | 'partial' | 'missed'
  latitude?: number;
  longitude?: number;
  timestamp: string;
  synced: boolean;
}

export interface OfflineRouteCache<T = any> {
  key: string;
  data: T;
  updatedAt: string;
}

const CURRENT_ROUTE_KEY = 'current_route';

/**
 * Guarda la ruta activa y sus clientes en caché local IndexedDB.
 */
export async function saveRouteOffline<T = any>(routeData: T): Promise<void> {
  if (!isIndexedDBAvailable()) return;

  const db = await openOfflineDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.ROUTE_CACHE, 'readwrite');
    const store = tx.objectStore(STORES.ROUTE_CACHE);

    const record: OfflineRouteCache<T> = {
      key: CURRENT_ROUTE_KEY,
      data: routeData,
      updatedAt: new Date().toISOString(),
    };

    const request = store.put(record);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error || new Error('Error al guardar ruta offline.'));
  });
}

/**
 * Obtiene la última ruta cacheada localmente.
 */
export async function getOfflineRoute<T = any>(): Promise<T | null> {
  if (!isIndexedDBAvailable()) return null;

  try {
    const db = await openOfflineDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.ROUTE_CACHE, 'readonly');
      const store = tx.objectStore(STORES.ROUTE_CACHE);
      const request = store.get(CURRENT_ROUTE_KEY);

      request.onsuccess = () => {
        const result = request.result as OfflineRouteCache<T> | undefined;
        resolve(result ? result.data : null);
      };

      request.onerror = () => reject(request.error || new Error('Error al obtener ruta offline.'));
    });
  } catch (err) {
    console.warn('No se pudo recuperar la ruta offline:', err);
    return null;
  }
}

/**
 * Agrega un cobro o novedad a la cola de transacciones offline.
 */
export async function queueOfflineTransaction(
  txData: Omit<OfflineTransaction, 'synced'> & { synced?: boolean }
): Promise<OfflineTransaction> {
  if (!isIndexedDBAvailable()) {
    throw new Error('IndexedDB no está disponible para encolar transacciones.');
  }

  const transactionRecord: OfflineTransaction = {
    ...txData,
    localId: txData.localId || `tx_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    synced: txData.synced ?? false,
    timestamp: txData.timestamp || new Date().toISOString(),
  };

  const db = await openOfflineDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.PENDING_TRANSACTIONS, 'readwrite');
    const store = tx.objectStore(STORES.PENDING_TRANSACTIONS);
    const request = store.put(transactionRecord);

    request.onsuccess = () => resolve(transactionRecord);
    request.onerror = () => reject(request.error || new Error('Error al guardar transacción en cola.'));
  });
}

/**
 * Obtiene todas las transacciones pendientes por sincronizar (synced === false).
 */
export async function getPendingTransactions(): Promise<OfflineTransaction[]> {
  if (!isIndexedDBAvailable()) return [];

  try {
    const db = await openOfflineDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.PENDING_TRANSACTIONS, 'readonly');
      const store = tx.objectStore(STORES.PENDING_TRANSACTIONS);
      const request = store.getAll();

      request.onsuccess = () => {
        const all = (request.result as OfflineTransaction[]) || [];
        // Filtra pendientes de sincronización
        const pending = all.filter((item) => !item.synced);
        resolve(pending);
      };

      request.onerror = () => reject(request.error || new Error('Error al obtener transacciones pendientes.'));
    });
  } catch (err) {
    console.warn('Error al leer transacciones pendientes:', err);
    return [];
  }
}

/**
 * Marca una lista de transacciones como sincronizadas con el servidor.
 */
export async function markTransactionsSynced(localIds: string[]): Promise<void> {
  if (!isIndexedDBAvailable() || localIds.length === 0) return;

  const db = await openOfflineDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.PENDING_TRANSACTIONS, 'readwrite');
    const store = tx.objectStore(STORES.PENDING_TRANSACTIONS);

    let completed = 0;
    let hasError = false;

    localIds.forEach((id) => {
      const getReq = store.get(id);
      getReq.onsuccess = () => {
        const record = getReq.result as OfflineTransaction | undefined;
        if (record) {
          record.synced = true;
          store.put(record);
        }
        completed++;
        if (completed === localIds.length && !hasError) {
          resolve();
        }
      };
      getReq.onerror = (e) => {
        hasError = true;
        reject(getReq.error || new Error(`Error al actualizar transacción ${id}`));
      };
    });
  });
}

/**
 * Purga de la base de datos local aquellas transacciones que ya fueron sincronizadas.
 */
export async function removeSyncedTransactions(): Promise<number> {
  if (!isIndexedDBAvailable()) return 0;

  const db = await openOfflineDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.PENDING_TRANSACTIONS, 'readwrite');
    const store = tx.objectStore(STORES.PENDING_TRANSACTIONS);
    const getAllReq = store.getAll();

    getAllReq.onsuccess = () => {
      const records = (getAllReq.result as OfflineTransaction[]) || [];
      const syncedRecords = records.filter((r) => r.synced);

      let deletedCount = 0;
      syncedRecords.forEach((r) => {
        store.delete(r.localId);
        deletedCount++;
      });

      tx.oncomplete = () => resolve(deletedCount);
      tx.onerror = () => reject(tx.error || new Error('Error al eliminar transacciones sincronizadas.'));
    };

    getAllReq.onerror = () => reject(getAllReq.error);
  });
}

/**
 * Limpia la caché local de la ruta.
 */
export async function clearOfflineRoute(): Promise<void> {
  if (!isIndexedDBAvailable()) return;

  const db = await openOfflineDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.ROUTE_CACHE, 'readwrite');
    const store = tx.objectStore(STORES.ROUTE_CACHE);
    const req = store.delete(CURRENT_ROUTE_KEY);

    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}
