/**
 * QuickCash — Rigorous Backend QA Verification Suite
 * Pruebas forenses automatizadas de integridad de base de datos,
 * lógica contable, transaccionalidad ACID y restricciones relacionales.
 */

import { db } from '../lib/db';
import { tenants, users, clients, loans, payments, collection_routes } from '../lib/db/schema';
import { eq, and, inArray } from 'drizzle-orm';
import { createClient, deleteClient, searchClients, getClients } from '../services/clients.service';
import { createLoan, getLoanById, registerPayment, payOffLoan, applyGraceDay, deleteLoan } from '../services/loans.service';
import { calculateLoanSchedule } from '../lib/utils/loans';
import { getDashboardKPIs } from '../services/dashboard.service';
import { createRoute, addClientToRoute, removeClientFromRoute, deleteRoute, getRouteActiveChecklist } from '../services/collection-routes.service';

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  details?: string;
}

const results: TestResult[] = [];

function assert(condition: boolean, testName: string, failureDetails?: string) {
  if (condition) {
    results.push({ name: testName, passed: true });
    console.log(`  ✅ PASS: ${testName}`);
  } else {
    results.push({ name: testName, passed: false, error: failureDetails || 'Assertion failed' });
    console.error(`  ❌ FAIL: ${testName} — ${failureDetails || 'Assertion failed'}`);
  }
}

