
import TelegramBot from 'node-telegram-bot-api';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import http from 'http';

dotenv.config();

/**
 * TradeFlow Telegram Bot - Optimized for Render
 */

// --- RENDER HEALTH CHECK SERVER ---
// Render needs a web server to bind to a port, otherwise deployment fails.
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

// Warning for Render Free Tier users
if (process.env.RENDER) {
  console.log('--- DEPLOYMENT NOTICE ---');
  console.log('Running on Render. Note: db.json will be reset on every restart.');
  console.log('To persist data, use a database like MongoDB Atlas or Render Paid Disk.');
  console.log('-------------------------');
}

if (!TOKEN || !ADMIN_ID) {
  console.error('CRITICAL ERROR: BOT_TOKEN or ADMIN_ID is not defined in environment variables.');
}

const loadDB = () => {
  try {
    if (!fs.existsSync(DB_PATH)) return { users: {}, trades: [] };
    const data = fs.readFileSync(DB_PATH, 'utf8');
    return JSON.parse(data);
  } catch (e) {
    console.error("DB Load Error:", e.message);
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

let bot;
if (TOKEN) {
  bot = new TelegramBot(TOKEN, { polling: true });
  console.log('TradeFlow Bot is active and polling Telegram API...');

  bot.onText(/\/start/, (msg) => {
    const userId = msg.from.id.toString();
    const db = loadDB();

    if (db.users[userId]) {
      bot.sendMessage(msg.chat.id, "Welcome back! Aapka trial pehle se chal raha hai. Ek user sirf ek baar join kar sakta hai.");
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
    
    const welcomeMsg = `Welcome 👋
Trades yahin milenge.
Aapka free trial start ho chuka hai.

Rules:
• SL = -1
• RR jitna mile, utne points
• 10 trades + 10 points = trial complete (one-time)

Status:
Trades: 0 / 10
Points: 0 / 10`;

    bot.sendMessage(msg.chat.id, welcomeMsg);
  });

  bot.onText(/\/profile/, (msg) => {
    const userId = msg.from.id.toString();
    const db = loadDB();
    const user = db.users[userId];

    if (!user) {
      bot.sendMessage(msg.chat.id, "Please use /start to begin.");
      return;
    }

    const historyText = user.history.length > 0
      ? user.history.map((h, i) => `${i + 1}) ${h.tradeId} | ${h.result} | ${h.points > 0 ? '+' : ''}${h.points} pts`).join('\n')
      : "No trades tracked yet.";

    const profileMsg = `Your Trade Profile

Joined On: ${new Date(user.join_timestamp).toLocaleDateString()}

Trades Since Joining: ${user.trades} / 10
Total Points: ${user.points} / 10

Trade History:
${historyText}

Status: ${user.status.charAt(0).toUpperCase() + user.status.slice(1)}`;

    bot.sendMessage(msg.chat.id, profileMsg);
  });

  const isAdmin = (msg) => msg.from.id.toString() === ADMIN_ID;

  // /result TRADE_ID RESULT (Example: /result T001 1:2)
  bot.onText(/\/result (\S+) (\S+)/, (msg, match) => {
    if (!isAdmin(msg)) return;
    const tradeId = match[1];
    const resultStr = match[2];
    const points = calculatePoints(resultStr);
    const db = loadDB();

    db.trades.push({ tradeId, result: resultStr, points, timestamp: Date.now() });

    Object.keys(db.users).forEach(uid => {
      const user = db.users[uid];
      if (user.status === 'active' && Date.now() >= user.join_timestamp) {
        user.trades += 1;
        user.points += points;
        user.history.push({ tradeId, result: resultStr, points });

        if (user.trades >= 10 && user.points >= 10) {
          user.status = 'exited';
          bot.sendMessage(uid, "🚫 Free Trial Completed\nYour access has ended permanently.\nTo continue, please upgrade via Exness Social Trading.");
        } else {
          bot.sendMessage(uid, `New Trade Result: ${tradeId}\nResult: ${resultStr}\nTotal Points: ${user.points}`);
        }
      }
    });

    saveDB(db);
    bot.sendMessage(msg.chat.id, `Trade ${tradeId} processed for all active users.`);
  });

  bot.on('polling_error', (err) => {
    if (err.code === 'EFATAL') {
       console.error('Fatal Polling Error. Restarting process...');
       process.exit(1);
    }
    console.error('Bot Poll Error:', err.message);
  });
}
