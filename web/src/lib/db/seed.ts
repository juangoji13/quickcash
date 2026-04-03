import { db } from './index';
import { tenants, users } from './schema';
import bcrypt from 'bcryptjs';

async function seed() {
  console.log('🌱 Seeding database...');

  try {
    // 1. Create Default Tenant
    const [tenant] = await db.insert(tenants).values({
      name: 'QuickCash Demo',
      currency: 'COP',
    }).returning();

    console.log(`✅ Tenant created: ${tenant.name} (${tenant.id})`);

    // 2. Create Admin User
    const hashedPassword = await bcrypt.hash('admin123', 10);
    
    const [admin] = await db.insert(users).values({
      email: 'admin@quickcash.com',
      password_hash: hashedPassword,
      full_name: 'Administrador Sistema',
      role: 'admin',
      tenant_id: tenant.id,
    }).returning();

    console.log(`✅ Admin user created: ${admin.email}`);
    
    console.log('✨ Seeding completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding database:', error);
    process.exit(1);
  }
}

seed();
