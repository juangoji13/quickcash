# 🏗️ QuickCash — Documento de Handoff Completo
> **Panel administrativo de Gota-a-Gota / Préstamos informales**  
> Fecha: 2 de Abril 2026 | Sprint actual: 4.3  
> **IMPORTANTE**: Responder siempre en ESPAÑOL

---

## 📋 CONTEXTO DEL PROYECTO

QuickCash es un **panel administrativo web + mobile** para gestionar préstamos informales (gota a gota). 
Incluye gestión de clientes, préstamos, cobradores, rutas de cobro, reportes y configuración.

### Stack Tecnológico
- **Framework**: Next.js 15 (App Router)
- **Lenguaje**: TypeScript
- **Estilos**: CSS Modules + globals.css (Design System v2)
- **Base de datos**: Supabase (PostgreSQL)
- **Autenticación**: Supabase Auth (email/password)
- **Fonts**: Rubik (headings), Overpass (body), Alfa Slab One (logo)
- **No usa**: Tailwind, ninguna librería de iconos externa

### Credenciales Supabase
```
NEXT_PUBLIC_SUPABASE_URL=https://lsrdikexijjsnfabbhqs.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxzcmRpa2V4aWpqc25mYWJiaHFzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUxNTQ2NTgsImV4cCI6MjA5MDczMDY1OH0.dniKMUXgFwjyzGXEMgTeMlHyH7t9sSqEqgIR7L88e8k
```

### Cómo ejecutar
```bash
cd c:\Users\Juan G\Desktop\PROYECTOS\PRESTAMOS\web
$env:NEXT_PUBLIC_SUPABASE_URL="https://lsrdikexijjsnfabbhqs.supabase.co"; $env:NEXT_PUBLIC_SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxzcmRpa2V4aWpqc25mYWJiaHFzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUxNTQ2NTgsImV4cCI6MjA5MDczMDY1OH0.dniKMUXgFwjyzGXEMgTeMlHyH7t9sSqEqgIR7L88e8k"; npm run dev
```
- Login test: `juangomez4499@gmail.com` / `123456`

---

## 📁 ESTRUCTURA DEL PROYECTO

```
web/src/
├── app/
│   ├── globals.css              ← Design System v2 (620 líneas, tokens, componentes globales)
│   ├── layout.tsx               ← Root layout con AuthProvider + fonts
│   ├── page.tsx                 ← Redirect a /overview
│   ├── (auth)/
│   │   └── login/
│   │       ├── page.tsx         ← Página de login
│   │       └── login.module.css
│   └── (dashboard)/
│       ├── layout.tsx           ← Dashboard layout (Sidebar + topbar + auth guard)
│       ├── dashboard.module.css ← Layout CSS (sidebar offset, topbar blur, loading screen)
│       ├── overview/
│       │   ├── page.tsx         ← Dashboard con KPIs, semáforo riesgo, acciones rápidas
│       │   └── overview.module.css
│       ├── clients/
│       │   ├── page.tsx         ← CRUD clientes, búsqueda, filtro riesgo
│       │   └── clients.module.css
│       ├── loans/
│       │   ├── page.tsx         ← CRUD préstamos, preview cuotas, frecuencias
│       │   └── loans.module.css
│       ├── collectors/
│       │   ├── page.tsx         ← Equipo + invitaciones
│       │   └── collectors.module.css
│       ├── routes/
│       │   ├── page.tsx         ← Rutas de cobro (lista/crear/detalle)
│       │   └── routes.module.css
│       ├── reports/
│       │   ├── page.tsx         ← Reportes financieros + rendimiento
│       │   └── reports.module.css
│       └── settings/
│           ├── page.tsx         ← Config negocio, moneda, días no laborables
│           └── settings.module.css
├── components/
│   ├── layout/
│   │   ├── Sidebar.tsx          ← Sidebar con SVG icons (sin emojis)
│   │   └── Sidebar.module.css
│   ├── charts/                  ← (vacío, para futuro)
│   ├── forms/                   ← (vacío, para futuro)
│   ├── tables/                  ← (vacío, para futuro)
│   └── ui/                      ← (vacío, para futuro)
├── hooks/
│   └── index.ts                 ← useAuth hook
├── lib/
│   ├── supabase/
│   │   └── index.ts             ← createBrowserClient()
│   └── utils.ts                 ← formatCurrency, formatDate, getInitials, risk helpers
├── services/
│   ├── index.ts                 ← Barrel export
│   ├── clients.service.ts       ← CRUD clientes
│   ├── loans.service.ts         ← CRUD préstamos + calculador cuotas + schedule
│   ├── collectors.service.ts    ← CRUD cobradores + invitaciones
│   ├── collection-routes.service.ts ← CRUD rutas + asignar clientes
│   ├── dashboard.service.ts     ← KPIs dashboard
│   ├── reports.service.ts       ← Reportes financieros + performance
│   ├── tenant.service.ts        ← Config tenant
│   └── routes.service.ts        ← (deprecated, usar collection-routes)
├── store/
│   └── auth-context.tsx         ← AuthProvider con Supabase session + appUser
└── types/
    └── index.ts                 ← Todos los tipos TS (188 líneas)
```

