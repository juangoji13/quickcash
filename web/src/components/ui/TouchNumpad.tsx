'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useLockBodyScroll } from '@/hooks';
import { formatCurrency } from '@/lib/utils';
import styles from './TouchNumpad.module.css';

function triggerHaptic(duration: number | number[] = 25) {
  if (typeof window !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate(duration as any);
    } catch {
      // Ignorar si no está soportado
    }
  }
}

export interface TouchNumpadProps {
  initialAmount?: number;
  expectedQuota?: number;
  clientName?: string;
  title?: string;
  confirmLabel?: string;
  onConfirm: (amount: number) => void;
  onClose?: () => void;
  isOpen?: boolean;
}

export function TouchNumpad({
  initialAmount = 0,
  expectedQuota,
  clientName,
  title = 'Registrar Abono',
  confirmLabel = 'Confirmar Abono',
  onConfirm,
  onClose,
}: TouchNumpadProps) {
  const [valStr, setValStr] = useState<string>(
    initialAmount > 0 ? initialAmount.toString() : ''
  );

  useEffect(() => {
    setValStr(initialAmount > 0 ? initialAmount.toString() : '');
  }, [initialAmount]);

  const numericValue = parseInt(valStr || '0', 10);

  const handleDigit = useCallback((d: string) => {
    triggerHaptic(20);
    setValStr((prev) => {
      if (d === '000') {
        if (!prev || prev === '0') return prev;
        const next = prev + '000';
        return next.length > 10 ? prev : next;
      }
      if (prev === '0') return d;
      const next = prev + d;
      return next.length > 10 ? prev : next;
    });
  }, []);

  const handleDelete = useCallback(() => {
    triggerHaptic(30);
    setValStr((prev) => (prev.length > 1 ? prev.slice(0, -1) : ''));
  }, []);

  const handleClear = useCallback(() => {
    triggerHaptic(35);
    setValStr('');
  }, []);

  const handleAddShortcut = useCallback((amount: number) => {
    triggerHaptic(30);
    setValStr((prev) => {
      const curr = parseInt(prev || '0', 10);
      const next = Math.max(0, curr + amount);
      return next.toString();
    });
  }, []);

  const handleSetExact = useCallback((amount: number) => {
    triggerHaptic(35);
    setValStr(amount.toString());
  }, []);

  const handleConfirm = () => {
    if (numericValue <= 0) return;
    triggerHaptic([40, 30, 60]);
    onConfirm(numericValue);
  };

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.titleBox}>
          <span className={styles.title}>{title}</span>
          {clientName && (
            <span className={styles.clientSubtitle}>Cliente: {clientName}</span>
          )}
        </div>
        {onClose && (
          <button
            type="button"
            className={styles.closeBtn}
            onClick={onClose}
            aria-label="Cerrar teclado"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        )}
      </div>

      {/* Real-time Display — 100% prevenido el teclado nativo */}
      <div className={styles.displayWrapper}>
        <span className={styles.displayLabel}>Monto a Cobrar</span>
        <div className={styles.displayAmount}>
          {formatCurrency(numericValue)}
        </div>
        {expectedQuota !== undefined && expectedQuota > 0 && (
          <div className={styles.displayExpected}>
            Cuota esperada: {formatCurrency(expectedQuota)}
            {numericValue > 0 && (
              <span>
                {' '}
                ·{' '}
                {numericValue >= expectedQuota
                  ? numericValue === expectedQuota
                    ? 'Cuota completa'
                    : `+${formatCurrency(numericValue - expectedQuota)} (Excedente)`
                  : `-${formatCurrency(expectedQuota - numericValue)} (Abono)`}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Shortcuts Row (+10k, +20k, +50k, Cuota Exacta) */}
      <div className={styles.shortcutsRow}>
        <button
          type="button"
          className={styles.shortcutBtn}
          onClick={() => handleAddShortcut(10000)}
        >
          +10.000
        </button>
        <button
          type="button"
          className={styles.shortcutBtn}
          onClick={() => handleAddShortcut(20000)}
        >
          +20.000
        </button>
        <button
          type="button"
          className={styles.shortcutBtn}
          onClick={() => handleAddShortcut(50000)}
        >
          +50.000
        </button>
        {expectedQuota && expectedQuota > 0 ? (
          <button
            type="button"
            className={`${styles.shortcutBtn} ${styles.shortcutBtnExact}`}
            onClick={() => handleSetExact(expectedQuota)}
          >
            Exacta
          </button>
        ) : (
          <button
            type="button"
            className={styles.shortcutBtn}
            onClick={handleClear}
          >
            Limpiar
          </button>
        )}
      </div>

      {/* 60px Massive Tactile Numeric Keypad */}
      <div className={styles.numpadGrid}>
        <button type="button" className={styles.numKey} onClick={() => handleDigit('1')}>
          1
        </button>
        <button type="button" className={styles.numKey} onClick={() => handleDigit('2')}>
          2
        </button>
        <button type="button" className={styles.numKey} onClick={() => handleDigit('3')}>
          3
        </button>

        <button type="button" className={styles.numKey} onClick={() => handleDigit('4')}>
          4
        </button>
        <button type="button" className={styles.numKey} onClick={() => handleDigit('5')}>
          5
        </button>
        <button type="button" className={styles.numKey} onClick={() => handleDigit('6')}>
          6
        </button>

        <button type="button" className={styles.numKey} onClick={() => handleDigit('7')}>
          7
        </button>
        <button type="button" className={styles.numKey} onClick={() => handleDigit('8')}>
          8
        </button>
        <button type="button" className={styles.numKey} onClick={() => handleDigit('9')}>
          9
        </button>

        <button
          type="button"
          className={`${styles.numKey} ${styles.specialKey}`}
          onClick={() => handleDigit('000')}
          title="Agregar tres ceros"
        >
          000
        </button>
        <button type="button" className={styles.numKey} onClick={() => handleDigit('0')}>
          0
        </button>
        <button
          type="button"
          className={`${styles.numKey} ${styles.specialKey} ${styles.deleteKey}`}
          onClick={handleDelete}
          title="Borrar dígito"
        >
          ⌫
        </button>
      </div>

      {/* Confirm Button */}
      <button
        type="button"
        className={styles.confirmBtn}
        disabled={numericValue <= 0}
        onClick={handleConfirm}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
          <polyline points="20 6 9 17 4 12" />
        </svg>
        <span>
          {confirmLabel} {numericValue > 0 ? `(${formatCurrency(numericValue)})` : ''}
        </span>
      </button>
    </div>
  );
}

/**
 * Modal Bottom-Sheet para abrir el TouchNumpad desde cualquier vista móvil
 */
export interface TouchNumpadModalProps extends TouchNumpadProps {
  isOpen: boolean;
  onClose: () => void;
}

export function TouchNumpadModal({
  isOpen,
  onClose,
  ...props
}: TouchNumpadModalProps) {
  useLockBodyScroll(isOpen);

  if (!isOpen) return null;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.bottomSheet} onClick={(e) => e.stopPropagation()}>
        <TouchNumpad {...props} onClose={onClose} />
      </div>
    </div>
  );
}
export default TouchNumpad;
