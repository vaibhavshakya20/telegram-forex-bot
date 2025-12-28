
# TradeFlow Telegram Bot

A private 1-on-1 Telegram bot for managing trade trials.

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Create a `.env` file in the root directory:
   ```env
   BOT_TOKEN=your_telegram_bot_token_here
   ADMIN_ID=your_telegram_user_id_here
   ```

3. Run the bot:
   ```bash
   npm start
   ```

## Admin Commands
- `/result TRADE_ID RESULT` - Post a new result (e.g., `/result T001 1:3`)
- `/edit TRADE_ID NEW_RESULT` - Correct a mistake (e.g., `/edit T001 SL`)
- `/delete TRADE_ID` - Remove a trade result completely

## User Commands
- `/start` - Join the trial
- `/profile` - View your progress and history
