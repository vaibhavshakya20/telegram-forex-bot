
import TelegramBot from 'node-telegram-bot-api';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import http from 'http';

dotenv.config();

// Health check for hosting
const PORT = process.env.PORT || 3000;
http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('TradeFlow Hybrid System is Active\n');
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

  // --- USER: START ---
  bot.onText(/\/start/, (msg) => {
    const uid = msg.from.id.toString();
    const db = loadDB();
    if (db.users[uid]) {
      return bot.sendMessage(msg.chat.id, "Welcome back!\nAapka trial pehle se chal raha hai.\nEk user sirf ek baar join kar sakta hai.");
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
    bot.sendMessage(msg.chat.id, "Welcome 👋\nAapka free trial start ho chuka hai.\n\nRules:\n• SL = -1 Point\n• Target 1:N = N Points\n\nChannel mein entry/exit charts dekhte rahein. Aapka status yahan track hoga.");
  });

  // --- USER: PROFILE ---
  bot.onText(/\/profile/, (msg) => {
    const uid = msg.from.id.toString();
    const db = loadDB();
    const u = db.users[uid];
    if (!u) return bot.sendMessage(msg.chat.id, "Pehle /start bhein.");
    
    const hist = u.history.map((h, i) => `${i+1}) ${h.tradeId} | ${h.points > 0 ? '+' : ''}${h.points} Pts`).join('\n') || "No trades yet.";
    
    bot.sendMessage(msg.chat.id, `📊 Your Profile\n\nJoined: ${new Date(u.join_timestamp).toLocaleDateString()}\nTrades: ${u.trades}\nPoints: ${u.points}\nStatus: ${u.status.toUpperCase()}\n\nTrade History:\n${hist}`);
  });

  // --- ADMIN: ADD RESULT (/add 2 or /add sl) ---
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
        
        // Completion Check: Trades >= 10 AND Points >= 10
        if (u.trades >= 10 && u.points >= 10) {
          u.status = 'exited';
          bot.sendMessage(uid, "🚫 Free trial completed.\nYour access has ended permanently.");
        } else {
          bot.sendMessage(uid, `✅ New Update\nPoints: ${pts > 0 ? '+' : ''}${pts}\nTotal Points: ${u.points}\nTotal Trades: ${u.trades}`);
        }
      }
    });
    
    saveDB(db);
    bot.sendMessage(msg.chat.id, `Success: Trade ${tradeId} added (${pts} pts) to all active users.`);
  });

  // --- ADMIN: USERS LIST ---
  bot.onText(/\/users/, (msg) => {
    if (!isAdmin(msg.from.id)) return;
    const db = loadDB();
    const users = Object.values(db.users);
    const active = users.filter(u => u.status === 'active').length;
    const exited = users.filter(u => u.status === 'exited').length;

    let list = `👥 User List\nTotal: ${users.length} | Active: ${active} | Exited: ${exited}\n\n`;
    users.forEach(u => {
      list += `${u.user_id} | ${new Date(u.join_timestamp).toLocaleDateString()} | T:${u.trades} | P:${u.points} | ${u.status}\n`;
    });

    bot.sendMessage(msg.chat.id, list.slice(0, 4000)); // Telegram limit safety
  });

  // --- ADMIN: EDIT ---
  bot.onText(/\/edit (\S+) (\S+)/, (msg, match) => {
    if (!isAdmin(msg.from.id)) return;
    const [_, tid, newRes] = match;
    const db = loadDB();
    const tIdx = db.trades.findIndex(t => t.tradeId === tid);
    if (tIdx === -1) return bot.sendMessage(msg.chat.id, "Trade ID not found.");
    
    const oldPts = db.trades[tIdx].points;
    const newPts = parseResult(newRes);
    db.trades[tIdx].result = newRes;
    db.trades[tIdx].points = newPts;
    
    Object.keys(db.users).forEach(uid => {
      const u = db.users[uid];
      const hIdx = u.history.findIndex(h => h.tradeId === tid);
      if (hIdx !== -1) {
        u.points = u.points - oldPts + newPts;
        u.history[hIdx].points = newPts;
        bot.sendMessage(uid, `⚠️ Admin correction for ${tid}.\nNew Points: ${u.points}`);
      }
    });
    
    saveDB(db);
    bot.sendMessage(msg.chat.id, `Trade ${tid} updated.`);
  });

  bot.on('polling_error', console.log);
}
