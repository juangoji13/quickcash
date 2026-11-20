'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

interface PwaContextType {
  isOnline: boolean;
  isInstallable: boolean;
  installPwa: () => Promise<boolean>;
}

const PwaContext = createContext<PwaContextType>({
  isOnline: true,
  isInstallable: false,
  installPwa: async () => false,
});

export function PwaProvider({ children }: { children: React.ReactNode }) {
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstallable, setIsInstallable] = useState<boolean>(false);
  const [isDismissed, setIsDismissed] = useState<boolean>(false);

  useEffect(() => {
    // 1. Initial Online / Offline detection
    setIsOnline(typeof navigator !== 'undefined' ? navigator.onLine : true);

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // 2. Service Worker Registration
    if ('serviceWorker' in navigator && window.location.protocol.startsWith('http')) {
      const registerSW = () => {
        navigator.serviceWorker
          .register('/sw.js')
          .then((registration) => {
            console.log('⚡ QuickCash PWA: Service Worker registrado en scope:', registration.scope);
          })
          .catch((error) => {
            console.warn('⚠️ QuickCash PWA: Error al registrar Service Worker:', error);
          });
      };

      if (document.readyState === 'complete') {
        registerSW();
      } else {
        window.addEventListener('load', registerSW);
      }
    }

    // 3. BeforeInstallPrompt detection for installable PWA
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setIsInstallable(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const installPwa = async (): Promise<boolean> => {
    if (!deferredPrompt) {
      return false;
    }

    try {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === 'accepted') {
        setIsInstallable(false);
        setDeferredPrompt(null);
        return true;
      }
      return false;
    } catch (err) {
      console.warn('Error al activar instalación de PWA:', err);
      return false;
    }
  };

  return (
    <PwaContext.Provider value={{ isOnline, isInstallable, installPwa }}>
      {children}

      {/* Floating PWA Install Prompt with QuickCash Brand */}
      {isInstallable && !isDismissed && (
        <div
          role="dialog"
          aria-label="Descargar aplicación QuickCash"
          style={{
            position: 'fixed',
            bottom: '95px',
            left: '50%',
            transform: 'translateX(-50%)',
            backgroundColor: '#2C3E50',
            color: '#FFFFFF',
            border: '1.5px solid #F1C40F',
            borderRadius: '14px',
            padding: '12px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            boxShadow: '0 8px 30px rgba(0, 0, 0, 0.4)',
            zIndex: 9998,
            maxWidth: '92%',
            width: '390px',
            animation: 'slideUp 0.3s ease-out',
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/icon-192x192.png"
            alt="QuickCash Logo"
            width={44}
            height={44}
            style={{
              borderRadius: '10px',
              border: '1px solid rgba(241, 196, 15, 0.4)',
              boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
              flexShrink: 0,
            }}
          />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: '13px', lineHeight: 1.2 }}>
              Instalar Quick<span style={{ color: '#F1C40F' }}>Cash</span>
            </div>
            <div style={{ fontSize: '11px', color: '#CBD5E1', marginTop: '2px' }}>
              App nativa para gestión en calle
            </div>
          </div>
          <button
            onClick={installPwa}
            style={{
              backgroundColor: '#F1C40F',
              color: '#1A252F',
              border: 'none',
              borderRadius: '8px',
              padding: '8px 14px',
              fontFamily: 'var(--font-heading)',
              fontWeight: 800,
              fontSize: '12px',
              cursor: 'pointer',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
              flexShrink: 0,
            }}
          >
            Instalar
          </button>
          <button
            onClick={() => setIsDismissed(true)}
            aria-label="Cerrar aviso"
            style={{
              background: 'none',
              border: 'none',
              color: '#85929E',
              cursor: 'pointer',
              fontSize: '16px',
              padding: '2px',
              lineHeight: 1,
            }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Offline Status Warning */}
      {!isOnline && (
        <div
          role="status"
          aria-live="polite"
          style={{
            position: 'fixed',
            bottom: '16px',
            left: '50%',
            transform: 'translateX(-50%)',
            backgroundColor: '#C0392B',
            color: '#FFFFFF',
            padding: '10px 18px',
            borderRadius: '6px',
            fontWeight: 600,
            fontSize: '13px',
            zIndex: 9999,
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            letterSpacing: '0.5px',
          }}
        >
          <span>⚠️</span>
          <span>Sin conexión a internet. Operando en modo offline.</span>
        </div>
      )}
    </PwaContext.Provider>
  );
}

export function usePwa() {
  return useContext(PwaContext);
}
