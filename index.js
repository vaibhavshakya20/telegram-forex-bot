
import TelegramBot from 'node-telegram-bot-api';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import http from 'http';

dotenv.config();

const PORT = process.env.PORT || 3000;
http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('TradeFlow Admin Pro is Live\n');
}).listen(PORT);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TOKEN = process.env.BOT_TOKEN;
const ADMIN_ID = process.env.ADMIN_ID; 
const DB_PATH = path.join(__dirname, 'db.json');

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
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
};

const parseResult = (input) => {
  const val = input.toLowerCase();
  if (val === 'sl') return -1;
  const num = parseInt(val, 10);
  return isNaN(num) ? 0 : num;
};

if (TOKEN) {
  const bot = new TelegramBot(TOKEN, { polling: true });
  const isAdmin = (id) => id.toString() === ADMIN_ID;

  // --- ADMIN: PHOTO BROADCAST (Screenshots) ---
  bot.on('photo', (msg) => {
    if (!isAdmin(msg.from.id)) return;
    
    const db = loadDB();
    const photoId = msg.photo[msg.photo.length - 1].file_id;
    const caption = msg.caption || "";
    const activeUsers = Object.values(db.users).filter(u => u.status === 'active');

    activeUsers.forEach(u => {
      bot.sendPhoto(u.user_id, photoId, { caption: caption });
    });

    bot.sendMessage(msg.chat.id, `📸 Screenshot broadcasted to ${activeUsers.length} active users.`);
  });

  // --- ADMIN: DIRECT MESSAGE TO USER ---
  bot.onText(/\/msg (\d+) (.+)/, (msg, match) => {
    if (!isAdmin(msg.from.id)) return;
    const targetId = match[1];
    const text = match[2];
    
    bot.sendMessage(targetId, `💬 *Message from Admin:*\n\n${text}`, { parse_mode: 'Markdown' })
      .then(() => bot.sendMessage(msg.chat.id, `✅ Message sent to user \`${targetId}\``, { parse_mode: 'Markdown' }))
      .catch(() => bot.sendMessage(msg.chat.id, `❌ Failed to send. User might have blocked the bot.`));
  });

  // --- USER/ADMIN: START ---
  bot.onText(/\/start/, (msg) => {
    const uid = msg.from.id.toString();
    const db = loadDB();
    
    if (isAdmin(uid)) {
      return bot.sendMessage(msg.chat.id, 
        "⚡ *Admin Panel Active*\n\n" +
        "• *Broadcasting:* Bot ko koi bhi Chart SS bhejien, wo turant sabko mil jayega.\n" +
        "• *Direct Msg:* `/msg ID message` bhejien.\n" +
        "• *Result:* `/add 3` ya `/add sl` bhejien.\n" +
        "• *Data:* `/users` se list dekhein."
      , { parse_mode: 'Markdown' });
    }

    if (db.users[uid]) {
      return bot.sendMessage(msg.chat.id, "Welcome back! /profile se status check karein.");
    }

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
    bot.sendMessage(msg.chat.id, "Welcome 👋\nAapka free trial start ho chuka hai.\n\nRules:\n• SL = -1 Point\n• Target 1:N = N Points\n\nAbhi se jo bhi screenshots admin bhejenge, wo aapko yahi milenge.");
  });

  // --- USERS LIST (Admin Only) ---
  bot.onText(/\/users/, (msg) => {
    if (!isAdmin(msg.from.id)) return;
    const db = loadDB();
    const users = Object.values(db.users);
    let list = `👥 *User List (${users.length})*\n\n`;
    users.forEach(u => {
      list += `\`${u.user_id}\` | P:${u.points} | ${u.status === 'active' ? '🟢' : '🔴'}\n`;
      list += `/msg ${u.user_id} [text]\n\n`;
    });
    bot.sendMessage(msg.chat.id, list.slice(0, 4000), { parse_mode: 'Markdown' });
  });

  // --- PROFILE (Context Sensitive) ---
  bot.onText(/\/profile/, (msg) => {
    const uid = msg.from.id.toString();
    const db = loadDB();
    const u = db.users[uid];
    
    if (!u) return bot.sendMessage(msg.chat.id, "Pehle /start bhein.");
    
    if (isAdmin(uid)) {
      const activeCount = Object.values(db.users).filter(x => x.status === 'active').length;
      return bot.sendMessage(msg.chat.id, `📊 *System Summary*\nActive Users: ${activeCount}\nTotal Database: ${Object.keys(db.users).length}\n\nUse /users for details.`, { parse_mode: 'Markdown' });
    }

    const hist = u.history.map((h, i) => `${i+1}) ${h.tradeId} | ${h.points > 0 ? '+' : ''}${h.points} Pts`).join('\n') || "No trades yet.";
    bot.sendMessage(msg.chat.id, `📊 *Your Stats*\n\nTrades: ${u.trades} / 10\nPoints: ${u.points} / 10\nStatus: ${u.status.toUpperCase()}\n\n*History:*\n${hist}`, { parse_mode: 'Markdown' });
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
          bot.sendMessage(uid, "🚫 *Trial Completed*\nAapka free trial khatam ho gaya hai.\nAccess permanent end ho gayi hai.");
        } else {
          bot.sendMessage(uid, `✅ *New Result: ${tradeId}*\nResult: ${resInput}\nPoints: ${pts > 0 ? '+' : ''}${pts}\nTotal Score: ${u.points}`);
        }
      }
    });
    
    saveDB(db);
    bot.sendMessage(msg.chat.id, `✅ Trade ${tradeId} added. Broadasted to all active users.`);
  });

  // --- ADMIN: REJOIN ---
  bot.onText(/\/rejoin (\d+)/, (msg, match) => {
    if (!isAdmin(msg.from.id)) return;
    const targetUid = match[1];
    const db = loadDB();
    if (!db.users[targetUid]) return bot.sendMessage(msg.chat.id, "User not found.");
    
    db.users[targetUid].status = 'active';
    saveDB(db);
    bot.sendMessage(msg.chat.id, `User ${targetUid} reactivated.`);
    bot.sendMessage(targetUid, `⚡ *Re-Entry Granted*\nWelcome back! Admin has restored your access.`);
  });

  bot.on('polling_error', (err) => console.log('Polling Error:', err.message));
}
