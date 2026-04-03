# QuickCash — Instrucciones para IA

## PRIMERA INSTRUCCIÓN CRÍTICA
**LEE EL ARCHIVO `HANDOFF.md` EN ESTE MISMO DIRECTORIO ANTES DE HACER CUALQUIER COSA.**

Ese archivo contiene:
- Contexto completo del proyecto (stack, credenciales, estructura)
- Estado actual de todas las funcionalidades
- Diagnóstico detallado de qué mejorar en la UI
- Instrucciones específicas de qué hacer y qué NO hacer
- Referencia de archivos CSS por módulo

## Reglas
1.## Estado Actual (Abril 2026)
- **Modales Propios**: Se han eliminado casi todos los `window.confirm` y `window.prompt`. Usa los componentes `<ConfirmModal />` y `<PromptModal />` de `@/components/ui/Modal`.
- **UI Premium**: Se ha implementado glassmorphism, sombras profundas y un diseño más "vendele" (premium).
- **Dashboard de Préstamos**: La vista detallada de préstamos incluye cronograma de pagos y estados en tiempo real.

## Tareas Pendientes e Instrucciones
1. **Cobros Futuros**: Falta implementar un bloque en el Dashboard principal que resuma los cobros de los próximos 7 días para todos los préstamos.
2. **Collectors Page**: Falta migrar el último `confirm()` que queda en el borrado de invitaciones.
3. **Consistencia**: Mantener el estilo glassmorphism en cualquier componente nuevo.
4. **HANDOFF.md**: Consulta este archivo para detalles profundos de la arquitectura y BD.
