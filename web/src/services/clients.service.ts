'use server';

/* ============================================
 * QuickCash — Clients Service
 * CRUD completo de clientes (SQL Local / Drizzle)
 * ============================================ */

import { db } from '@/lib/db';
import { clients, loans, users } from '@/lib/db/schema';
import { eq, or, ilike, desc } from 'drizzle-orm';
import type { Client, ClientWithLoans } from '@/types';

export async function getClients(): Promise<Client[]> {
  try {
    const results = await db.query.clients.findMany({
      orderBy: [desc(clients.created_at)],
    });
    return results as unknown as Client[];
  } catch (error) {
    console.error('Error fetching clients:', error);
    return [];
  }
}

export async function getClientById(id: string): Promise<ClientWithLoans | null> {
  try {
    const result = await db.query.clients.findFirst({
      where: eq(clients.id, id),
      with: {
        loans: true,
        collector: true,
      },
    });

    return result as unknown as ClientWithLoans;
  } catch (error) {
    console.error('Error fetching client:', error);
    return null;
  }
}

export async function createClient(
  clientData: any
): Promise<{ data: Client | null; error?: string }> {
  try {
    const [newClient] = await db.insert(clients).values({
      full_name: clientData.full_name,
      tenant_id: clientData.tenant_id,
      collector_id: clientData.collector_id,
      document_id: clientData.document_id,
      phone: clientData.phone,
      address: clientData.address,
      latitude: clientData.latitude,
      longitude: clientData.longitude,
      risk_status: 'green',
    }).returning();

    return { data: newClient as unknown as Client };
  } catch (err: any) {
    return { data: null, error: err.message };
  }
}

export async function updateClient(
  id: string,
  updates: Partial<Client>
): Promise<{ success: boolean; error?: string }> {
  try {
    await db.update(clients)
      .set(updates as any)
      .where(eq(clients.id, id));
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function deleteClient(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    await db.delete(clients).where(eq(clients.id, id));
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function searchClients(query: string): Promise<Client[]> {
  try {
    const results = await db.query.clients.findMany({
      where: or(
        ilike(clients.full_name, `%${query}%`),
        ilike(clients.document_id, `%${query}%`),
        ilike(clients.phone, `%${query}%`)
      ),
      orderBy: [clients.full_name],
    });
    return results as unknown as Client[];
  } catch (error) {
    console.error('Error searching clients:', error);
    return [];
  }
}
