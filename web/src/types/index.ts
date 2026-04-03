/* ============================================
 * QuickCash — TypeScript Type Definitions
 * Tipos de la base de datos y lógica de negocio
 * ============================================ */

/* ---- Enums ---- */

export type UserRole = 'super_admin' | 'admin' | 'collector';

export type LoanFrequency = 'daily' | 'weekly' | 'biweekly' | 'monthly';

export type LoanStatus = 'active' | 'completed' | 'defaulted' | 'renewed';

export type PaymentStatus = 'pending' | 'paid' | 'partial' | 'missed' | 'grace';

export type RiskStatus = 'green' | 'yellow' | 'red';

export type InvitationStatus = 'pending' | 'accepted' | 'expired';

export type RouteClosure = 'open' | 'closed';

/* ---- Database Models ---- */

export interface Tenant {
  id: string;
  name: string;
  currency: string;
  non_working_days: string[] | unknown; // ['sunday', 'saturday']
  holidays: string[] | unknown;         // ['2026-12-25']
  created_at: string;
  updated_at: string;
}

export interface User {
  id: string;
  tenant_id: string;
  email: string;
  username: string | null; // Nuevo campo para handle con @
  full_name: string;
  role: UserRole;
  phone: string | null;
  is_active: boolean;
  created_at: string;
}

export interface Client {
  id: string;
  tenant_id: string;
  collector_id: string | null;
  full_name: string;
  document_id: string;
  phone: string | null;
  address: string | null;
  photo_id_url: string | null;
  photo_location_url: string | null;
  latitude: number | null;
  longitude: number | null;
  risk_status: RiskStatus;
  notes: string | null;
  route_id: string | null;
  created_at: string;
}

export interface Loan {
  id: string;
  tenant_id: string;
  client_id: string;
  collector_id: string;
  principal_amount: number;
  interest_rate: number;
  total_amount: number;
  total_installments: number;
  paid_installments: number;
  frequency: LoanFrequency;
  installment_amount: number;
  start_date: string;
  end_date: string;
  status: LoanStatus;
  renewed_from: string | null;
  skip_non_working_days: boolean;
  created_at: string;
}

export interface Payment {
  id: string;
  tenant_id: string;
  loan_id: string;
  collector_id: string;
  installment_number: number;
  amount_due: number;
  amount_paid: number;
  due_date: string;
  paid_date: string | null;
  status: PaymentStatus;
  latitude: number | null;
  longitude: number | null;
  is_locked: boolean;
  created_at: string;
}

export interface RouteClosureRecord {
  id: string;
  tenant_id: string;
  collector_id: string;
  closure_date: string;
  total_collected: number;
  total_expected: number;
  total_visits: number;
  status: RouteClosure;
  created_at: string;
}

export interface Invitation {
  id: string;
  tenant_id: string;
  email: string;
  role: UserRole;
  status: InvitationStatus;
  invited_by: string;
  expires_at: string;
  created_at: string;
}

/* ---- Computed / View Models ---- */

export interface LoanWithClient extends Loan {
  client: Client;
}

export interface LoanWithPayments extends Loan {
  payments: Payment[];
}

export interface ClientWithLoans extends Client {
  loans: Loan[];
  collector?: User;
}

export interface DashboardKPIs {
  capital_in_street: number;
  interest_receivable: number;
  today_collected: number;
  today_expected: number;
  delinquency_rate: number;
  total_active_loans: number;
  total_clients: number;
  risk_distribution: {
    green: number;
    yellow: number;
    red: number;
  };
}

export interface InstallmentScheduleItem {
  installment_number: number;
  due_date: string;
  amount_due: number;
  status: PaymentStatus;
  amount_paid: number;
  paid_date: string | null;
}

export interface RenewalCalculation {
  current_loan: Loan;
  remaining_balance: number;
  new_principal: number;
  net_to_disburse: number;
}

export interface CollectionRoute {
  id: string;
  tenant_id: string;
  name: string;
  zone: string | null;
  collector_id: string | null;
  color: string;
  is_active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface CollectionRouteWithDetails extends CollectionRoute {
  collector?: User | null;
  clients?: Client[];
  total_daily_quota?: number;
  total_collected_today?: number;
}
