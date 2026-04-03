Tienes toda la razón. Me enfoqué tanto en unificar la lógica y el diseño que dejé por fuera la parte más importante para la ejecución: **el backlog de trabajo**.

Aquí tienes el **PRD definitivo y 100% completo**, ahora sí con los Módulos Épicos y los Tickets de desarrollo integrados en la Sección 8 para que puedas organizar las tareas directamente.

Markdown

\# 📄 Documento de Requerimientos de Producto (PRD) \- Gestor de Préstamos "QuickCash"

**\*\*Versión:\*\*** 1.0 (MVP)  
**\*\*Público Objetivo:\*\*** Prestadores Independientes / Grupos de Préstamo (Gota a Gota)  
**\*\*Plataformas:\*\*** App Android (Operación de calle) \+ Web App (Panel Administrativo)  
**\*\*Stack Tecnológico:\*\*** Flutter (Frontend) \+ Supabase/PostgreSQL (Backend Fase 1\) \-\> NestJS (Fase 2\)

\---

\#\# 1\. Visión Ejecutiva  
Sustituir el control manual (papel y tarjetas) de los prestadores de corto plazo por una solución digital centralizada. El sistema automatiza el cálculo de cuotas, audita el trabajo de los cobradores mediante geolocalización, opera bajo conectividad limitada (Offline-first) y proporciona métricas de rentabilidad y riesgo en tiempo real.

\---

\#\# 2\. Arquitectura de Usuarios y Seguridad

