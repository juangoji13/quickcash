'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/hooks';
import Sidebar from '@/components/layout/Sidebar';
import BottomNav from '@/components/layout/BottomNav';
import NotificationsModal from '@/components/layout/NotificationsModal';
import SubscriptionLockScreen from '@/components/layout/SubscriptionLockScreen';
import { checkTenantSubscriptionStatus } from '@/services/superadmin.service';
import styles from './dashboard.module.css';

function IconSettings() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/>
    </svg>
  );
}

function IconBell() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
      <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
    </svg>
  );
}

function IconLogout() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/>
      <polyline points="16 17 21 12 16 7"/>
      <line x1="21" y1="12" x2="9" y2="12"/>
    </svg>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { session, isLoading, appUser, signOut } = useAuth();
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [hasUnread, setHasUnread] = useState(true);
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [billingLock, setBillingLock] = useState<{
    isBlocked: boolean;
    monthlyFee: number;
    contactPhone: string;
  } | null>(null);
  const router = useRouter();
  const pathname = usePathname();

  const toggleNotifications = () => {
    setIsNotifOpen((prev) => !prev);
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(20);
    }
  };

  useEffect(() => {
    if (!isLoading && !session) {
      router.replace('/login');
      return;
    }

    // Proteger todas las rutas de préstamos para el SuperAdmin
    if (appUser && (appUser.role === 'superadmin' || (appUser.role as string) === 'super_admin')) {
      if (pathname !== '/superadmin' && pathname !== '/settings') {
        router.replace('/superadmin');
      }
    }
  }, [session, isLoading, appUser, pathname, router]);

  // Verificar estado de suscripción de la cuenta (solo para prestamistas y cobradores)
  useEffect(() => {
    if (!appUser || appUser.role === 'superadmin' || (appUser.role as string) === 'super_admin') {
      return;
    }

    if (appUser.tenant_id) {
      checkTenantSubscriptionStatus(appUser.tenant_id).then((res) => {
        if (res && res.isBlocked) {
          setBillingLock({
            isBlocked: true,
            monthlyFee: res.monthlyFee,
            contactPhone: res.contactPhone,
          });
        } else {
          setBillingLock(null);
        }
      });
    }
  }, [appUser, pathname]);

  if (isLoggingOut) {
    return (
      <div className={styles.loadingScreen}>
        <div className={styles.loadingLogo}>
          Quick<span>Cash</span>
        </div>
        <p style={{ marginTop: '16px', color: 'var(--color-gray-400)', fontSize: '0.9rem', fontWeight: 600 }}>
          Cerrando sesión de forma segura...
        </p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className={styles.loadingScreen}>
        <div className={styles.loadingLogo}>
          Quick<span>Cash</span>
        </div>
        <div className={styles.loadingBar}>
          <div className={styles.loadingBarInner} />
        </div>
      </div>
    );
  }

  if (!session) return null;

  // Si la suscripción del negocio está bloqueada por falta de pago
  if (billingLock?.isBlocked) {
    return (
      <SubscriptionLockScreen
        monthlyFee={billingLock.monthlyFee}
        contactPhone={billingLock.contactPhone}
        tenantName={appUser?.full_name ? `el negocio de ${appUser.full_name}` : 'tu negocio'}
        onSignOut={signOut}
      />
    );
  }

  // El SuperAdmin sólo puede visualizar la consola global y ajustes
  if (appUser && (appUser.role === 'superadmin' || (appUser.role as string) === 'super_admin')) {
    if (pathname !== '/superadmin' && pathname !== '/settings') {
      return null;
    }
  }

  return (
    <div className={styles.dashboardLayout}>
      <Sidebar />
      <main className={styles.mainContent}>
        {/* Desktop TopBar */}
        <header className={`${styles.topBar} ${styles.topBarDesktop}`}>
          <div className={styles.pageContext}>
            <span className={styles.greeting}>
              Hola, <strong>{appUser?.full_name || 'Usuario'}</strong>
            </span>
          </div>
          {/* Logo centrado absoluto */}
          <div className={styles.topBarLogo}>
            Quick<span>Cash</span>
          </div>
          <div className={styles.topActions}>
            {appUser?.role === 'admin' && (
              <Link href="/routes" className={styles.collectorModeBtn} title="Ir a Gestión de Rutas y Cobro">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="6" cy="19" r="3"/>
                  <path d="M9 19h8.5a3.5 3.5 0 000-7h-11a3.5 3.5 0 010-7H15"/>
                  <circle cx="18" cy="5" r="3"/>
                </svg>
                <span>Modo Cobrador</span>
              </Link>
            )}
            <button className={styles.iconBtn} onClick={toggleNotifications} aria-label="Notificaciones">
              <IconBell />
              {hasUnread && <span className={styles.notificationDot} />}
            </button>
            <button
              className={styles.iconBtn}
              onClick={() => setIsLogoutModalOpen(true)}
              title="Cerrar sesión"
              aria-label="Cerrar sesión"
              style={{ color: '#E74C3C' }}
            >
              <IconLogout />
            </button>
          </div>
        </header>

        {/* Mobile TopBar */}
        <header className={`${styles.topBar} ${styles.topBarMobile}`} style={{ position: 'relative', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', zIndex: 2 }}>
            <Link href="/settings" className={styles.iconBtn} aria-label="Configuración">
              <IconSettings />
            </Link>
            {appUser?.role === 'admin' && (
              <Link href="/routes" className={styles.mobileCollectorBtn} title="Modo Cobrador" aria-label="Modo Cobrador">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="6" cy="19" r="3"/>
                  <path d="M9 19h8.5a3.5 3.5 0 000-7h-11a3.5 3.5 0 010-7H15"/>
                  <circle cx="18" cy="5" r="3"/>
                </svg>
              </Link>
            )}
          </div>
          <Link
            href={appUser?.role === 'superadmin' || (appUser?.role as string) === 'super_admin' ? '/superadmin' : '/overview'}
            className={styles.mobileLogo}
            style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', margin: 0, textDecoration: 'none' }}
          >
            Quick<span>Cash</span>
          </Link>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', zIndex: 2 }}>
            <button className={styles.iconBtn} onClick={toggleNotifications} aria-label="Notificaciones">
              <IconBell />
              {hasUnread && <span className={styles.notificationDot} />}
            </button>
            <button
              className={styles.iconBtn}
              onClick={() => setIsLogoutModalOpen(true)}
              aria-label="Cerrar sesión"
              title="Cerrar sesión"
              style={{ color: '#E74C3C' }}
            >
              <IconLogout />
            </button>
          </div>
        </header>

        <div className={styles.pageContent}>{children}</div>
      </main>

      {/* Modal de Notificaciones */}
      <NotificationsModal
        isOpen={isNotifOpen}
        onClose={() => setIsNotifOpen(false)}
        onClearDot={() => setHasUnread(false)}
      />

      {/* Modal de Cierre de Sesión Global */}
      {isLogoutModalOpen && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(44, 62, 80, 0.65)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '16px',
            animation: 'fadeIn 0.2s ease-out',
          }}
          onClick={() => setIsLogoutModalOpen(false)}
        >
          <div
            style={{
              background: '#FFFFFF',
              borderRadius: '16px',
              padding: '24px',
              maxWidth: '400px',
              width: '100%',
              boxShadow: '0 10px 30px rgba(0,0,0,0.25)',
              border: '1px solid #E5E7EB',
              textAlign: 'center',
              animation: 'slideUp 0.2s ease-out',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                width: '54px',
                height: '54px',
                borderRadius: '50%',
                backgroundColor: '#FEF2F2',
                color: '#C0392B',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px auto',
                border: '2px solid #FEE2E2',
              }}
            >
              <IconLogout />
            </div>
            <h3
              style={{
                fontFamily: 'var(--font-heading)',
                fontSize: '1.2rem',
                fontWeight: 800,
                color: 'var(--color-asphalt)',
                margin: '0 0 8px 0',
              }}
            >
              ¿Cerrar sesión en QuickCash?
            </h3>
            <p
              style={{
                fontSize: '0.875rem',
                color: 'var(--color-gray-400)',
                lineHeight: 1.5,
                margin: '0 0 24px 0',
              }}
            >
              Saldrás de tu cuenta en este dispositivo. Tus clientes, cobros y préstamos seguirán respaldados y seguros.
            </p>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                type="button"
                onClick={() => setIsLogoutModalOpen(false)}
                style={{
                  flex: 1,
                  minHeight: '44px',
                  padding: '10px',
                  backgroundColor: '#F3F4F6',
                  border: '1px solid #D1D5DB',
                  borderRadius: '8px',
                  fontFamily: 'var(--font-heading)',
                  fontSize: '0.85rem',
                  fontWeight: 700,
                  color: '#4B5563',
                  cursor: 'pointer',
                }}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={async () => {
                  setIsLogoutModalOpen(false);
                  setIsLoggingOut(true);
                  await signOut();
                }}
                style={{
                  flex: 1,
                  minHeight: '44px',
                  padding: '10px',
                  backgroundColor: '#C0392B',
                  border: 'none',
                  borderRadius: '8px',
                  fontFamily: 'var(--font-heading)',
                  fontSize: '0.85rem',
                  fontWeight: 700,
                  color: '#FFFFFF',
                  cursor: 'pointer',
                }}
              >
                Sí, Salir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Navigation — solo móvil */}
      <BottomNav />
    </div>
  );
}
