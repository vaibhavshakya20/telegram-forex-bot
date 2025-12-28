
import TelegramBot from 'node-telegram-bot-api';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import http from 'http';

dotenv.config();

// --- STABILITY: Global Error Handlers ---
process.on('uncaughtException', (err) => console.error('CRITICAL:', err));
process.on('unhandledRejection', (reason) => console.error('REJECTION:', reason));

// --- KEEP ALIVE ---
const PORT = process.env.PORT || 3000;
http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('TradeFlow Engine: Live\n');
}).listen(PORT);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TOKEN = process.env.BOT_TOKEN;
const ADMIN_ID = process.env.ADMIN_ID; 
const DB_PATH = path.join(__dirname, 'db.json');

const adminState = { activeTargetId: null };

const loadDB = () => {
  try {
    if (!fs.existsSync(DB_PATH)) return { users: {}, trades: [] };
    const data = fs.readFileSync(DB_PATH, 'utf8');
    const db = data ? JSON.parse(data) : { users: {}, trades: [] };
    // Safety check for structure
    if (!db.users) db.users = {};
    if (!db.trades) db.trades = [];
    return db;
  } catch (e) {
    return { users: {}, trades: [] };
  }
};

const saveDB = (data) => {
  try {
    if (!data || Object.keys(data.users).length === 0 && data.trades.length === 0 && fs.existsSync(DB_PATH)) {
      // Prevent overwriting with empty data if file already exists with content
      const current = loadDB();
      if (Object.keys(current.users).length > 0) return; 
    }
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
  } catch (e) {
    console.error('DB Save Error:', e);
  }
};

const parseResult = (input) => {
  const val = input.toLowerCase().trim();
  if (val === 'sl') return -1;
  const num = parseInt(val, 10);
  return isNaN(num) ? 0 : num;
};

