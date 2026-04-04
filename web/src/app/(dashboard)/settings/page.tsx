'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/hooks';
import { getTenant, updateTenant } from '@/services/tenant.service';
import type { Tenant } from '@/types';
import styles from './settings.module.css';

const CURRENCIES = ['COP', 'USD', 'MXN', 'ARS', 'PEN', 'BRL', 'EUR'];
const WEEK_DAYS = [
  { key: 'monday', label: 'Lunes' },
  { key: 'tuesday', label: 'Martes' },
  { key: 'wednesday', label: 'Miércoles' },
  { key: 'thursday', label: 'Jueves' },
  { key: 'friday', label: 'Viernes' },
  { key: 'saturday', label: 'Sábado' },
  { key: 'sunday', label: 'Domingo' },
];

export default function SettingsPage() {
  const { appUser } = useAuth();
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [currency, setCurrency] = useState('COP');
  const [nonWorkingDays, setNonWorkingDays] = useState<string[]>([]);
  const [newHoliday, setNewHoliday] = useState('');
  const [holidays, setHolidays] = useState<string[]>([]);

  const loadTenant = useCallback(async () => {
    if (!appUser) return;
    setLoading(true);
    const data = await getTenant(appUser.tenant_id);
    if (data) {
      setTenant(data);
      setName(data.name);
      setCurrency(data.currency);
      setNonWorkingDays(data.non_working_days as string[] || []);
      setHolidays((data.holidays as string[]) || []);
    }
    setLoading(false);
  }, [appUser]);

  useEffect(() => {
    loadTenant();
  }, [loadTenant]);

  function toggleDay(day: string) {
    setNonWorkingDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  }

  function addHoliday() {
    if (newHoliday && !holidays.includes(newHoliday)) {
      setHolidays([...holidays, newHoliday].sort());
      setNewHoliday('');
    }
  }

  function removeHoliday(date: string) {
    setHolidays(holidays.filter((h) => h !== date));
  }

  async function handleSave() {
    if (!tenant) return;
    setSaving(true);
    setMessage(null);

    if (!appUser) return;
    const { success, error } = await updateTenant(tenant.id, {
      name,
      currency,
      non_working_days: nonWorkingDays,
      holidays,
    });

    if (success) {
      setMessage({ type: 'success', text: 'Configuración guardada correctamente' });
    } else {
      setMessage({ type: 'error', text: `Error: ${error}` });
    }
    setSaving(false);
  }

  if (loading) {
    return (
      <div className={styles.page}>
        <div className="skeleton" style={{ height: 40, width: 200, marginBottom: 32 }} />
        <div className="skeleton" style={{ height: 300, width: '100%' }} />
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <h2 className={styles.pageTitle}>Configuración</h2>
        <p className={styles.pageSubtitle}>Ajustes del negocio, moneda y calendario</p>
      </div>

      {message && (
        <div className={`${styles.alert} ${styles[message.type]}`}>
          {message.text}
        </div>
      )}

      <div className={styles.grid}>
        {/* Info del Negocio */}
        <div className="card">
          <h3 className={styles.sectionTitle}>Información del Negocio</h3>
          <div className={styles.field}>
            <label className="input-label" htmlFor="businessName">Nombre del negocio</label>
            <input
              id="businessName"
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Mi Negocio de Préstamos"
            />
          </div>

          <div className={styles.field}>
            <label className="input-label" htmlFor="currency">Moneda</label>
            <select
              id="currency"
              className="input"
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
            >
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <div className={styles.field}>
            <label className="input-label">Admin</label>
            <input className="input" value={appUser?.email || ''} disabled />
          </div>
        </div>

        {/* Días No Laborables */}
        <div className="card">
          <h3 className={styles.sectionTitle}>Días No Laborables</h3>
          <p className={styles.fieldHint}>
            Los días marcados serán omitidos al calcular el cronograma de cuotas.
          </p>
          <div className={styles.daysGrid}>
            {WEEK_DAYS.map((day) => (
              <button
                key={day.key}
                className={`${styles.dayBtn} ${nonWorkingDays.includes(day.key) ? styles.dayBtnActive : ''}`}
                onClick={() => toggleDay(day.key)}
                type="button"
              >
                {day.label}
              </button>
            ))}
          </div>
        </div>

        {/* Festivos */}
        <div className="card">
          <h3 className={styles.sectionTitle}>Días Festivos</h3>
          <p className={styles.fieldHint}>
            Fechas específicas que serán omitidas del calendario de cobros.
          </p>
          <div className={styles.holidayInput}>
            <input
              type="date"
              className="input"
              value={newHoliday}
              onChange={(e) => setNewHoliday(e.target.value)}
            />
            <button className="btn btn--primary btn--sm" onClick={addHoliday} type="button">
              Agregar
            </button>
          </div>
          <div className={styles.holidayList}>
            {holidays.length === 0 && (
              <p className={styles.emptyText}>Sin festivos configurados</p>
            )}
            {holidays.map((h) => (
              <div key={h} className={styles.holidayTag}>
                <span>{new Date(h + 'T12:00:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                <button onClick={() => removeHoliday(h)} className={styles.removeBtn} type="button">✕</button>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className={styles.actions}>
        <button
          className="btn btn--primary btn--lg"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? 'Guardando...' : 'Guardar Configuración'}
        </button>
      </div>
    </div>
  );
}
