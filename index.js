
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
    if (!db.users) db.users = {};
    if (!db.trades) db.trades = [];
    return db;
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
  const val = input.toLowerCase().trim();
  if (val === 'sl') return -1;
  const num = parseInt(val, 10);
  return isNaN(num) ? 0 : num;
};

if (TOKEN) {
  const bot = new TelegramBot(TOKEN, { polling: true });
  const isAdmin = (id) => id && id.toString() === ADMIN_ID?.toString();

  // --- SET COMMAND MENU ---
  const setBotCommands = () => {
    const adminCommands = [
      { command: 'start', description: 'Open Admin Panel' },
      { command: 'add', description: '[Result] Add trade result (e.g. /add 3)' },
      { command: 'all', description: '[Msg] Send message to all active users' },
      { command: 'users', description: 'List all users & message them' },
      { command: 'rejoin', description: '[ID] Reactivate a finished user' },
      { command: 'edit', description: '[ID] [Result] Correct a trade' },
      { command: 'delete', description: '[ID] Delete a trade' }
    ];
    bot.setMyCommands(adminCommands);
  };
  setBotCommands();

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

  // --- ADMIN: REJOIN USER ---
  bot.onText(/\/rejoin (\d+)/, (msg, match) => {
    if (!isAdmin(msg.from.id)) return;
    const targetUid = match[1];
    const db = loadDB();
    
    if (!db.users[targetUid]) return bot.sendMessage(msg.chat.id, "❌ User ID nahi mila.");
    
    db.users[targetUid].status = 'active';
    saveDB(db);
    
    bot.sendMessage(msg.chat.id, `✅ User \`${targetUid}\` reactivate ho gaya hai.`, { parse_mode: 'Markdown' });
    bot.sendMessage(targetUid, "⚡ *Trial Reactivated*\nAdmin ne aapka access dobara chalu kar diya hai.");
  });

  // --- ADMIN: DELETE TRADE ---
  bot.onText(/\/delete (\S+)/, (msg, match) => {
    if (!isAdmin(msg.from.id)) return;
    const tradeId = match[1].toUpperCase();
    const db = loadDB();
    
    const tradeIdx = db.trades.findIndex(t => t.tradeId === tradeId);
    if (tradeIdx === -1) return bot.sendMessage(msg.chat.id, "❌ Trade ID nahi mila.");
    
    const trade = db.trades[tradeIdx];
    db.trades.splice(tradeIdx, 1);
    
    Object.values(db.users).forEach(u => {
      const hIdx = u.history.findIndex(h => h.tradeId === tradeId);
      if (hIdx !== -1) {
        u.points -= u.history[hIdx].points;
        u.trades -= 1;
        u.history.splice(hIdx, 1);
      }
    });
    
    saveDB(db);
    bot.sendMessage(msg.chat.id, `🗑️ Trade ${tradeId} deleted and points rolled back.`);
  });

  // --- ADMIN: EDIT TRADE ---
  bot.onText(/\/edit (\S+) (\S+)/, (msg, match) => {
    if (!isAdmin(msg.from.id)) return;
    const tradeId = match[1].toUpperCase();
    const newRes = match[2];
    const newPts = parseResult(newRes);
    const db = loadDB();
    
    const trade = db.trades.find(t => t.tradeId === tradeId);
    if (!trade) return bot.sendMessage(msg.chat.id, "❌ Trade ID nahi mila.");
    
    const oldPts = trade.points;
    trade.result = newRes;
    trade.points = newPts;
    
    Object.values(db.users).forEach(u => {
      const h = u.history.find(h => h.tradeId === tradeId);
      if (h) {
        u.points = (u.points - oldPts) + newPts;
        h.points = newPts;
        h.result = newRes;
      }
    });
    
    saveDB(db);
    bot.sendMessage(msg.chat.id, `✏️ Trade ${tradeId} updated to ${newRes} (${newPts} pts).`);
  });

  // --- GLOBAL MESSAGE HANDLER ---
  bot.on('message', (msg) => {
    const uid = msg.from.id.toString();
    const text = msg.text;
    if (!text || text.startsWith('/')) return;

    if (isAdmin(uid) && adminState.activeTargetId) {
      if (text === 'cancel') {
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

  // --- USER/ADMIN: START ---
  bot.onText(/\/start/, (msg) => {
    const uid = msg.from.id.toString();
    const db = loadDB();
    
    if (isAdmin(uid)) {
      return bot.sendMessage(msg.chat.id, "⚡ *Admin Access Enabled*\n\nCommands list menu mein check karein ya `/` type karein.", { parse_mode: 'Markdown' });
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
      bot.sendMessage(msg.chat.id, "Welcome 👋\nAapka free trial start ho chuka hai.\n\nRules:\n• SL = -1 Point\n• Target 1:N = N Points\n\nStatus check karne ke liye /profile bhejien.");
    } else {
      bot.sendMessage(msg.chat.id, "Welcome back! /profile se status dekhein.");
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
        u.history.push({ tradeId, points: pts, result: resInput });
        updatedCount++;

        if (u.trades >= 10 && u.points >= 10) {
          u.status = 'exited';
          bot.sendMessage(uid, "🚫 *Free Trial Completed*\nYour access has ended permanently.\nTo continue, please upgrade.");
        } else {
          bot.sendMessage(uid, `✅ *Update: ${tradeId}*\nResult: ${resInput}\nPoints: ${pts > 0 ? '+' : ''}${pts}\nTotal: ${u.points} / 10`);
        }
      }
    });
    saveDB(db);
    bot.sendMessage(msg.chat.id, `✅ Success: ${tradeId} added. Updates sent to ${updatedCount} users.`);
  };

  bot.onText(/\/add (\S+)/, (msg, match) => {
    if (isAdmin(msg.from.id)) handleAddResult(msg, match[1]);
  });

  bot.onText(/\/result \S+ (\S+)/, (msg, match) => {
    if (isAdmin(msg.from.id)) handleAddResult(msg, match[1]);
  });

  // --- USER: PROFILE ---
  bot.onText(/\/profile/, (msg) => {
    const uid = msg.from.id.toString();
    const db = loadDB();
    const u = db.users[uid];
    if (!u) return bot.sendMessage(msg.chat.id, "Start with /start");

    const hist = u.history.map((h, i) => `${i+1}) ${h.tradeId} | ${h.result} | ${h.points}`).join('\n') || "No trades yet.";
    bot.sendMessage(msg.chat.id, `📊 *Your Trade Profile*\n\nTrades: ${u.trades} / 10\nPoints: ${u.points} / 10\nStatus: ${u.status.toUpperCase()}\n\n*History:*\n${hist}`, { parse_mode: 'Markdown' });
  });

  // --- ADMIN: USERS DIRECTORY ---
  bot.onText(/\/users/, (msg) => {
    if (!isAdmin(msg.from.id)) return;
    const db = loadDB();
    const users = Object.values(db.users);
    if (users.length === 0) return bot.sendMessage(msg.chat.id, "No users.");

    users.forEach(u => {
      bot.sendMessage(msg.chat.id, `👤 \`${u.user_id}\` (${u.username})\nPoints: ${u.points} | Trades: ${u.trades} | ${u.status}`, {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: "✉️ Message User", callback_data: `msg_${u.user_id}` }],
            [{ text: "🔄 Reactivate", callback_data: `rejoin_${u.user_id}` }]
          ]
        }
      });
    });
  });

  // --- CALLBACK HANDLER ---
  bot.on('callback_query', (query) => {
    if (!isAdmin(query.from.id)) return;
    const data = query.data;
    const db = loadDB();
    
    if (data.startsWith('msg_')) {
      adminState.activeTargetId = data.split('_')[1];
      bot.sendMessage(ADMIN_ID, `📝 Write message for \`${adminState.activeTargetId}\` (or type 'cancel'):`, { parse_mode: 'Markdown' });
    } else if (data.startsWith('rejoin_')) {
      const tid = data.split('_')[1];
      if (db.users[tid]) {
        db.users[tid].status = 'active';
        saveDB(db);
        bot.sendMessage(ADMIN_ID, `✅ User ${tid} reactivated.`);
        bot.sendMessage(tid, "⚡ Admin has restored your access.");
      }
    }
    bot.answerCallbackQuery(query.id);
  });

  bot.on('polling_error', (err) => console.log('Polling:', err.message));
}
