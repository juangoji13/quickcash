/* ============================================
 * QuickCash — Form Validators
 * Validaciones reutilizables para formularios
 * ============================================ */

export interface ValidationResult {
  isValid: boolean;
  error?: string;
}

export function validateEmail(email: string): ValidationResult {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email.trim()) return { isValid: false, error: 'El correo es obligatorio' };
  if (!regex.test(email)) return { isValid: false, error: 'El correo no es válido' };
  return { isValid: true };
}

export function validateRequired(value: string, fieldName: string): ValidationResult {
  if (!value.trim()) return { isValid: false, error: `${fieldName} es obligatorio` };
  return { isValid: true };
}

export function validatePositiveNumber(value: number, fieldName: string): ValidationResult {
  if (isNaN(value) || value <= 0) {
    return { isValid: false, error: `${fieldName} debe ser un número positivo` };
  }
  return { isValid: true };
}

export function validateMinLength(value: string, min: number, fieldName: string): ValidationResult {
  if (value.length < min) {
    return { isValid: false, error: `${fieldName} debe tener al menos ${min} caracteres` };
  }
  return { isValid: true };
}

export function validateDocumentId(docId: string): ValidationResult {
  if (!docId.trim()) return { isValid: false, error: 'El número de documento es obligatorio' };
  if (docId.length < 5) return { isValid: false, error: 'El número de documento es muy corto' };
  return { isValid: true };
}

export function validateLoanAmount(amount: number, min: number = 10000): ValidationResult {
  if (isNaN(amount)) return { isValid: false, error: 'El monto no es válido' };
  if (amount < min) {
    return { isValid: false, error: `El monto mínimo de préstamo es ${min}` };
  }
  return { isValid: true };
}

export function validateInterestRate(rate: number): ValidationResult {
  if (isNaN(rate) || rate < 0 || rate > 100) {
    return { isValid: false, error: 'La tasa de interés debe estar entre 0% y 100%' };
  }
  return { isValid: true };
}

export function validateInstallments(count: number): ValidationResult {
  if (!Number.isInteger(count) || count < 1 || count > 365) {
    return { isValid: false, error: 'Las cuotas deben ser entre 1 y 365' };
  }
  return { isValid: true };
}

export function validatePhone(phone: string): ValidationResult {
  if (!phone.trim()) return { isValid: true }; // Optional field
  const cleaned = phone.replace(/[\s\-\(\)]/g, '');
  if (cleaned.length < 7 || cleaned.length > 15) {
    return { isValid: false, error: 'El número de teléfono no es válido' };
  }
  return { isValid: true };
}
