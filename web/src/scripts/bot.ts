import { Telegraf, Scenes, session, Markup } from 'telegraf';
import { db } from '../lib/db';
import { users, tenants } from '../lib/db/schema';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';

const BOT_TOKEN = process.env.BOT_TOKEN || '8627376599:AAGFo8Nytscp_2f2Rr-y-4QYYzopGmdIQDg';
const OWNER_ID = Number(process.env.OWNER_ID) || 8409547845;

interface MySession extends Scenes.WizardSessionData {
  userData: {
    fullName?: string;
    username?: string;
    email?: string;
    password?: string;
  };
}

interface MyContext extends Scenes.WizardContext<MySession> {}

const bot = new Telegraf<MyContext>(BOT_TOKEN);

// --- Middleware: Security ---
bot.use(async (ctx, next) => {
  if (ctx.from?.id !== OWNER_ID) {
    return ctx.reply('⛔ Acceso denegado. Solo el dueño de QuickCash puede usar este bot.');
  }
  return next();
});

// --- Scene: Create Lender (Prestamista) ---
const createLenderWizard = new Scenes.WizardScene<MyContext>(
  'create-lender-wizard',
  async (ctx) => {
    ctx.scene.session.userData = {};
    await ctx.reply('➕ Iniciando creación de nuevo Prestamista.\n\nEscribe el **Nombre Completo**:');
    return ctx.wizard.next();
  },
  async (ctx) => {
    if (!('text' in ctx.message!)) return ctx.reply('Por favor envía un texto.');
    ctx.scene.session.userData.fullName = ctx.message.text;
    await ctx.reply('Escribe el **Nombre de Usuario** (ej: @juan_pres):');
    return ctx.wizard.next();
  },
  async (ctx) => {
    if (!('text' in ctx.message!)) return ctx.reply('Por favor envía un texto.');
    let username = ctx.message.text;
    if (!username.startsWith('@')) username = '@' + username;
    ctx.scene.session.userData.username = username;
    await ctx.reply('Escribe el **Email** (obligatorio para la base de datos):');
    return ctx.wizard.next();
  },
  async (ctx) => {
    if (!('text' in ctx.message!)) return ctx.reply('Por favor envía un texto.');
    ctx.scene.session.userData.email = ctx.message.text;
    await ctx.reply('Escribe la **Contraseña** de acceso web:');
    return ctx.wizard.next();
  },
  async (ctx) => {
    if (!('text' in ctx.message!)) return ctx.reply('Por favor envía un texto.');
    ctx.scene.session.userData.password = ctx.message.text;

    const { fullName, username, email, password } = ctx.scene.session.userData;
    
    await ctx.reply(
      `📝 **Resumen del Nuevo Prestamista**:\n\n` +
      `👤 Nombre: ${fullName}\n` +
      `🆔 Usuario: ${username}\n` +
      `📧 Email: ${email}\n` +
      `🔑 Pass: ${password}\n\n` +
      `¿Confirmas la creación?`,
      Markup.inlineKeyboard([
        [Markup.button.callback('✅ Confirmar y Crear', 'confirm_create')],
        [Markup.button.callback('❌ Cancelar', 'cancel_create')]
      ])
    );
    return ctx.wizard.next();
  },
  async (ctx) => {
    // Handled by actions below
    return ctx.wizard.leave();
  }
);

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
bot.action('start_create', (ctx) => ctx.scene.enter('create-lender-wizard'));

bot.action('list_users', async (ctx) => {
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

bot.action(/toggle_(.+)_(0|1)/, async (ctx) => {
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

bot.action('confirm_create', async (ctx) => {
  const data = (ctx.scene.session as any).userData;
  try {
    const [tenant] = await db.select().from(tenants).limit(1);
    const hashedPassword = await bcrypt.hash(data.password, 10);

    await db.insert(users).values({
      full_name: data.fullName,
      username: data.username,
      email: data.email,
      password_hash: hashedPassword,
      role: 'admin',
      tenant_id: tenant.id,
      is_active: true
    });

    await ctx.answerCbQuery('Usuario creado con éxito');
    await ctx.reply(`✨ El prestamista **${data.fullName}** ya puede entrar a la web enviando sus credenciales.`);
    return ctx.scene.leave();
  } catch (err: any) {
    await ctx.reply(`❌ Error al crear: ${err.message}`);
    return ctx.scene.leave();
  }
});

bot.action('cancel_create', (ctx) => {
  ctx.answerCbQuery('Operación cancelada');
  ctx.reply('❌ Creación cancelada.');
  return ctx.scene.leave();
});

// --- Start Bot ---
bot.launch(() => {
  console.log('🤖 QuickCash Admin Bot is running...');
});

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
