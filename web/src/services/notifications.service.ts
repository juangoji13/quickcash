'use server';

import { db } from '@/lib/db';
import { route_closures, clients, invitations } from '@/lib/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { formatCurrency, formatDate } from '@/lib/utils';

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  time: string;
  type: 'info' | 'warning' | 'success';
  read: boolean;
  link?: string;
}

export async function getLiveNotifications(tenantId: string): Promise<NotificationItem[]> {
  try {
    const notifications: NotificationItem[] = [];

    // 1. Arqueos por conciliar (cierres de ruta que no han sido verificados)
    const pendingClosures = await db.query.route_closures.findMany({
      where: and(
        eq(route_closures.tenant_id, tenantId),
        eq(route_closures.status, 'open')
      ),
      with: {
        collector: true,
      },
      orderBy: [desc(route_closures.created_at)],
      limit: 5,
    });

    for (const c of pendingClosures) {
      notifications.push({
        id: `closure-${c.id}`,
        title: 'Arqueo Pendiente por Conciliar',
        message: `${c.collector?.full_name || 'Cobrador'} registró entrega de ${formatCurrency(Number(c.total_collected || 0))} de su ruta.`,
        time: formatDate(c.closure_date ? new Date(c.closure_date).toISOString() : new Date().toISOString()),
        type: 'warning',
        read: false,
        link: '/routes',
      });
    }

    // 2. Clientes en mora crítica (risk_status = 'red')
    const overdueClients = await db.query.clients.findMany({
      where: and(
        eq(clients.tenant_id, tenantId),
        eq(clients.risk_status, 'red')
      ),
      limit: 5,
    });

    if (overdueClients.length > 0) {
      notifications.push({
        id: 'overdue-alert',
        title: 'Alerta de Cartera en Mora',
        message: `${overdueClients.length} ${overdueClients.length === 1 ? 'cliente presenta' : 'clientes presentan'} atraso crítico en sus cuotas.`,
        time: 'Hoy',
        type: 'warning',
        read: false,
        link: '/clients',
      });
    }

    // 3. Invitaciones pendientes a cobradores
    const pendingInvs = await db.query.invitations.findMany({
      where: and(
        eq(invitations.tenant_id, tenantId),
        eq(invitations.status, 'pending')
      ),
      limit: 3,
    });

    for (const inv of pendingInvs) {
      notifications.push({
        id: `inv-${inv.id}`,
        title: 'Invitación a Cobrador Pendiente',
        message: `Invitación enviada a ${inv.email} pendiente de confirmación.`,
        time: formatDate(inv.created_at ? new Date(inv.created_at).toISOString() : new Date().toISOString()),
        type: 'info',
        read: false,
        link: '/collectors',
      });
    }

    return notifications;
  } catch (err) {
    console.error('Error fetching live notifications:', err);
    return [];
  }
}
