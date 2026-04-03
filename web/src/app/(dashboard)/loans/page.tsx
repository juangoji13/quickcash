'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/hooks';
import { getLoans, createLoan, getLoanById, deleteLoan, registerPayment, payOffLoan, applyGraceDay } from '@/services/loans.service';
import { calculateLoanSchedule, calculateRenewal } from '@/lib/utils/loans';
import { getClients } from '@/services/clients.service';
import { getTenant } from '@/services/tenant.service';
import { formatCurrency, formatDate } from '@/lib/utils';
import type { LoanWithClient, Client, Tenant, InstallmentScheduleItem } from '@/types';
import { ConfirmModal, PromptModal, Modal } from '@/components/ui/Modal';
import styles from './loans.module.css';

type ViewMode = 'list' | 'create' | 'detail';

export default function LoansPage() {
  const { appUser } = useAuth();
  const [loans, setLoans] = useState<LoanWithClient[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<ViewMode>('list');
  const [filter, setFilter] = useState<'all' | 'active' | 'completed' | 'defaulted'>('all');
  const [selectedLoan, setSelectedLoan] = useState<LoanWithClient | null>(null);
  const [loanDetail, setLoanDetail] = useState<any | null>(null);
  const [expandedLoan, setExpandedLoan] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Modals
  const [deleteTarget, setDeleteTarget] = useState<{ id: string } | null>(null);
  const [payTarget, setPayTarget] = useState<{ id: string; label: string; amount: number } | null>(null);
  const [payOffTarget, setPayOffTarget] = useState<{ loanId: string; remainingAmount: number } | null>(null);
  const [graceTarget, setGraceTarget] = useState<{ paymentId: string; label: string } | null>(null);
  const [renewTarget, setRenewTarget] = useState<{ loan: LoanWithClient; remainingBalance: number } | null>(null);

  // Renovation specific form
  const [renewPrincipal, setRenewPrincipal] = useState('');
  const [renewInterestRate, setRenewInterestRate] = useState('20');
  const [renewInstallments, setRenewInstallments] = useState('20');
  const [renewFrequency, setRenewFrequency] = useState<'daily' | 'weekly' | 'biweekly' | 'monthly'>('daily');

  // Form
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [clientId, setClientId] = useState('');
  const [principal, setPrincipal] = useState('');
  const [interestRate, setInterestRate] = useState('20');
  const [installments, setInstallments] = useState('20');
  const [frequency, setFrequency] = useState<'daily' | 'weekly' | 'biweekly' | 'monthly'>('daily');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [skipNonWorking, setSkipNonWorking] = useState(true);

  // Preview
  const [preview, setPreview] = useState<{
    totalAmount: number;
    installmentAmount: number;
    endDate: string;
    schedule: InstallmentScheduleItem[];
  } | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    const [loansData, clientsData, tenantData] = await Promise.all([
      getLoans(),
      getClients(),
      getTenant(),
    ]);
    setLoans(loansData);
    setClients(clientsData);
    setTenant(tenantData);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Calcular preview cuando cambian los valores
  useEffect(() => {
    if (principal && interestRate && installments && startDate) {
      const result = calculateLoanSchedule({
        principalAmount: Number(principal),
        interestRate: Number(interestRate),
        totalInstallments: Number(installments),
        frequency,
        startDate,
        skipNonWorkingDays: skipNonWorking,
        nonWorkingDays: (tenant?.non_working_days as string[]) || ['sunday'],
        holidays: (tenant?.holidays as string[]) || [],
      });
      setPreview(result);
    } else {
      setPreview(null);
    }
  }, [principal, interestRate, installments, frequency, startDate, skipNonWorking, tenant]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!appUser || !clientId || !preview) {
      setFormError('Completa todos los campos obligatorios');
      return;
    }
    setSaving(true);
    setFormError('');

    const { data, error } = await createLoan(
      {
        tenant_id: appUser.tenant_id,
        client_id: clientId,
        collector_id: appUser.id,
        principal_amount: Number(principal),
        interest_rate: Number(interestRate),
        total_amount: preview.totalAmount,
        total_installments: Number(installments),
        frequency,
        installment_amount: preview.installmentAmount,
        start_date: startDate,
        end_date: preview.endDate,
        skip_non_working_days: skipNonWorking,
      },
      preview.schedule
    );

    if (error) {
      setFormError(error);
    } else {
      setView('list');
      resetForm();
      loadData();
    }
    setSaving(false);
  }

  function resetForm() {
    setClientId('');
    setPrincipal('');
    setInterestRate('20');
    setInstallments('20');
    setFrequency('daily');
    setStartDate(new Date().toISOString().split('T')[0]);
    setSkipNonWorking(true);
    setPreview(null);
  }

  const statusLabels: Record<string, string> = {
    active: 'Activo',
    completed: 'Completado',
    defaulted: 'En mora',
    renewed: 'Renovado',
  };

  function getPaymentLabel(status: string) {
    const labels: Record<string, string> = {
      pending: 'Pendiente',
      paid: 'Pagado',
      missed: 'Vencido',
      partial: 'Parcial',
      grace: 'Día de Gracia'
    };
    return labels[status] || status;
  }

  function getPaymentBadge(status: string) {
    const classes: Record<string, string> = {
      pending: 'badge badge--gray',
      paid: 'badge badge--green',
      missed: 'badge badge--red',
      partial: 'badge badge--yellow',
      grace: 'badge badge--blue'
    };
    return classes[status] || 'badge';
  }

  async function openDetail(loan: LoanWithClient) {
    setSelectedLoan(loan);
    setView('detail');
    setLoanDetail(null);
    const details = await getLoanById(loan.id);
    setLoanDetail(details);
  }

  async function confirmDeleteLoan() {
    if (!deleteTarget) return;
    const currentId = deleteTarget.id;
    
    // UI Optimista
    setLoans(prev => prev.filter(l => l.id !== currentId));
    setView('list');
    setSelectedLoan(null);
    setDeleteTarget(null);
    
    const { success, error } = await deleteLoan(currentId);
    if (!success) {
      alert(`Error al eliminar: ${error}`);
      loadData(); // Revertir
    }
  }

  function handleDeleteLoan() {
    if (selectedLoan) {
      setDeleteTarget({ id: selectedLoan.id });
    }
  }

  async function confirmPayInstallment(amountStr: string) {
    if (!payTarget) return;
    
    const amt = parseFloat(amountStr);
    if (isNaN(amt) || amt <= 0) return alert('Monto inválido');
    
    const { success, error } = await registerPayment(payTarget.id, amt);
    if (!success) {
      alert(`Error al registrar pago: ${error}`);
      return;
    }

    setPayTarget(null);

    // Refresh loan details
    if (selectedLoan) {
      const details = await getLoanById(selectedLoan.id);
      setLoanDetail(details);
      // Actualizar lista para reflejar el avance
      loadData();
    }
  }

  async function handlePayInstallment(paymentId: string, installmentNumber: number, amountDue: number) {
    setPayTarget({ id: paymentId, label: `Cuota #${installmentNumber}`, amount: amountDue });
  }

  async function handleQuickPay(loan: LoanWithClient) {
    // Buscar la primera cuota vencida o pendiente
    const details = await getLoanById(loan.id);
    if (!details) return alert('No se pudo cargar el detalle del préstamo.');
    
    const nextPayable = details.payments?.find((p: any) => p.status === 'missed' || p.status === 'pending' || p.status === 'partial');
    if (nextPayable) {
      setPayTarget({ id: nextPayable.id, label: `Cuota #${nextPayable.installment_number}`, amount: nextPayable.amount_due });
    } else {
      alert('Todas las cuotas de este préstamo están al día.');
    }
  }

  function handlePayOff() {
    if (!selectedLoan) return;
    const remaining = selectedLoan.total_amount - (selectedLoan.paid_installments * selectedLoan.installment_amount);
    setPayOffTarget({ loanId: selectedLoan.id, remainingAmount: remaining });
  }

  async function confirmPayOff() {
    if (!payOffTarget) return;
    const { success, error } = await payOffLoan(payOffTarget.loanId);
    setPayOffTarget(null);
    if (!success) {
      alert(`Error al saldar: ${error}`);
      return;
    }
    // Refrescar detalle y lista
    if (selectedLoan) {
      const details = await getLoanById(selectedLoan.id);
      setLoanDetail(details);
      loadData();
    }
  }

  async function handleGraceDay(paymentId: string, installmentNumber: number) {
    setGraceTarget({ paymentId, label: `Cuota #${installmentNumber}` });
  }

  function handleRenew() {
    if (!selectedLoan) return;
    const remaining = selectedLoan.total_amount - (selectedLoan.paid_installments * selectedLoan.installment_amount);
    setRenewTarget({ loan: selectedLoan, remainingBalance: remaining });
    setRenewPrincipal(selectedLoan.principal_amount.toString());
  }

  async function confirmRenewal() {
    if (!renewTarget || !selectedLoan) return;
    const np = parseFloat(renewPrincipal);
    const ni = parseFloat(renewInterestRate);
    const ninst = parseInt(renewInstallments);
    if (isNaN(np) || isNaN(ni) || isNaN(ninst)) return alert('Valores inválidos.');

    const { remainingBalance, netToDiburse, newTotalAmount } = calculateRenewal(selectedLoan, np, ni, ninst);
    
    if (netToDiburse <= 0) {
      return alert('El nuevo capital debe ser mayor a la deuda restante.');
    }

    setSaving(true);
    // 1. Pay off existing loan temporarily logically closing it
    const payOffRes = await payOffLoan(selectedLoan.id);
    if (!payOffRes.success) {
      alert('Error cerrando préstamo anterior: ' + payOffRes.error);
      setSaving(false);
      return;
    }

    // 2. Compute the schedule for the new loan
    const sd = new Date().toISOString().split('T')[0];
    const previewCalculations = calculateLoanSchedule({
      principalAmount: np,
      interestRate: ni,
      totalInstallments: ninst,
      frequency: renewFrequency,
      startDate: sd,
      skipNonWorkingDays: true,
      nonWorkingDays: (tenant?.non_working_days as string[]) || ['sunday'],
      holidays: (tenant?.holidays as string[]) || [],
    });

    if (!appUser) {
        alert("Error: Sesión no válida");
        setSaving(false);
        return;
    }

    // 3. Create the new loan
    const { error } = await createLoan({
      tenant_id: appUser.tenant_id,
      client_id: selectedLoan.client_id,
      collector_id: appUser.id,
      principal_amount: np,
      interest_rate: ni,
      total_amount: previewCalculations.totalAmount,
      total_installments: ninst,
      frequency: renewFrequency,
      installment_amount: previewCalculations.installmentAmount,
      start_date: sd,
      end_date: previewCalculations.endDate,
      skip_non_working_days: true
    }, previewCalculations.schedule);

    setSaving(false);
    if (!error) {
      setRenewTarget(null);
      setView('list');
      setSelectedLoan(null);
      loadData();
    } else {
      alert('Error creando préstamo de renovación: ' + error);
    }
  }

  async function confirmGraceDay() {
    if (!graceTarget || !selectedLoan) return;
    
    // El servicio necesita el loanId para extender la date_end
    const { success, error } = await applyGraceDay(selectedLoan.id, graceTarget.paymentId);
    setGraceTarget(null);

    if (!success) {
      alert(`Error al registrar Día de Gracia: ${error}`);
      return;
    }

    const details = await getLoanById(selectedLoan.id);
    setLoanDetail(details);
    loadData();
  }

  const filteredLoans = loans.filter((l) => {
    const matchesFilter = filter === 'all' || l.status === filter;
    const matchesSearch = l.client?.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         l.client?.document_id.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const stats = {
    active: loans.filter(l => l.status === 'active').length,
    totalPrincipal: loans.reduce((acc, l) => acc + l.principal_amount, 0),
    totalCollected: loans.reduce((acc, l) => acc + (l.paid_installments * l.installment_amount), 0),
    avgInterest: loans.length > 0 ? (loans.reduce((acc, l) => acc + l.interest_rate, 0) / loans.length).toFixed(1) : 0
  };

  /* ============ LIST VIEW ============ */
  if (view === 'list') {
    return (
      <>
        <div className={styles.page}>
        <div className={styles.pageHeader}>
          <div>
            <h2 className={styles.pageTitle}>Préstamos</h2>
            <p className={styles.pageSubtitle}>
              {loans.length} préstamos ({loans.filter((l) => l.status === 'active').length} activos)
            </p>
          </div>
          <button className="btn btn--primary" onClick={() => setView('create')}>
            + Nuevo Préstamo
          </button>
        </div>

        {/* Mini KPIs Summary */}
        <div className={styles.summaryGrid}>
          <div className={styles.summaryCard}>
            <span className={styles.summaryLabel}>Capital en Calle</span>
            <span className={styles.summaryValue}>{formatCurrency(stats.totalPrincipal)}</span>
          </div>
          <div className={styles.summaryCard}>
            <span className={styles.summaryLabel}>Recaudado</span>
            <span className={styles.summaryValue}>{formatCurrency(stats.totalCollected)}</span>
          </div>
          <div className={styles.summaryCard}>
            <span className={styles.summaryLabel}>Activos</span>
            <span className={styles.summaryValue}>{stats.active}</span>
          </div>
          <div className={styles.summaryCard}>
            <span className={styles.summaryLabel}>Interés Promedio</span>
            <span className={styles.summaryValue}>{stats.avgInterest}%</span>
          </div>
        </div>

        {/* Filters & Search */}
        <div className={styles.toolbar}>
          <div className={styles.filterGroup}>
            {(['all', 'active', 'completed', 'defaulted'] as const).map((f) => (
              <button
                key={f}
                className={`${styles.filterBtn} ${filter === f ? styles.filterBtnActive : ''}`}
                onClick={() => setFilter(f)}
              >
                {f === 'all' ? 'Todos' : f === 'active' ? 'Activos' : f === 'completed' ? 'Completados' : 'En mora'}
              </button>
            ))}
          </div>

          <div className={styles.searchContainer}>
            <div className={styles.searchIcon}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            </div>
            <input 
              type="text" 
              className={styles.searchInput} 
              placeholder="Buscar por cliente o documento..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {loading ? (
          <div className={styles.loanGrid}>
            {[1, 2, 3].map((i) => <div key={i} className="skeleton" style={{ height: 160 }} />)}
          </div>
        ) : filteredLoans.length === 0 ? (
          <div className={styles.empty}>
            <span className={styles.emptyIcon}><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--color-gray-300)" strokeWidth="1.5"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg></span>
            <h3>Sin préstamos</h3>
            <p>Crea tu primer préstamo para comenzar</p>
          </div>
        ) : (
          <div className={styles.loanGrid}>
            {filteredLoans.map((loan) => {
              const isExpanded = expandedLoan === loan.id;
              return (
              <div key={loan.id} className={`card ${styles.loanCard}`} onClick={() => openDetail(loan)} style={{ cursor: 'pointer' }}>
                <div className={styles.loanHeader}>
                  <div style={{ flex: 1, paddingRight: '8px' }}>
                    <h4 className={styles.loanClient}>{loan.client?.full_name || 'Sin cliente'}</h4>
                  </div>
                  <span className={styles.loanBadge}>{statusLabels[loan.status]}</span>
                </div>
                <div className={styles.loanNumbers}>
                  <div className={styles.loanStat}>
                     {/* El colector necesita saber rápido cuánto debe cobrar hoy (Cuota) y el Balance Total */}
                    <span className={styles.loanStatLabel}>Cuota</span>
                    <span className={styles.loanStatValue}>{formatCurrency(loan.installment_amount)}</span>
                  </div>
                  <div className={styles.loanStat}>
                    <span className={styles.loanStatLabel}>Balance</span>
                    <span className={styles.loanStatValue}>{formatCurrency(loan.total_amount)}</span>
                  </div>
                  <div className={styles.loanStat} style={{ textAlign: 'right', display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                    {loan.status === 'active' && (
                      <button 
                        className="btn btn--primary btn--sm" 
                        onClick={(e) => { e.stopPropagation(); handleQuickPay(loan); }}
                        style={{ padding: '6px 14px', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase' }}
                      >
                        Cobrar
                      </button>
                    )}
                    <button 
                      className="btn btn--icon" 
                      onClick={(e) => { e.stopPropagation(); setExpandedLoan(isExpanded ? null : loan.id); }}
                      style={{ background: 'var(--color-gray-50)', color: 'var(--color-gray-500)', padding: '6px', width: '30px', height: '30px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                    >
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}><polyline points="6 9 12 15 18 9"/></svg>
                    </button>
                  </div>
                </div>
                
                {isExpanded && (
                  <div className={styles.loanExpanded} style={{ padding: '0 0 var(--space-4) 0', marginBottom: 'var(--space-4)', borderBottom: '1px solid var(--color-gray-100)', animation: 'fadeIn 0.2s ease-out' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)', fontSize: 'var(--text-sm)', color: 'var(--color-gray-500)' }}>
                       <div>
                         <strong style={{ display: 'block', fontSize: '11px', textTransform: 'uppercase', color: 'var(--color-gray-400)', marginBottom: '4px' }}>Capital</strong>
                         {formatCurrency(loan.principal_amount)}
                       </div>
                       <div>
                         <strong style={{ display: 'block', fontSize: '11px', textTransform: 'uppercase', color: 'var(--color-gray-400)', marginBottom: '4px' }}>Condiciones</strong>
                         {loan.frequency === 'daily' ? 'Diario' : loan.frequency === 'weekly' ? 'Semanal' : loan.frequency === 'biweekly' ? 'Quincenal' : 'Mensual'} • {loan.interest_rate}%
                       </div>
                       <div style={{ gridColumn: '1 / -1' }}>
                         <strong style={{ display: 'block', fontSize: '11px', textTransform: 'uppercase', color: 'var(--color-gray-400)', marginBottom: '4px' }}>Periodo</strong>
                         {formatDate(loan.start_date)} → {formatDate(loan.end_date)}
                       </div>
                       <div style={{ gridColumn: '1 / -1' }}>
                         <strong style={{ display: 'block', fontSize: '11px', textTransform: 'uppercase', color: 'var(--color-gray-400)', marginBottom: '4px' }}>Documento Cliente</strong>
                         {loan.client?.document_id}
                       </div>
                    </div>
                  </div>
                )}

                <div className={styles.loanProgress}>
                  <div className={styles.progressBar}>
                    <div
                      className={styles.progressFill}
                      style={{ width: `${(loan.paid_installments / loan.total_installments) * 100}%` }}
                    />
                  </div>
                  <span className={styles.progressText}>
                    {loan.paid_installments} / {loan.total_installments} cuotas recaudadas
                  </span>
                </div>
              </div>
            )})}
          </div>
        )}
      </div>

      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDeleteLoan}
        title="Eliminar Préstamo"
        message="¿Estás seguro de que deseas eliminar este préstamo y todo su historial de pagos? Esta acción es irreversible."
        isDestructive={true}
      />
    </>
    );
  }

  /* ============ DETAIL VIEW ============ */
  if (view === 'detail' && selectedLoan) {
    return (
      <>
        <div className={styles.page}>
        <div className={styles.pageHeader}>
          <div>
            <h2 className={styles.pageTitle}>Dashboard del Préstamo</h2>
            <p className={styles.pageSubtitle}>Cliente: {selectedLoan.client?.full_name}</p>
          </div>
          <div className={styles.headerBtns} style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
            {selectedLoan.status === 'active' && (
              <>
                <button className="btn btn--primary" onClick={handlePayOff} style={{ background: 'var(--color-green)', color: 'var(--color-white)', borderColor: 'var(--color-green)' }}>
                  Saldar Crédito
                </button>
                <button className="btn btn--primary" onClick={handleRenew} style={{ background: 'var(--color-asphalt)', color: 'var(--color-white)', borderColor: 'var(--color-asphalt)' }}>
                  Renovar
                </button>
              </>
            )}
            <button className="btn btn--danger" onClick={handleDeleteLoan}>
              Eliminar
            </button>
            <button className="btn btn--ghost" onClick={() => { setView('list'); setSelectedLoan(null); }}>
              ← Volver
            </button>
          </div>
        </div>

        <div className={styles.detailGrid} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
          <div className="card" style={{ padding: 'var(--space-5)', backgroundColor: 'var(--color-card-white)', border: '1px solid rgba(44, 62, 80, 0.08)', boxShadow: '0 4px 12px rgba(44, 62, 80, 0.04)', borderRadius: 'var(--radius-md)' }}>
            <span style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--color-gray-400)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '8px' }}>Monto Prestado</span>
            <span style={{ display: 'block', fontSize: 'var(--text-2xl)', fontWeight: 800, color: 'var(--color-asphalt)', fontFamily: 'var(--font-heading)' }}>{formatCurrency(selectedLoan.principal_amount)}</span>
          </div>
          <div className="card" style={{ padding: 'var(--space-5)', backgroundColor: 'var(--color-card-white)', border: '1px solid rgba(44, 62, 80, 0.08)', boxShadow: '0 4px 12px rgba(44, 62, 80, 0.04)', borderRadius: 'var(--radius-md)' }}>
            <span style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--color-gray-400)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '8px' }}>Progreso (Recaudado)</span>
            <span style={{ display: 'block', fontSize: 'var(--text-2xl)', fontWeight: 800, color: 'var(--color-asphalt)', fontFamily: 'var(--font-heading)' }}>{selectedLoan.paid_installments} / {selectedLoan.total_installments}</span>
          </div>
          <div className="card" style={{ padding: 'var(--space-5)', backgroundColor: 'var(--color-card-white)', border: '1px solid var(--color-red)', boxShadow: '0 4px 12px rgba(231, 76, 60, 0.08)', borderRadius: 'var(--radius-md)' }}>
            <span style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--color-gray-400)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '8px' }}>Deuda Pendiente</span>
            <span style={{ display: 'block', fontSize: 'var(--text-2xl)', fontWeight: 800, color: 'var(--color-red)', fontFamily: 'var(--font-heading)' }}>
              {formatCurrency(selectedLoan.total_amount - (selectedLoan.paid_installments * selectedLoan.installment_amount))}
            </span>
          </div>
        </div>

        <div className="card" style={{ backgroundColor: 'var(--color-card-white)', border: '1px solid rgba(44, 62, 80, 0.08)', borderRadius: 'var(--radius-md)' }}>
          <h3 className={styles.sectionTitle} style={{ padding: 'var(--space-5)', margin: 0, borderBottom: '1px solid var(--color-gray-100)' }}>Cronograma de Cuotas (Pagos de Oficina)</h3>
          {!loanDetail ? (
            <div style={{ padding: 'var(--space-5)' }}>
              <div className="skeleton" style={{ height: 200 }} />
            </div>
          ) : (
            <div className={styles.scheduleTable} style={{ overflowY: 'auto', maxHeight: 'none', border: 'none' }}>
              <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--color-gray-200)', color: 'var(--color-gray-500)', fontSize: '0.85rem' }}>
                    <th style={{ padding: '12px 8px' }}>#</th>
                    <th style={{ padding: '12px 8px' }}>Vencimiento</th>
                    <th style={{ padding: '12px 8px' }}>Esperado</th>
                    <th style={{ padding: '12px 8px' }}>Pagado</th>
                    <th style={{ padding: '12px 8px' }}>Estado</th>
                    <th style={{ padding: '12px 8px' }}>Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {loanDetail.payments?.map((payment: any) => (
                    <tr key={payment.id} style={{ borderBottom: '1px solid var(--color-gray-100)' }}>
                      <td style={{ padding: '12px 8px', fontWeight: 600 }}>{payment.installment_number}</td>
                      <td style={{ padding: '12px 8px' }}>{formatDate(payment.due_date)}</td>
                      <td style={{ padding: '12px 8px' }}>{formatCurrency(payment.amount_due)}</td>
                      <td style={{ padding: '12px 8px', color: payment.amount_paid > 0 ? 'var(--color-primary)' : 'inherit' }}>{formatCurrency(payment.amount_paid || 0)}</td>
                      <td style={{ padding: '12px 8px' }}>
                        <span className={getPaymentBadge(payment.status)}>{getPaymentLabel(payment.status)}</span>
                      </td>
                      <td style={{ padding: '12px 8px' }}>
                        {(() => {
                          const isPayable = (payment.status === 'missed') ||
                            (payment.status === 'partial') ||
                            (payment.status === 'pending'); // Permitir cobros anticipados
                          return isPayable ? (
                            <div style={{ display: 'flex', gap: '8px' }}>
                              <button className="btn btn--sm btn--primary" onClick={() => handlePayInstallment(payment.id, payment.installment_number, payment.amount_due)}>
                                Cobrar
                              </button>
                              <button 
                                className="btn btn--sm btn--ghost" 
                                onClick={() => handleGraceDay(payment.id, payment.installment_number)}
                                title="No Pagó (Aplica Día de Gracia)"
                              >
                                Omitir
                              </button>
                            </div>
                          ) : null;
                        })()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDeleteLoan}
        title="Eliminar Préstamo"
        message="¿Estás seguro de que deseas eliminar este préstamo y todo su historial de pagos? Esta acción es irreversible."
        isDestructive={true}
      />
      <PromptModal
        isOpen={!!payTarget}
        onClose={() => setPayTarget(null)}
        onConfirm={confirmPayInstallment}
        title="Cobrar Cuota"
        label={`Monto a cobrar para la ${payTarget?.label}`}
        placeholder="Ej. 10000"
        defaultValue={payTarget?.amount.toString()}
        type="number"
      />
      <ConfirmModal
        isOpen={!!payOffTarget}
        onClose={() => setPayOffTarget(null)}
        onConfirm={confirmPayOff}
        title="Saldar Crédito Completo"
        message={`¿Confirmas el pago total del saldo restante (${formatCurrency(payOffTarget?.remainingAmount || 0)})? Todas las cuotas pendientes quedarán marcadas como pagadas y el préstamo se cerrará.`}
        isDestructive={false}
      />
      <ConfirmModal
        isOpen={!!graceTarget}
        onClose={() => setGraceTarget(null)}
        onConfirm={confirmGraceDay}
        title="Aplicar Día de Gracia"
        message={`Vas a omitir la ${graceTarget?.label}. Esto marcará la cuota como no pagada ("Día de Gracia") y extenderá la fecha final del préstamo sumando 1 día adicional al cronograma. ¿Continuar?`}
        isDestructive={false}
      />
      
      <Modal
        isOpen={!!renewTarget}
        onClose={() => setRenewTarget(null)}
        title="Renovar Préstamo"
      >
        <div style={{ marginBottom: 'var(--space-4)' }}>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-gray-500)', marginBottom: 'var(--space-4)' }}>
            El saldo pendiente actual es de <strong>{formatCurrency(renewTarget?.remainingBalance || 0)}</strong>.
            Crea un nuevo crédito que cubra esta deuda y entregue un excedente al cliente.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            <div className="field">
              <label className="input-label">Nuevo Capital (Monto Total)</label>
              <input type="number" className="input" value={renewPrincipal} onChange={e => setRenewPrincipal(e.target.value)} />
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 'var(--space-3)' }}>
              <div className="field">
                <label className="input-label">% Interés</label>
                <input type="number" className="input" value={renewInterestRate} onChange={e => setRenewInterestRate(e.target.value)} />
              </div>
              <div className="field">
                <label className="input-label">Frecuencia</label>
                <select className="input" value={renewFrequency} onChange={(e: any) => setRenewFrequency(e.target.value)}>
                  <option value="daily">Diaria</option>
                  <option value="weekly">Semanal</option>
                  <option value="biweekly">Quincenal</option>
                  <option value="monthly">Mensual</option>
                </select>
              </div>
            </div>

            <div className="field">
              <label className="input-label">Total Cuotas</label>
              <input type="number" className="input" value={renewInstallments} onChange={e => setRenewInstallments(e.target.value)} />
            </div>
          </div>
          
          {renewTarget && selectedLoan && (() => {
             const np = parseFloat(renewPrincipal) || 0;
             const ni = parseFloat(renewInterestRate) || 0;
             const ninst = parseInt(renewInstallments) || 0;
             const calc = calculateRenewal(selectedLoan, np, ni, ninst);
             return (
               <div style={{ marginTop: 'var(--space-5)', padding: 'var(--space-4)', background: 'var(--color-gray-50)', borderRadius: 'var(--radius-md)' }}>
                 <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                   <span style={{ fontSize: '13px', color: 'var(--color-gray-500)' }}>Saldo a Descontar:</span>
                   <span style={{ fontWeight: 600, color: 'var(--color-red)' }}>- {formatCurrency(calc.remainingBalance)}</span>
                 </div>
                 <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '8px', borderBottom: '1px solid var(--color-gray-200)', marginBottom: '8px' }}>
                   <span style={{ fontSize: '13px', color: 'var(--color-gray-500)' }}>Nuevo Capital:</span>
                   <span style={{ fontWeight: 600 }}>{formatCurrency(np)}</span>
                 </div>
                 <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '15px' }}>
                   <span style={{ fontWeight: 600, color: 'var(--color-asphalt)' }}>Neto a Entregar (Cash):</span>
                   <span style={{ fontWeight: 800, color: 'var(--color-green)' }}>{formatCurrency(calc.netToDiburse)}</span>
                 </div>
               </div>
             );
          })()}
        </div>
        
        <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end', marginTop: 'var(--space-5)' }}>
          <button className="btn btn--ghost" onClick={() => setRenewTarget(null)}>Cancelar</button>
          <button className="btn btn--primary" onClick={confirmRenewal} disabled={saving} style={{ background: 'var(--color-asphalt)', borderColor: 'var(--color-asphalt)' }}>
            {saving ? 'Cargando...' : 'Confirmar Renovación'}
          </button>
        </div>
      </Modal>

    </>
    );
  }

  /* ============ CREATE VIEW ============ */
  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div>
          <h2 className={styles.pageTitle}>Nuevo Préstamo</h2>
          <p className={styles.pageSubtitle}>Configura y pre-visualiza antes de crear</p>
        </div>
        <button className="btn btn--ghost" onClick={() => { setView('list'); resetForm(); }}>
          ← Volver
        </button>
      </div>

      {formError && <div className={styles.formError}>{formError}</div>}

      <div className={styles.createGrid}>
        {/* Form */}
        <form onSubmit={handleCreate} className="card">
          <h3 className={styles.sectionTitle}>Datos del Crédito</h3>

          <div className={styles.field}>
            <label className="input-label" htmlFor="client">Cliente *</label>
            <select
              id="client"
              className="input"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              required
            >
              <option value="">— Selecciona un cliente —</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.full_name} (CC {c.document_id})
                </option>
              ))}
            </select>
          </div>

          <div className={styles.formRow}>
            <div className={styles.field}>
              <label className="input-label" htmlFor="principal">Capital Prestado *</label>
              <input
                id="principal"
                className="input"
                type="number"
                min="1000"
                step="1"
                value={principal}
                onChange={(e) => setPrincipal(e.target.value)}
                placeholder="100,000"
                required
              />
            </div>
            <div className={styles.field}>
              <label className="input-label" htmlFor="interest">Interés (%) *</label>
              <input
                id="interest"
                className="input"
                type="number"
                min="1"
                max="100"
                value={interestRate}
                onChange={(e) => setInterestRate(e.target.value)}
                required
              />
            </div>
          </div>

          <div className={styles.formRow}>
            <div className={styles.field}>
              <label className="input-label" htmlFor="installments">Nro. Cuotas *</label>
              <input
                id="installments"
                className="input"
                type="number"
                min="1"
                max="365"
                value={installments}
                onChange={(e) => setInstallments(e.target.value)}
                required
              />
            </div>
            <div className={styles.field}>
              <label className="input-label" htmlFor="frequency">Frecuencia *</label>
              <select
                id="frequency"
                className="input"
                value={frequency}
                onChange={(e) => setFrequency(e.target.value as 'daily' | 'weekly' | 'biweekly' | 'monthly')}
              >
                <option value="daily">Diaria</option>
                <option value="weekly">Semanal</option>
                <option value="biweekly">Quincenal</option>
                <option value="monthly">Mensual</option>
              </select>
            </div>
          </div>

          <div className={styles.formRow}>
            <div className={styles.field}>
              <label className="input-label" htmlFor="startDate">Fecha de Inicio *</label>
              <input
                id="startDate"
                className="input"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
              />
            </div>
            <div className={styles.field}>
              <label className="input-label">Omitir Festivos</label>
              <div className={styles.toggleContainer}>
                <label className={styles.toggle}>
                  <input
                    type="checkbox"
                    checked={skipNonWorking}
                    onChange={(e) => setSkipNonWorking(e.target.checked)}
                  />
                  <span className={styles.toggleSlider}></span>
                </label>
                <span className={styles.toggleLabel}>{skipNonWorking ? 'Activado' : 'Desactivado'}</span>
              </div>
            </div>
          </div>

          <div className={styles.formActions}>
            <button type="submit" className="btn btn--primary btn--lg" disabled={saving || !preview}>
              {saving ? 'Creando crédito...' : 'Crear Préstamo'}
            </button>
          </div>
        </form>

        {/* Preview */}
        <div className={styles.previewPanel}>
          <div className="card card--elevated">
            <h3 className={styles.sectionTitle}>Pre-visualización</h3>
            {preview ? (
              <>
                <div className={styles.previewSummary}>
                  <div className={styles.previewItem}>
                    <span className={styles.previewLabel}>Capital</span>
                    <span className={styles.previewValue}>{formatCurrency(Number(principal))}</span>
                  </div>
                  <div className={styles.previewItem}>
                    <span className={styles.previewLabel}>Interés ({interestRate}%)</span>
                    <span className={styles.previewValue}>{formatCurrency(Number(principal) * Number(interestRate) / 100)}</span>
                  </div>
                  <div className={`${styles.previewItem} ${styles.previewTotal}`}>
                    <span className={styles.previewLabel}>Total a Pagar</span>
                    <span className={styles.previewValueBig}>{formatCurrency(preview.totalAmount)}</span>
                  </div>
                  <div className={styles.previewItem}>
                    <span className={styles.previewLabel}>Cuota</span>
                    <span className={styles.previewValue}>{formatCurrency(preview.installmentAmount)}</span>
                  </div>
                  <div className={styles.previewItem}>
                    <span className={styles.previewLabel}>Fecha final</span>
                    <span className={styles.previewValue}>{formatDate(preview.endDate)}</span>
                  </div>
                </div>

                {/* Schedule Table */}
                <h4 className={styles.scheduleTitle}>Cronograma de Cuotas</h4>
                <div className={styles.scheduleTable}>
                  <table>
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Fecha</th>
                        <th>Monto</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.schedule.map((item) => (
                        <tr key={item.installment_number}>
                          <td>{item.installment_number}</td>
                          <td>{formatDate(item.due_date)}</td>
                          <td>{formatCurrency(item.amount_due)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <div className={styles.previewEmpty}>
                <span>#</span>
                <p>Ingresa los datos del crédito para ver la pre-visualización</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function getPaymentBadge(status: string) {
  switch (status) {
    case 'paid': return 'badge badge--success';
    case 'partial': return 'badge badge--warning';
    case 'missed': return 'badge badge--error';
    case 'pending': return 'badge badge--gray';
    case 'grace': return 'badge badge--info';
    default: return 'badge badge--gray';
  }
}

function getPaymentLabel(status: string) {
  switch (status) {
    case 'paid': return 'Pagado';
    case 'partial': return 'Parcial';
    case 'missed': return 'En mora';
    case 'pending': return 'Pendiente';
    case 'grace': return 'Gracia';
    default: return status;
  }
}
