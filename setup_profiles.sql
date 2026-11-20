-- ============================================
-- QuickCash — Migration & Seed: New Profiles
-- 1. Remove old superadmin
-- 2. Create SuperAdmin (@SuperJuan13)
-- 3. Create Prestamista (@juan_prestamista) with Tenant & Data
-- ============================================

-- 1. Remove old superadmin
DELETE FROM users WHERE username = '@superadmin' OR email = 'admin@quickcash.app';

-- 2. Ensure Platform Root Tenant exists
INSERT INTO tenants (id, name, currency, non_working_days, holidays, settings)
VALUES (
  'a0000000-0000-0000-0000-000000000001',
  'QuickCash Global',
  'COP',
  '["sunday"]'::jsonb,
  '[]'::jsonb,
  '{"system": true}'::jsonb
)
ON CONFLICT (id) DO UPDATE SET name = 'QuickCash Global';

-- 3. Insert New SuperAdmin (@SuperJuan13 / Passdejuanadmin)
-- Hash: $2b$10$u7pPXQCBqUXsaiqEwSvqGOifbsmMj8hVYayWifJXqPnJSvs.ezI.S
INSERT INTO users (
  id,
  username,
  email,
  password_hash,
  full_name,
  role,
  tenant_id,
  is_active,
  phone
)
VALUES (
  'a0000000-0000-0000-0000-000000000002',
  '@SuperJuan13',
  'superjuan@quickcash.app',
  '$2b$10$u7pPXQCBqUXsaiqEwSvqGOifbsmMj8hVYayWifJXqPnJSvs.ezI.S',
  'Juan SuperAdmin',
  'superadmin',
  'a0000000-0000-0000-0000-000000000001',
  true,
  '+57 300 000 0001'
)
ON CONFLICT (email) DO UPDATE SET
  username = '@SuperJuan13',
  password_hash = '$2b$10$u7pPXQCBqUXsaiqEwSvqGOifbsmMj8hVYayWifJXqPnJSvs.ezI.S',
  full_name = 'Juan SuperAdmin',
  role = 'superadmin',
  is_active = true;

-- 4. Create Tenant for Prestamista
INSERT INTO tenants (id, name, currency, non_working_days, holidays, settings)
VALUES (
  'b0000000-0000-0000-0000-000000000001',
  'Inversiones Juan & Cía',
  'COP',
  '["sunday"]'::jsonb,
  '[]'::jsonb,
  '{
    "business_city": "Medellín, Antioquia",
    "business_address": "Cra 45 # 50-20, Centro",
    "business_nit": "900.876.543-1",
    "default_interest_rate": 20,
    "default_installments": 24,
    "default_frequency": "daily",
    "require_gps": true,
    "allow_partial_payments": true,
    "require_daily_closure": true,
    "auto_receipts_whatsapp": true
  }'::jsonb
)
ON CONFLICT (id) DO UPDATE SET name = 'Inversiones Juan & Cía';

-- 5. Insert Prestamista User (@juan_prestamista / Juanprestamos2026*)
-- Hash: $2b$10$6baQ5UVmElG3uDTcQ7TBbuCL37Tx0TkeLSRumAnLX0fW6MS6iWnJW
INSERT INTO users (
  id,
  username,
  email,
  password_hash,
  full_name,
  role,
  tenant_id,
  is_active,
  phone
)
VALUES (
  'b0000000-0000-0000-0000-000000000002',
  '@juan_prestamista',
  'prestamista@quickcash.app',
  '$2b$10$6baQ5UVmElG3uDTcQ7TBbuCL37Tx0TkeLSRumAnLX0fW6MS6iWnJW',
  'Juan Carlos Prestamista',
  'admin',
  'b0000000-0000-0000-0000-000000000001',
  true,
  '+57 310 555 1234'
)
ON CONFLICT (email) DO UPDATE SET
  username = '@juan_prestamista',
  password_hash = '$2b$10$6baQ5UVmElG3uDTcQ7TBbuCL37Tx0TkeLSRumAnLX0fW6MS6iWnJW',
  full_name = 'Juan Carlos Prestamista',
  role = 'admin',
  is_active = true;

-- 6. Insert Collector User (@carlos_cobrador / Cobrador2026*)
-- Hash: $2b$10$Qx2G55Qe0ZJDZkGjqze9SuutePIPLehvBek2EIsfaK3es7EIPB9/y
INSERT INTO users (
  id,
  username,
  email,
  password_hash,
  full_name,
  role,
  tenant_id,
  is_active,
  phone
)
VALUES (
  'b0000000-0000-0000-0000-000000000003',
  '@carlos_cobrador',
  'carlos_cobrador@quickcash.app',
  '$2b$10$Qx2G55Qe0ZJDZkGjqze9SuutePIPLehvBek2EIsfaK3es7EIPB9/y',
  'Carlos Cobrador',
  'collector',
  'b0000000-0000-0000-0000-000000000001',
  true,
  '+57 312 444 7890'
)
ON CONFLICT (email) DO UPDATE SET
  username = '@carlos_cobrador',
  password_hash = '$2b$10$Qx2G55Qe0ZJDZkGjqze9SuutePIPLehvBek2EIsfaK3es7EIPB9/y',
  full_name = 'Carlos Cobrador',
  role = 'collector',
  is_active = true;

