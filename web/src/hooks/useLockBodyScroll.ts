'use client';

import { useEffect } from 'react';

/**
 * useLockBodyScroll
 * Bloquea el scroll del body/html cuando un modal o backdrop está abierto,
 * previniendo el "scroll bleed / scroll chaining" en navegadores móviles (iOS Safari / Android Chrome).
 * Preserva y restaura exactamente la posición de scroll de la ventana.
 */
export function useLockBodyScroll(isLocked: boolean) {
  useEffect(() => {
    if (!isLocked || typeof window === 'undefined' || typeof document === 'undefined') return;

    const originalOverflow = document.body.style.overflow;
    const originalPosition = document.body.style.position;
    const originalTop = document.body.style.top;
    const originalWidth = document.body.style.width;
    const scrollY = window.scrollY;

    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = '100%';

    return () => {
      document.body.style.overflow = originalOverflow;
      document.body.style.position = originalPosition;
      document.body.style.top = originalTop;
      document.body.style.width = originalWidth;
      window.scrollTo(0, scrollY);
    };
  }, [isLocked]);
}
