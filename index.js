
import TelegramBot from 'node-telegram-bot-api';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import http from 'http';

dotenv.config();

// --- RENDER HEALTH CHECK SERVER ---
const PORT = process.env.PORT || 3000;
http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('TradeFlow Bot is running...\n');
}).listen(PORT, () => {
  console.log(`Health check server listening on port ${PORT}`);
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TOKEN = process.env.BOT_TOKEN;
const ADMIN_ID = process.env.ADMIN_ID; 
const DB_PATH = path.join(__dirname, 'db.json');

const loadDB = () => {
  try {
    if (!fs.existsSync(DB_PATH)) return { users: {}, trades: [] };
    const data = fs.readFileSync(DB_PATH, 'utf8');
    if (!data || data.trim() === "") return { users: {}, trades: [] };
    return JSON.parse(data);
  } catch (e) {
    console.error("Load DB Error:", e.message);
    return { users: {}, trades: [] };
  }
};

const saveDB = (data) => {
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
  } catch (e) {
    console.error("Database save failed:", e.message);
  }
};

const calculatePoints = (result) => {
  if (!result) return 0;
  const upper = result.toUpperCase();
  if (upper === 'SL') return -1;
  const match = result.match(/1:(\d+)/);
  if (match) return parseInt(match[1], 10);
  return 0;
};

if (TOKEN) {
  const bot = new TelegramBot(TOKEN, { polling: true });
  console.log('TradeFlow Bot is active and polling...');

  const isAdmin = (msg) => msg.from.id.toString() === ADMIN_ID;

  // Error handling for polling
  bot.on('polling_error', (error) => {
    console.error(`[Polling Error]: ${error.code} - ${error.message}`);
  });

  // USER COMMAND: /start
  bot.onText(/\/start/, (msg) => {
    try {
      const userId = msg.from.id.toString();
      const db = loadDB();

      if (db.users[userId]) {
        bot.sendMessage(msg.chat.id, "Aapka trial pehle se active hai ya khatam ho chuka hai. Re-entry allow nahi hai.");
        return;
      }

      db.users[userId] = {
        user_id: userId,
        username: msg.from.username || 'Trader',
        join_timestamp: Date.now(),
        trades: 0,
        points: 0,
        status: "active",
        history: []
      };

      saveDB(db);
      
      bot.sendMessage(msg.chat.id, `Welcome 👋\nTrades yahin milenge.\nAapka free trial start ho chuka hai.\n\nRules:\n• SL = -1\n• RR jitna mile, utne points\n• 10 trades + 10 points = trial complete (one-time)\n\nStatus:\nTrades: 0 / 10\nPoints: 0 / 10`);
    } catch (err) {
      console.error("Start command error:", err);
    }
  });

  // USER COMMAND: /profile
  bot.onText(/\/profile/, (msg) => {
    try {
      const userId = msg.from.id.toString();
      const db = loadDB();
      const user = db.users[userId];

      if (!user) return bot.sendMessage(msg.chat.id, "Please use /start to begin.");

      const historyText = user.history.length > 0
        ? user.history.map((h, i) => `${i + 1}) ${h.tradeId} | ${h.result} | ${h.points > 0 ? '+' : ''}${h.points}`).join('\n')
        : "No trades yet.";

      bot.sendMessage(msg.chat.id, `Your Trade Profile\n\nJoined: ${new Date(user.join_timestamp).toLocaleDateString()}\nTrades: ${user.trades} / 10\nPoints: ${user.points} / 10\n\nHistory:\n${historyText}\n\nStatus: ${user.status.toUpperCase()}`);
    } catch (err) {
      console.error("Profile command error:", err);
    }
  });

  // ADMIN COMMAND: /result TRADE_ID RESULT
  bot.onText(/\/result (\S+) (\S+)/, (msg, match) => {
    if (!isAdmin(msg)) return;
    try {
      const tradeId = match[1];
      const resultStr = match[2];
      const points = calculatePoints(resultStr);
      const db = loadDB();

      if (db.trades.find(t => t.tradeId === tradeId)) return bot.sendMessage(msg.chat.id, "Error: Trade ID already exists.");

      db.trades.push({ tradeId, result: resultStr, points, timestamp: Date.now() });

      Object.keys(db.users).forEach(uid => {
        const user = db.users[uid];
        if (user.status === 'active') {
          user.trades += 1;
          user.points += points;
          user.history.push({ tradeId, result: resultStr, points });

          if (user.trades >= 10 && user.points >= 10) {
            user.status = 'exited';
            bot.sendMessage(uid, "🚫 Free Trial Completed\nYour access has ended permanently.\nTo continue, please upgrade via Exness Social Trading.");
          } else {
            bot.sendMessage(uid, `✅ New Trade Result: ${tradeId}\nResult: ${resultStr}\nTotal Points: ${user.points}`);
          }
        }
      });

      saveDB(db);
      bot.sendMessage(msg.chat.id, `Success: Trade ${tradeId} added.`);
    } catch (err) {
      console.error("Result command error:", err);
    }
  });

  // ADMIN COMMAND: /edit TRADE_ID NEW_RESULT
  bot.onText(/\/edit (\S+) (\S+)/, (msg, match) => {
    if (!isAdmin(msg)) return;
    try {
      const tradeId = match[1];
      const newResult = match[2];
      const newPoints = calculatePoints(newResult);
      const db = loadDB();

      const tradeIndex = db.trades.findIndex(t => t.tradeId === tradeId);
      if (tradeIndex === -1) return bot.sendMessage(msg.chat.id, "Error: Trade ID not found.");

      const oldPoints = db.trades[tradeIndex].points;
      db.trades[tradeIndex].result = newResult;
      db.trades[tradeIndex].points = newPoints;

      Object.keys(db.users).forEach(uid => {
        const user = db.users[uid];
        const historyIdx = user.history.findIndex(h => h.tradeId === tradeId);
        if (historyIdx !== -1) {
          user.points = user.points - oldPoints + newPoints;
          user.history[historyIdx].result = newResult;
          user.history[historyIdx].points = newPoints;
          bot.sendMessage(uid, `⚠️ Correction: Trade ${tradeId} updated to ${newResult}.\nNew Total Points: ${user.points}`);
        }
      });

      saveDB(db);
      bot.sendMessage(msg.chat.id, `Success: Trade ${tradeId} updated.`);
    } catch (err) {
      console.error("Edit command error:", err);
    }
  });

  // ADMIN COMMAND: /delete TRADE_ID
  bot.onText(/\/delete (\S+)/, (msg, match) => {
    if (!isAdmin(msg)) return;
    try {
      const tradeId = match[1];
      const db = loadDB();

      const trade = db.trades.find(t => t.tradeId === tradeId);
      if (!trade) return bot.sendMessage(msg.chat.id, "Error: Trade ID not found.");

      db.trades = db.trades.filter(t => t.tradeId !== tradeId);

      Object.keys(db.users).forEach(uid => {
        const user = db.users[uid];
        const hIdx = user.history.findIndex(h => h.tradeId === tradeId);
        if (hIdx !== -1 && user.status === 'active') {
          user.trades -= 1;
          user.points -= user.history[hIdx].points;
          user.history.splice(hIdx, 1);
          bot.sendMessage(uid, `❌ Trade ${tradeId} has been deleted by admin.\nTotal Points: ${user.points}`);
        }
      });

      saveDB(db);
      bot.sendMessage(msg.chat.id, `Success: Trade ${tradeId} deleted.`);
    } catch (err) {
      console.error("Delete command error:", err);
    }
  });
} else {
  console.error("FATAL ERROR: BOT_TOKEN is missing in environment variables.");
}