-- 7. Insert Route
INSERT INTO collection_routes (
  id,
  name,
  zone,
  collector_id,
  color,
  is_active,
  tenant_id
)
VALUES (
  'b0000000-0000-0000-0000-000000000004',
  'Ruta Centro Comercial',
  'Comuna 10 - La Candelaria',
  'b0000000-0000-0000-0000-000000000003',
  '#F1C40F',
  true,
  'b0000000-0000-0000-0000-000000000001'
)
ON CONFLICT (id) DO NOTHING;

-- 8. Insert Clients
INSERT INTO clients (
  id,
  full_name,
  document_id,
  phone,
  address,
  risk_status,
  tenant_id,
  collector_id,
  route_id
)
VALUES
(
  'b0000000-0000-0000-0000-000000000011',
  'Martha Cecilia Gómez - Panadería La Espiga',
  '1020304050',
  '+57 311 222 3344',
  'Cra 45 # 52-10, Medellín',
  'green',
  'b0000000-0000-0000-0000-000000000001',
  'b0000000-0000-0000-0000-000000000003',
  'b0000000-0000-0000-0000-000000000004'
),
(
  'b0000000-0000-0000-0000-000000000012',
  'Pedro Antonio Restrepo - Frutería El Oasis',
  '71234567',
  '+57 312 333 4455',
  'Cl 49 # 46-20, Medellín',
  'green',
  'b0000000-0000-0000-0000-000000000001',
  'b0000000-0000-0000-0000-000000000003',
  'b0000000-0000-0000-0000-000000000004'
),
(
  'b0000000-0000-0000-0000-000000000013',
  'Andrés Felipe Taller - Motos del Centro',
  '1035678901',
  '+57 314 555 6677',
  'Cra 50 # 40-15, Medellín',
  'yellow',
  'b0000000-0000-0000-0000-000000000001',
  'b0000000-0000-0000-0000-000000000003',
  'b0000000-0000-0000-0000-000000000004'
)
ON CONFLICT (id) DO NOTHING;

-- 9. Insert Loans for Prestamista
-- Loan 1: Martha, $1.000.000 COP al 20% = $1.200.000 COP, 24 cuotas de $50.000 COP. 8 pagadas, balance $800.000 COP
INSERT INTO loans (
  id,
  principal_amount,
  interest_rate,
  total_amount,
  paid_installments,
  total_installments,
  balance,
  installment_amount,
  status,
  frequency,
  start_date,
  end_date,
  client_id,
  tenant_id,
  collector_id,
  skip_non_working_days
)
VALUES (
  'b0000000-0000-0000-0000-000000000021',
  1000000,
  20,
  1200000,
  8,
  24,
  800000,
  50000,
  'active',
  'daily',
  NOW() - INTERVAL '10 days',
  NOW() + INTERVAL '16 days',
  'b0000000-0000-0000-0000-000000000011',
  'b0000000-0000-0000-0000-000000000001',
  'b0000000-0000-0000-0000-000000000003',
  true
)
ON CONFLICT (id) DO NOTHING;

-- Loan 2: Pedro, $600.000 COP al 20% = $720.000 COP, 24 cuotas de $30.000 COP. 5 pagadas, balance $570.000 COP
INSERT INTO loans (
  id,
  principal_amount,
  interest_rate,
  total_amount,
  paid_installments,
  total_installments,
  balance,
  installment_amount,
  status,
  frequency,
  start_date,
  end_date,
  client_id,
  tenant_id,
  collector_id,
  skip_non_working_days
)
VALUES (
  'b0000000-0000-0000-0000-000000000022',
  600000,
  20,
  720000,
  5,
  24,
  570000,
  30000,
  'active',
  'daily',
  NOW() - INTERVAL '6 days',
  NOW() + INTERVAL '20 days',
  'b0000000-0000-0000-0000-000000000012',
  'b0000000-0000-0000-0000-000000000001',
  'b0000000-0000-0000-0000-000000000003',
  true
)
ON CONFLICT (id) DO NOTHING;

-- Loan 3: Andrés, $400.000 COP al 20% = $480.000 COP, 20 cuotas de $24.000 COP. 2 pagadas, balance $432.000 COP
INSERT INTO loans (
  id,
  principal_amount,
  interest_rate,
  total_amount,
  paid_installments,
  total_installments,
  balance,
  installment_amount,
  status,
  frequency,
  start_date,
  end_date,
  client_id,
  tenant_id,
  collector_id,
  skip_non_working_days
)
VALUES (
  'b0000000-0000-0000-0000-000000000023',
  400000,
  20,
  480000,
  2,
  20,
  432000,
  24000,
  'active',
  'daily',
  NOW() - INTERVAL '4 days',
  NOW() + INTERVAL '18 days',
  'b0000000-0000-0000-0000-000000000013',
  'b0000000-0000-0000-0000-000000000001',
  'b0000000-0000-0000-0000-000000000003',
  true
)
ON CONFLICT (id) DO NOTHING;