---

## 🎨 SISTEMA DE DISEÑO ACTUAL

### Identidad Visual: "Metal y Asfalto"
- **Concepto**: Industrial, confiable, callejero
- **Paleta**: Asphalt (#2C3E50), Safety Yellow (#F1C40F), grays neutrales
- **Fonts**: Rubik (headings, bold), Overpass (body), Alfa Slab One (logo)
- **Radius**: Industrial (3-12px, no excesivamente redondeado)
- **Shadows**: Sutil hybrid (card shadows con 1px border)

### Tokens clave (globals.css :root)
| Token | Valor | Uso |
|-------|-------|-----|
| `--color-asphalt` | #2C3E50 | Color principal texto/sidebar |
| `--color-safety-yellow` | #F1C40F | Accents, botones primarios, active states |
| `--color-bg-light` | #EAEEF1 | Fondo general |
| `--color-card-white` | #FDFEFE | Fondo cards |
| `--gradient-asphalt` | 135deg #2C3E50→#1a252f | Sidebar bg |
| `--gradient-yellow` | 135deg #F1C40F→#d4ac0d | Botones primarios |
| `--shadow-card` | Sutil con 1px ring | Cards en reposo |
| `--shadow-card-hover` | Elevado + yellow ring | Cards en hover |

### Componentes Globales (en globals.css)
- `.btn` `.btn--primary` `.btn--dark` `.btn--ghost` `.btn--sm` `.btn--lg`
- `.card` `.card--elevated` `.card--flat`
- `.input` `.input-label` `.input--error`
- `.badge--green` `.badge--yellow` `.badge--red` `.badge--blue` `.badge--dark`
- `.stat-card` `.stat-card__label` `.stat-card__value`
- `.skeleton` (loading shimmer)
- `.page-title` (con barra amarilla ::before)
- `.table` `.table-wrapper`
- `.empty-state`
- Animaciones: `fadeIn`, `slideUp`, `slideInLeft`, `scaleIn`, `pulse`, `shimmer`

### Sidebar (Sidebar.tsx)
- Iconos: **SVG inline** (estilo Lucide), NO emojis, NO librerías externas
- Secciones: OPERACIÓN (Dashboard, Clientes, Préstamos), GESTIÓN (Cobradores, Rutas, Reportes), SISTEMA (Configuración)
- Active state: left-border amarilla + bg translúcido amarillo
- Bottom: Avatar circular con iniciales + botón logout

---

## 🗄️ BASE DE DATOS (Supabase)

### Tablas principales
| Tabla | Descripción |
|-------|-------------|
| `tenants` | Negocio/empresa (multi-tenant) |
| `users` | Usuarios (admin, collector) con `auth.users` link |
| `clients` | Clientes del negocio, con `route_id` FK |
| `loans` | Préstamos (frequency: daily/weekly/biweekly/monthly) |
| `payments` | Cuotas individuales de cada préstamo |
| `collection_routes` | Rutas de cobro con color, zona, collector_id |
| `invitations` | Invitaciones por email a cobradores |
| `route_closure_records` | Registros de cierres de ruta |

### RLS
- Todas las tablas tienen RLS habilitado
- Políticas basadas en `tenant_id` del usuario autenticado

---

## ✅ LO QUE ESTÁ COMPLETO

### Funcionalidades
- [x] **Auth**: Login/logout con Supabase Auth
- [x] **Dashboard**: KPIs en tiempo real (capital, intereses, recaudo, mora, riesgo)
- [x] **Clientes**: CRUD completo, búsqueda, filtro por riesgo (verde/amarillo/rojo)
- [x] **Préstamos**: Crear con preview de cuotas, frecuencias (diaria/semanal/quincenal/mensual)
- [x] **Cobradores**: Lista equipo, activar/desactivar, sistema de invitaciones
- [x] **Rutas**: CRUD rutas, asignar clientes, asignar cobrador con picker
- [x] **Reportes**: Financiero (KPIs + movimientos + gauges) + Rendimiento cobradores
- [x] **Configuración**: Nombre negocio, moneda, días no laborables, festivos
- [x] **Loading Screen**: Animada con logo QuickCash
- [x] **Emojis**: 100% eliminados, reemplazados por SVG inline o texto

### UI
- [x] Sidebar v3 con SVG icons
- [x] Página de rutas con Comenzar/Cerrar ruta
- [x] Collector picker en detalle de ruta
- [x] Todas las páginas sin emojis
- [x] **Modales Premium**: Reemplazo de `confirm`/`prompt` nativos por `ConfirmModal` y `PromptModal` de React.
- [x] **Glassmorphism**: Implementado en cards, KPIs y sidebars para look premium.

---

## ⚠️ PROBLEMA ACTUAL DEL USUARIO

> **"Me gusta pero lo siento muy plano todavía"**

El usuario siente que la UI, aunque libre de emojis y funcional, se ve **demasiado plana, simple y sin profundidad visual**. Necesita un overhaul estético que la haga sentir **premium, moderna y con vida**.

### Diagnóstico y Soluciones Aplicadas:
1. **Profundidad Visual**: Se implementaron sombras dinámicas y bordes sutiles con glassmorphism.
2. **Modales No Bloqueantes**: Se eliminaron los diálogos nativos que bloqueaban la ejecución en móviles.
3. **Dashboard Detallado**: Cada préstamo y cliente tiene ahora su propia vista de métricas y cronograma.
4. **Interactividad**: Hover effects mejorados en todas las cards y botones.

---

## 🎯 TAREA PARA EL SIGUIENTE MODELO: UI Premium Overhaul

### Objetivo Actual
Finalizar la implementación de funcionalidades solicitadas por el usuario para completar el ecosistema "Premium":
1. **Cronograma de Cobros Futuros**: Bloque en el dashboard principal para ver pagos de la próxima semana.
2. **Migración Final de Modales**: Último `confirm()` en `collectors/page.tsx`.

### Instrucciones técnicas:
1. **Lee este archivo HANDOFF.md primero** antes de hacer cualquier cambio
2. **No rompas funcionalidades existentes** — solo mejora lo visual (CSS + componentes JSX)
3. **Responde siempre en ESPAÑOL** (regla del usuario)
4. **El servidor de desarrollo ya debería estar corriendo** en `localhost:3000`
5. **Usa CSS Modules** — cada página tiene su `.module.css`
6. **No instales librerías de iconos** — los iconos son SVG inline
7. **El archivo globals.css** contiene el design system, puedes enriquecerlo

### Áreas a mejorar:

#### 1. Design System (globals.css)
- Añadir **glassmorphism** utilities (backdrop-filter: blur + bg transparente)
- Mejorar cards con **gradient overlays** sutiles
- Añadir **inner glow** en hover states
- Variables de **grain texture** o subtle patterns para fondos
- Mejorar animaciones: `countUp` para números, hover scale suave

#### 2. Dashboard Layout (dashboard.module.css + layout.tsx)
- **TopBar**: Glassmorphism con blur real, quizás breadcrumb o datetime
- **Fondo de content area**: Sutil gradient o pattern en vez de flat gray
- Añadir **notification badge** o quick stats en el topbar

#### 3. Dashboard Overview (overview/)
- KPI cards con **glassmorphism** o gradient backgrounds
- Números con **counter animation** al cargar
- Semáforo de riesgo con **animated bars** de mayor impacto
- Quick actions con **icon animation on hover**
- Quizás un **mini chart** visual (sin librería, puro CSS/SVG)

#### 4. Sidebar (Sidebar.tsx + .module.css)
- **Hover feedback mejorado**: glow sutil, icon scale
- **Active state más pronunciado**: gradient background en vez de translúcido
- **Transiciones más suaves** entre estados
- **Mobile drawer** para responsive (actualmente no hay mobile sidebar)

#### 5. Todas las páginas de módulo
- Las cards de clientes/préstamos/cobradores necesitan **más personalidad**
- Status badges con **dot indicators** de color (bolita + texto)
- Mejor **jerarquía visual** entre secciones
- **Hover states** más dramáticos pero suaves
- **Empty states** con ilustraciones SVG más elaboradas

#### 6. Rutas (routes/)
- El botón "Comenzar Ruta" debería tener **más presencia** (gradient, glow)
- La barra de "Ruta en curso" debería ser más **llamativa** (animación pulso)
- Las cards de ruta en lista deberían tener **más depth** en el header de color

#### 7. Formularios (crear préstamo, crear ruta, agregar cliente)
- Los inputs se ven muy **básicos** — mejorar con focus transitions, floating labels quizás
- El preview de cuotas podría tener mejor **visual hierarchy**

### Referencia de estilo deseado:
El usuario quiere algo que se sienta como una **app fintech premium**:
- Piensa en interfaces como Stripe Dashboard, Linear, Vercel Dashboard
- **Glassmorphism + dark accents** sobre fondos claros
- **Micro-animaciones** en todos los elementos interactivos
- **Tipografía con jerarquía clara** (grande y bold para números, sutil para labels)
- **Color con propósito** — no decorativo sino informativo

### NO hacer:
- No cambiar la paleta de colores (Asphalt + Safety Yellow es la identidad)
- No cambiar las fuentes (Rubik/Overpass/Alfa Slab One)
- No instalar nuevas dependencias npm
- No modificar la lógica de servicios (services/*.ts) — solo CSS y componentes
- No agregar emojis de vuelta
- No usar Tailwind

---

## 📊 TABLAS DE BD — Referencia Rápida

```sql
-- Principales relaciones:
-- users.tenant_id → tenants.id
-- clients.tenant_id → tenants.id
-- clients.collector_id → users.id (nullable)
-- clients.route_id → collection_routes.id (nullable)
-- loans.client_id → clients.id
-- loans.collector_id → users.id
-- payments.loan_id → loans.id
-- collection_routes.collector_id → users.id (nullable)
-- collection_routes.tenant_id → tenants.id
```

---

## 🔄 ARCHIVOS CSS POR MÓDULO (para editar)

| Módulo | CSS File | Líneas |
|--------|----------|--------|
| Design System | `src/app/globals.css` | 620 |
| Dashboard Layout | `src/app/(dashboard)/dashboard.module.css` | 107 |
| Overview | `src/app/(dashboard)/overview/overview.module.css` | ~120 |
| Clients | `src/app/(dashboard)/clients/clients.module.css` | ~variable |
| Loans | `src/app/(dashboard)/loans/loans.module.css` | ~variable |
| Collectors | `src/app/(dashboard)/collectors/collectors.module.css` | ~variable |
| Routes | `src/app/(dashboard)/routes/routes.module.css` | ~250 |
| Reports | `src/app/(dashboard)/reports/reports.module.css` | ~variable |
| Settings | `src/app/(dashboard)/settings/settings.module.css` | ~variable |
| Sidebar | `src/components/layout/Sidebar.module.css` | ~140 |
| Login | `src/app/(auth)/login/login.module.css` | ~variable |

---

## 🔑 DATOS DE TEST EN BD

- **1 Tenant**: Configurado
- **1 Admin**: juangomez4499@gmail.com (Admin QuickCash)
- **1 Cliente**: Maria Garcia (CC 1098765432, Al Día)
- **1 Préstamo activo**: $100,000 capital, 20% interés, mensual
- **1 Ruta**: "Ruta Norte" (color amarillo, 1 cliente asignado)

---

> **Para el nuevo modelo**: Tu misión es tomar esta UI funcional y transformarla en algo que haga decir "WOW" al usuario. Piensa en profundidad visual, micro-interacciones, glassmorphism sutil, y una experiencia que se sienta **premium y viva**. No toques la lógica, solo CSS + JSX de presentación. ¡Éxito! 🚀
