import { Telegraf, Scenes, session, Markup } from 'telegraf';
import { db } from '../lib/db';
import { users, tenants } from '../lib/db/schema';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';

const BOT_TOKEN = process.env.BOT_TOKEN;
const OWNER_ID = Number(process.env.OWNER_ID);

if (!BOT_TOKEN || !OWNER_ID) {
  console.error('❌ Error: BOT_TOKEN o OWNER_ID no configurados en variables de entorno.');
  process.exit(1);
}

// Interfaz para la sesión personalizada
interface MySession extends Scenes.WizardSessionData {
  userData: {
    fullName?: string;
    username?: string;
    email?: string;
    password?: string;
  };
}

interface MyContext extends Scenes.WizardContext<MySession> {}

const bot = new Telegraf<any>(BOT_TOKEN);

// --- Middleware: Security ---
bot.use(async (ctx: any, next: () => Promise<void>) => {
  if (ctx.from?.id !== OWNER_ID) {
    return ctx.reply('⛔ Acceso denegado. Solo el dueño de QuickCash puede usar este bot.');
  }
  return next();
});

// --- Scene: Create Lender (Prestamista) ---
const createLenderWizard = new Scenes.WizardScene<MyContext>(
  'create-lender-wizard',
  async (ctx: any) => {
    // Inicializar datos LIMPIOS
    ctx.scene.session.userData = {};
    await ctx.reply('➕ **NUEVA CREACIÓN DE PRESTAMISTA**\n\nPor favor, escribe el **Nombre Completo**:');
    return ctx.wizard.next();
  },
  async (ctx: any) => {
    if (!('text' in ctx.message!)) return ctx.reply('Por favor envía un texto.');
    ctx.scene.session.userData.fullName = ctx.message.text;
    await ctx.reply('Escribe el **Nombre de Usuario** (ej: @juan_pres):');
    return ctx.wizard.next();
  },
  async (ctx: any) => {
    if (!('text' in ctx.message!)) return ctx.reply('Por favor envía un texto.');
    let username = ctx.message.text.trim();
    if (!username.startsWith('@')) username = '@' + username;
    
    // Verificar si el usuario ya existe
    const existing = await db.select().from(users).where(eq(users.username, username)).limit(1);
    if (existing.length > 0) {
      return ctx.reply(`❌ El usuario ${username} ya existe. Por favor intenta con otro:`);
    }

    ctx.scene.session.userData.username = username;
    await ctx.reply(`Email para **${username}**:`);
    return ctx.wizard.next();
  },
  async (ctx: any) => {
    if (!('text' in ctx.message!)) return ctx.reply('Por favor envía un texto.');
    ctx.scene.session.userData.email = ctx.message.text;
    await ctx.reply('Escribe la **Contraseña** de acceso web:');
    return ctx.wizard.next();
  },
  async (ctx: any) => {
    if (!('text' in ctx.message!)) return ctx.reply('Por favor envía un texto.');
    ctx.scene.session.userData.password = ctx.message.text;

    const { fullName, username, email, password } = ctx.scene.session.userData;
    
    await ctx.reply(
      `📝 **VERIFICA LOS DATOS**\n\n` +
      `👤 **Nombre:** ${fullName}\n` +
      `🆔 **Usuario:** ${username}\n` +
      `📧 **Email:** ${email}\n` +
      `🔑 **Password:** \`${password}\` (haz clic para copiar)\n\n` +
      `¿Son correctos estos datos?`,
      Markup.inlineKeyboard([
        [Markup.button.callback('✅ CONFIRMAR Y CREAR', 'confirm_create')],
        [Markup.button.callback('❌ CANCELAR', 'cancel_create')]
      ])
    );
    return;
  }
);

