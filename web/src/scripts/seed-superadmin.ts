import { db } from '../lib/db';
import { tenants, users } from '../lib/db/schema';
import { eq, or } from 'drizzle-orm';
import bcrypt from 'bcryptjs';

async function seedSuperAdmin() {
  console.log('👑 Provisioning SuperAdmin account...');

  const adminEmail = process.env.SUPERADMIN_EMAIL || 'admin@quickcash.app';
  const adminPassword = process.env.SUPERADMIN_PASSWORD || 'QuickCash2025*!';
  const adminUsername = process.env.SUPERADMIN_USERNAME || '@superadmin';
  const adminName = process.env.SUPERADMIN_NAME || 'Super Administrador';

  try {
    // 1. Ensure platform root tenant exists
    let [platformTenant] = await db
      .select()
      .from(tenants)
      .where(eq(tenants.name, 'QuickCash Global'))
      .limit(1);

    if (!platformTenant) {
      [platformTenant] = await db
        .insert(tenants)
        .values({
          name: 'QuickCash Global',
          currency: 'COP',
        })
        .returning();
      console.log(`✅ Platform Root Tenant created: ${platformTenant.name} (${platformTenant.id})`);
    } else {
      console.log(`ℹ️ Platform Root Tenant exists: ${platformTenant.name} (${platformTenant.id})`);
    }

    // 2. Hash password
    const hashedPassword = await bcrypt.hash(adminPassword, 10);

    // 3. Check for existing superadmin user by email or username
    const [existingAdmin] = await db
      .select()
      .from(users)
      .where(
        or(
          eq(users.email, adminEmail),
          eq(users.username, adminUsername)
        )
      )
      .limit(1);

    if (existingAdmin) {
      await db
        .update(users)
        .set({
          password_hash: hashedPassword,
          role: 'superadmin',
          full_name: adminName,
          is_active: true,
          tenant_id: platformTenant.id,
          updated_at: new Date(),
        })
        .where(eq(users.id, existingAdmin.id));

      console.log(`✅ SuperAdmin account updated successfully:`);
      console.log(`   Email:    ${adminEmail}`);
      console.log(`   Username: ${adminUsername}`);
      console.log(`   Role:     superadmin`);
    } else {
      await db.insert(users).values({
        username: adminUsername,
        email: adminEmail,
        password_hash: hashedPassword,
        full_name: adminName,
        role: 'superadmin',
        tenant_id: platformTenant.id,
        is_active: true,
      });

      console.log(`✅ SuperAdmin account created successfully:`);
      console.log(`   Email:    ${adminEmail}`);
      console.log(`   Username: ${adminUsername}`);
      console.log(`   Role:     superadmin`);
    }

    console.log('✨ SuperAdmin provisioning completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error provisioning SuperAdmin:', error);
    process.exit(1);
  }
}

seedSuperAdmin();
