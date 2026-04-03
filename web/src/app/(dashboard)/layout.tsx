'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/hooks';
import Sidebar from '@/components/layout/Sidebar';
import BottomNav from '@/components/layout/BottomNav';
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

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { session, isLoading, appUser } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !session) {
      router.replace('/login');
    }
  }, [session, isLoading, router]);

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
            <button className={styles.iconBtn} aria-label="Notificaciones">
              <IconBell />
              <span className={styles.notificationDot} />
            </button>
          </div>
        </header>

        {/* Mobile TopBar: ⚙️ [QuickCash] 🔔 */}
        <header className={`${styles.topBar} ${styles.topBarMobile}`} style={{ position: 'relative', justifyContent: 'space-between', alignItems: 'center' }}>
          <Link href="/settings" className={styles.iconBtn} aria-label="Configuración">
            <IconSettings />
          </Link>
          <div className={styles.mobileLogo} style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', margin: 0 }}>
            Quick<span>Cash</span>
          </div>
          <button className={styles.iconBtn} aria-label="Notificaciones" style={{ position: 'relative' }}>
            <IconBell />
            <span className={styles.notificationDot} />
          </button>
        </header>

        <div className={styles.pageContent}>{children}</div>
      </main>

      {/* Bottom Navigation — solo móvil */}
      <BottomNav />
    </div>
  );
}

