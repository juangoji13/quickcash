import psycopg2
import os
import sys
from datetime import datetime, timedelta
import uuid

# --- CONFIGURACIÓN ---
# Intentar cargar variables desde .env
env_path = os.path.join(os.path.dirname(__file__), '..', 'web', '.env')
db_url = "postgresql://admin:quickcash_pass_2024@localhost:5432/quickcash"

if os.path.exists(env_path):
    with open(env_path, 'r') as f:
        for line in f:
            if line.startswith('DATABASE_URL='):
                db_url = line.split('=')[1].strip().strip('"').strip("'")
                # Ajustar host si es interno de docker pero corremos desde afuera
                if "@quickcash-db:" in db_url:
                    db_url = db_url.replace("@quickcash-db:", "@localhost:")

print(f"🚀 Conectando a la base de datos...")

try:
    conn = psycopg2.connect(db_url)
    cur = conn.cursor()
    print("✅ Conexión exitosa.")
except Exception as e:
    print(f"❌ Error conectando a la DB: {e}")
    sys.exit(1)

def run_sql(sql, params=None):
    try:
        cur.execute(sql, params)
    except Exception as e:
        print(f"⚠️ Error ejecutando SQL: {e}")
        conn.rollback()
        raise e

# --- DDL (CREACIÓN DE TABLAS) ---
print("🏗️ Creando tablas...")

tables_sql = """
-- Extensiones
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Tabla Tenants
CREATE TABLE IF NOT EXISTS tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    currency VARCHAR(10) DEFAULT 'COP' NOT NULL,
    non_working_days JSONB DEFAULT '["sunday"]'::jsonb NOT NULL,
    holidays JSONB DEFAULT '[]'::jsonb NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Tabla Users
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(50) UNIQUE, -- Nuevo campo solicitado para @handle
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    full_name VARCHAR(255),
    role VARCHAR(50) DEFAULT 'collector' NOT NULL,
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    phone VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Tabla Collection Routes
CREATE TABLE IF NOT EXISTS collection_routes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    zone VARCHAR(255),
    collector_id UUID REFERENCES users(id) ON DELETE SET NULL,
    color VARCHAR(50) DEFAULT '#3B82F6',
    is_active BOOLEAN DEFAULT TRUE,
    notes TEXT,
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Tabla Clients
CREATE TABLE IF NOT EXISTS clients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name VARCHAR(255) NOT NULL,
    document_id VARCHAR(50),
    phone VARCHAR(50),
    address TEXT,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    risk_status VARCHAR(20) DEFAULT 'green' NOT NULL,
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
    collector_id UUID REFERENCES users(id) ON DELETE SET NULL,
    route_id UUID REFERENCES collection_routes(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Tabla Loans
CREATE TABLE IF NOT EXISTS loans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    principal_amount DOUBLE PRECISION NOT NULL,
    interest_rate DOUBLE PRECISION DEFAULT 20 NOT NULL,
    total_amount DOUBLE PRECISION NOT NULL,
    paid_installments INTEGER DEFAULT 0 NOT NULL,
    total_installments INTEGER NOT NULL,
    balance DOUBLE PRECISION,
    installment_amount DOUBLE PRECISION NOT NULL,
    status VARCHAR(20) DEFAULT 'active' NOT NULL,
    frequency VARCHAR(20) DEFAULT 'daily' NOT NULL,
    start_date TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    end_date TIMESTAMP WITH TIME ZONE NOT NULL,
    client_id UUID REFERENCES clients(id) ON DELETE CASCADE NOT NULL,
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
    collector_id UUID REFERENCES users(id) ON DELETE SET NULL NOT NULL,
    skip_non_working_days BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Tabla Payments
CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    loan_id UUID REFERENCES loans(id) ON DELETE CASCADE NOT NULL,
    installment_number INTEGER NOT NULL,
    amount_due DOUBLE PRECISION NOT NULL,
    amount_paid DOUBLE PRECISION DEFAULT 0 NOT NULL,
    due_date TIMESTAMP WITH TIME ZONE NOT NULL,
    paid_date TIMESTAMP WITH TIME ZONE,
    status VARCHAR(20) DEFAULT 'pending' NOT NULL,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    is_locked BOOLEAN DEFAULT FALSE NOT NULL,
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
    collector_id UUID REFERENCES users(id) ON DELETE SET NULL NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);
"""

