'use client';

import { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import { Modal } from '@/components/ui/Modal';
import styles from './ClientQrModal.module.css';

interface ClientQrModalProps {
  isOpen: boolean;
  onClose: () => void;
  client: {
    id: string;
    full_name: string;
    document_id?: string;
    access_token?: string | null;
  } | null;
}

export default function ClientQrModal({ isOpen, onClose, client }: ClientQrModalProps) {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copied, setCopied] = useState(false);

  // Generar URL completa del talonario
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://quickcash.jghermanos.xyz';
  const token = client?.access_token || '';
  const talonarioUrl = token ? `${origin}/t/${token}` : '';

  useEffect(() => {
    if (isOpen && talonarioUrl) {
      QRCode.toDataURL(talonarioUrl, {
        width: 280,
        margin: 2,
        color: {
          dark: '#0F172A',
          light: '#FFFFFF',
        },
      })
        .then((url) => setQrDataUrl(url))
        .catch((err) => console.error('Error generando QR:', err));
    } else {
      setQrDataUrl('');
      setCopied(false);
    }
  }, [isOpen, talonarioUrl]);

  if (!isOpen || !client) return null;

  const handleCopy = () => {
    if (!talonarioUrl) return;
    navigator.clipboard.writeText(talonarioUrl);
    setCopied(true);
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(20);
    }
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="📱 Talonario Virtual del Cliente" width="440px">
      <div className={styles.qrContainer}>
        <div>
          <h4 className={styles.clientNameTitle}>{client.full_name}</h4>
          {client.document_id && (
            <span className={styles.clientDocSub}>CC {client.document_id}</span>
          )}
        </div>

        {/* Marco con el Código QR generado en el dispositivo */}
        <div className={styles.qrFrame}>
          {qrDataUrl ? (
            <img src={qrDataUrl} alt="Código QR del Talonario" className={styles.qrImage} />
          ) : (
            <div className={styles.qrPlaceholder}>Generando código QR...</div>
          )}
        </div>

        <div className={styles.tipBox}>
          <span>💡</span>
          <span>
            <strong>Pídele al cliente que escanee este código</strong> con la cámara de su teléfono.
            Podrá ver sus cuotas pagadas y su cuota diaria sin contraseñas ni complicaciones.
          </span>
        </div>

        {/* Enlace directo y botón copiar */}
        <div className={styles.urlBox}>
          <input
            type="text"
            readOnly
            value={talonarioUrl}
            className={styles.urlInput}
            onClick={(e) => (e.target as HTMLInputElement).select()}
          />
          <button type="button" className={styles.copyBtn} onClick={handleCopy}>
            {copied ? '¡Copiado! ✅' : 'Copiar Enlace'}
          </button>
        </div>

        <div className={styles.actionRow}>
          <a
            href={talonarioUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn--ghost btn--sm"
          >
            Abrir Talonario ↗
          </a>
          <button type="button" className="btn btn--primary btn--sm" onClick={onClose}>
            Entendido
          </button>
        </div>
      </div>
    </Modal>
  );
}
