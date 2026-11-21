'use client';

/* ============================================
 * QuickCash — Mobile Collector Route View
 * Vista Móvil de Calle PWA para Cobradores
 * Optimizado para uso a una sola mano (Thumb-Zone)
 * ============================================ */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useAuth, useOfflineSync } from '@/hooks';
import {
  getCollectionRoutes,
  getRouteActiveChecklist,
  closeRouteRecord,
} from '@/services/collection-routes.service';
import { registerPayment } from '@/services/loans.service';
import { saveRouteOffline, getOfflineRoute } from '@/lib/offline';
import { formatCurrency } from '@/lib/utils';
import { TouchNumpadModal } from '@/components/ui/TouchNumpad';
import { ConfirmModal, AlertModal } from '@/components/ui/Modal';
import type { CollectionRouteWithDetails } from '@/types';
import styles from './collector-route.module.css';

interface ChecklistItem {
  client_id: string;
  client_name: string;
  document_id: string;
  phone: string | null;
  address: string | null;
  risk_status: 'green' | 'yellow' | 'red';
  loan_id: string;
  payment_id: string;
  expectedQuota: number;
  balance: number;
  dueDate: string;
  installment_number: number;
}

interface ProcessedRecord {
  status: 'paid' | 'partial' | 'missed';
  amountPaid: number;
  reason?: string;
  time: string;
}

const MISSED_REASONS = [
  'Negocio / Domicilio cerrado',
  'Cliente ausente',
  'Promesa para más tarde',
  'Sin fondos / Iliquidez',
  'Rechazó pagar',
];

