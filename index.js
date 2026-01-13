
import TelegramBot from 'node-telegram-bot-api';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import http from 'http';
import { GoogleGenAI } from "@google/genai";

dotenv.config();

// --- STABILITY: Global Error Handlers ---
process.on('uncaughtException', (err) => console.error('CRITICAL ERROR (Uncaught Exception):', err));
process.on('unhandledRejection', (reason) => console.error('CRITICAL ERROR (Unhandled Rejection):', reason));

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TOKEN = process.env.BOT_TOKEN;
const ADMIN_ID = process.env.ADMIN_ID; 
const DB_PATH = path.join(__dirname, 'db.json');
const GEMINI_API_KEY = process.env.API_KEY;

// Initialize Gemini for TTS
const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

// --- UTILS: DB & PARSING ---
const loadDB = () => {
  try {
    if (!fs.existsSync(DB_PATH)) return { users: {}, trades: [] };
    const data = fs.readFileSync(DB_PATH, 'utf8');
    const db = data ? JSON.parse(data) : { users: {}, trades: [] };
    if (!db.users) db.users = {};
    if (!db.trades) db.trades = [];
    return db;
  } catch (e) { return { users: {}, trades: [] }; }
};

const saveDB = (data) => {
  try { fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2)); }
  catch (e) { console.error('DB Save Error:', e); }
};

// --- UTILS: AUDIO PROCESSING ---
function addWavHeader(pcmData, sampleRate = 24000) {
  const dataLen = pcmData.length;
  const buffer = Buffer.alloc(44 + dataLen);
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataLen, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20); // PCM
  buffer.writeUInt16LE(1, 22); // Mono
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34); // 16-bit
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataLen, 40);
  pcmData.copy(buffer, 44);
  return buffer;
}

// --- BOT INITIALIZATION ---
let bot;
if (TOKEN) {
  bot = new TelegramBot(TOKEN, { polling: true });
  
  const setBotCommands = () => {
    bot.setMyCommands([
      { command: 'start', description: 'Main Menu / Status' },
      { command: 'profile', description: 'Check my profile progress' },
      { command: 'all', description: 'Admin: Broadcast text' },
      { command: 'users', description: 'Admin: Manage users' }
    ]).catch(e => console.error("Failed to set commands:", e));
  };
  setBotCommands();
}

// --- WEBHOOK BROADCAST LOGIC ---
async function broadcastSignal(payload) {
  const db = loadDB();
  const activeUsers = Object.values(db.users).filter(u => u.status === 'active');
  
  const signalMsg = `🚨 *NEW TRADE SIGNAL* 🚨\n\n` +
                    `📈 *Pair:* ${payload.pair}\n` +
                    `🎯 *Side:* ${payload.signal}\n` +
                    `💵 *Entry:* ${payload.entry}\n` +
                    `🛑 *SL:* ${payload.sl}\n` +
                    `✅ *TP:* ${payload.tp}\n` +
                    `💼 *Lot:* ${payload.lot || 'Auto'}`;

  // 1. Send Text Signal
  activeUsers.forEach(u => {
    bot.sendMessage(u.user_id, signalMsg, { parse_mode: 'Markdown' }).catch(() => {});
  });

  // 2. Generate and Send TTS Alert
  try {
    const ttsText = `New ${payload.signal} signal on ${payload.pair}`;
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: ttsText }] }],
      config: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (base64Audio) {
      const pcmBuffer = Buffer.from(base64Audio, 'base64');
      const wavBuffer = addWavHeader(pcmBuffer, 24000);
      
      activeUsers.forEach(u => {
        bot.sendVoice(u.user_id, wavBuffer).catch(() => {});
      });
    }
  } catch (error) {
    console.error("TTS Broadcast Error:", error);
  }
}

// --- KEEP ALIVE & WEBHOOK SERVER ---
const server = http.createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/tv-webhook') {
    let body = '';
    req.on('data', chunk => body += chunk.toString());
    req.on('end', async () => {
      try {
        const payload = JSON.parse(body);
        console.log('Webhook Received:', payload);
        await broadcastSignal(payload);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'success' }));
      } catch (e) {
        console.error('Webhook Error:', e);
        res.writeHead(400);
        res.end('Invalid Payload');
      }
    });
    return;
  }

  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('TradeFlow Engine: Online\n');
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server & Webhook running on port ${PORT}`));

// --- BOT HANDLERS ---
if (bot) {
  const isAdmin = (id) => id && id.toString() === ADMIN_ID?.toString();

  bot.onText(/\/start/, (msg) => {
    const uid = msg.from.id.toString();
    const db = loadDB();
    if (!db.users[uid]) {
      db.users[uid] = { user_id: uid, username: msg.from.username || 'Trader', join_timestamp: Date.now(), trades: 0, points: 0, status: "active", history: [] };
      saveDB(db);
      bot.sendMessage(msg.chat.id, "Welcome 👋\nAapka free trial start ho chuka hai. Signal yahi milenge.");
    } else {
      bot.sendMessage(msg.chat.id, "Welcome back! Type /profile to see progress.");
    }
  });

  bot.onText(/\/profile/, (msg) => {
    const uid = msg.from.id.toString();
    const db = loadDB();
    const u = db.users[uid];
    if (!u) return bot.sendMessage(msg.chat.id, "Please /start first.");
    bot.sendMessage(msg.chat.id, `📊 *Profile*\n\nTrades: ${u.trades}/10\nPoints: ${u.points}/10\nStatus: ${u.status.toUpperCase()}`, { parse_mode: 'Markdown' });
  });

  bot.onText(/\/all (.+)/, (msg, match) => {
    if (!isAdmin(msg.from.id)) return;
    const db = loadDB();
    Object.values(db.users).filter(u => u.status === 'active').forEach(u => {
      bot.sendMessage(u.user_id, `📢 *Announcement:*\n\n${match[1]}`, { parse_mode: 'Markdown' }).catch(() => {});
    });
    bot.sendMessage(msg.chat.id, "✅ Broadcast sent.");
  });
}