if (TOKEN) {
  const bot = new TelegramBot(TOKEN, { polling: true });
  const isAdmin = (id) => id && id.toString() === ADMIN_ID?.toString();

  // --- ADMIN: PHOTO BROADCAST ---
  bot.on('photo', (msg) => {
    if (!isAdmin(msg.from.id)) return;
    const db = loadDB();
    const photoId = msg.photo[msg.photo.length - 1].file_id;
    const caption = msg.caption || "";
    const activeUsers = Object.values(db.users).filter(u => u.status === 'active');
    
    activeUsers.forEach(u => {
      bot.sendPhoto(u.user_id, photoId, { caption: caption }).catch(() => {});
    });
    bot.sendMessage(msg.chat.id, `📸 Photo broadcasted to ${activeUsers.length} users.`);
  });

  // --- ADMIN: TEXT BROADCAST ---
  bot.onText(/\/all (.+)/, (msg, match) => {
    if (!isAdmin(msg.from.id)) return;
    const text = match[1];
    const db = loadDB();
    const activeUsers = Object.values(db.users).filter(u => u.status === 'active');
    
    activeUsers.forEach(u => {
      bot.sendMessage(u.user_id, `📢 *Announcement:*\n\n${text}`, { parse_mode: 'Markdown' }).catch(() => {});
    });
    bot.sendMessage(msg.chat.id, `📢 Message broadcasted to ${activeUsers.length} users.`);
  });

  // --- GLOBAL MESSAGE HANDLER ---
  bot.on('message', (msg) => {
    const uid = msg.from.id.toString();
    const text = msg.text;
    if (!text) return;

    // Direct Messaging Mode
    if (isAdmin(uid) && adminState.activeTargetId) {
      if (text === '/cancel') {
        adminState.activeTargetId = null;
        return bot.sendMessage(ADMIN_ID, "✅ Messaging mode off.");
      }
      
      const target = adminState.activeTargetId;
      bot.sendMessage(target, `💬 *Message from Admin:*\n\n${text}`, { parse_mode: 'Markdown' })
        .then(() => {
          bot.sendMessage(ADMIN_ID, `✅ Sent to \`${target}\`.`);
          adminState.activeTargetId = null;
        })
        .catch(() => {
          bot.sendMessage(ADMIN_ID, `❌ Failed. User blocked the bot.`);
          adminState.activeTargetId = null;
        });
    }
  });

  // --- USER: START ---
  bot.onText(/\/start/, (msg) => {
    const uid = msg.from.id.toString();
    const db = loadDB();
    
    if (isAdmin(uid)) {
      return bot.sendMessage(msg.chat.id, "⚡ Admin Master Active.\nCommands: /add, /all, /users, /rejoin");
    }

    if (!db.users[uid]) {
      db.users[uid] = {
        user_id: uid,
        username: msg.from.username || 'Trader',
        join_timestamp: Date.now(),
        trades: 0,
        points: 0,
        status: "active",
        history: []
      };
      saveDB(db);
      bot.sendMessage(msg.chat.id, "Welcome 👋 Aapka free trial start ho chuka hai.");
    } else {
      bot.sendMessage(msg.chat.id, "Welcome back! Use /profile.");
    }
  });

  // --- ADMIN: ADD RESULT ---
  const handleAddResult = (msg, resInput) => {
    const pts = parseResult(resInput);
    const db = loadDB();
    const tradeId = `T${db.trades.length + 101}`;

    db.trades.push({ tradeId, result: resInput, points: pts, time: Date.now() });
    
    let updatedCount = 0;
    Object.keys(db.users).forEach(uid => {
      const u = db.users[uid];
      if (u.status === 'active') {
        u.trades = (u.trades || 0) + 1;
        u.points = (u.points || 0) + pts;
        u.history = u.history || [];
        u.history.push({ tradeId, points: pts });
        updatedCount++;

        if (u.trades >= 10 && u.points >= 10) {
          u.status = 'exited';
          bot.sendMessage(uid, "🚫 *Trial Completed*\nAccess permanent end ho gayi hai.");
        } else {
          bot.sendMessage(uid, `✅ *New Update: ${tradeId}*\nResult: ${resInput}\nPoints: ${pts > 0 ? '+' : ''}${pts}\nTotal Points: ${u.points}`);
        }
      }
    });
    saveDB(db);
    bot.sendMessage(msg.chat.id, `✅ Success: Trade ${tradeId} added. ${updatedCount} users updated.`);
  };

  bot.onText(/\/add (\S+)/, (msg, match) => {
    if (isAdmin(msg.from.id)) handleAddResult(msg, match[1]);
  });

  bot.onText(/\/result \S+ (\S+)/, (msg, match) => {
    if (isAdmin(msg.from.id)) handleAddResult(msg, match[1]);
  });

  // --- USERS DIRECTORY ---
  bot.onText(/\/users/, (msg) => {
    if (!isAdmin(msg.from.id)) return;
    const db = loadDB();
    const users = Object.values(db.users);
    if (users.length === 0) return bot.sendMessage(msg.chat.id, "No users.");

    bot.sendMessage(msg.chat.id, `👥 *Directory (${users.length})*`);
    users.forEach(u => {
      bot.sendMessage(msg.chat.id, `ID: \`${u.user_id}\` | P:${u.points} | T:${u.trades} | ${u.status}`, {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [[{ text: "✉️ Message", callback_data: `msg_${u.user_id}` }]]
        }
      });
    });
  });

  // --- CALLBACK HANDLER ---
  bot.on('callback_query', (query) => {
    if (!isAdmin(query.from.id)) return;
    const data = query.data;
    if (data.startsWith('msg_')) {
      adminState.activeTargetId = data.split('_')[1];
      bot.sendMessage(ADMIN_ID, `📝 Type message for \`${adminState.activeTargetId}\` (or /cancel):`, { parse_mode: 'Markdown' });
    }
    bot.answerCallbackQuery(query.id);
  });

  bot.on('polling_error', (err) => console.log('Polling:', err.message));
}
