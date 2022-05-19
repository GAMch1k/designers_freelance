const TelegramBot = require('node-telegram-bot-api');
const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database('./databases/database.db');

const token = '5173499293:AAEjTu3z7N-6rhpJxHhhDPV_gR85hlTc-LA';

const bot = new TelegramBot(token, {polling: true});




bot.on('message', (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;

  bot.sendMessage(chatId, text);
});
