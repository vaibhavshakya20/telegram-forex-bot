
import TelegramBot from 'node-telegram-bot-api';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import http from 'http';

dotenv.config();

// --- STABILITY: Global Error Handlers ---
process.on('uncaughtException', (err) => {
  console.error('CRITICAL ERROR (Uncaught Exception):', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('CRITICAL ERROR (Unhandled Rejection):', reason);
});

// --- KEEP ALIVE: HTTP Server to prevent spin-down ---
const PORT = process.env.PORT || 3000;
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('TradeFlow Engine: Online and Active\n');
});

server.listen(PORT, () => {
  console.log(`Keep-alive server running on port ${PORT}`);
});

// Self-pinging logic if WEBAPP_URL is provided in .env
if (process.env.WEBAPP_URL) {
  setInterval(() => {
    http.get(process.env.WEBAPP_URL, (res) => {
      console.log(`Self-ping status: ${res.statusCode}`);
    }).on('error', (err) => {
      console.log('Self-ping error:', err.message);
    });
  }, 1000 * 60 * 10); // Ping every 10 minutes
}

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
  if (!input) return 0;
  const val = input.toString().toLowerCase().trim();
  if (val === 'sl') return -1;
  const num = parseInt(val, 10);
  return isNaN(num) ? 0 : num;
};

