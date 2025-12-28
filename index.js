
import TelegramBot from 'node-telegram-bot-api';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import http from 'http';

dotenv.config();

// --- PREVENT CRASHES: Global Error Handlers ---
process.on('uncaughtException', (err) => {
  console.error('CRITICAL ERROR (Uncaught Exception):', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('CRITICAL ERROR (Unhandled Rejection):', reason);
});

// --- KEEP ALIVE: HTTP Server ---
const PORT = process.env.PORT || 3000;
http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('TradeFlow Engine: Active\n');
}).listen(PORT, () => {
  console.log(`Keep-alive server running on port ${PORT}`);
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TOKEN = process.env.BOT_TOKEN;
const ADMIN_ID = process.env.ADMIN_ID; 
const DB_PATH = path.join(__dirname, 'db.json');

// Temporary state to track if admin is in "messaging mode"
const adminState = {
  activeTargetId: null
};

const loadDB = () => {
  try {
    if (!fs.existsSync(DB_PATH)) return { users: {}, trades: [] };
    const data = fs.readFileSync(DB_PATH, 'utf8');
    return data ? JSON.parse(data) : { users: {}, trades: [] };
  } catch (e) {
    return { users: {}, trades: [] };
  }
};

const saveDB = (data) => {
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
  } catch (e) {
    console.error('DB Save Error:', e);
  }
};

const parseResult = (input) => {
  const val = input.toLowerCase();
  if (val === 'sl') return -1;
  const num = parseInt(val, 10);
  return isNaN(num) ? 0 : num;
};

if (TOKEN) {
  const bot = new TelegramBot(TOKEN, { 
    polling: {
      interval: 300,
      autoStart: true,
      params: { timeout: 10 }
    }
  });

  const isAdmin = (id) => id && id.toString() === ADMIN_ID;

  // --- ADMIN: INLINE KEYBOARD HANDLER ---
  bot.on('callback_query', (query) => {
    if (!isAdmin(query.from.id)) return;
    
    const data = query.data;
    if (data.startsWith('msg_')) {
      const targetId = data.split('_')[1];
      adminState.activeTargetId = targetId;
      bot.answerCallbackQuery(query.id);
      bot.sendMessage(ADMIN_ID, `📝 *Messaging Mode:* Write your message for User \`${targetId}\` below.\n(Type /cancel to exit)`, { parse_mode: 'Markdown' });
    }
  });

  // --- GLOBAL MESSAGE HANDLER ---
  bot.on('message', (msg) => {
    const uid = msg.from.id.toString();
    const text = msg.text;

    // Handle Admin Messaging State
    if (isAdmin(uid) && adminState.activeTargetId && text) {
      if (text === '/cancel') {
        adminState.activeTargetId = null;
        return bot.sendMessage(ADMIN_ID, "✅ Messaging mode cancelled.");
      }
      
      const target = adminState.activeTargetId;
      bot.sendMessage(target, `💬 *Message from Admin:*\n\n${text}`, { parse_mode: 'Markdown' })
        .then(() => {
          bot.sendMessage(ADMIN_ID, `✅ Message sent to \`${target}\`.`);
          adminState.activeTargetId = null; // Reset after sending
        })
        .catch(() => {
          bot.sendMessage(ADMIN_ID, `❌ Failed to send to \`${target}\`. User might have blocked the bot.`);
          adminState.activeTargetId = null;
        });
      return;
    }
  });

  // --- ADMIN: PHOTO BROADCAST ---
  bot.on('photo', (msg) => {
    if (!isAdmin(msg.from.id)) return;
    const db = loadDB();
    const photoId = msg.photo[msg.photo.length - 1].file_id;
    const caption = msg.caption || "";
    const activeUsers = Object.values(db.users).filter(u => u.status === 'active');
    
    activeUsers.forEach(u => {
      bot.sendPhoto(u.user_id, photoId, { caption: caption }).catch(e => console.log(`Failed for ${u.user_id}`));
    });
    bot.sendMessage(msg.chat.id, `📸 Broadcasted to ${activeUsers.length} users.`);
  });

  // --- USER/ADMIN: START ---
  bot.onText(/\/start/, (msg) => {
    const uid = msg.from.id.toString();
    const db = loadDB();
    
    if (isAdmin(uid)) {
      return bot.sendMessage(msg.chat.id, 
        "⚡ *Admin Panel Active*\n\n" +
        "• *Broadcasting:* Send any Photo for all users.\n" +
        "• *Results:* Use `/add 3` or `/add sl`.\n" +
        "• *Directory:* Use `/users` to list & message users easily."
      , { parse_mode: 'Markdown' });
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

  // --- USERS LIST with EASY BUTTONS ---
  bot.onText(/\/users/, (msg) => {
    if (!isAdmin(msg.from.id)) return;
    const db = loadDB();
    const users = Object.values(db.users);
    
    if (users.length === 0) return bot.sendMessage(ADMIN_ID, "No users yet.");

    bot.sendMessage(ADMIN_ID, `👥 *User Directory (${users.length} users)*\nSelect a user to message:`, { parse_mode: 'Markdown' });

    users.forEach(u => {
      const statusIcon = u.status === 'active' ? '🟢' : '🔴';
      bot.sendMessage(ADMIN_ID, 
        `${statusIcon} *User:* \`${u.user_id}\`\nPoints: ${u.points} | Trades: ${u.trades}`,
        { 
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [{ text: "✉️ Send Message", callback_data: `msg_${u.user_id}` }],
              [{ text: "🔄 Reactivate User", callback_data: `rejoin_${u.user_id}` }]
            ]
          }
        }
      );
    });
  });

  // --- ADMIN: ADD RESULT ---
  bot.onText(/\/add (\S+)/, (msg, match) => {
    if (!isAdmin(msg.from.id)) return;
    const resInput = match[1];
    const pts = parseResult(resInput);
    const db = loadDB();
    const tradeId = `T${db.trades.length + 101}`;

    db.trades.push({ tradeId, result: resInput, points: pts, time: Date.now() });
    
    Object.keys(db.users).forEach(uid => {
      const u = db.users[uid];
      if (u.status === 'active') {
        u.trades += 1;
        u.points += pts;
        u.history.push({ tradeId, points: pts });
        
        if (u.trades >= 10 && u.points >= 10) {
          u.status = 'exited';
          bot.sendMessage(uid, "🚫 *Trial Completed*\nAccess permanent end ho gayi hai.");
        } else {
          bot.sendMessage(uid, `✅ *Update: ${tradeId}*\nResult: ${resInput}\nPoints: ${pts > 0 ? '+' : ''}${pts}`);
        }
      }
    });
    saveDB(db);
    bot.sendMessage(msg.chat.id, `✅ Trade ${tradeId} added.`);
  });

  bot.on('polling_error', (err) => {
    console.error('Polling Error:', err.message);
    // Auto-restart polling handled by library defaults usually, but we log it.
  });

  console.log("TradeFlow Bot Engine started successfully.");
}
