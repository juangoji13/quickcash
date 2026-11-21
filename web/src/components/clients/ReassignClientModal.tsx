'use client';

import { useState, useEffect } from 'react';
import { Modal } from '@/components/ui/Modal';
import { getCollectors } from '@/services/collectors.service';
import { reassignClientCollector } from '@/services/clients.service';
import type { User } from '@/types';
import styles from './ReassignClientModal.module.css';

interface ReassignClientModalProps {
  isOpen: boolean;
  onClose: () => void;
  client: {
    id: string;
    full_name: string;
    document_id?: string;
    collector_id?: string | null;
  } | null;
  currentCollectorName?: string;
  tenantId: string;
  onSuccess: () => void;
}

export default function ReassignClientModal({
  isOpen,
  onClose,
  client,
  currentCollectorName,
  tenantId,
  onSuccess,
}: ReassignClientModalProps) {
  const [collectors, setCollectors] = useState<User[]>([]);
  const [selectedCollectorId, setSelectedCollectorId] = useState<string>('');
  const [loadingCollectors, setLoadingCollectors] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && tenantId) {
      setLoadingCollectors(true);
      setErrorMessage(null);
      getCollectors(tenantId)
        .then((list) => {
          setCollectors(list);
          // Preseleccionar el primer cobrador disponible que no sea el actual
          const other = list.find((u) => u.id !== client?.collector_id);
          if (other) {
            setSelectedCollectorId(other.id);
          } else if (list.length > 0) {
            setSelectedCollectorId(list[0].id);
          }
        })
        .catch((err) => {
          console.error('Error cargando cobradores:', err);
          setErrorMessage('No se pudieron cargar los cobradores del equipo.');
        })
        .finally(() => setLoadingCollectors(false));
    } else {
      setSelectedCollectorId('');
      setErrorMessage(null);
    }
  }, [isOpen, tenantId, client?.collector_id]);

  if (!isOpen || !client) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCollectorId) {
      setErrorMessage('Por favor selecciona un cobrador destino.');
      return;
    }

    if (selectedCollectorId === client.collector_id) {
      setErrorMessage('El cliente ya está asignado a este cobrador.');
      return;
    }

    setSubmitting(true);
    setErrorMessage(null);

    try {
      const res = await reassignClientCollector(client.id, selectedCollectorId, tenantId);
      if (res.success) {
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
          navigator.vibrate([15, 50, 15]);
        }
        onSuccess();
        onClose();
      } else {
        setErrorMessage(res.error || 'Ocurrió un error al reasignar el cliente.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Error de conexión al reasignar.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="🔄 Reasignar Cobrador" width="460px">
      <form onSubmit={handleSubmit} className={styles.reassignForm}>
        <div className={styles.clientSummary}>
          <h4 className={styles.clientName}>{client.full_name}</h4>
          {client.document_id && <span className={styles.clientDoc}>CC {client.document_id}</span>}
          <div className={styles.currentCollectorBadge}>
            <span>Cobrador actual:</span>
            <span className={styles.currentCollectorHighlight}>
              {currentCollectorName || 'Sin asignar / Directo'}
            </span>
          </div>
        </div>

        <div className={styles.fieldGroup}>
          <label className={styles.fieldLabel} htmlFor="collectorSelect">
            Nuevo Cobrador Responsable:
          </label>
          {loadingCollectors ? (
            <div style={{ fontSize: '0.85rem', color: '#64748B' }}>Cargando lista de cobradores...</div>
          ) : (
            <select
              id="collectorSelect"
              className={styles.collectorSelect}
              value={selectedCollectorId}
              onChange={(e) => setSelectedCollectorId(e.target.value)}
              disabled={submitting}
            >
              <option value="" disabled>-- Selecciona un cobrador --</option>
              {collectors.map((col) => {
                const isCurrent = col.id === client.collector_id;
                return (
                  <option key={col.id} value={col.id} disabled={isCurrent}>
                    {col.full_name} ({col.role === 'admin' ? 'Admin' : 'Cobrador'}) {isCurrent ? '(Actual)' : ''}
                  </option>
                );
              })}
            </select>
          )}
        </div>

        <div className={styles.transferNote}>
          <span style={{ fontSize: '1.1rem' }}>ℹ️</span>
          <span>
            <strong>Transferencia instantánea:</strong> La ruta, créditos activos y cuotas pendientes del cliente
            se sincronizarán de inmediato en la app móvil del nuevo cobrador.
          </span>
        </div>

        {errorMessage && (
          <div className={styles.errorBanner}>
            ⚠️ {errorMessage}
          </div>
        )}

        <div className={styles.actionsRow}>
          <button
            type="button"
            className={styles.cancelBtn}
            onClick={onClose}
            disabled={submitting}
          >
            Cancelar
          </button>
          <button
            type="submit"
            className={styles.submitBtn}
            disabled={submitting || !selectedCollectorId || selectedCollectorId === client.collector_id}
          >
            {submitting ? 'Reasignando...' : 'Confirmar Reasignación'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
