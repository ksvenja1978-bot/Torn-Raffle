const express = require('express');
const axios = require('axios');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const TORN_API_BASE = 'https://api.torn.com/v2';

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// SQLite Datenbank initialisieren
const db = new sqlite3.Database('./casino.db', (err) => {
  if (err) console.error('DB-Fehler:', err.message);
  else console.log('SQLite Datenbank verbunden.');
});

// Tabellen anlegen
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS users (
    player_id INTEGER PRIMARY KEY,
    name TEXT,
    balance INTEGER DEFAULT 0,
    api_key TEXT
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    player_id INTEGER,
    type TEXT,
    amount INTEGER,
    game TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
});

// Torn API Middleware / Auth
async function verifyTornUser(apiKey) {
  const response = await axios.get(`${TORN_API_BASE}/user/?selections=profile`, {
    headers: { 'Authorization': `ApiKey ${apiKey}` }
  });
  if (response.data.error) throw new Error(response.data.error.error);
  return response.data;
}

// LOGIN / AUTH
app.post('/api/login', async (req, res) => {
  const { apiKey } = req.body;
  if (!apiKey) return res.status(400).json({ error: 'API Key fehlt.' });

  try {
    const userData = await verifyTornUser(apiKey);
    const playerId = userData.player_id;
    const name = userData.name;

    db.run(
      `INSERT INTO users (player_id, name, api_key) VALUES (?, ?, ?)
       ON CONFLICT(player_id) DO UPDATE SET name=?, api_key=?`,
      [playerId, name, apiKey, name, apiKey],
      function (err) {
        if (err) return res.status(500).json({ error: 'DB Fehler' });

        db.get(`SELECT balance FROM users WHERE player_id = ?`, [playerId], (err, row) => {
          res.json({
            player_id: playerId,
            name: name,
            balance: row ? row.balance : 0
          });
        });
      }
    );
  } catch (err) {
    res.status(401).json({ error: 'Ungültiger Torn API Key.' });
  }
});

// GLÜCKSRAD SPIN LOGIK
app.post('/api/spin', async (req, res) => {
  const apiKey = req.headers['x-api-key'];
  if (!apiKey) return res.status(400).json({ error: 'Kein API Key.' });

  try {
    const userData = await verifyTornUser(apiKey);
    const playerId = userData.player_id;

    // Gewinnschlüssel berechnen (55% Niete, 35% 1x, 7% 2x, 2.5% 5x, 0.5% 10x)
    const rand = Math.random() * 100;
    let prize = 0;
    if (rand < 55) prize = 0;
    else if (rand < 90) prize = 1;
    else if (rand < 97) prize = 2;
    else if (rand < 99.5) prize = 5;
    else prize = 10;

    // Kontostand in DB aktualisieren & Transaction loggen
    db.serialize(() => {
      if (prize > 0) {
        db.run(`UPDATE users SET balance = balance + ? WHERE player_id = ?`, [prize, playerId]);
      }
      db.run(`INSERT INTO transactions (player_id, type, amount, game) VALUES (?, ?, ?, ?)`, 
        [playerId, prize > 0 ? 'WIN' : 'LOSE', prize, 'wheel']);

      db.get(`SELECT balance FROM users WHERE player_id = ?`, [playerId], (err, row) => {
        res.json({
          prize: prize,
          newBalance: row ? row.balance : 0
        });
      });
    });

  } catch (err) {
    res.status(500).json({ error: 'Fehler beim Verarbeiten des Spielzuges.' });
  }
});

// ITEM SEND LOGIK (Auszahlungsanforderung)
app.post('/api/withdraw', async (req, res) => {
  const apiKey = req.headers['x-api-key'];
  const { amount } = req.body;

  if (!apiKey || !amount || amount <= 0) return res.status(400).json({ error: 'Ungültige Anfrage.' });

  try {
    const userData = await verifyTornUser(apiKey);
    const playerId = userData.player_id;

    db.get(`SELECT balance FROM users WHERE player_id = ?`, [playerId], (err, row) => {
      if (!row || row.balance < amount) {
        return res.status(400).json({ error: 'Nicht genügend Guthaben.' });
      }

      // Guthaben abziehen & Auszahlungs-Auftrag erstellen
      db.serialize(() => {
        db.run(`UPDATE users SET balance = balance - ? WHERE player_id = ?`, [amount, playerId]);
        db.run(`INSERT INTO transactions (player_id, type, amount, game) VALUES (?, 'WITHDRAW_REQUEST', ?, 'payout')`, [playerId, amount]);

        res.json({
          success: true,
          message: `Auszahlung von ${amount} Xanax wurde angemeldet! Der Bot/Admin überweist das Item in-game.`,
          newBalance: row.balance - amount
        });
      });
    });
  } catch (err) {
    res.status(500).json({ error: 'Auszahlungsfehler.' });
  }
});

app.listen(PORT, () => console.log(`High-End Casino Server läuft auf Port ${PORT}`));
