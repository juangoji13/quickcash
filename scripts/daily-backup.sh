#!/bin/bash
set -euo pipefail

# ==============================================================================
# QuickCash — Script de Respaldo Diario Automático (PostgreSQL)
# Ejecutado vía cron todos los días a las 03:00 AM (hora Colombia / servidor)
# ==============================================================================

BACKUP_DIR="/home/opc/quickcash-backups"
LOG_FILE="${BACKUP_DIR}/backup.log"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="${BACKUP_DIR}/quickcash_${TIMESTAMP}.sql.gz"

mkdir -p "${BACKUP_DIR}"

echo "[$(date -Iseconds)] Iniciando copia de seguridad diaria de QuickCash..." >> "${LOG_FILE}"

# Realizar dump comprimido usando pg_dump directamente del contenedor supabase-db
if docker exec supabase-db pg_dump -U postgres -d quickcash --clean --if-exists | gzip > "${BACKUP_FILE}"; then
  FILESIZE=$(stat -c%s "${BACKUP_FILE}" 2>/dev/null || stat -f%z "${BACKUP_FILE}" 2>/dev/null || echo 0)
  if [ "${FILESIZE}" -gt 1000 ]; then
    chmod 600 "${BACKUP_FILE}"
    HUMAN_SIZE=$(du -h "${BACKUP_FILE}" | cut -f1)
    echo "[$(date -Iseconds)] Respaldo completado exitosamente: ${BACKUP_FILE} (${HUMAN_SIZE})" >> "${LOG_FILE}"
  else
    echo "[$(date -Iseconds)] ERROR: El archivo de respaldo tiene un tamaño sospechoso (${FILESIZE} bytes)" >> "${LOG_FILE}"
    exit 1
  fi
else
  echo "[$(date -Iseconds)] ERROR: Falló la ejecución de pg_dump en el contenedor supabase-db" >> "${LOG_FILE}"
  exit 1
fi

# Política de retención: mantener los respaldos de los últimos 30 días
DELETED_COUNT=$(find "${BACKUP_DIR}" -name "quickcash_*.sql.gz" -type f -mtime +30 -delete -print 2>/dev/null | wc -l || echo 0)
if [ "${DELETED_COUNT}" -gt 0 ]; then
  echo "[$(date -Iseconds)] Limpieza de retención: eliminados ${DELETED_COUNT} respaldos de más de 30 días" >> "${LOG_FILE}"
fi

echo "[$(date -Iseconds)] Proceso finalizado correctamente." >> "${LOG_FILE}"