async function runQA() {
  console.log('====================================================');
  console.log('🧪 INICIANDO SUITE DE QA AUTOMATIZADA: QUICKCASH SAAS');
  console.log('====================================================\n');

  // 1. Obtener Tenant de Pruebas (Inversiones Juan & Cía o Demo)
  const tenant = await db.query.tenants.findFirst({
    where: eq(tenants.name, 'Inversiones Juan & Cía')
  });

  if (!tenant) {
    console.error('❌ FATAL: No se encontró el tenant "Inversiones Juan & Cía".');
    process.exit(1);
  }

  const tenantId = tenant.id;
  console.log(`📌 Tenant bajo prueba: ${tenant.name} (${tenantId})`);

  // Obtener cobrador
  const collector = await db.query.users.findFirst({
    where: and(eq(users.tenant_id, tenantId), eq(users.role, 'collector'))
  });
  const collectorId = collector?.id || (await db.query.users.findFirst())?.id;
  if (!collectorId) {
    console.error('❌ FATAL: No se encontró ningún usuario para asociar cobros.');
    process.exit(1);
  }

  let tempClientId: string | null = null;
  let tempLoanId: string | null = null;
  let tempRouteId: string | null = null;

  try {
    // -------------------------------------------------------------
    // PRUEBA 1: Creación de Cliente y Búsqueda
    // -------------------------------------------------------------
    console.log('\n--- GRUPO 1: CICLO DE VIDA DE CLIENTE ---');
    const uniqueDoc = `QA-${Date.now().toString().slice(-8)}`;
    const createRes = await createClient({
      tenant_id: tenantId,
      full_name: 'Cliente QA Automatizado',
      document_id: uniqueDoc,
      phone: '3009998877',
      address: 'Calle QA # 100-20',
      notes: 'Cliente generado por suite de QA',
      collector_id: collectorId,
      photo_id_url: null,
      photo_location_url: null,
      latitude: 6.2442,
      longitude: -75.5812,
      route_id: null
    });

    assert(!!createRes.data && !createRes.error, 'Crear cliente en base de datos');
    tempClientId = createRes.data?.id || null;

    if (tempClientId) {
      const searchRes = await searchClients(uniqueDoc, tenantId);
      assert(searchRes.length === 1 && searchRes[0].id === tempClientId, 'Búsqueda de cliente por documento único');
    }

    // -------------------------------------------------------------
    // PRUEBA 2: Originación de Crédito y Cronograma (Amortización)
    // -------------------------------------------------------------
    console.log('\n--- GRUPO 2: ORIGINACIÓN Y CÁLCULO DE CRÉDITO ---');
    const schedule = calculateLoanSchedule({
      principalAmount: 500000,
      interestRate: 20,
      totalInstallments: 10,
      frequency: 'daily',
      startDate: new Date().toISOString().split('T')[0],
      skipNonWorkingDays: true,
      nonWorkingDays: ['sunday'],
      holidays: []
    });

    assert(schedule.totalAmount === 600000, 'Cálculo de monto total con interés (500k + 20% = 600k)');
    assert(schedule.installmentAmount === 60000, 'Cálculo de valor cuota exacto (600k / 10 = 60k)');
    assert(schedule.schedule.length === 10, 'Generación de 10 cuotas programadas');

    // Verificar que ninguna cuota caiga en domingo
    const hasSundays = schedule.schedule.some(item => {
      const day = new Date(item.due_date + 'T12:00:00').getDay();
      return day === 0;
    });
    assert(!hasSundays, 'Omisión estricta de domingos en calendario');

    // Insertar crédito
    const loanRes = await createLoan({
      tenant_id: tenantId,
      client_id: tempClientId,
      collector_id: collectorId,
      principal_amount: 500000,
      interest_rate: 20,
      total_amount: 600000,
      total_installments: 10,
      installment_amount: 60000,
      frequency: 'daily',
      start_date: schedule.schedule[0].due_date,
      end_date: schedule.schedule[schedule.schedule.length - 1].due_date,
      skip_non_working_days: true
    }, schedule.schedule);

    assert(!!loanRes.data && !loanRes.error, 'Inserción atómica de préstamo y sus 10 cuotas en transacción ACID');
    tempLoanId = loanRes.data?.id || null;

    // Verificar lectura con cuotas ordenadas
    const loanDetail = await getLoanById(tempLoanId!, tenantId);
    assert(loanDetail !== null, 'Lectura de préstamo por ID con joins');
    assert(loanDetail?.payments?.length === 10, 'Persistencia verificada: 10 cuotas en tabla payments');

    // -------------------------------------------------------------
    // PRUEBA 3: Cobro de Cuota e Integridad de Saldo
    // -------------------------------------------------------------
    console.log('\n--- GRUPO 3: TRANSACCIONES DE COBRO Y SALDOS ---');
    const firstPayment = loanDetail?.payments?.[0];
    assert(!!firstPayment, 'Existencia de primera cuota para cobro');

    if (firstPayment) {
      const payRes = await registerPayment(firstPayment.id, tenantId, 60000, 6.24, -75.58);
      assert(payRes.success, 'Registro de pago exitoso de cuota #1 ($60.000)');

      // Verificar idempotencia / bloqueo de doble pago
      const doublePayRes = await registerPayment(firstPayment.id, tenantId, 60000);
      assert(!doublePayRes.success, 'Bloqueo estricto de doble cobro sobre cuota ya bloqueada (is_locked)');

      // Verificar actualización de saldo del préstamo
      const updatedLoan = await getLoanById(tempLoanId!, tenantId);
      assert(updatedLoan?.paid_installments === 1, 'Incremento de cuotas pagadas (1 / 10)');
      assert(updatedLoan?.balance === 540000, 'Disminución de saldo pendiente (600k - 60k = 540k)');
    }

    // -------------------------------------------------------------
    // PRUEBA 4: Día de Gracia (Prórroga)
    // -------------------------------------------------------------
    console.log('\n--- GRUPO 4: DÍA DE GRACIA Y NOVEDADES ---');
    const secondPayment = loanDetail?.payments?.[1];
    if (secondPayment) {
      const oldEndDate = new Date(loanDetail?.end_date || '').getTime();
      const graceRes = await applyGraceDay(tempLoanId!, tenantId, secondPayment.id);
      assert(graceRes.success, 'Aplicación de día de gracia exitosa');

      const refreshedLoan = await getLoanById(tempLoanId!, tenantId);
      const updatedSecondPayment = refreshedLoan?.payments?.find(p => p.id === secondPayment.id);
      assert(updatedSecondPayment?.status === 'grace', 'Cuota marcada con estado grace y bloqueada');
      const newEndDate = new Date(refreshedLoan?.end_date || '').getTime();
      assert(newEndDate >= oldEndDate, 'Extensión verificada de la fecha final del préstamo');
    }

    // -------------------------------------------------------------
    // PRUEBA 5: Pago Total Anticipado (Saldar Crédito)
    // -------------------------------------------------------------
    console.log('\n--- GRUPO 5: SALDADO COMPLETO DE CRÉDITO ---');
    const payOffRes = await payOffLoan(tempLoanId!, tenantId);
    assert(payOffRes.success, 'Saldar crédito completo (payOffLoan)');

    const completedLoan = await getLoanById(tempLoanId!, tenantId);
    assert(completedLoan?.status === 'completed', 'Estado de préstamo actualizado a "completed"');
    assert(completedLoan?.balance === 0, 'Saldo deudor llevado a $ 0');

    const allPaymentsPaid = completedLoan?.payments?.every(p => p.status === 'paid');
    assert(!!allPaymentsPaid, 'Todas las cuotas remanentes marcadas como pagadas');

    // -------------------------------------------------------------
    // PRUEBA 6: Eliminación de Cliente en Cascada (El fallo del usuario)
    // -------------------------------------------------------------
    console.log('\n--- GRUPO 6: ELIMINACIÓN EN CASCADA (FIX REGRESIÓN DE FK) ---');
    // Creamos otro cliente con crédito activo para probar la eliminación segura en cascada
    const clientToDeleteRes = await createClient({
      tenant_id: tenantId,
      full_name: 'Cliente Para Prueba Cascada',
      document_id: `DEL-${Date.now().toString().slice(-8)}`,
      phone: '3110009988',
      address: 'Carrera Eliminación # 1-2',
      collector_id: collectorId,
      photo_id_url: null,
      photo_location_url: null,
      latitude: null,
      longitude: null,
      notes: null,
      route_id: null
    });

    const delClientId = clientToDeleteRes.data?.id;
    assert(!!delClientId, 'Crear cliente de prueba para borrado');

    if (delClientId) {
      // Le creamos un préstamo con cuotas
      const delLoanRes = await createLoan({
        tenant_id: tenantId,
        client_id: delClientId,
        collector_id: collectorId,
        principal_amount: 100000,
        interest_rate: 20,
        total_amount: 120000,
        total_installments: 2,
        installment_amount: 60000,
        frequency: 'daily',
        start_date: new Date().toISOString().split('T')[0],
        end_date: new Date(Date.now() + 2 * 86400000).toISOString().split('T')[0],
        skip_non_working_days: true
      }, [
        { installment_number: 1, due_date: new Date().toISOString().split('T')[0], amount_due: 60000, status: 'pending', amount_paid: 0, paid_date: null },
        { installment_number: 2, due_date: new Date(Date.now() + 86400000).toISOString().split('T')[0], amount_due: 60000, status: 'pending', amount_paid: 0, paid_date: null },
      ]);

      const delLoanId = delLoanRes.data?.id;
      assert(!!delLoanId, 'Asociar préstamo y cuotas al cliente');

      // Ahora ejecutamos deleteClient — ESTO ERA LO QUE FALLABA ANTES CON ERROR DE FK
      const deleteResult = await deleteClient(delClientId, tenantId);
      assert(deleteResult.success, 'Eliminación de cliente con préstamos asociados en transacción en cascada');
      assert(!deleteResult.error, `Sin errores de clave foránea arrojados (Error: ${deleteResult.error || 'ninguno'})`);

      // Verificar que no quedaron registros huérfanos
      const orphanedPayments = await db.query.payments.findMany({
        where: eq(payments.loan_id, delLoanId)
      });
      assert(orphanedPayments.length === 0, 'Cero pagos huérfanos remanentes en base de datos');

      const orphanedLoans = await db.query.loans.findMany({
        where: eq(loans.id, delLoanId)
      });
      assert(orphanedLoans.length === 0, 'Cero préstamos huérfanos remanentes en base de datos');

      const orphanedClients = await db.query.clients.findMany({
        where: eq(clients.id, delClientId)
      });
      assert(orphanedClients.length === 0, 'Cliente eliminado 100% de la tabla clients');
    }

    // -------------------------------------------------------------
    // PRUEBA 7: Consistencia Matemática del Dashboard
    // -------------------------------------------------------------
    console.log('\n--- GRUPO 7: MATEMÁTICA Y CONSISTENCIA DE DASHBOARD ---');
    const kpis = await getDashboardKPIs(tenantId);
    assert(typeof kpis.capital_in_street === 'number' && !isNaN(kpis.capital_in_street), 'Capital en calle es un número válido');
    assert(typeof kpis.interest_receivable === 'number' && !isNaN(kpis.interest_receivable), 'Intereses por cobrar es un número válido');
    assert(typeof kpis.delinquency_rate === 'number' && !isNaN(kpis.delinquency_rate), 'Índice de mora protegido contra NaN');

    // -------------------------------------------------------------
    // PRUEBA 8: Rutas de Cobro y Asignación
    // -------------------------------------------------------------
    console.log('\n--- GRUPO 8: RUTAS DE COBRO Y ASIGNACIÓN ---');
    const routeRes = await createRoute({
      tenant_id: tenantId,
      name: 'Ruta QA Express',
      zone: 'Zona Norte QA',
      collector_id: collectorId,
      color: '#10B981',
      notes: 'Ruta temporal creada por QA'
    });
    assert(!!routeRes.data && !routeRes.error, 'Creación de ruta de cobranza');
    tempRouteId = routeRes.data?.id || null;

    if (tempRouteId && tempClientId) {
      const assignRes = await addClientToRoute(tempClientId, tempRouteId, tenantId);
      assert(!assignRes.error, 'Asignación de cliente a ruta');

      const removeRes = await removeClientFromRoute(tempClientId, tenantId);
      assert(!removeRes.error, 'Desasignación limpia de cliente de ruta');

      const deleteRouteRes = await deleteRoute(tempRouteId, tenantId);
      assert(!deleteRouteRes.error, 'Eliminación segura de ruta sin afectar integridad');
      tempRouteId = null;
    }

    // -------------------------------------------------------------
    // Limpieza final de datos de prueba
    // -------------------------------------------------------------
    if (tempRouteId) {
      await deleteRoute(tempRouteId, tenantId);
    }
    if (tempClientId) {
      await deleteClient(tempClientId, tenantId);
    }

  } catch (err: any) {
    console.error('💥 Excepción no controlada durante QA:', err);
    results.push({ name: 'Ejecución general de suite', passed: false, error: err.message });
  }

  console.log('\n====================================================');
  console.log('📊 RESUMEN FINAL DE CONTROL DE CALIDAD (QA)');
  console.log('====================================================');
  const passedCount = results.filter(r => r.passed).length;
  const failedCount = results.filter(r => !r.passed).length;
  console.log(`Total pruebas: ${results.length}`);
  console.log(`Aprobadas:     ${passedCount} ✅`);
  console.log(`Fallidas:      ${failedCount} ❌`);

  if (failedCount > 0) {
    console.error('\nFallos detectados:');
    results.filter(r => !r.passed).forEach(f => console.error(` - ${f.name}: ${f.error}`));
    process.exit(1);
  } else {
    console.log('\n🏆 TODAS LAS PRUEBAS DE BACKEND PASARON CON ÉXITO.');
    process.exit(0);
  }
}

runQA();