createLenderWizard.action('confirm_create', async (ctx: any) => {
  const data = (ctx.scene.session as any).userData;
  if (!data || !data.password) {
    return ctx.reply('❌ Error: Datos perdidos. Por favor intenta de nuevo.');
  }
  
  try {
    // 1. CREAR UN NUEVO NEGOCIO (TENANT) PARA ESTE USUARIO
    const [newTenant] = await db.insert(tenants).values({
      name: `Negocio de ${data.fullName}`,
      currency: 'COP',
    }).returning();

    const hashedPassword = await bcrypt.hash(data.password, 10);

    // 2. CREAR EL USUARIO ASOCIADO AL NUEVO NEGOCIO
    await db.insert(users).values({
      full_name: data.fullName,
      username: data.username,
      email: data.email,
      password_hash: hashedPassword,
      role: 'admin',
      tenant_id: newTenant.id,
      is_active: true
    });

    await ctx.answerCbQuery('Usuario y Negocio creados con éxito');
    await ctx.editMessageText(
      `✨ **¡ÉXITO!** ✨\n\n` +
      `👤 Prestamista: **${data.fullName}**\n` +
      `🏢 Negocio Privado: Creado e Independiente.\n\n` +
      `Ya puede iniciar sesión en la web y gestionar sus propios préstamos.`
    );
    return ctx.scene.leave();
  } catch (err: any) {
    await ctx.reply(`❌ Error al crear el negocio/usuario: ${err.message}`);
    return ctx.scene.leave();
  }
});

createLenderWizard.action('cancel_create', (ctx: any) => {
  ctx.answerCbQuery('Operación cancelada');
  ctx.editMessageText('❌ Creación de prestamista cancelada.');
  return ctx.scene.leave();
});

const stage = new Scenes.Stage<MyContext>([createLenderWizard]);
bot.use(session());
bot.use(stage.middleware());

// --- Main Menu ---
const mainMenu = (ctx: any) => {
  return ctx.reply(
    '💼 **Panel de Administración QuickCash**\n\nHola dueño. ¿Qué deseas hacer hoy?',
    Markup.inlineKeyboard([
      [Markup.button.callback('👥 Listar Usuarios', 'list_users')],
      [Markup.button.callback('➕ Crear Prestamista (Admin)', 'start_create')]
    ])
  );
};

bot.start(mainMenu);

// --- Actions ---
bot.action('start_create', (ctx: any) => ctx.scene.enter('create-lender-wizard'));

bot.action('list_users', async (ctx: any) => {
  const allUsers = await db.select().from(users);
  if (allUsers.length === 0) return ctx.reply('No hay usuarios en la base de datos.');

  for (const user of allUsers) {
    const statusIcon = user.is_active ? '✅' : '❌';
    const statusAction = user.is_active ? 'Desactivar' : 'Activar';
    const callbackData = `toggle_${user.id}_${user.is_active ? 0 : 1}`;

    await ctx.reply(
      `👤 **${user.full_name}** (${user.role})\n` +
      `🆔 ${user.username}\n` +
      `📧 ${user.email}\n` +
      `Estado: ${statusIcon} ${user.is_active ? 'Activo' : 'Inactivo'}`,
      Markup.inlineKeyboard([
        [Markup.button.callback(`${statusIcon} ${statusAction}`, callbackData)]
      ])
    );
  }
});

bot.action(/toggle_(.+)_(0|1)/, async (ctx: any) => {
  const userId = ctx.match[1];
  const newState = ctx.match[2] === '1';

  try {
    await db.update(users)
      .set({ is_active: newState })
      .where(eq(users.id, userId));
    
    await ctx.answerCbQuery(`Usuario ${newState ? 'activado' : 'desactivado'}`);
    await ctx.editMessageText(
      ctx.callbackQuery.message && 'text' in ctx.callbackQuery.message 
        ? ctx.callbackQuery.message.text.replace(/Estado: .+/, `Estado: ${newState ? '✅ Activo' : '❌ Inactivo'}`)
        : 'Estado actualizado',
      Markup.inlineKeyboard([
        [Markup.button.callback(`${newState ? '✅ Desactivar' : '❌ Activar'}`, `toggle_${userId}_${newState ? 0 : 1}`)]
      ])
    );
  } catch (err) {
    await ctx.answerCbQuery('Error al actualizar');
  }
});


// --- Start Bot ---
bot.launch(() => {
  console.log('🤖 QuickCash Admin Bot is running...');
});

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
