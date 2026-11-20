import React, { ReactNode } from 'react';
import { formatCurrency } from '@/lib/utils';
import styles from './Modal.module.css';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  width?: string;
}

export function Modal({ isOpen, onClose, title, children, width = '480px' }: ModalProps) {
  if (!isOpen) return null;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div 
        className={styles.modal} 
        style={{ maxWidth: width }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.header}>
          <h3 className={styles.title}>{title}</h3>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Cerrar">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
        <div className={styles.content}>
          {children}
        </div>
      </div>
    </div>
  );
}

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  isDestructive?: boolean;
  hideCancel?: boolean;
  isLoading?: boolean;
  confirmDisabled?: boolean;
  width?: string;
}

export function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  isDestructive = false,
  hideCancel = false,
  isLoading = false,
  confirmDisabled = false,
  width = '480px',
}: ConfirmModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} width={width}>
      <div className={styles.messageBox}>{message}</div>
      <div className={styles.footerBtns}>
        {!hideCancel && (
          <button type="button" className="btn btn--ghost" onClick={onClose} disabled={isLoading}>
            {cancelLabel}
          </button>
        )}
        <button 
          type="button"
          className={`btn ${isDestructive ? 'btn--danger' : 'btn--primary'} ${styles.massiveBtn}`} 
          disabled={confirmDisabled || isLoading}
          onClick={() => {
            onConfirm();
          }}
        >
          {isLoading ? (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              <span className={styles.btnSpinner} />
              Cargando...
            </span>
          ) : (
            confirmLabel
          )}
        </button>
      </div>
    </Modal>
  );
}

/* ============================================
 * Vistas Enriquecidas de Arqueo y Conciliación
 * Identidad: "Metal y Asfalto" con Tabular Nums
 * ============================================ */

export function ArqueoHero({ label, amount }: { label: string; amount: number | string }) {
  return (
    <div className={styles.arqueoHero}>
      <span className={styles.arqueoHeroLabel}>{label}</span>
      <span className={styles.arqueoHeroAmount}>
        {typeof amount === 'number' ? formatCurrency(amount) : amount}
      </span>
    </div>
  );
}

export function ArqueoRow({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: ReactNode;
  highlight?: boolean;
}) {
  return (
    <div className={styles.arqueoRow}>
      <span className={styles.arqueoLabel}>{label}</span>
      <span
        className={styles.arqueoValue}
        style={
          highlight
            ? {
                color: 'var(--color-safety-yellow)',
                backgroundColor: 'var(--color-asphalt)',
                padding: '2px 8px',
                borderRadius: '4px',
              }
            : undefined
        }
      >
        {value}
      </span>
    </div>
  );
}

export function ArqueoDivider() {
  return <div className={styles.arqueoDivider} />;
}

interface AlertModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  message: ReactNode;
  buttonLabel?: string;
  isError?: boolean;
}

export function AlertModal({
  isOpen,
  onClose,
  title = 'Aviso',
  message,
  buttonLabel = 'Entendido',
  isError = false
}: AlertModalProps) {
  return (
    <ConfirmModal
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={onClose}
      title={title}
      message={message}
      confirmLabel={buttonLabel}
      hideCancel={true}
      isDestructive={isError}
    />
  );
}

interface PromptModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (value: string) => void;
  title: string;
  label: string;
  placeholder?: string;
  defaultValue?: string;
  type?: string;
  confirmLabel?: string;
}

export function PromptModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  label,
  placeholder = '',
  defaultValue = '',
  type = 'text',
  confirmLabel = 'Aceptar'
}: PromptModalProps) {
  const [value, setValue] = React.useState(defaultValue);

  // Reset value when modal opens
  React.useEffect(() => {
    if (isOpen) setValue(defaultValue);
  }, [isOpen, defaultValue]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!value.trim()) return;
    onConfirm(value);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} width="400px">
      <form onSubmit={handleSubmit}>
        <div className={styles.promptField}>
          <label className="input-label">{label}</label>
          <input
            autoFocus
            type={type}
            className="input"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={placeholder}
          />
        </div>
        <div className={styles.footerBtns}>
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className="btn btn--primary" disabled={!value.trim()}>
            {confirmLabel}
          </button>
        </div>
      </form>
    </Modal>
  );
}