export default function CollectorRoutePage() {
  const { appUser } = useAuth();
  const { isOnline, pendingCount, isSyncing, syncNow, recordOfflinePayment } = useOfflineSync();

  // Estados de datos
  const [routes, setRoutes] = useState<CollectionRouteWithDetails[]>([]);
  const [selectedRoute, setSelectedRoute] = useState<CollectionRouteWithDetails | null>(null);
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Navegación de pestañas: Pendientes, Cobrados, Novedades
  const [activeTab, setActiveTab] = useState<'pending' | 'collected' | 'incidents'>('pending');

  // Filtros Rápidos y Búsqueda en Ruta Móvil (Sprint Prioridad 1)
  const [routeSearch, setRouteSearch] = useState('');
  const [routeRiskFilter, setRouteRiskFilter] = useState<'all' | 'red' | 'yellow' | 'green'>('all');

  // Cliente actualmente enfocado para la Thumb-Zone
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);

  // Registro en memoria de cobros efectuados en la jornada
  const [processedMap, setProcessedMap] = useState<Record<string, ProcessedRecord>>({});
  const [todayCollected, setTodayCollected] = useState(0);

  // Modales
  const [numpadItem, setNumpadItem] = useState<ChecklistItem | null>(null);
  const [missedItem, setMissedItem] = useState<ChecklistItem | null>(null);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [closingRoute, setClosingRoute] = useState(false);
  const [alertError, setAlertError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Estados de Cierre de Jornada y Arqueo (Sprint 4)
  const [isShiftClosed, setIsShiftClosed] = useState(false);
  const [shiftNotes, setShiftNotes] = useState('');
  const [viewClosedReceipt, setViewClosedReceipt] = useState(false);
  const [closedSummary, setClosedSummary] = useState<{
    totalClients: number;
    collectedCount: number;
    incidentCount: number;
    pendingCount: number;
    totalCollected: number;
    totalExpected: number;
    closedAt: string;
    notes?: string;
  } | null>(null);

  // Haptic Feedback (vibración para uso en calle)
  const triggerHaptic = useCallback((pattern: number | number[] = [60, 40, 60]) => {
    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(pattern);
      } catch {
        // Ignorar si no está disponible
      }
    }
  }, []);

  // Notificación Toast temporal
  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => {
      setToast(null);
    }, 2800);
  }, []);

  // Auditoría GPS Silenciosa
  const getGPSCoordinates = useCallback(async (): Promise<{ latitude?: number; longitude?: number }> => {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      return {};
    }
    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
        (err) => {
          console.warn('GPS capture bypassed:', err.message);
          resolve({});
        },
        { enableHighAccuracy: true, timeout: 4000, maximumAge: 30000 }
      );
    });
  }, []);

  // 1. Cargar rutas del cobrador / tenant
  const loadRoutes = useCallback(async () => {
    if (!appUser?.tenant_id) return;
    setLoading(true);
    try {
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        const cached = await getOfflineRoute<any>();
        if (cached?.routes) {
          setRoutes(cached.routes);
          setSelectedRoute(cached.selectedRoute || cached.routes[0] || null);
          if (cached.checklist) setChecklist(cached.checklist);
          if (cached.todayCollected) setTodayCollected(cached.todayCollected);
          setLoading(false);
          return;
        }
      }

      const allRoutes = await getCollectionRoutes(appUser.tenant_id);
      setRoutes(allRoutes);

      // Si el usuario es cobrador, asignar preferentemente su ruta
      let current = allRoutes.find((r) => r.collector_id === appUser.id);
      if (!current && allRoutes.length > 0) {
        current = allRoutes[0];
      }
      setSelectedRoute(current || null);
    } catch (err: any) {
      console.warn('Error loading routes, attempting offline cache:', err);
      const cached = await getOfflineRoute<any>();
      if (cached?.routes) {
        setRoutes(cached.routes);
        setSelectedRoute(cached.selectedRoute || cached.routes[0] || null);
        if (cached.checklist) setChecklist(cached.checklist);
        if (cached.todayCollected) setTodayCollected(cached.todayCollected);
        showToast('⚡ Datos cargados desde caché offline');
      } else {
        setAlertError('Error al cargar rutas de cobro.');
      }
    } finally {
      setLoading(false);
    }
  }, [appUser, showToast]);

  useEffect(() => {
    loadRoutes();
  }, [loadRoutes]);

  // 2. Cargar checklist de la ruta seleccionada
  const loadChecklist = useCallback(async (routeId: string) => {
    if (!appUser?.tenant_id) return;
    try {
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        const cached = await getOfflineRoute<any>();
        if (cached?.checklist && cached.checklist.length > 0) {
          setChecklist(cached.checklist);
          setSelectedClientId((prev) => prev || cached.checklist[0].client_id);
          return;
        }
      }

      const items = await getRouteActiveChecklist(routeId, appUser.tenant_id);
      const typedItems = items as ChecklistItem[];
      setChecklist(typedItems);

      // Inicializar el primer cliente como seleccionado por defecto
      if (typedItems.length > 0) {
        setSelectedClientId((prev) => prev || typedItems[0].client_id);
      }

      // Guardar en caché offline IndexedDB
      saveRouteOffline({
        routes,
        selectedRoute,
        checklist: typedItems,
        todayCollected: selectedRoute?.total_collected_today || 0,
      }).catch((e) => console.warn('Cache save deferred:', e));
    } catch (err: any) {
      console.warn('Error loading checklist, using offline cache:', err);
      const cached = await getOfflineRoute<any>();
      if (cached?.checklist && cached.checklist.length > 0) {
        setChecklist(cached.checklist);
        setSelectedClientId((prev) => prev || cached.checklist[0].client_id);
      }
    }
  }, [appUser?.tenant_id, routes, selectedRoute]);

  useEffect(() => {
    if (selectedRoute) {
      loadChecklist(selectedRoute.id);
      setTodayCollected(selectedRoute.total_collected_today || 0);
    }
  }, [selectedRoute, loadChecklist]);

  // Clasificación de clientes según pestañas
  const pendingClients = useMemo(() => {
    return checklist.filter((c) => !processedMap[c.payment_id]);
  }, [checklist, processedMap]);

  const collectedClients = useMemo(() => {
    return checklist.filter(
      (c) =>
        processedMap[c.payment_id] &&
        (processedMap[c.payment_id].status === 'paid' ||
          processedMap[c.payment_id].status === 'partial')
    );
  }, [checklist, processedMap]);

  const incidentClients = useMemo(() => {
    return checklist.filter(
      (c) => processedMap[c.payment_id]?.status === 'missed'
    );
  }, [checklist, processedMap]);

  // Filtro compuesto por búsqueda y semáforo de riesgo
  const filterList = useCallback((list: ChecklistItem[]) => {
    let result = list;

    if (routeRiskFilter !== 'all') {
      result = result.filter((item) => item.risk_status === routeRiskFilter);
    }

    if (routeSearch.trim()) {
      const q = routeSearch.toLowerCase().trim();
      result = result.filter((item) =>
        item.client_name.toLowerCase().includes(q) ||
        item.document_id.includes(q) ||
        (item.address && item.address.toLowerCase().includes(q)) ||
        (item.phone && item.phone.includes(q))
      );
    }

    return result;
  }, [routeRiskFilter, routeSearch]);

  const displayedPendingClients = useMemo(() => filterList(pendingClients), [filterList, pendingClients]);
  const displayedCollectedClients = useMemo(() => filterList(collectedClients), [filterList, collectedClients]);
  const displayedIncidentClients = useMemo(() => filterList(incidentClients), [filterList, incidentClients]);

  const pendingRiskCounts = useMemo(() => ({
    all: pendingClients.length,
    red: pendingClients.filter((c) => c.risk_status === 'red').length,
    yellow: pendingClients.filter((c) => c.risk_status === 'yellow').length,
    green: pendingClients.filter((c) => c.risk_status === 'green').length,
  }), [pendingClients]);

  // Selección automática del siguiente cliente pendiente
  const advanceToNextPending = useCallback(
    (currentId: string) => {
      const remaining = pendingClients.filter((c) => c.client_id !== currentId);
      if (remaining.length > 0) {
        setSelectedClientId(remaining[0].client_id);
      } else {
        setSelectedClientId(null);
      }
    },
    [pendingClients]
  );

  // Cliente activo para la Thumb-Zone inferior
  const activeTarget = useMemo(() => {
    if (!selectedClientId) return pendingClients[0] || null;
    return checklist.find((c) => c.client_id === selectedClientId) || pendingClients[0] || null;
  }, [selectedClientId, checklist, pendingClients]);

  // Total cuotas esperadas en la ruta
  const totalExpectedSum = useMemo(() => {
    return checklist.reduce((sum, item) => sum + (item.expectedQuota || 0), 0);
  }, [checklist]);

  // Progreso general
  const progressText = `${collectedClients.length + incidentClients.length} de ${checklist.length}`;
  const progressPercent = checklist.length > 0
    ? Math.round(((collectedClients.length + incidentClients.length) / checklist.length) * 100)
    : 0;

  /* ---- ACCIÓN 1: 🟢 COBRO COMPLETO (1-TAP) ---- */
  const handleFullPayment = async () => {
    if (!activeTarget || !appUser || isSubmitting) return;

    setIsSubmitting(true);
    triggerHaptic([60, 40, 60]);

    const amount = activeTarget.expectedQuota;

    try {
      const gps = await getGPSCoordinates();

      // Si no hay conexión, almacenar en IndexedDB de inmediato
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        await recordOfflinePayment({
          paymentId: activeTarget.payment_id,
          tenantId: appUser.tenant_id,
          collectorId: appUser.id,
          amountPaid: amount,
          status: 'paid',
          latitude: gps.latitude,
          longitude: gps.longitude,
        });

        setProcessedMap((prev) => ({
          ...prev,
          [activeTarget.payment_id]: {
            status: 'paid',
            amountPaid: amount,
            time: new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }),
          },
        }));

        setTodayCollected((prev) => prev + amount);
        showToast(`⚡ Cobro guardado en cola offline: ${formatCurrency(amount)}`);
        advanceToNextPending(activeTarget.client_id);
        setIsSubmitting(false);
        return;
      }

      // En línea: registrar en servidor con fallback a cola local
      const res = await registerPayment(
        activeTarget.payment_id,
        appUser.tenant_id,
        amount,
        gps.latitude,
        gps.longitude
      );

      if (!res.success) {
        await recordOfflinePayment({
          paymentId: activeTarget.payment_id,
          tenantId: appUser.tenant_id,
          collectorId: appUser.id,
          amountPaid: amount,
          status: 'paid',
          latitude: gps.latitude,
          longitude: gps.longitude,
        });
        showToast(`⚡ Guardado en cola local: ${formatCurrency(amount)}`);
      } else {
        showToast(`✅ Cobro completo: ${formatCurrency(amount)}`);
      }

      // Actualizar estado en vivo
      setProcessedMap((prev) => ({
        ...prev,
        [activeTarget.payment_id]: {
          status: 'paid',
          amountPaid: amount,
          time: new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }),
        },
      }));

      setTodayCollected((prev) => prev + amount);
      advanceToNextPending(activeTarget.client_id);
    } catch (err: any) {
      console.warn('Network exception in handleFullPayment, fallback to offline queue:', err);
      try {
        const gps = await getGPSCoordinates();
        await recordOfflinePayment({
          paymentId: activeTarget.payment_id,
          tenantId: appUser.tenant_id,
          collectorId: appUser.id,
          amountPaid: amount,
          status: 'paid',
          latitude: gps.latitude,
          longitude: gps.longitude,
        });

        setProcessedMap((prev) => ({
          ...prev,
          [activeTarget.payment_id]: {
            status: 'paid',
            amountPaid: amount,
            time: new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }),
          },
        }));

        setTodayCollected((prev) => prev + amount);
        showToast(`⚡ Guardado en cola offline: ${formatCurrency(amount)}`);
        advanceToNextPending(activeTarget.client_id);
      } catch (offlineErr) {
        setAlertError('Error al registrar cobro.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  /* ---- ACCIÓN 2: 🟡 ABONO PARCIAL (TOUCH NUMPAD) ---- */
  const handleOpenPartialNumpad = () => {
    if (!activeTarget) return;
    triggerHaptic(30);
    setNumpadItem(activeTarget);
  };

  const handleConfirmPartialPayment = async (amount: number) => {
    if (!numpadItem || !appUser || isSubmitting) return;

    setNumpadItem(null);
    setIsSubmitting(true);

    try {
      const gps = await getGPSCoordinates();

      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        await recordOfflinePayment({
          paymentId: numpadItem.payment_id,
          tenantId: appUser.tenant_id,
          collectorId: appUser.id,
          amountPaid: amount,
          status: 'partial',
          latitude: gps.latitude,
          longitude: gps.longitude,
        });

        setProcessedMap((prev) => ({
          ...prev,
          [numpadItem.payment_id]: {
            status: 'partial',
            amountPaid: amount,
            time: new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }),
          },
        }));

        setTodayCollected((prev) => prev + amount);
        showToast(`⚡ Abono guardado en cola offline: ${formatCurrency(amount)}`);
        advanceToNextPending(numpadItem.client_id);
        setIsSubmitting(false);
        return;
      }

      const res = await registerPayment(
        numpadItem.payment_id,
        appUser.tenant_id,
        amount,
        gps.latitude,
        gps.longitude
      );

      if (!res.success) {
        await recordOfflinePayment({
          paymentId: numpadItem.payment_id,
          tenantId: appUser.tenant_id,
          collectorId: appUser.id,
          amountPaid: amount,
          status: 'partial',
          latitude: gps.latitude,
          longitude: gps.longitude,
        });
        showToast(`⚡ Abono guardado en cola local: ${formatCurrency(amount)}`);
      } else {
        showToast(`🟡 Abono registrado: ${formatCurrency(amount)}`);
      }

      setProcessedMap((prev) => ({
        ...prev,
        [numpadItem.payment_id]: {
          status: 'partial',
          amountPaid: amount,
          time: new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }),
        },
      }));

      setTodayCollected((prev) => prev + amount);
      advanceToNextPending(numpadItem.client_id);
    } catch (err: any) {
      console.warn('Network exception in handleConfirmPartialPayment, fallback to offline:', err);
      try {
        const gps = await getGPSCoordinates();
        await recordOfflinePayment({
          paymentId: numpadItem.payment_id,
          tenantId: appUser.tenant_id,
          collectorId: appUser.id,
          amountPaid: amount,
          status: 'partial',
          latitude: gps.latitude,
          longitude: gps.longitude,
        });

        setProcessedMap((prev) => ({
          ...prev,
          [numpadItem.payment_id]: {
            status: 'partial',
            amountPaid: amount,
            time: new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }),
          },
        }));

        setTodayCollected((prev) => prev + amount);
        showToast(`⚡ Abono guardado offline: ${formatCurrency(amount)}`);
        advanceToNextPending(numpadItem.client_id);
      } catch (offlineErr) {
        setAlertError('Error al procesar abono parcial.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  /* ---- ACCIÓN 3: 🔴 NO PAGÓ (SELECTOR DE MOTIVO) ---- */
  const handleOpenMissedModal = () => {
    if (!activeTarget) return;
    triggerHaptic(40);
    setMissedItem(activeTarget);
  };

  const handleConfirmMissedPayment = async (reason: string) => {
    if (!missedItem || !appUser || isSubmitting) return;

    setMissedItem(null);
    setIsSubmitting(true);
    triggerHaptic([80, 40, 80]);

    try {
      const gps = await getGPSCoordinates();

      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        await recordOfflinePayment({
          paymentId: missedItem.payment_id,
          tenantId: appUser.tenant_id,
          collectorId: appUser.id,
          amountPaid: 0,
          status: 'missed',
          latitude: gps.latitude,
          longitude: gps.longitude,
        });

        setProcessedMap((prev) => ({
          ...prev,
          [missedItem.payment_id]: {
            status: 'missed',
            amountPaid: 0,
            reason,
            time: new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }),
          },
        }));

        showToast(`⚡ Novedad guardada offline: ${reason}`);
        advanceToNextPending(missedItem.client_id);
        setIsSubmitting(false);
        return;
      }

      const res = await registerPayment(
        missedItem.payment_id,
        appUser.tenant_id,
        0,
        gps.latitude,
        gps.longitude
      );

      if (!res.success) {
        await recordOfflinePayment({
          paymentId: missedItem.payment_id,
          tenantId: appUser.tenant_id,
          collectorId: appUser.id,
          amountPaid: 0,
          status: 'missed',
          latitude: gps.latitude,
          longitude: gps.longitude,
        });
        showToast(`⚡ Novedad guardada en cola local: ${reason}`);
      } else {
        showToast(`🔴 Novedad: ${reason}`);
      }

      setProcessedMap((prev) => ({
        ...prev,
        [missedItem.payment_id]: {
          status: 'missed',
          amountPaid: 0,
          reason,
          time: new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }),
        },
      }));

      advanceToNextPending(missedItem.client_id);
    } catch (err: any) {
      console.warn('Network exception in handleConfirmMissedPayment, fallback to offline:', err);
      try {
        const gps = await getGPSCoordinates();
        await recordOfflinePayment({
          paymentId: missedItem.payment_id,
          tenantId: appUser.tenant_id,
          collectorId: appUser.id,
          amountPaid: 0,
          status: 'missed',
          latitude: gps.latitude,
          longitude: gps.longitude,
        });

        setProcessedMap((prev) => ({
          ...prev,
          [missedItem.payment_id]: {
            status: 'missed',
            amountPaid: 0,
            reason,
            time: new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }),
          },
        }));

        showToast(`⚡ Novedad guardada offline: ${reason}`);
        advanceToNextPending(missedItem.client_id);
      } catch (offlineErr) {
        setAlertError('Error al registrar novedad.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  /* ---- CIERRE DE JORNADA (ARQUEO SPRINT 4) ---- */
  const handleConfirmCloseShift = async () => {
    if (!selectedRoute || !appUser) return;
    setClosingRoute(true);

    try {
      const res = await closeRouteRecord(
        appUser.tenant_id,
        selectedRoute.id,
        appUser.id,
        todayCollected,
        totalExpectedSum
      );

      if (!res.success) {
        setAlertError(res.error || 'Error al registrar cierre de jornada.');
      } else {
        const now = new Date();
        const timeStr = now.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
        const dateStr = now.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });

        setClosedSummary({
          totalClients: checklist.length,
          collectedCount: collectedClients.length,
          incidentCount: incidentClients.length,
          pendingCount: pendingClients.length,
          totalCollected: todayCollected,
          totalExpected: totalExpectedSum,
          closedAt: `${dateStr} a las ${timeStr}`,
          notes: shiftNotes.trim() || undefined,
        });

        setIsShiftClosed(true);
        setViewClosedReceipt(true);
        setShowCloseModal(false);
        showToast('🏁 Jornada cerrada con éxito.');
        triggerHaptic([100, 50, 100, 50, 150]);
      }
    } catch (err: any) {
      console.error('Error in closeShift:', err);
      setAlertError('Error de servidor al cerrar jornada.');
    } finally {
      setClosingRoute(false);
    }
  };

  if (loading) {
    return (
      <div className={styles.emptyState}>
        <div className={styles.emptyTitle}>Cargando Ruta de Cobranza...</div>
        <div className={styles.emptyText}>Conectando con base de datos local...</div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      {/* Toast Notification */}
      {toast && (
        <div className={styles.toast}>
          <span>{toast}</span>
        </div>
      )}

      {/* Header Compacto */}
      <header className={styles.header}>
        <div className={styles.topRow}>
          <div className={styles.routeMeta}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span className={styles.routeName}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
                {selectedRoute ? selectedRoute.name : 'Ruta Asignada'}
              </span>

              {/* Indicador de Conectividad y Sincronización Offline */}
              {pendingCount > 0 ? (
                <button
                  type="button"
                  className={styles.syncPill}
                  onClick={() => syncNow()}
                  disabled={isSyncing}
                  title="Presiona para sincronizar pendientes con el servidor"
                >
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    className={isSyncing ? styles.syncSpinner : ''}
                  >
                    <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
                  </svg>
                  <span>{isSyncing ? 'Sincronizando...' : `${pendingCount} pend.`}</span>
                </button>
              ) : !isOnline ? (
                <span className={`${styles.syncPill} ${styles.syncPillOffline}`} title="Operando en modo sin conexión">
                  <span>● Offline</span>
                </span>
              ) : null}
            </div>

            <span className={styles.routeZone}>
              {selectedRoute?.zone || 'Zona Urbana'} · {appUser?.full_name || 'Cobrador'}
            </span>
          </div>

          <button
            type="button"
            className={styles.closeShiftBtn}
            onClick={() => {
              if (isShiftClosed) {
                setViewClosedReceipt(true);
              } else {
                setShowCloseModal(true);
              }
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M18.36 6.64a9 9 0 1 1-12.73 0" />
              <line x1="12" y1="2" x2="12" y2="12" />
            </svg>
            {isShiftClosed ? 'Ver Arqueo' : 'Cerrar Turno'}
          </button>
        </div>

        {/* Barra de Progreso y KPI */}
        <div className={styles.kpiBar}>
          <div className={styles.kpiCol}>
            <span className={styles.kpiLabel}>Progreso de Cobro</span>
            <span className={styles.kpiValue}>{progressText}</span>
            <div className={styles.progressBarContainer}>
              <div
                className={styles.progressBarFill}
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

          <div className={styles.kpiCol} style={{ alignItems: 'flex-end' }}>
            <span className={styles.kpiLabel}>Recaudo Hoy</span>
            <span className={styles.kpiValue} style={{ color: 'var(--color-safety-yellow)' }}>
              {formatCurrency(todayCollected)}
            </span>
            <span style={{ fontSize: '10px', color: '#BDC3C7', marginTop: '2px' }}>
              Meta: {formatCurrency(totalExpectedSum)}
            </span>
          </div>
        </div>
      </header>

      {/* Vista de Jornada Cerrada con Éxito (Sprint 4) */}
      {isShiftClosed && viewClosedReceipt && closedSummary ? (
        <section className={styles.closedScreenOverlay}>
          <div className={styles.closedSuccessBanner}>
            <div style={{ fontSize: '2.5rem' }}>🏁</div>
            <span className={styles.closedSuccessTitle}>Jornada Cerrada con Éxito</span>
            <span className={styles.closedSuccessSub}>
              Ruta formalmente finalizada. Entrega este comprobante de caja al prestamista.
            </span>
          </div>

          <div className={styles.closedReceipt}>
            <div className={styles.closedReceiptHeader}>
              <span className={styles.closedReceiptTitle}>Comprobante de Arqueo</span>
              <span className={styles.closedReceiptSub}>
                {selectedRoute?.name || 'Ruta'} · {closedSummary.closedAt}
              </span>
            </div>

            <div className={styles.closedReceiptCashBig}>
              <span className={styles.cashLabel}>Efectivo Físico a Entregar</span>
              <span className={styles.closedReceiptCashAmount}>
                {formatCurrency(closedSummary.totalCollected)}
              </span>
            </div>

            <div className={styles.closedReceiptRow}>
              <span>Cobrador Responsable:</span>
              <span className={styles.closedReceiptValue}>{appUser?.full_name || 'Cobrador'}</span>
            </div>

            <div className={styles.closedReceiptRow}>
              <span>Total Clientes en Ruta:</span>
              <span className={styles.closedReceiptValue}>{closedSummary.totalClients}</span>
            </div>

            <div className={styles.closedReceiptRow}>
              <span>Cobros Efectivos Realizados:</span>
              <span className={styles.closedReceiptValue} style={{ color: 'var(--color-green)' }}>
                {closedSummary.collectedCount}
              </span>
            </div>

            <div className={styles.closedReceiptRow}>
              <span>Visitas con Novedad (No Pago):</span>
              <span className={styles.closedReceiptValue} style={{ color: 'var(--color-red)' }}>
                {closedSummary.incidentCount}
              </span>
            </div>

            <div className={styles.closedReceiptRow}>
              <span>Clientes Pendientes (No Visitados):</span>
              <span className={styles.closedReceiptValue}>{closedSummary.pendingCount}</span>
            </div>

            <div className={styles.closedReceiptRow}>
              <span>Meta Proyectada del Día:</span>
              <span className={styles.closedReceiptValue}>
                {formatCurrency(closedSummary.totalExpected)}
              </span>
            </div>

            {closedSummary.notes && (
              <div className={styles.closedNotesBox}>
                <strong>Notas de jornada:</strong> &ldquo;{closedSummary.notes}&rdquo;
              </div>
            )}

            <button
              type="button"
              className={styles.shortcutBtn}
              style={{ marginTop: '8px', padding: '12px', fontSize: '13px' }}
              onClick={() => setViewClosedReceipt(false)}
            >
              Consultar Lista de Clientes (Modo Lectura)
            </button>
          </div>
        </section>
      ) : (
        <>
          {/* Pestañas Rápidas */}
          <nav className={styles.tabsContainer}>
        <button
          type="button"
          className={`${styles.tabBtn} ${activeTab === 'pending' ? styles.tabBtnActive : ''}`}
          onClick={() => setActiveTab('pending')}
        >
          <span>Pendientes</span>
          <span className={styles.tabBadge}>{pendingClients.length}</span>
        </button>

        <button
          type="button"
          className={`${styles.tabBtn} ${activeTab === 'collected' ? styles.tabBtnActive : ''}`}
          onClick={() => setActiveTab('collected')}
        >
          <span>Cobrados</span>
          <span className={styles.tabBadge}>{collectedClients.length}</span>
        </button>

        <button
          type="button"
          className={`${styles.tabBtn} ${activeTab === 'incidents' ? styles.tabBtnActive : ''}`}
          onClick={() => setActiveTab('incidents')}
        >
          <span>Novedades</span>
          <span className={styles.tabBadge}>{incidentClients.length}</span>
        </button>
      </nav>

      {/* Barra de Búsqueda y Filtros Rápidos (Sprint Prioridad 1) */}
      <div className={styles.quickFilterBar}>
        <div className={styles.searchBox}>
          <span className={styles.searchIcon}>🔍</span>
          <input
            type="text"
            className={styles.routeSearchInput}
            placeholder="Buscar por nombre, cédula o dirección..."
            value={routeSearch}
            onChange={(e) => setRouteSearch(e.target.value)}
          />
          {routeSearch && (
            <button
              type="button"
              className={styles.clearSearchBtn}
              onClick={() => {
                setRouteSearch('');
                triggerHaptic(10);
              }}
              aria-label="Limpiar búsqueda"
            >
              ✕
            </button>
          )}
        </div>

        <div className={styles.filterPillsRow}>
          <button
            type="button"
            className={`${styles.filterPill} ${routeRiskFilter === 'all' ? styles.filterPillActive : ''}`}
            onClick={() => {
              setRouteRiskFilter('all');
              triggerHaptic(15);
            }}
          >
            <span>Todos</span>
            <span className={styles.pillCount}>
              {activeTab === 'pending'
                ? pendingRiskCounts.all
                : activeTab === 'collected'
                ? collectedClients.length
                : incidentClients.length}
            </span>
          </button>

          <button
            type="button"
            className={`${styles.filterPill} ${routeRiskFilter === 'red' ? styles.filterPillActiveRed : ''}`}
            onClick={() => {
              setRouteRiskFilter(routeRiskFilter === 'red' ? 'all' : 'red');
              triggerHaptic(15);
            }}
          >
            <span className={styles.riskDotMiniRed} />
            <span>En Mora</span>
            {activeTab === 'pending' && <span className={styles.pillCountRed}>{pendingRiskCounts.red}</span>}
          </button>

          <button
            type="button"
            className={`${styles.filterPill} ${routeRiskFilter === 'yellow' ? styles.filterPillActiveYellow : ''}`}
            onClick={() => {
              setRouteRiskFilter(routeRiskFilter === 'yellow' ? 'all' : 'yellow');
              triggerHaptic(15);
            }}
          >
            <span className={styles.riskDotMiniYellow} />
            <span>Alerta</span>
            {activeTab === 'pending' && <span className={styles.pillCountYellow}>{pendingRiskCounts.yellow}</span>}
          </button>

          <button
            type="button"
            className={`${styles.filterPill} ${routeRiskFilter === 'green' ? styles.filterPillActiveGreen : ''}`}
            onClick={() => {
              setRouteRiskFilter(routeRiskFilter === 'green' ? 'all' : 'green');
              triggerHaptic(15);
            }}
          >
            <span className={styles.riskDotMiniGreen} />
            <span>Al Día</span>
            {activeTab === 'pending' && <span className={styles.pillCountGreen}>{pendingRiskCounts.green}</span>}
          </button>
        </div>
      </div>

      {/* Contenido según pestaña activa */}
      <main className={styles.clientList}>
        {activeTab === 'pending' && (
          <>
            {pendingClients.length === 0 ? (
              <div className={styles.emptyState}>
                <div style={{ fontSize: '2rem' }}>🎉</div>
                <div className={styles.emptyTitle}>¡Ruta al Día!</div>
                <div className={styles.emptyText}>
                  No hay cobros pendientes por realizar en esta jornada.
                </div>
              </div>
            ) : displayedPendingClients.length === 0 ? (
              <div className={styles.emptyState}>
                <div style={{ fontSize: '1.8rem' }}>🔍</div>
                <div className={styles.emptyTitle}>Sin coincidencias</div>
                <div className={styles.emptyText}>No hay clientes pendientes que coincidan con el filtro actual.</div>
                <button
                  type="button"
                  className="btn btn--ghost btn--sm"
                  style={{ marginTop: 8 }}
                  onClick={() => {
                    setRouteSearch('');
                    setRouteRiskFilter('all');
                    triggerHaptic(15);
                  }}
                >
                  Ver todos los pendientes
                </button>
              </div>
            ) : (
              displayedPendingClients.map((client) => {
                const isSelected = client.client_id === selectedClientId;
                return (
                  <article
                    key={client.client_id}
                    className={`${styles.clientCard} ${isSelected ? styles.clientCardSelected : ''}`}
                    onClick={() => {
                      setSelectedClientId(client.client_id);
                      triggerHaptic(20);
                    }}
                  >
                    <div className={styles.clientCardTop}>
                      <div className={styles.clientNameBox}>
                        <span className={styles.clientName}>
                          <span
                            className={`${styles.riskDot} ${
                              client.risk_status === 'green'
                                ? styles.riskGreen
                                : client.risk_status === 'yellow'
                                ? styles.riskYellow
                                : styles.riskRed
                            }`}
                          />
                          {client.client_name}
                        </span>
                        <span className={styles.clientDoc}>
                          C.C. {client.document_id} · Cuota #{client.installment_number}
                        </span>
                      </div>

                      {client.phone && (
                        <a
                          href={`tel:${client.phone}`}
                          className={styles.callBtn}
                          onClick={(e) => e.stopPropagation()}
                          title="Llamar al cliente"
                        >
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                          </svg>
                        </a>
                      )}
                    </div>

                    <div className={styles.cardFinancials}>
                      <div className={styles.finBox}>
                        <span className={styles.finLabel}>Cuota a Cobrar</span>
                        <span className={`${styles.finValue} ${styles.finValueQuota}`}>
                          {formatCurrency(client.expectedQuota)}
                        </span>
                      </div>
                      <div className={styles.finBox} style={{ alignItems: 'flex-end' }}>
                        <span className={styles.finLabel}>Saldo Pendiente</span>
                        <span className={`${styles.finValue} ${styles.finValueBalance}`}>
                          {formatCurrency(client.balance)}
                        </span>
                      </div>
                    </div>

                    {client.address && (
                      <div className={styles.cardAddress}>
                        <svg className={styles.addressIcon} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                          <circle cx="12" cy="10" r="3" />
                        </svg>
                        <span>{client.address}</span>
                      </div>
                    )}
                  </article>
                );
              })
            )}
          </>
        )}

        {activeTab === 'collected' && (
          <>
            {collectedClients.length === 0 ? (
              <div className={styles.emptyState}>
                <div className={styles.emptyTitle}>Sin Cobros Registrados</div>
                <div className={styles.emptyText}>Los pagos cobrados hoy aparecerán listados aquí.</div>
              </div>
            ) : displayedCollectedClients.length === 0 ? (
              <div className={styles.emptyState}>
                <div style={{ fontSize: '1.8rem' }}>🔍</div>
                <div className={styles.emptyTitle}>Sin coincidencias</div>
                <div className={styles.emptyText}>No hay cobros que coincidan con el filtro actual.</div>
              </div>
            ) : (
              displayedCollectedClients.map((client) => {
                const rec = processedMap[client.payment_id];
                return (
                  <article key={client.client_id} className={`${styles.clientCard} ${styles.clientCardPaid}`}>
                    <div className={styles.clientCardTop}>
                      <div className={styles.clientNameBox}>
                        <span className={styles.clientName}>{client.client_name}</span>
                        <span className={styles.clientDoc}>
                          Registrado a las {rec?.time || '--:--'} · C.C. {client.document_id}
                        </span>
                      </div>
                      <span
                        className={`${styles.statusOutcomeBadge} ${
                          rec?.status === 'paid' ? styles.badgePaidFull : styles.badgePaidPartial
                        }`}
                      >
                        {rec?.status === 'paid' ? 'Completo' : 'Abono'}
                      </span>
                    </div>

                    <div className={styles.cardFinancials}>
                      <div className={styles.finBox}>
                        <span className={styles.finLabel}>Monto Cobrado</span>
                        <span className={styles.finValue} style={{ color: 'var(--color-green)' }}>
                          {formatCurrency(rec?.amountPaid || client.expectedQuota)}
                        </span>
                      </div>
                      <div className={styles.finBox} style={{ alignItems: 'flex-end' }}>
                        <span className={styles.finLabel}>Cuota Original</span>
                        <span className={`${styles.finValue} ${styles.finValueBalance}`}>
                          {formatCurrency(client.expectedQuota)}
                        </span>
                      </div>
                    </div>
                  </article>
                );
              })
            )}
          </>
        )}

        {activeTab === 'incidents' && (
          <>
            {incidentClients.length === 0 ? (
              <div className={styles.emptyState}>
                <div className={styles.emptyTitle}>Sin Novedades</div>
                <div className={styles.emptyText}>Los clientes que no pagaron hoy se registrarán aquí.</div>
              </div>
            ) : displayedIncidentClients.length === 0 ? (
              <div className={styles.emptyState}>
                <div style={{ fontSize: '1.8rem' }}>🔍</div>
                <div className={styles.emptyTitle}>Sin coincidencias</div>
                <div className={styles.emptyText}>No hay novedades que coincidan con el filtro actual.</div>
              </div>
            ) : (
              displayedIncidentClients.map((client) => {
                const rec = processedMap[client.payment_id];
                return (
                  <article key={client.client_id} className={`${styles.clientCard} ${styles.clientCardMissed}`}>
                    <div className={styles.clientCardTop}>
                      <div className={styles.clientNameBox}>
                        <span className={styles.clientName}>{client.client_name}</span>
                        <span className={styles.clientDoc}>
                          Registrado a las {rec?.time || '--:--'} · C.C. {client.document_id}
                        </span>
                      </div>
                      <span className={`${styles.statusOutcomeBadge} ${styles.badgeMissed}`}>
                        No Pagó
                      </span>
                    </div>

                    <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-red)' }}>
                      Motivo: {rec?.reason || 'No especificado'}
                    </div>

                    <div className={styles.cardFinancials}>
                      <div className={styles.finBox}>
                        <span className={styles.finLabel}>Cuota Vencida</span>
                        <span className={`${styles.finValue} ${styles.finValueQuota}`}>
                          {formatCurrency(client.expectedQuota)}
                        </span>
                      </div>
                      <div className={styles.finBox} style={{ alignItems: 'flex-end' }}>
                        <span className={styles.finLabel}>Saldo Total</span>
                        <span className={`${styles.finValue} ${styles.finValueBalance}`}>
                          {formatCurrency(client.balance)}
                        </span>
                      </div>
                    </div>
                  </article>
                );
              })
            )}
          </>
        )}
      </main>
      </>
      )}

      {/* Zona de Pulgar Inferior Fija (Thumb-Zone) o Aviso de Cierre Congelado */}
      {isShiftClosed ? (
        <footer className={styles.thumbZone} style={{ padding: '12px' }}>
          <div className={styles.closedFrozenNotice}>
            <span>🔒 Jornada cerrada por hoy · Edición de cobros congelada</span>
            <button
              type="button"
              className={styles.shortcutBtn}
              style={{
                padding: '6px 12px',
                fontSize: '11px',
                backgroundColor: 'var(--color-safety-yellow)',
                color: 'var(--color-asphalt-dark)',
              }}
              onClick={() => setViewClosedReceipt(true)}
            >
              Ver Arqueo
            </button>
          </div>
        </footer>
      ) : activeTab === 'pending' && activeTarget ? (
        <footer className={styles.thumbZone}>
          <div className={styles.activeTargetBanner}>
            <span className={styles.activeTargetName}>
              🎯 {activeTarget.client_name}
            </span>
            <span className={styles.activeTargetQuota}>
              {formatCurrency(activeTarget.expectedQuota)}
            </span>
          </div>

          <div className={styles.actionButtonsGrid}>
            {/* 🟢 Cobro Completo (1-Tap instantáneo) */}
            <button
              type="button"
              className={`${styles.btnAction} ${styles.btnComplete}`}
              onClick={handleFullPayment}
              disabled={isSubmitting}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              <span className={styles.btnActionTitle}>Cobro Completo</span>
              <span className={styles.btnActionSub}>1-Tap</span>
            </button>

            {/* 🟡 Abono Parcial (Touch Numpad) */}
            <button
              type="button"
              className={`${styles.btnAction} ${styles.btnPartial}`}
              onClick={handleOpenPartialNumpad}
              disabled={isSubmitting}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <rect x="4" y="2" width="16" height="20" rx="2" />
                <line x1="8" y1="6" x2="16" y2="6" />
                <line x1="8" y1="10" x2="16" y2="10" />
                <line x1="8" y1="14" x2="16" y2="14" />
                <line x1="8" y1="18" x2="16" y2="18" />
              </svg>
              <span className={styles.btnActionTitle}>Abono</span>
              <span className={styles.btnActionSub}>Parcial</span>
            </button>

            {/* 🔴 No Pagó (Selector de Motivo) */}
            <button
              type="button"
              className={`${styles.btnAction} ${styles.btnMissed}`}
              onClick={handleOpenMissedModal}
              disabled={isSubmitting}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
              <span className={styles.btnActionTitle}>No Pagó</span>
              <span className={styles.btnActionSub}>Novedad</span>
            </button>
          </div>
        </footer>
      ) : null}

      {/* Modal Bottom Sheet: Touch Numpad para Abono Parcial */}
      {numpadItem && (
        <TouchNumpadModal
          isOpen={Boolean(numpadItem)}
          onClose={() => setNumpadItem(null)}
          onConfirm={handleConfirmPartialPayment}
          clientName={numpadItem.client_name}
          expectedQuota={numpadItem.expectedQuota}
          title="Registrar Abono Parcial"
          confirmLabel="Confirmar Abono"
        />
      )}

      {/* Modal Bottom Sheet: Selector Rápido de Motivo de No Pago */}
      {missedItem && (
        <div className={styles.modalOverlay} onClick={() => setMissedItem(null)}>
          <div className={styles.sheetContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.sheetHeader}>
              <span className={styles.sheetTitle}>¿Por qué no pagó?</span>
              <button
                type="button"
                style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer' }}
                onClick={() => setMissedItem(null)}
              >
                ✕
              </button>
            </div>

            <div style={{ fontSize: '13px', color: 'var(--color-gray-500)', fontWeight: 600 }}>
              Cliente: {missedItem.client_name} · Cuota: {formatCurrency(missedItem.expectedQuota)}
            </div>

            <div className={styles.reasonsList}>
              {MISSED_REASONS.map((reason) => (
                <button
                  key={reason}
                  type="button"
                  className={styles.reasonBtn}
                  onClick={() => handleConfirmMissedPayment(reason)}
                >
                  <span style={{ color: 'var(--color-red)' }}>•</span>
                  <span>{reason}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Modal Bottom Sheet: Arqueo y Cierre de Jornada (Sprint 4) */}
      {showCloseModal && (
        <div className={styles.modalOverlay} onClick={() => !closingRoute && setShowCloseModal(false)}>
          <div className={styles.closeModalSheet} onClick={(e) => e.stopPropagation()}>
            <div className={styles.sheetHeader}>
              <span className={styles.sheetTitle}>Arqueo y Cierre de Jornada</span>
              <button
                type="button"
                style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer' }}
                onClick={() => setShowCloseModal(false)}
                disabled={closingRoute}
              >
                ✕
              </button>
            </div>

            {/* Resumen visual antes de cerrar */}
            <div className={styles.kpiClosureGrid}>
              <div className={styles.kpiClosureCard}>
                <span className={styles.kpiClosureLabel}>Total</span>
                <span className={styles.kpiClosureVal}>{checklist.length}</span>
              </div>
              <div className={styles.kpiClosureCard} style={{ borderColor: 'var(--color-green)' }}>
                <span className={styles.kpiClosureLabel} style={{ color: 'var(--color-green)' }}>Cobrados</span>
                <span className={styles.kpiClosureVal} style={{ color: 'var(--color-green)' }}>{collectedClients.length}</span>
              </div>
              <div className={styles.kpiClosureCard} style={{ borderColor: 'var(--color-red)' }}>
                <span className={styles.kpiClosureLabel} style={{ color: 'var(--color-red)' }}>Novedad</span>
                <span className={styles.kpiClosureVal} style={{ color: 'var(--color-red)' }}>{incidentClients.length}</span>
              </div>
              <div className={styles.kpiClosureCard}>
                <span className={styles.kpiClosureLabel}>Pendientes</span>
                <span className={styles.kpiClosureVal}>{pendingClients.length}</span>
              </div>
            </div>

            {/* Monto total en efectivo a entregar (en formato de moneda y tabular-nums gigante) */}
            <div className={styles.cashBoxClosure}>
              <span className={styles.cashLabel}>Efectivo Total a Entregar</span>
              <span className={styles.cashAmountHuge}>{formatCurrency(todayCollected)}</span>
              <span className={styles.cashMetaExpected}>Meta esperada: {formatCurrency(totalExpectedSum)}</span>
            </div>

            {/* Campo para notas o novedades del día */}
            <div className={styles.notesFieldBox}>
              <label className={styles.notesLabel}>Notas o Novedades del Día</label>
              <textarea
                className={styles.notesTextArea}
                placeholder="Ej: Cobros completos, Doña Marta pidió día de gracia..."
                value={shiftNotes}
                onChange={(e) => setShiftNotes(e.target.value)}
                disabled={closingRoute}
              />
            </div>

            {/* Botón masivo 'Confirmar Cierre de Jornada' con confirmación háptica */}
            <button
              type="button"
              className={styles.btnSubmitClose}
              onClick={handleConfirmCloseShift}
              disabled={closingRoute}
            >
              {closingRoute ? (
                <span>Registrando Arqueo...</span>
              ) : (
                <>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M18.36 6.64a9 9 0 1 1-12.73 0" />
                    <line x1="12" y1="2" x2="12" y2="12" />
                  </svg>
                  <span>Confirmar Cierre de Jornada</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Modal de Alerta de Error */}
      <AlertModal
        isOpen={Boolean(alertError)}
        title="Atención"
        message={alertError || ''}
        onClose={() => setAlertError(null)}
      />
    </div>
  );
}