\#\#\# 2.1 Modelo Multi-Tenant  
\* Base de datos compartida pero lógicamente aislada. Se utiliza una columna \`tenant\_id\` protegida por políticas de seguridad RLS (Row Level Security) para garantizar que los datos de un prestador jamás se crucen con los de otro.

\#\#\# 2.2 Roles de Sistema  
\* **\*\*Súper Admin:\*\*** Propietario del software. Gestiona la creación de las instancias de los dueños de rutas.  
\* **\*\*Dueño de Ruta (Admin Tenant):\*\*** Administrador de su propio capital. Accede al dashboard web y app móvil. Configura variables, monitorea métricas, crea rutas y supervisa cobradores. (Puede actuar como cobrador si lo desea).  
\* **\*\*Cobrador:\*\*** Personal de campo. Acceso exclusivo a la app móvil y limitado estrictamente a la lista de clientes que le ha sido asignada. No tiene visibilidad sobre las utilidades globales del negocio.

\#\#\# 2.3 Autenticación y Control de Acceso  
\* **\*\*Registro por Invitación:\*\*** Los cobradores no pueden registrarse libremente. El Dueño de Ruta debe pre-autorizar sus correos electrónicos desde el panel administrativo.  
\* **\*\*Inicio Rápido (Biometría):\*\*** Tras el primer inicio de sesión, la app móvil requerirá desbloqueo por Huella Digital o FaceID para agilizar el flujo en la calle y mantener la privacidad de la cuenta.

\---

\#\# 3\. Lógica de Negocio y Finanzas

\#\#\# 3.1 Motor de Préstamos  
\* **\*\*Modalidades:\*\*** Soporte para frecuencias de cobro Diarias, Semanales y Quincenales.  
\* **\*\*Calendario Inteligente:\*\*** Opción configurable para omitir días no laborables (domingos y festivos) en la proyección de las cuotas.  
\* **\*\*Día de Gracia (Manejo de Novedades):\*\*** Si se registra un "No Pago", el sistema desplaza la fecha de finalización del préstamo agregando un día extra al final del cronograma.  
\* **\*\*Renovaciones (Refinanciamiento):\*\*** Funcionalidad para liquidar un préstamo activo utilizando el capital de uno nuevo, calculando automáticamente el saldo pendiente y mostrando el excedente neto a entregar.  
\* **\*\*Multimoneda:\*\*** Cada Dueño de Ruta define manualmente la moneda con la que va a operar su instancia.

\#\#\# 3.2 Semáforo de Riesgo (Métrica Visual)  
\* 🟢 **\*\*Verde:\*\*** Cliente al día o con pagos adelantados.  
\* 🟡 **\*\*Amarillo:\*\*** 1 a 2 cuotas vencidas (Alerta temprana).  
\* 🔴 **\*\*Rojo:\*\*** 3 o más cuotas vencidas (Mora crítica).

\---

\#\# 4\. Operación de Cobro (App Móvil)

\#\#\# 4.1 Hoja de Ruta  
\* **\*\*Lista Flexible:\*\*** El cobrador ve los cobros pendientes, pero sin un orden bloqueado. Usa barra de búsqueda o filtros ("Pendientes", "Pagados", "Morosos").  
\* **\*\*Perfiles con Evidencia:\*\*** Captura fotográfica del cliente (cédula) y la fachada de su negocio/vivienda.

\#\#\# 4.2 Transacciones y Auditoría  
\* **\*\*Auditoría GPS (Geofencing):\*\*** Cada transacción (Pago, Abono o No Pagó) captura las coordenadas GPS exactas en segundo plano.  
\* **\*\*Inmutabilidad de Registros (Opción A):\*\*** Para evitar fraudes, una vez que el cobrador registra una transacción, **\*\*no puede editarla ni eliminarla\*\***. Solo el Admin puede corregir errores desde el panel web.  
\* **\*\*Cierre de Ruta/Caja:\*\*** Al concluir la jornada, el cobrador presiona "Cierre de Ruta". Esto bloquea nuevos registros y notifica al Admin el efectivo exacto recolectado.

\---

\#\# 5\. Interfaz y Experiencia de Usuario (UX/UI de "Guerrilla")

Diseño optimizado para trabajo de campo bajo presión (calle, sol, motocicleta):  
\* **\*\*Uso a una mano:\*\*** Botones ubicados en la mitad inferior de la pantalla.  
\* **\*\*Alto Contraste:\*\*** Textos negros/blancos puros y montos sobredimensionados.  
\* **\*\*Entrada Rápida:\*\*** Despliegue automático de teclado numérico (Numpad) grande.  
\* **\*\*Gestos (Swipes):\*\*** Swipe derecho para "Pago Completo", Swipe izquierdo para "No Pagó".  
\* **\*\*Feedback Inmediato:\*\*** Vibración háptica y destello verde en pantalla al confirmar transacción.

\---

\#\# 6\. Panel Administrativo (Web App Dashboard)  
1\. **\*\*Capital en Calle:\*\*** Dinero prestado total activo.  
2\. **\*\*Intereses por Cobrar:\*\*** Proyección de ganancia total.  
3\. **\*\*Recaudo del Día:\*\*** Total recolectado hoy vs. Total esperado.  
4\. **\*\*Índice de Mora:\*\*** Porcentaje de la cartera en estado Rojo o Amarillo.  
5\. **\*\*Historial de Operaciones:\*\*** Renovaciones, nuevos créditos y auditoría de cobradores.

\---

\#\# 7\. Requerimientos Técnicos y Arquitectura

\#\#\# 7.1 Stack Tecnológico  
\* **\*\*MVP:\*\*** Flutter \+ Supabase (Auth, PostgreSQL, Storage, Edge Functions).  
\* **\*\*Escalamiento:\*\*** Migración del backend a VPS propio usando NestJS (TypeScript) o FastAPI (Python).

\#\#\# 7.2 Soporte Offline-First  
\* Base de datos local (SQLite/Hive) como caché para trabajar en zonas sin cobertura. Sincronización automática de la cola de transacciones al recuperar internet.

\#\#\# 7.3 Estructura Relacional Base (SQL)  
\* \`tenants\`, \`users\`, \`clients\`, \`loans\`, \`payments\`.

\---

\#\# 8\. Módulos de Desarrollo y Backlog (Tickets)

Para organizar los Sprints de trabajo, el desarrollo se divide en 4 módulos épicos:

\#\#\# 🏗 Módulo 1: Infraestructura y Multi-tenancy  
\* **\*\*Ticket 1.1 \- BD Multi-tenant:\*\*** Diseñar esquema PostgreSQL asegurando políticas RLS con \`tenant\_id\` en todas las tablas.  
\* **\*\*Ticket 1.2 \- Autenticación Biométrica y Roles:\*\*** Implementar login por invitación (Admin crea a Cobrador), jerarquía de permisos y desbloqueo local por FaceID/Huella.  
\* **\*\*Ticket 1.3 \- Configuración Base (Tenant):\*\*** Crear vistas para que el Admin configure la moneda y los días no laborables de su instancia.

\#\#\# 💸 Módulo 2: Core de Préstamos (Lógica Financiera)  
\* **\*\*Ticket 2.1 \- Motor de Cuotas:\*\*** Formulario de creación de crédito. Algoritmo que calcula el cronograma de pagos omitiendo días no laborables (si aplica).  
\* **\*\*Ticket 2.2 \- Lógica de Desplazamiento (Día de Gracia):\*\*** Script que corra la fecha final del préstamo automáticamente cuando se registre la novedad "No Pagó".  
\* **\*\*Ticket 2.3 \- Motor de Renovaciones:\*\*** Flujo para cancelar un crédito actual y abrir uno nuevo, calculando el saldo neto a desembolsar.

\#\#\# 📱 Módulo 3: App Móvil "Offline-First" (Operación)  
\* **\*\*Ticket 3.1 \- Hoja de Ruta y Gestos:\*\*** Interfaz de lista de clientes con acciones por Swipe (derecha/izquierda) y semáforo de colores. Implementar Caché Local.  
\* **\*\*Ticket 3.2 \- Numpad y Transacciones GPS:\*\*** Creación del teclado numérico propio y captura silenciosa de latitud/longitud en cada guardado.  
\* **\*\*Ticket 3.3 \- Cierre de Caja e Inmutabilidad:\*\*** Bloqueo de edición de registros para el cobrador y botón de finalización de jornada.

\#\#\# 📈 Módulo 4: Dashboard Admin y Métricas  
\* **\*\*Ticket 4.1 \- Semáforo Automático:\*\*** Función (Edge Function/Cron) que revise a diario el estado de los clientes y actualice los colores (Verde, Amarillo, Rojo).  
\* **\*\*Ticket 4.2 \- KPIs en Tiempo Real:\*\*** Gráficas de Recaudo vs Esperado, Capital en Calle e Índice de Mora.  
\* **\*\*Ticket 4.3 \- Gestión Multimedia:\*\*** Subida y carga optimizada de fotos (Cédula/Negocio) conectada a Supabase Storage.  
