-- QuickCash: Token de acceso público seguro para Talonario Digital de Cuotas
ALTER TABLE clients ADD COLUMN IF NOT EXISTS access_token VARCHAR(64);

-- Asignar tokens únicos a todos los clientes existentes
UPDATE clients 
SET access_token = 'qc_' || substr(md5(random()::text || id::text), 1, 12) 
WHERE access_token IS NULL;

-- Asegurar unicidad y obligatoriedad
ALTER TABLE clients ALTER COLUMN access_token SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_clients_access_token ON clients(access_token);
