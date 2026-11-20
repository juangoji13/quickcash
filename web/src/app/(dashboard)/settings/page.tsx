'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/hooks';
import {
  getTenant,
  updateTenant,
  getUserProfile,
  updateUserProfile,
  changeUserPassword,
} from '@/services/tenant.service';
import type { Tenant, TenantSettings, LoanFrequency } from '@/types';
import styles from './settings.module.css';

const WEEK_DAYS = [
  { key: 'monday', label: 'Lunes' },
  { key: 'tuesday', label: 'Martes' },
  { key: 'wednesday', label: 'Miércoles' },
  { key: 'thursday', label: 'Jueves' },
  { key: 'friday', label: 'Viernes' },
  { key: 'saturday', label: 'Sábado' },
  { key: 'sunday', label: 'Domingo' },
];

function IconLogout() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/>
      <polyline points="16 17 21 12 16 7"/>
      <line x1="21" y1="12" x2="9" y2="12"/>
    </svg>
  );
}

function IconCheck() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  );
}

function IconLock() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
      <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
    </svg>
  );
}

export default function SettingsPage() {
  const { appUser, signOut } = useAuth();
  const [loading, setLoading] = useState(true);

  // Tenant base state
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [businessName, setBusinessName] = useState('');
  const [businessNit, setBusinessNit] = useState('');
  const [businessCity, setBusinessCity] = useState('');
  const [businessAddress, setBusinessAddress] = useState('');

  // Loan parameters state
  const [defaultInterestRate, setDefaultInterestRate] = useState(20);
  const [defaultInstallments, setDefaultInstallments] = useState(24);
  const [defaultFrequency, setDefaultFrequency] = useState<LoanFrequency>('daily');
  const [graceDays, setGraceDays] = useState(1);

  // Field operations state
  const [requireGps, setRequireGps] = useState(true);
  const [allowPartialPayments, setAllowPartialPayments] = useState(true);
  const [requireDailyClosure, setRequireDailyClosure] = useState(true);
  const [autoReceiptsWhatsapp, setAutoReceiptsWhatsapp] = useState(true);

  // Calendar state
  const [nonWorkingDays, setNonWorkingDays] = useState<string[]>(['sunday']);
  const [holidays, setHolidays] = useState<string[]>([]);
  const [newHoliday, setNewHoliday] = useState('');

  // User profile state
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');

  // Password state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // UI feedback and loaders
  const [savingBusiness, setSavingBusiness] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  const [businessMsg, setBusinessMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [profileMsg, setProfileMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [passwordMsg, setPasswordMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadData = useCallback(async () => {
    if (!appUser) return;
    setLoading(true);

    try {
      const [tenantData, userProfile] = await Promise.all([
        getTenant(appUser.tenant_id),
        getUserProfile(appUser.id),
      ]);

      if (tenantData) {
        setTenant(tenantData);
        setBusinessName(tenantData.name || '');
        setNonWorkingDays((tenantData.non_working_days as string[]) || ['sunday']);
        setHolidays((tenantData.holidays as string[]) || []);

        const settings = (tenantData.settings || {}) as TenantSettings;
        if (settings.business_nit) setBusinessNit(settings.business_nit);
        if (settings.business_city) setBusinessCity(settings.business_city);
        if (settings.business_address) setBusinessAddress(settings.business_address);
        if (settings.default_interest_rate !== undefined) setDefaultInterestRate(settings.default_interest_rate);
        if (settings.default_installments !== undefined) setDefaultInstallments(settings.default_installments);
        if (settings.default_frequency) setDefaultFrequency(settings.default_frequency);
        if (settings.grace_days !== undefined) setGraceDays(settings.grace_days);
        if (settings.require_gps !== undefined) setRequireGps(settings.require_gps);
        if (settings.allow_partial_payments !== undefined) setAllowPartialPayments(settings.allow_partial_payments);
        if (settings.require_daily_closure !== undefined) setRequireDailyClosure(settings.require_daily_closure);
        if (settings.auto_receipts_whatsapp !== undefined) setAutoReceiptsWhatsapp(settings.auto_receipts_whatsapp);
      }

      if (userProfile) {
        setFullName(userProfile.full_name || '');
        setPhone(userProfile.phone || '');
        setEmail(userProfile.email || '');
        setUsername(userProfile.username || '');
      } else if (appUser) {
        setFullName(appUser.full_name || '');
        setEmail(appUser.email || '');
        setUsername(appUser.username || '');
      }
    } catch (err) {
      console.error('Error loading settings:', err);
    } finally {
      setLoading(false);
    }
  }, [appUser]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Handlers for Calendar
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

  // Save Tenant & Business settings
  async function handleSaveBusiness() {
    if (!tenant) return;
    setSavingBusiness(true);
    setBusinessMsg(null);

    const updatedSettings: TenantSettings = {
      ...(tenant.settings as TenantSettings || {}),
      business_nit: businessNit.trim(),
      business_city: businessCity.trim(),
      business_address: businessAddress.trim(),
      default_interest_rate: Number(defaultInterestRate) || 20,
      default_installments: Number(defaultInstallments) || 24,
      default_frequency: defaultFrequency,
      grace_days: Number(graceDays) || 1,
      require_gps: Boolean(requireGps),
      allow_partial_payments: Boolean(allowPartialPayments),
      require_daily_closure: Boolean(requireDailyClosure),
      auto_receipts_whatsapp: Boolean(autoReceiptsWhatsapp),
    };

    const res = await updateTenant(tenant.id, {
      name: businessName,
      non_working_days: nonWorkingDays,
      holidays,
      settings: updatedSettings,
    });

    if (res.success) {
      setBusinessMsg({ type: 'success', text: 'Configuración comercial y parámetros de crédito guardados' });
      setTimeout(() => setBusinessMsg(null), 4000);
    } else {
      setBusinessMsg({ type: 'error', text: res.error || 'Error al guardar la configuración' });
    }
    setSavingBusiness(false);
  }

  // Save Personal Profile
  async function handleSaveProfile() {
    if (!appUser) return;
    setSavingProfile(true);
    setProfileMsg(null);

    if (!fullName.trim()) {
      setProfileMsg({ type: 'error', text: 'El nombre completo es obligatorio' });
      setSavingProfile(false);
      return;
    }

    const res = await updateUserProfile(appUser.id, {
      fullName,
      phone,
    });

    if (res.success) {
      setProfileMsg({ type: 'success', text: 'Datos de perfil personal actualizados' });
      setTimeout(() => setProfileMsg(null), 4000);
    } else {
      setProfileMsg({ type: 'error', text: res.error || 'Error al actualizar perfil' });
    }
    setSavingProfile(false);
  }

  // Save Password Change
  async function handleChangePassword() {
    if (!appUser) return;
    setSavingPassword(true);
    setPasswordMsg(null);

    if (!currentPassword) {
      setPasswordMsg({ type: 'error', text: 'Debes ingresar tu contraseña actual' });
      setSavingPassword(false);
      return;
    }

    if (newPassword.length < 6) {
      setPasswordMsg({ type: 'error', text: 'La nueva contraseña debe tener mínimo 6 caracteres' });
      setSavingPassword(false);
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordMsg({ type: 'error', text: 'La confirmación no coincide con la nueva contraseña' });
      setSavingPassword(false);
      return;
    }

    const res = await changeUserPassword(appUser.id, currentPassword, newPassword);

    if (res.success) {
      setPasswordMsg({ type: 'success', text: 'Contraseña actualizada exitosamente' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setPasswordMsg(null), 4000);
    } else {
      setPasswordMsg({ type: 'error', text: res.error || 'No se pudo cambiar la contraseña' });
    }
    setSavingPassword(false);
  }

  // Handle Logout Confirmation
  async function handleConfirmLogout() {
    setShowLogoutModal(false);
    await signOut();
  }

  if (loading) {
    return (
      <div className={styles.page}>
        <div className="skeleton" style={{ height: 48, width: 280, marginBottom: 24, borderRadius: 8 }} />
        <div className="skeleton" style={{ height: 90, width: '100%', marginBottom: 24, borderRadius: 12 }} />
        <div className="skeleton" style={{ height: 350, width: '100%', borderRadius: 12 }} />
      </div>
    );
  }

  const roleLabel =
    appUser?.role === 'superadmin' || (appUser?.role as string) === 'super_admin'
      ? 'Súper Administrador'
      : appUser?.role === 'admin'
      ? 'Prestamista / Administrador'
      : 'Cobrador de Ruta';

  return (
    <div className={styles.page}>
      {/* Header with Quick Action */}
      <div className={styles.pageHeader}>
        <div className={styles.headerText}>
          <h1 className={styles.pageTitle}>Configuración y Cuenta</h1>
          <p className={styles.pageSubtitle}>Administración de negocio, reglas de crédito y seguridad</p>
        </div>
        <button
          onClick={() => setShowLogoutModal(true)}
          className={styles.headerLogoutBtn}
          title="Cerrar sesión en QuickCash"
          aria-label="Cerrar sesión"
        >
          <IconLogout />
          <span>Cerrar Sesión</span>
        </button>
      </div>

      {/* Account Overview Banner */}
      <div className={styles.accountBanner}>
        <div className={styles.accountBannerLeft}>
          <div className={styles.avatarLarge}>
            {fullName ? fullName.charAt(0).toUpperCase() : 'U'}
          </div>
          <div className={styles.accountInfo}>
            <div className={styles.accountName}>{fullName || 'Usuario'}</div>
            <div className={styles.accountMeta}>
              <span>{email}</span>
              {username && <span>• @{username.replace('@', '')}</span>}
              <span>• Negocio: <strong>{tenant?.name || 'Mi Ruta'}</strong></span>
            </div>
          </div>
        </div>
        <span className={styles.roleBadge}>{roleLabel}</span>
      </div>

      {/* Settings Grid */}
      <div className={styles.grid}>
        {/* 1. Perfil del Titular */}
        <div className="card">
          <h2 className={styles.sectionTitle}>
            <span>Perfil del Administrador</span>
            <IconCheck />
          </h2>

          {profileMsg && (
            <div className={`${styles.alert} ${styles[profileMsg.type]}`}>
              {profileMsg.text}
            </div>
          )}

          <div className={styles.field}>
            <label className="input-label" htmlFor="userFullName">Nombre Completo</label>
            <input
              id="userFullName"
              className="input"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Ej. Carlos Mario Restrepo"
            />
          </div>

          <div className={styles.field}>
            <label className="input-label" htmlFor="userPhone">Teléfono / WhatsApp de Contacto</label>
            <input
              id="userPhone"
              className="input"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Ej. 310 123 4567"
            />
            <p className={styles.fieldHint}>Número de contacto para notificaciones y soporte con cobradores.</p>
          </div>

          <div className={styles.fieldRow}>
            <div className={styles.field}>
              <label className="input-label">Usuario</label>
              <input
                className="input"
                value={username ? `@${username.replace('@', '')}` : '—'}
                disabled
              />
            </div>
            <div className={styles.field}>
              <label className="input-label">Correo Registrado</label>
              <input
                className="input"
                value={email}
                disabled
              />
            </div>
          </div>

          <div className={styles.cardActions}>
            <button
              className="btn btn--primary"
              onClick={handleSaveProfile}
              disabled={savingProfile}
            >
              {savingProfile ? 'Guardando...' : 'Guardar Perfil'}
            </button>
          </div>
        </div>

        {/* 2. Datos de la Empresa y Moneda */}
        <div className="card">
          <h2 className={styles.sectionTitle}>
            <span>Datos del Negocio y Moneda</span>
            <span style={{ fontSize: '11px', color: 'var(--color-gray-400)' }}>100% Colombia</span>
          </h2>

          <div className={styles.field}>
            <label className="input-label" htmlFor="businessName">Nombre Comercial del Negocio</label>
            <input
              id="businessName"
              className="input"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              placeholder="Ej. Inversiones El Diamante"
            />
          </div>

          <div className={styles.fieldRow}>
            <div className={styles.field}>
              <label className="input-label" htmlFor="businessNit">NIT o Cédula Comercial</label>
              <input
                id="businessNit"
                className="input"
                value={businessNit}
                onChange={(e) => setBusinessNit(e.target.value)}
                placeholder="Ej. 900.123.456-7"
              />
            </div>
            <div className={styles.field}>
              <label className="input-label" htmlFor="businessCity">Ciudad / Municipio</label>
              <input
                id="businessCity"
                className="input"
                value={businessCity}
                onChange={(e) => setBusinessCity(e.target.value)}
                placeholder="Ej. Medellín, Antioquia"
              />
            </div>
          </div>

          <div className={styles.field}>
            <label className="input-label" htmlFor="businessAddress">Dirección o Sede Principal</label>
            <input
              id="businessAddress"
              className="input"
              value={businessAddress}
              onChange={(e) => setBusinessAddress(e.target.value)}
              placeholder="Ej. Cra 45 # 50-20, Centro"
            />
          </div>

          {/* Moneda Fija COP - Rediseñada sin selectores ajenos */}
          <div className={styles.field}>
            <label className="input-label">Moneda de Operación</label>
            <div className={styles.currencyBox}>
              <div className={styles.currencyText}>
                <span className={styles.currencyTitle}>Pesos Colombianos ($ COP)</span>
                <span className={styles.currencySub}>Moneda fija de la plataforma. Valores enteros sin decimales.</span>
              </div>
              <span className={styles.currencyPill}>100% COP</span>
            </div>
          </div>
        </div>

        {/* 3. Parámetros de Crédito por Defecto */}
        <div className="card">
          <h2 className={styles.sectionTitle}>
            <span>Parámetros Financieros por Defecto</span>
          </h2>
          <p className={styles.fieldHint} style={{ marginBottom: 16 }}>
            Valores estándar precargados automáticamente al crear un nuevo crédito o simular en calle.
          </p>

          <div className={styles.fieldRow}>
            <div className={styles.field}>
              <label className="input-label" htmlFor="defaultInterest">Tasa de Interés Base (%)</label>
              <input
                id="defaultInterest"
                type="number"
                min="1"
                max="100"
                className="input"
                value={defaultInterestRate}
                onChange={(e) => setDefaultInterestRate(Number(e.target.value))}
              />
              <p className={styles.fieldHint}>Tasa sugerida (ej. 20%)</p>
            </div>

            <div className={styles.field}>
              <label className="input-label" htmlFor="defaultInstallments">Plazo Habitual (Cuotas)</label>
              <input
                id="defaultInstallments"
                type="number"
                min="1"
                max="180"
                className="input"
                value={defaultInstallments}
                onChange={(e) => setDefaultInstallments(Number(e.target.value))}
              />
              <p className={styles.fieldHint}>Ej. 24 cuotas (24 días)</p>
            </div>
          </div>

          <div className={styles.fieldRow}>
            <div className={styles.field}>
              <label className="input-label" htmlFor="defaultFrequency">Frecuencia Habitual</label>
              <select
                id="defaultFrequency"
                className="input"
                value={defaultFrequency}
                onChange={(e) => setDefaultFrequency(e.target.value as LoanFrequency)}
              >
                <option value="daily">Diario (Lunes a Sábado)</option>
                <option value="weekly">Semanal</option>
                <option value="biweekly">Quincenal</option>
                <option value="monthly">Mensual</option>
              </select>
            </div>

            <div className={styles.field}>
              <label className="input-label" htmlFor="graceDays">Días de Gracia para Mora</label>
              <input
                id="graceDays"
                type="number"
                min="0"
                max="15"
                className="input"
                value={graceDays}
                onChange={(e) => setGraceDays(Number(e.target.value))}
              />
              <p className={styles.fieldHint}>Días antes de activar semáforo en rojo</p>
            </div>
          </div>
        </div>

        {/* 4. Reglas Operativas de Calle y Cobradores */}
        <div className="card">
          <h2 className={styles.sectionTitle}>
            <span>Operación en Calle y Cobradores</span>
          </h2>

          <div className={styles.toggleList}>
            <div className={styles.toggleItem}>
              <div className={styles.toggleLabel}>
                <span className={styles.toggleTitle}>Geolocalización GPS Obligatoria</span>
                <span className={styles.toggleDesc}>
                  Exige coordenadas GPS al registrar cada pago para auditar la presencia en calle.
                </span>
              </div>
              <label className={styles.switch}>
                <input
                  type="checkbox"
                  checked={requireGps}
                  onChange={(e) => setRequireGps(e.target.checked)}
                />
                <span className={styles.slider} />
              </label>
            </div>

            <div className={styles.toggleItem}>
              <div className={styles.toggleLabel}>
                <span className={styles.toggleTitle}>Permitir Abonos Parciales</span>
                <span className={styles.toggleDesc}>
                  Habilita registrar pagos inferiores a la cuota cuando el cliente no tiene el saldo completo.
                </span>
              </div>
              <label className={styles.switch}>
                <input
                  type="checkbox"
                  checked={allowPartialPayments}
                  onChange={(e) => setAllowPartialPayments(e.target.checked)}
                />
                <span className={styles.slider} />
              </label>
            </div>

            <div className={styles.toggleItem}>
              <div className={styles.toggleLabel}>
                <span className={styles.toggleTitle}>Arqueo y Cierre Diario Obligatorio</span>
                <span className={styles.toggleDesc}>
                  El cobrador debe cuadrar y declarar el dinero en caja antes de abrir una nueva jornada.
                </span>
              </div>
              <label className={styles.switch}>
                <input
                  type="checkbox"
                  checked={requireDailyClosure}
                  onChange={(e) => setRequireDailyClosure(e.target.checked)}
                />
                <span className={styles.slider} />
              </label>
            </div>

            <div className={styles.toggleItem}>
              <div className={styles.toggleLabel}>
                <span className={styles.toggleTitle}>Recibo Digital por WhatsApp</span>
                <span className={styles.toggleDesc}>
                  Habilita el botón directo para compartir el comprobante de pago por WhatsApp al cobrar.
                </span>
              </div>
              <label className={styles.switch}>
                <input
                  type="checkbox"
                  checked={autoReceiptsWhatsapp}
                  onChange={(e) => setAutoReceiptsWhatsapp(e.target.checked)}
                />
                <span className={styles.slider} />
              </label>
            </div>
          </div>
        </div>

        {/* 5. Calendario y Días No Laborables */}
        <div className="card">
          <h2 className={styles.sectionTitle}>
            <span>Días de Descanso Semanal</span>
          </h2>
          <p className={styles.fieldHint} style={{ marginBottom: 12 }}>
            Los días seleccionados no generan cobro ni cuentan en el cronograma de cuotas.
          </p>
          <div className={styles.daysGrid}>
            {WEEK_DAYS.map((day) => (
              <button
                key={day.key}
                type="button"
                className={`${styles.dayBtn} ${nonWorkingDays.includes(day.key) ? styles.dayBtnActive : ''}`}
                onClick={() => toggleDay(day.key)}
              >
                {day.label}
              </button>
            ))}
          </div>
        </div>

        {/* 6. Festivos y Excepciones */}
        <div className="card">
          <h2 className={styles.sectionTitle}>
            <span>Días Festivos de Colombia</span>
          </h2>
          <p className={styles.fieldHint} style={{ marginBottom: 12 }}>
            Fechas específicas que serán omitidas automáticamente de la ruta de cobro.
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
                <button onClick={() => removeHoliday(h)} className={styles.removeBtn} type="button" title="Eliminar festivo">✕</button>
              </div>
            ))}
          </div>
        </div>

        {/* Botón de Guardar Ajustes Generales del Negocio */}
        <div className={styles.cardFull}>
          {businessMsg && (
            <div className={`${styles.alert} ${styles[businessMsg.type]}`}>
              {businessMsg.text}
            </div>
          )}
          <button
            className="btn btn--primary btn--lg"
            style={{ width: '100%', minHeight: 48, justifyContent: 'center' }}
            onClick={handleSaveBusiness}
            disabled={savingBusiness}
          >
            {savingBusiness ? 'Guardando Ajustes...' : 'Guardar Todos los Ajustes del Negocio y Ruta'}
          </button>
        </div>

        {/* 7. Seguridad y Cambio de Contraseña */}
        <div className="card">
          <h2 className={styles.sectionTitle}>
            <span>Seguridad y Contraseña</span>
            <IconLock />
          </h2>

          {passwordMsg && (
            <div className={`${styles.alert} ${styles[passwordMsg.type]}`}>
              {passwordMsg.text}
            </div>
          )}

          <div className={styles.field}>
            <label className="input-label" htmlFor="currentPassword">Contraseña Actual</label>
            <input
              id="currentPassword"
              type="password"
              className="input"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Ingresa tu contraseña actual"
            />
          </div>

          <div className={styles.fieldRow}>
            <div className={styles.field}>
              <label className="input-label" htmlFor="newPassword">Nueva Contraseña</label>
              <input
                id="newPassword"
                type="password"
                className="input"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
              />
            </div>
            <div className={styles.field}>
              <label className="input-label" htmlFor="confirmPassword">Confirmar Contraseña</label>
              <input
                id="confirmPassword"
                type="password"
                className="input"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repite la nueva contraseña"
              />
            </div>
          </div>

          <div className={styles.cardActions}>
            <button
              className="btn btn--secondary"
              onClick={handleChangePassword}
              disabled={savingPassword}
            >
              {savingPassword ? 'Cambiando...' : 'Actualizar Contraseña'}
            </button>
          </div>
        </div>

        {/* 8. Zona de Cierre de Sesión Destacada */}
        <div className={`card ${styles.dangerCard}`}>
          <h2 className={styles.dangerTitle}>
            <IconLogout />
            <span>Zona de Salida y Cierre de Sesión</span>
          </h2>
          <p className={styles.dangerDesc}>
            Al cerrar sesión se desconectará este dispositivo de QuickCash. Podrás volver a ingresar en cualquier momento con tu usuario o correo electrónico y tu contraseña. Todos tus datos quedan asegurados en la base de datos.
          </p>
          <button
            onClick={() => setShowLogoutModal(true)}
            className={styles.logoutCardBtn}
            type="button"
          >
            <IconLogout />
            <span>Cerrar Sesión Definitivamente</span>
          </button>
        </div>
      </div>

      {/* Confirmation Modal */}
      {showLogoutModal && (
        <div className={styles.modalOverlay} onClick={() => setShowLogoutModal(false)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalIcon}>
              <IconLogout />
            </div>
            <h3 className={styles.modalTitle}>¿Deseas cerrar tu sesión?</h3>
            <p className={styles.modalDesc}>
              Saldrás de tu cuenta en QuickCash. Tendrás que ingresar tus credenciales nuevamente para acceder a tu ruta y préstamos.
            </p>
            <div className={styles.modalActions}>
              <button
                type="button"
                className={styles.modalCancelBtn}
                onClick={() => setShowLogoutModal(false)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className={styles.modalConfirmBtn}
                onClick={handleConfirmLogout}
              >
                Sí, Cerrar Sesión
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
