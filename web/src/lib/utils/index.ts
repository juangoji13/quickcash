/* ============================================
 * QuickCash — Utility Functions
 * Helpers para formateo, cálculos y validaciones
 * ============================================ */

/**
 * Formatea un número como moneda
 */
export function formatCurrency(amount: number, currency: string = 'COP'): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Formatea una fecha ISO a formato legible
 */
export function formatDate(dateString: string): string {
  if (!dateString) return '—';
  // Handle both ISO timestamps and date-only strings
  const date = dateString.length <= 10
    ? new Date(dateString + 'T12:00:00')
    : new Date(dateString);
  if (isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('es-CO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

/**
 * Formatea una fecha con hora
 */
export function formatDateTime(dateString: string): string {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('es-CO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

/**
 * Calcula el porcentaje de un valor
 */
export function percentage(value: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((value / total) * 100 * 10) / 10;
}

/**
 * Genera las clases CSS del semáforo de riesgo
 */
export function getRiskBadgeClass(status: 'green' | 'yellow' | 'red'): string {
  const classes: Record<string, string> = {
    green: 'badge badge--green',
    yellow: 'badge badge--yellow',
    red: 'badge badge--red',
  };
  return classes[status] || 'badge';
}

/**
 * Devuelve el label del semáforo de riesgo
 */
export function getRiskLabel(status: 'green' | 'yellow' | 'red'): string {
  const labels: Record<string, string> = {
    green: 'Al día',
    yellow: 'Alerta',
    red: 'Mora crítica',
  };
  return labels[status] || 'Desconocido';
}

/**
 * Devuelve el label del estado de un préstamo
 */
export function getLoanStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    active: 'Activo',
    completed: 'Completado',
    defaulted: 'En mora',
    renewed: 'Renovado',
  };
  return labels[status] || status;
}

/**
 * Devuelve el label de la frecuencia de pago
 */
export function getFrequencyLabel(freq: string): string {
  const labels: Record<string, string> = {
    daily: 'Diario',
    weekly: 'Semanal',
    biweekly: 'Quincenal',
  };
  return labels[freq] || freq;
}

/**
 * Genera un color semáforo para usar en inline styles o charts
 */
export function getRiskColor(status: 'green' | 'yellow' | 'red'): string {
  const colors: Record<string, string> = {
    green: '#22c55e',
    yellow: '#eab308',
    red: '#ef4444',
  };
  return colors[status] || '#6b7280';
}

/**
 * Trunca un string a un máximo de caracteres
 */
export function truncate(str: string, maxLength: number = 30): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength) + '…';
}

/**
 * Clasifica las iniciales de un nombre
 */
export function getInitials(name: string): string {
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}
