
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
      return bot.sendMessage(msg.chat.id, "Welcome Admin! ⚡\nAapka control panel active hai.\nCommands:\n/add [result]\n/rejoin [uid]\n/profile\n/users");
    }

    if (db.users[uid]) {
      return bot.sendMessage(msg.chat.id, "Welcome back!\nAapka trial pehle se chal raha hai ya khatam ho chuka hai.");
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

  // --- PROFILE (Context Sensitive) ---
  bot.onText(/\/profile/, (msg) => {
    const uid = msg.from.id.toString();
    const db = loadDB();

    if (isAdmin(uid)) {
      const users = Object.values(db.users);
      const active = users.filter(u => u.status === 'active').length;
      let list = `🛠 ADMIN DASHBOARD\n\nTotal Users: ${users.length}\nActive: ${active}\n\nUser Directory:\n`;
      users.forEach(u => {
        list += `• ${u.user_id} | P:${u.points} | T:${u.trades} | ${u.status.toUpperCase()}\n`;
      });
      return bot.sendMessage(msg.chat.id, list.slice(0, 4000));
    }

    const u = db.users[uid];
    if (!u) return bot.sendMessage(msg.chat.id, "Pehle /start bhein.");
    const hist = u.history.map((h, i) => `${i+1}) ${h.tradeId} | ${h.points > 0 ? '+' : ''}${h.points} Pts`).join('\n') || "No trades yet.";
    bot.sendMessage(msg.chat.id, `📊 Your Profile\n\nJoined: ${new Date(u.join_timestamp).toLocaleDateString()}\nTrades: ${u.trades}\nPoints: ${u.points}\nStatus: ${u.status.toUpperCase()}\n\nHistory:\n${hist}`);
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
          // Notification only to user
          bot.sendMessage(uid, "🚫 Free trial completed.\nYour access has ended permanently.");
        } else {
          bot.sendMessage(uid, `✅ New Trade Update: ${tradeId}\nResult: ${resInput}\nTotal Points: ${u.points}`);
        }
      }
    });
    
    saveDB(db);
    bot.sendMessage(msg.chat.id, `Success: ${tradeId} added (${pts} pts). All active users updated.`);
  });

  // --- ADMIN: REJOIN ---
  bot.onText(/\/rejoin (\S+)/, (msg, match) => {
    if (!isAdmin(msg.from.id)) return;
    const targetUid = match[1];
    const db = loadDB();
    
    if (!db.users[targetUid]) return bot.sendMessage(msg.chat.id, "User ID nahi mili.");
    
    db.users[targetUid].status = 'active';
    saveDB(db);
    
    bot.sendMessage(msg.chat.id, `User ${targetUid} has been reactivated.`);
    bot.sendMessage(targetUid, `⚡ Your trial has been reactivated by Admin.\nWelcome back!`);
  });

  bot.on('polling_error', console.log);
}
