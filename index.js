
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

  // --- USER/ADMIN: START ---
  bot.onText(/\/start/, (msg) => {
    const uid = msg.from.id.toString();
    const db = loadDB();
    
    if (isAdmin(uid)) {
      return bot.sendMessage(msg.chat.id, 
        "⚡ Welcome Admin Master!\n\n" +
        "Workflow:\n" +
        "1. Entry/Exit Screenshots: Channel mein manually upload karein.\n" +
        "2. Result Update: Bot mein /add [result] use karein.\n\n" +
        "Admin Commands:\n" +
        "• `/add 3` (Profit 1:3 RR)\n" +
        "• `/add sl` (Loss SL)\n" +
        "• `/rejoin USER_ID` (Exited user ko wapas active karein)\n" +
        "• `/profile` (System Summary & User List)\n" +
        "• `/users` (Detailed User Table for Copy-Paste)"
      , { parse_mode: 'Markdown' });
    }

    if (db.users[uid]) {
      return bot.sendMessage(msg.chat.id, "Welcome back!\nAapka trial data safe hai. /profile se check karein.");
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
    bot.sendMessage(msg.chat.id, "Welcome 👋\nAapka free trial start ho chuka hai.\n\nRules:\n• SL = -1 Point\n• Target 1:N = N Points\n\nChannel mein active rahein.");
  });

  // --- PROFILE (Admin Summary) ---
  bot.onText(/\/profile/, (msg) => {
    const uid = msg.from.id.toString();
    const db = loadDB();

    if (isAdmin(uid)) {
      const users = Object.values(db.users);
      const active = users.filter(u => u.status === 'active').length;
      let list = `🛠 *ADMIN DASHBOARD*\n\nTotal Users: ${users.length}\nActive: ${active}\n\n*User Directory:*\n`;
      users.forEach(u => {
        list += `• \`${u.user_id}\` | ${u.status === 'active' ? '🟢' : '🔴'} | P:${u.points} | T:${u.trades}\n`;
      });
      return bot.sendMessage(msg.chat.id, list.slice(0, 4000), { parse_mode: 'Markdown' });
    }

    const u = db.users[uid];
    if (!u) return bot.sendMessage(msg.chat.id, "Pehle /start bhein.");
    const hist = u.history.map((h, i) => `${i+1}) ${h.tradeId} | ${h.points > 0 ? '+' : ''}${h.points} Pts`).join('\n') || "No trades yet.";
    bot.sendMessage(msg.chat.id, `📊 *Your Profile*\n\nJoined: ${new Date(u.join_timestamp).toLocaleDateString()}\nTrades: ${u.trades} / 10\nPoints: ${u.points} / 10\nStatus: ${u.status.toUpperCase()}\n\n*History:*\n${hist}`, { parse_mode: 'Markdown' });
  });

  // --- USERS LIST (Copy-Paste Friendly) ---
  bot.onText(/\/users/, (msg) => {
    if (!isAdmin(msg.from.id)) return;
    const db = loadDB();
    const users = Object.values(db.users);
    let list = `👥 *User List (${users.length})*\n_Click ID to copy_\n\n`;
    users.forEach(u => {
      list += `ID: \`${u.user_id}\` | ${u.status} | Pts: ${u.points}\n`;
    });
    bot.sendMessage(msg.chat.id, list.slice(0, 4000), { parse_mode: 'Markdown' });
  });

  // --- ADMIN: ADD (Auto ID) ---
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
          bot.sendMessage(uid, "🚫 *Free trial completed.*\nYour access has ended permanently.", { parse_mode: 'Markdown' });
        } else {
          bot.sendMessage(uid, `✅ *Trade Result: ${tradeId}*\nResult: ${resInput}\nPoints: ${pts > 0 ? '+' : ''}${pts}\nTotal Points: ${u.points}`, { parse_mode: 'Markdown' });
        }
      }
    });
    
    saveDB(db);
    bot.sendMessage(msg.chat.id, `✅ Success! Trade ${tradeId} added.\nResult: ${resInput} (${pts} pts).\nActive users updated.`);
  });

  // --- ADMIN: REJOIN (Robust Matching) ---
  bot.onText(/\/rejoin (\S+)/, (msg, match) => {
    if (!isAdmin(msg.from.id)) return;
    const targetUid = match[1].trim();
    const db = loadDB();
    
    // Check if ID exists as a direct key
    let user = db.users[targetUid];
    
    // Backup: Search inside objects if key check fails
    if (!user) {
      const foundId = Object.keys(db.users).find(k => k.toString() === targetUid);
      if (foundId) user = db.users[foundId];
    }

    if (!user) {
      return bot.sendMessage(msg.chat.id, `❌ Error: User ID \`${targetUid}\` nahi mili.\nCheck /users for correct IDs.`, { parse_mode: 'Markdown' });
    }
    
    user.status = 'active';
    saveDB(db);
    
    bot.sendMessage(msg.chat.id, `✅ User \`${targetUid}\` has been reactivated successfully.`, { parse_mode: 'Markdown' });
    bot.sendMessage(user.user_id, `⚡ *Trial Reactivated*\nYour access has been restored by Admin.\nWelcome back!`, { parse_mode: 'Markdown' });
  });

  bot.on('polling_error', (err) => console.log('Polling Error:', err.message));
}
