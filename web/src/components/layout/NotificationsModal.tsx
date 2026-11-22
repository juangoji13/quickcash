'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useLockBodyScroll } from '@/hooks';
import styles from './NotificationsModal.module.css';

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  time: string;
  type: 'info' | 'warning' | 'success';
  read: boolean;
  link?: string;
}

interface NotificationsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onClearDot?: () => void;
  notifications?: NotificationItem[];
}

export default function NotificationsModal({
  isOpen,
  onClose,
  onClearDot,
  notifications: initialNotifications = [],
}: NotificationsModalProps) {
  useLockBodyScroll(isOpen);
  const router = useRouter();
  const [items, setItems] = useState<NotificationItem[]>(initialNotifications);

  useEffect(() => {
    setItems(initialNotifications);
  }, [initialNotifications]);

  if (!isOpen) return null;

  const handleMarkAllRead = () => {
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
    if (onClearDot) onClearDot();
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(25);
    }
  };

  const handleItemClick = (item: NotificationItem) => {
    if (item.link) {
      onClose();
      router.push(item.link);
    }
  };

  const unreadCount = items.filter((n) => !n.read).length;

  return (
    <div className={styles.overlay} onClick={onClose} role="dialog" aria-modal="true" aria-label="Notificaciones">
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <div className={styles.headerTitleWrap}>
            <div className={styles.headerIcon}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
              </svg>
            </div>
            <div>
              <h3 className={styles.title}>Notificaciones</h3>
              <p className={styles.subtitle}>
                {unreadCount > 0 ? `${unreadCount} ${unreadCount === 1 ? 'aviso nuevo' : 'avisos nuevos'}` : 'Al día'}
              </p>
            </div>
          </div>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Cerrar notificaciones">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div className={styles.list}>
          {items.length === 0 ? (
            <div className={styles.emptyState}>
              <div className={styles.emptyIcon}>
                <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                  <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
                </svg>
              </div>
              <h4 className={styles.emptyTitle}>Todo al día</h4>
              <p className={styles.emptyText}>No tienes alertas, arqueos por conciliar ni cobros atrasados en este momento.</p>
            </div>
          ) : (
            items.map((item) => (
              <div
                key={item.id}
                className={`${styles.item} ${!item.read ? styles.itemUnread : ''}`}
                onClick={() => handleItemClick(item)}
                style={{ cursor: item.link ? 'pointer' : 'default' }}
              >
                <div className={styles.itemHeader}>
                  <span className={`${styles.badge} ${styles['badge_' + item.type]}`}>
                    {item.type === 'success' ? 'Operación' : item.type === 'warning' ? 'Alerta' : 'Aviso'}
                  </span>
                  <span className={styles.time}>{item.time}</span>
                </div>
                <h4 className={styles.itemTitle}>{item.title}</h4>
                <p className={styles.itemMessage}>{item.message}</p>
              </div>
            ))
          )}
        </div>

        <div className={styles.footer}>
          {unreadCount > 0 && (
            <button className={styles.markReadBtn} onClick={handleMarkAllRead}>
              Marcar todas como leídas
            </button>
          )}
          <button className={styles.doneBtn} onClick={onClose}>
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
}
