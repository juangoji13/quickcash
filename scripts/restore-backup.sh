#!/bin/bash
set -euo pipefail

# ==============================================================================
# QuickCash — Script de Restauración de Respaldo PostgreSQL
# Uso: ./scripts/restore-backup.sh /home/opc/quickcash-backups/quickcash_YYYYMMDD_HHMMSS.sql.gz
# ==============================================================================

if [ $# -lt 1 ]; then
  echo "Uso: $0 <ruta-al-archivo-sql.gz>"
  exit 1
fi

BACKUP_FILE="$1"

if [ ! -f "${BACKUP_FILE}" ]; then
  echo "Error: El archivo ${BACKUP_FILE} no existe."
  exit 1
fi

echo "⚠️  ADVERTENCIA: Esta operación sobreescribirá los datos actuales de la base quickcash."
echo "Restaurando ${BACKUP_FILE} en supabase-db..."

gunzip -c "${BACKUP_FILE}" | docker exec -i supabase-db psql -U postgres -d quickcash

echo "✅ Restauración completada con éxito."