run_sql(tables_sql)
conn.commit()
print("✅ Tablas creadas/verificadas.")

# --- SEEDING (DATOS DE PRUEBA) ---
print("🌱 Sembrando datos Premium...")

# 1. Crear Tenant
tenant_id = str(uuid.uuid4())
run_sql("""
    INSERT INTO tenants (id, name, currency) 
    VALUES (%s, 'QuickCash Enterprise', 'COP')
    ON CONFLICT DO NOTHING
""", (tenant_id,))

# 2. Crear Usuarios (Handle @)
from werkzeug.security import generate_password_hash 
# Nota: Si no tienes werkzeug usamos un hash simple dummy por ahora
# para no complicar el script si el usuario no tiene la lib instalada
dummy_hash = "argon2id$v=19$m=65536,t=3,p=4$some_random_hash_here" # En prod usar bcrypt/argon2

admin_id = str(uuid.uuid4())
run_sql("""
    INSERT INTO users (id, username, email, password_hash, full_name, role, tenant_id)
    VALUES (%s, '@admin_master', 'admin@quickcash.com', %s, 'Administrador Pro', 'admin', %s)
    ON CONFLICT (username) DO NOTHING
""", (admin_id, dummy_hash, tenant_id))

collector_id = str(uuid.uuid4())
run_sql("""
    INSERT INTO users (id, username, email, password_hash, full_name, role, tenant_id)
    VALUES (%s, '@cobrador_ruinas', 'cobrador1@quickcash.com', %s, 'Juan Cobrador', 'collector', %s)
    ON CONFLICT (username) DO NOTHING
""", (collector_id, dummy_hash, tenant_id))

# 3. Crear Ruta
route_id = str(uuid.uuid4())
run_sql("""
    INSERT INTO collection_routes (id, name, zone, collector_id, tenant_id, color)
    VALUES (%s, 'Ruta Central - VIP', 'Sector Norte', %s, %s, '#FFD700')
    ON CONFLICT DO NOTHING
""", (route_id, collector_id, tenant_id))

# 4. Crear Cliente
client_id = str(uuid.uuid4())
run_sql("""
    INSERT INTO clients (id, full_name, document_id, phone, address, tenant_id, route_id, risk_status)
    VALUES (%s, 'Carlos Slim Jr', '1098765432', '3101234567', 'Av. 5 con Calle 10', %s, %s, 'green')
    ON CONFLICT DO NOTHING
""", (client_id, tenant_id, route_id))

# 5. Crear Préstamo
loan_id = str(uuid.uuid4())
principal = 1000000.0
total = principal * 1.20 # 20% interes
run_sql("""
    INSERT INTO loans (id, principal_amount, interest_rate, total_amount, total_installments, balance, installment_amount, status, end_date, client_id, tenant_id, collector_id)
    VALUES (%s, %s, 20, %s, 20, %s, %s, 'active', %s, %s, %s, %s)
    ON CONFLICT DO NOTHING
""", (loan_id, principal, total, total, total/20, datetime.now() + timedelta(days=20), client_id, tenant_id, collector_id))

conn.commit()
cur.close()
conn.close()

print("\n✨ Base de datos generada mejorada:")
print(f"👉 Tenant creado: QuickCash Enterprise")
print(f"👉 Admin: @admin_master (Pass: dummy_hash)")
print(f"👉 Cobrador: @cobrador_ruinas")
print(f"👉 Cliente Premium: Carlos Slim Jr")
print("\n✅ ¡LISTO!")