if (TOKEN) {
  // Use polling with error handling
  const bot = new TelegramBot(TOKEN, { 
    polling: {
      interval: 300,
      autoStart: true,
      params: { timeout: 10 }
    }
  });

  const isAdmin = (id) => id && id.toString() === ADMIN_ID?.toString();

  // --- SET COMMAND MENU ---
  const setBotCommands = () => {
    const adminCommands = [
      { command: 'start', description: 'Main Menu / Status' },
      { command: 'add', description: '[Res] Add trade result (e.g. /add 3)' },
      { command: 'all', description: '[Msg] Broadcast text to everyone' },
      { command: 'users', description: 'Manage Users & Message' },
      { command: 'rejoin', description: '[ID] Reactivate finished user' },
      { command: 'edit', description: '[ID] [NewRes] Correct trade' },
      { command: 'delete', description: '[ID] Remove trade' },
      { command: 'profile', description: 'Check my profile progress' }
    ];
    bot.setMyCommands(adminCommands).catch(e => console.error("Failed to set commands:", e));
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
    bot.sendMessage(msg.chat.id, `📸 Broadcasted to ${activeUsers.length} users.`);
  });

  // --- ADMIN: TEXT BROADCAST (/all) ---
  bot.onText(/\/all (.+)/, (msg, match) => {
    if (!isAdmin(msg.from.id)) return;
    const text = match[1];
    const db = loadDB();
    const activeUsers = Object.values(db.users).filter(u => u.status === 'active');
    
    activeUsers.forEach(u => {
      bot.sendMessage(u.user_id, `📢 *Announcement:*\n\n${text}`, { parse_mode: 'Markdown' }).catch(() => {});
    });
    bot.sendMessage(msg.chat.id, `📢 Sent to ${activeUsers.length} users.`);
  });

  // --- ADMIN: REJOIN USER ---
  const processRejoin = (chatId, targetUid) => {
    const db = loadDB();
    if (!db.users[targetUid]) return bot.sendMessage(chatId, "❌ User ID not found in database.");
    
    db.users[targetUid].status = 'active';
    // Optionally reset points if you want them to start over, 
    // but usually rejoin means resuming access.
    saveDB(db);
    
    bot.sendMessage(chatId, `✅ User \`${targetUid}\` has been reactivated.`, { parse_mode: 'Markdown' });
    bot.sendMessage(targetUid, "⚡ *Access Restored*\nAdmin ne aapka access reactivate kar diya hai. Aap agle trades track kar sakte hain.");
  };

  bot.onText(/\/rejoin (\d+)/, (msg, match) => {
    if (isAdmin(msg.from.id)) processRejoin(msg.chat.id, match[1]);
  });

  // --- ADMIN: DELETE TRADE ---
  bot.onText(/\/delete (\S+)/, (msg, match) => {
    if (!isAdmin(msg.from.id)) return;
    const tradeId = match[1].toUpperCase();
    const db = loadDB();
    
    const tradeIdx = db.trades.findIndex(t => t.tradeId === tradeId);
    if (tradeIdx === -1) return bot.sendMessage(msg.chat.id, "❌ Trade ID not found.");
    
    const trade = db.trades[tradeIdx];
    db.trades.splice(tradeIdx, 1);
    
    Object.values(db.users).forEach(u => {
      const hIdx = u.history.findIndex(h => h.tradeId === tradeId);
      if (hIdx !== -1) {
        u.points = (u.points || 0) - u.history[hIdx].points;
        u.trades = Math.max(0, (u.trades || 0) - 1);
        u.history.splice(hIdx, 1);
      }
    });
    
    saveDB(db);
    bot.sendMessage(msg.chat.id, `🗑️ Trade ${tradeId} deleted. Points updated for all users.`);
  });

  // --- ADMIN: EDIT TRADE ---
  bot.onText(/\/edit (\S+) (\S+)/, (msg, match) => {
    if (!isAdmin(msg.from.id)) return;
    const tradeId = match[1].toUpperCase();
    const newRes = match[2];
    const newPts = parseResult(newRes);
    const db = loadDB();
    
    const trade = db.trades.find(t => t.tradeId === tradeId);
    if (!trade) return bot.sendMessage(msg.chat.id, "❌ Trade ID not found.");
    
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
    bot.sendMessage(msg.chat.id, `✏️ Trade ${tradeId} edited. New result: ${newRes} (${newPts} pts).`);
  });

  // --- GLOBAL MESSAGE HANDLER ---
  bot.on('message', (msg) => {
    const uid = msg.from.id.toString();
    const text = msg.text;
    if (!text || text.startsWith('/')) return;

    // Private Admin-to-User Chat logic
    if (isAdmin(uid) && adminState.activeTargetId) {
      if (text.toLowerCase() === 'cancel') {
        adminState.activeTargetId = null;
        return bot.sendMessage(ADMIN_ID, "✅ Direct messaging mode turned off.");
      }
      
      const target = adminState.activeTargetId;
      bot.sendMessage(target, `💬 *Message from Admin:*\n\n${text}`, { parse_mode: 'Markdown' })
        .then(() => {
          bot.sendMessage(ADMIN_ID, `✅ Message sent to \`${target}\`. Type more or 'cancel'.`, { parse_mode: 'Markdown' });
        })
        .catch(() => {
          bot.sendMessage(ADMIN_ID, `❌ Failed to send. User may have blocked the bot.`);
          adminState.activeTargetId = null;
        });
    }
  });

  // --- USER/ADMIN: START ---
  bot.onText(/\/start/, (msg) => {
    const uid = msg.from.id.toString();
    const db = loadDB();
    
    if (isAdmin(uid)) {
      return bot.sendMessage(msg.chat.id, "⚡ *TradeFlow Admin Master*\n\n✅ Commands active.\n✅ Broadcast active.\n✅ Polling stable.\n\nUse / menu for quick commands.", { parse_mode: 'Markdown' });
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
      bot.sendMessage(msg.chat.id, "Welcome 👋\nAapka free trial start ho chuka hai.\n\n*Rules:*\n• SL Hit = -1 Point\n• Target 1:RR = RR Points\n• Goal: 10 Trades & 10 Points\n\nResult updates yahi milenge.", { parse_mode: 'Markdown' });
    } else {
      bot.sendMessage(msg.chat.id, "Welcome back! Type /profile to see your progress.");
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
          bot.sendMessage(uid, "🚫 *Free Trial Completed*\nYour access has ended permanently. Points reached 10+.\n\nTo continue, join via Exness Social Trading.");
        } else {
          bot.sendMessage(uid, `✅ *New Update: ${tradeId}*\nResult: ${resInput}\nPoints: ${pts > 0 ? '+' : ''}${pts}\nTotal Points: ${u.points}/10`, { parse_mode: 'Markdown' });
        }
      }
    });
    saveDB(db);
    bot.sendMessage(msg.chat.id, `✅ Success: ${tradeId} (${resInput}) added for ${updatedCount} users.`);
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
    if (!u) return bot.sendMessage(msg.chat.id, "Please /start first.");

    const hist = u.history.slice(-10).map((h, i) => `${i+1}) ${h.tradeId} | ${h.result} | ${h.points}`).join('\n') || "No trades yet.";
    bot.sendMessage(msg.chat.id, `📊 *Trade Profile*\n\nTrades: ${u.trades} / 10\nPoints: ${u.points} / 10\nStatus: ${u.status.toUpperCase()}\n\n*Recent History:*\n${hist}`, { parse_mode: 'Markdown' });
  });

  // --- ADMIN: USERS DIRECTORY ---
  bot.onText(/\/users/, (msg) => {
    if (!isAdmin(msg.from.id)) return;
    const db = loadDB();
    const users = Object.values(db.users);
    if (users.length === 0) return bot.sendMessage(msg.chat.id, "No users found.");

    bot.sendMessage(msg.chat.id, `👥 *Total Users:* ${users.length}`);
    users.forEach(u => {
      bot.sendMessage(msg.chat.id, `👤 \`${u.user_id}\` (${u.username})\nScore: ${u.points} Pts | ${u.trades} Trades\nStatus: ${u.status.toUpperCase()}`, {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: "✉️ Message", callback_data: `msg_${u.user_id}` }],
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
    
    if (data.startsWith('msg_')) {
      adminState.activeTargetId = data.split('_')[1];
      bot.sendMessage(ADMIN_ID, `📝 Write message for \`${adminState.activeTargetId}\` (Type 'cancel' to exit):`, { parse_mode: 'Markdown' });
    } else if (data.startsWith('rejoin_')) {
      const tid = data.split('_')[1];
      processRejoin(ADMIN_ID, tid);
    }
    bot.answerCallbackQuery(query.id);
  });

  bot.on('polling_error', (err) => {
    console.error('Polling Error:', err.message);
    // Polling usually continues automatically, but logging is vital.
  });

  console.log("TradeFlow Bot Engine is now running...");
}
