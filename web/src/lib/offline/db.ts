/**
 * Motor IndexedDB Local para QuickCash PWA.
 * Proporciona almacenamiento persistente offline sin dependencias externas.
 */

export const DB_NAME = 'quickcash_offline';
export const DB_VERSION = 1;

export const STORES = {
  ROUTE_CACHE: 'route_cache',
  PENDING_TRANSACTIONS: 'pending_transactions',
} as const;

let dbPromise: Promise<IDBDatabase> | null = null;

export function isIndexedDBAvailable(): boolean {
  return typeof window !== 'undefined' && 'indexedDB' in window;
}

export function openOfflineDB(): Promise<IDBDatabase> {
  if (!isIndexedDBAvailable()) {
    return Promise.reject(new Error('IndexedDB no está disponible en este entorno.'));
  }

  if (dbPromise) {
    return dbPromise;
  }

  dbPromise = new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // 1. Store para la ruta completa de cobranza
      if (!db.objectStoreNames.contains(STORES.ROUTE_CACHE)) {
        db.createObjectStore(STORES.ROUTE_CACHE, { keyPath: 'key' });
      }

      // 2. Store para la cola de pagos/novedades pendientes de sincronización
      if (!db.objectStoreNames.contains(STORES.PENDING_TRANSACTIONS)) {
        const txStore = db.createObjectStore(STORES.PENDING_TRANSACTIONS, { keyPath: 'localId' });
        txStore.createIndex('synced', 'synced', { unique: false });
        txStore.createIndex('timestamp', 'timestamp', { unique: false });
      }
    };

    request.onsuccess = (event: Event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      db.onversionchange = () => {
        db.close();
        dbPromise = null;
      };

      resolve(db);
    };

    request.onerror = (event: Event) => {
      dbPromise = null;
      const error = (event.target as IDBOpenDBRequest).error;
      reject(error || new Error('Error al abrir la base de datos offline.'));
    };

    request.onblocked = () => {
      console.warn('⚠️ Base de datos IndexedDB bloqueada por otra pestaña.');
    };
  });

  return dbPromise;
}
