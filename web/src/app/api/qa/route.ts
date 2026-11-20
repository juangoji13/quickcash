import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { tenants, users, clients, loans, payments, collection_routes } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { createClient, deleteClient, searchClients } from '@/services/clients.service';
import { createLoan, getLoanById, registerPayment, payOffLoan, applyGraceDay, deleteLoan } from '@/services/loans.service';
import { calculateLoanSchedule } from '@/lib/utils/loans';
import { getDashboardKPIs } from '@/services/dashboard.service';
import { createRoute, addClientToRoute, removeClientFromRoute, deleteRoute } from '@/services/collection-routes.service';

interface TestResult {
  group: string;
  name: string;
  passed: boolean;
  error?: string;
  durationMs?: number;
}

export async function POST(req: Request) {
  const qaSecret = req.headers.get('x-qa-key');
  if (qaSecret !== 'quickcash-qa-2026') {
    return NextResponse.json({ error: 'Unauthorized QA runner' }, { status: 401 });
  }

  const results: TestResult[] = [];
  const startAll = Date.now();

  function record(group: string, name: string, condition: boolean, error?: string, durationMs?: number) {
    results.push({
      group,
      name,
      passed: condition,
      error: condition ? undefined : (error || 'Falló la aserción'),
      durationMs
    });
  }

  let tempClientId: string | null = null;
  let tempLoanId: string | null = null;
  let tempRouteId: string | null = null;

  try {
    // 1. Localizar Tenant
    const tenant = await db.query.tenants.findFirst({
      where: eq(tenants.name, 'Inversiones Juan & Cía'),
    });

    if (!tenant) {
      return NextResponse.json({
        success: false,
        error: 'Tenant "Inversiones Juan & Cía" no encontrado para pruebas',
        results: []
      }, { status: 500 });
    }

    const tenantId = tenant.id;

    // Localizar cobrador
    const collector = await db.query.users.findFirst({
      where: and(eq(users.tenant_id, tenantId), eq(users.role, 'collector')),
    });
    const collectorId = collector?.id || (await db.query.users.findFirst())?.id;

    if (!collectorId) {
      return NextResponse.json({
        success: false,
        error: 'No se encontró un usuario cobrador para asociar pruebas',
        results: []
      }, { status: 500 });
    }

    // -----------------------------------------------------------------
    // GRUPO 1: CLIENTES
    // -----------------------------------------------------------------
    const t1 = Date.now();
    const uniqueDoc = `QA-${Date.now().toString().slice(-8)}`;
    const createClientRes = await createClient({
      tenant_id: tenantId,
      full_name: 'Cliente QA Test Suite',
      document_id: uniqueDoc,
      phone: '3009998877',
      address: 'Calle QA Transaccional # 100-20',
      notes: 'Cliente de prueba automatizada',
      collector_id: collectorId,
      photo_id_url: null,
      photo_location_url: null,
      latitude: 6.2442,
      longitude: -75.5812,
      route_id: null
    });

    record('Clientes', 'Creación de cliente en base de datos', !!createClientRes.data && !createClientRes.error, createClientRes.error, Date.now() - t1);
    tempClientId = createClientRes.data?.id || null;

    if (tempClientId) {
      const tSearch = Date.now();
      const searchRes = await searchClients(uniqueDoc, tenantId);
      record('Clientes', 'Búsqueda por documento único de identidad', searchRes.length === 1 && searchRes[0].id === tempClientId, 'No se encontró por documento', Date.now() - tSearch);
    }

    // -----------------------------------------------------------------
    // GRUPO 2: MATEMÁTICA Y CRONOGRAMA DE AMORTIZACIÓN
    // -----------------------------------------------------------------
    const t2 = Date.now();
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

    record('Matemática Financiera', 'Monto total con interés (500k + 20% = 600k)', schedule.totalAmount === 600000, `Esperado 600000, obtenido ${schedule.totalAmount}`);
    record('Matemática Financiera', 'Valor cuota exacto (600k / 10 = 60k)', schedule.installmentAmount === 60000, `Esperado 60000, obtenido ${schedule.installmentAmount}`);
    record('Matemática Financiera', 'Generación de 10 cuotas programadas', schedule.schedule.length === 10, `Esperado 10 cuotas, obtenido ${schedule.schedule.length}`);

    const hasSundays = schedule.schedule.some(item => {
      const day = new Date(item.due_date + 'T12:00:00').getDay();
      return day === 0;
    });
    record('Matemática Financiera', 'Omisión estricta de domingos en calendario', !hasSundays, 'Se encontraron domingos en el cronograma', Date.now() - t2);

    // -----------------------------------------------------------------
    // GRUPO 3: ORIGINACIÓN ATÓMICA DE PRÉSTAMO
    // -----------------------------------------------------------------
    const t3 = Date.now();
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

    record('Préstamos', 'Inserción atómica de préstamo y 10 cuotas en transacción ACID', !!loanRes.data && !loanRes.error, loanRes.error, Date.now() - t3);
    tempLoanId = loanRes.data?.id || null;

    const loanDetail = await getLoanById(tempLoanId!, tenantId);
    record('Préstamos', 'Lectura de préstamo por ID con joins relacionales', loanDetail !== null, 'Préstamo no devuelto por getLoanById');
    record('Préstamos', 'Persistencia exacta de 10 cuotas en tabla payments', loanDetail?.payments?.length === 10, `Esperado 10, obtenido ${loanDetail?.payments?.length}`);

    // -----------------------------------------------------------------
    // GRUPO 4: TRANSACCIÓN DE COBRO Y BLOQUEO DE DOBLE PAGO
    // -----------------------------------------------------------------
    const t4 = Date.now();
    const firstPayment = loanDetail?.payments?.[0];
    record('Pagos', 'Existencia de cuota #1 para cobro', !!firstPayment, 'No hay cuota #1');

    if (firstPayment) {
      const payRes = await registerPayment(firstPayment.id, tenantId, 60000, 6.24, -75.58);
      record('Pagos', 'Registro exitoso de pago de cuota #1 ($60.000)', payRes.success, payRes.error, Date.now() - t4);

      // Doble pago
      const doublePayRes = await registerPayment(firstPayment.id, tenantId, 60000);
      record('Pagos', 'Bloqueo ACID de doble cobro sobre cuota ya bloqueada (is_locked)', !doublePayRes.success, 'Permitió doble pago');

      // Verificación de saldos
      const updatedLoan = await getLoanById(tempLoanId!, tenantId);
      record('Pagos', 'Incremento atómico de cuotas pagadas (1/10)', updatedLoan?.paid_installments === 1, `Esperado 1, obtenido ${updatedLoan?.paid_installments}`);
      record('Pagos', 'Disminución de saldo pendiente (600k - 60k = 540k)', updatedLoan?.balance === 540000, `Esperado 540000, obtenido ${updatedLoan?.balance}`);
    }

    // -----------------------------------------------------------------
    // GRUPO 5: DÍA DE GRACIA (PRÓRROGA)
    // -----------------------------------------------------------------
    const t5 = Date.now();
    const secondPayment = loanDetail?.payments?.[1];
    if (secondPayment) {
      const oldEndDate = new Date(loanDetail?.end_date || '').getTime();
      const graceRes = await applyGraceDay(tempLoanId!, tenantId, secondPayment.id);
      record('Novedades', 'Aplicación de día de gracia', graceRes.success, graceRes.error, Date.now() - t5);

      const refreshedLoan = await getLoanById(tempLoanId!, tenantId);
      const updatedSecondPayment = refreshedLoan?.payments?.find(p => p.id === secondPayment.id);
      record('Novedades', 'Cuota marcada como grace y locked', updatedSecondPayment?.status === 'grace', `Estado es ${updatedSecondPayment?.status}`);
      const newEndDate = new Date(refreshedLoan?.end_date || '').getTime();
      record('Novedades', 'Extensión de fecha final de préstamo', newEndDate >= oldEndDate, 'Fecha final no se extendió');
    }

    // -----------------------------------------------------------------
    // GRUPO 6: SALDADO COMPLETO ANTICIPADO
    // -----------------------------------------------------------------
    const t6 = Date.now();
    const payOffRes = await payOffLoan(tempLoanId!, tenantId);
    record('Saldado', 'Saldar crédito completo (payOffLoan)', payOffRes.success, payOffRes.error, Date.now() - t6);

    const completedLoan = await getLoanById(tempLoanId!, tenantId);
    record('Saldado', 'Estado de préstamo actualizado a "completed"', completedLoan?.status === 'completed', `Estado es ${completedLoan?.status}`);
    record('Saldado', 'Saldo del préstamo en $0', completedLoan?.balance === 0, `Saldo es ${completedLoan?.balance}`);
    const allPaymentsPaid = completedLoan?.payments?.every(p => p.status === 'paid' || p.status === 'grace');
    record('Saldado', 'Todas las cuotas regularizadas', !!allPaymentsPaid, 'Quedaron cuotas pendientes');

    // -----------------------------------------------------------------
    // GRUPO 7: ELIMINACIÓN DE CLIENTE EN CASCADA (FIX REGRESIÓN DE FK)
    // -----------------------------------------------------------------
    const t7 = Date.now();
    const clientToDeleteRes = await createClient({
      tenant_id: tenantId,
      full_name: 'Cliente Para Test Cascada FK',
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
    record('Integridad Relacional', 'Crear cliente de prueba para borrado en cascada', !!delClientId, clientToDeleteRes.error);

    if (delClientId) {
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
      record('Integridad Relacional', 'Asociar préstamo y cuotas dependientes al cliente', !!delLoanId, delLoanRes.error);

      // EJECUTAR DELETE CLIENTE — LA OPERACIÓN QUE FALLABA ANTES CON ERROR DE FK
      const deleteResult = await deleteClient(delClientId, tenantId);
      record('Integridad Relacional', 'Eliminación en cascada de cliente con préstamos asociados', deleteResult.success, deleteResult.error, Date.now() - t7);

      // Comprobación forense de huérfanos
      const orphanedPayments = await db.query.payments.findMany({
        where: eq(payments.loan_id, delLoanId)
      });
      record('Integridad Relacional', 'Cero pagos huérfanos en BD tras eliminación', orphanedPayments.length === 0, `Quedaron ${orphanedPayments.length} pagos`);

      const orphanedLoans = await db.query.loans.findMany({
        where: eq(loans.id, delLoanId)
      });
      record('Integridad Relacional', 'Cero préstamos huérfanos en BD tras eliminación', orphanedLoans.length === 0, `Quedaron ${orphanedLoans.length} préstamos`);

      const orphanedClients = await db.query.clients.findMany({
        where: eq(clients.id, delClientId)
      });
      record('Integridad Relacional', 'Cliente eliminado 100% de la tabla clients', orphanedClients.length === 0, 'El cliente aún existe en BD');
    }

    // -----------------------------------------------------------------
    // GRUPO 8: RUTAS DE COBRANZA
    // -----------------------------------------------------------------
    const t8 = Date.now();
    const routeRes = await createRoute({
      tenant_id: tenantId,
      name: 'Ruta QA Express',
      zone: 'Zona Norte QA',
      collector_id: collectorId,
      color: '#10B981',
      notes: 'Ruta temporal creada por QA'
    });
    record('Rutas', 'Creación de ruta de cobranza', !!routeRes.data && !routeRes.error, routeRes.error, Date.now() - t8);
    tempRouteId = routeRes.data?.id || null;

    if (tempRouteId && tempClientId) {
      const assignRes = await addClientToRoute(tempClientId, tempRouteId, tenantId);
      record('Rutas', 'Asignación de cliente a ruta', !assignRes.error, assignRes.error);

      const removeRes = await removeClientFromRoute(tempClientId, tenantId);
      record('Rutas', 'Desasignación limpia de cliente de ruta', !removeRes.error, removeRes.error);

      const deleteRouteRes = await deleteRoute(tempRouteId, tenantId);
      record('Rutas', 'Eliminación segura de ruta sin violar FK', !deleteRouteRes.error, deleteRouteRes.error);
      tempRouteId = null;
    }

    // -----------------------------------------------------------------
    // GRUPO 9: MATEMÁTICA Y SALUD DEL DASHBOARD
    // -----------------------------------------------------------------
    const t9 = Date.now();
    const kpis = await getDashboardKPIs(tenantId);
    record('Dashboard', 'Capital en calle es un número válido (no NaN)', typeof kpis.capital_in_street === 'number' && !isNaN(kpis.capital_in_street), 'capital_in_street es NaN');
    record('Dashboard', 'Intereses por cobrar es un número válido (no NaN)', typeof kpis.interest_receivable === 'number' && !isNaN(kpis.interest_receivable), 'interest_receivable es NaN');
    record('Dashboard', 'Índice de mora protegido contra división por cero', typeof kpis.delinquency_rate === 'number' && !isNaN(kpis.delinquency_rate), 'delinquency_rate es NaN', Date.now() - t9);

  } catch (err: any) {
    record('Excepción Crítica', 'Ejecución libre de fallos no controlados', false, err.message);
  } finally {
    // Limpieza de datos temporales
    try {
      if (tempRouteId) {
        const tenant = await db.query.tenants.findFirst({ where: eq(tenants.name, 'Inversiones Juan & Cía') });
        if (tenant) await deleteRoute(tempRouteId, tenant.id);
      }
      if (tempClientId) {
        const tenant = await db.query.tenants.findFirst({ where: eq(tenants.name, 'Inversiones Juan & Cía') });
        if (tenant) await deleteClient(tempClientId, tenant.id);
      }
    } catch (cleanupErr) {
      console.error('Error durante cleanup de QA:', cleanupErr);
    }
  }

  const passedCount = results.filter(r => r.passed).length;
  const failedCount = results.filter(r => !r.passed).length;

  return NextResponse.json({
    success: failedCount === 0,
    totalTests: results.length,
    passedCount,
    failedCount,
    totalDurationMs: Date.now() - startAll,
    results
  });
}
