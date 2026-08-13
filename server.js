require('dotenv').config();
const express = require('express');
const session = require('express-session');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;
const APP_PASSWORD = process.env.APP_PASSWORD || 'wijzig-dit-wachtwoord';
const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');
const BOARD_NAME = process.env.BOARD_NAME || 'Mededelingenbord';
const SITE_URL = process.env.SITE_URL || `http://localhost:${PORT}`;
const MAX_FEED_ITEMS = 30;

const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'messages.json');

// --- Simpele opslag in een JSON-bestand ---
// Let op: op sommige gratis cloud-hosting-platforms wordt de schijf gewist bij
// elke nieuwe deploy. Koppel een persistent volume/disk als je berichten wilt
// bewaren tussen deploys. Zie README.md.
function ensureDataFile() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, '[]', 'utf8');
}

function readMessages() {
  ensureDataFile();
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    console.error('Kon berichten niet lezen, begin met lege lijst:', err);
    return [];
  }
}

function writeMessages(messages) {
  ensureDataFile();
  fs.writeFileSync(DATA_FILE, JSON.stringify(messages, null, 2), 'utf8');
}

// Render/Railway/etc. handelen HTTPS af op een proxy en sturen het verkeer
// daarna intern als gewoon HTTP door. Zonder deze regel denkt Express dat de
// verbinding onbeveiligd is en weigert hij de "secure" sessie-cookie te
// zetten, waardoor je steeds wordt teruggestuurd naar het inlogscherm.
app.set('trust proxy', 1);

// --- Middleware ---
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use(
  session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 1000 * 60 * 60 * 24 * 30, // 30 dagen
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
    },
  })
);

function requireLogin(req, res, next) {
  if (req.session && req.session.loggedIn) return next();
  return res.status(401).json({ error: 'Niet ingelogd' });
}

// --- Auth routes ---
app.post('/api/login', (req, res) => {
  const { password } = req.body || {};
  if (typeof password === 'string' && password === APP_PASSWORD) {
    req.session.loggedIn = true;
    return res.json({ ok: true });
  }
  return res.status(401).json({ error: 'Onjuist wachtwoord' });
});

app.post('/api/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

app.get('/api/session', (req, res) => {
  res.json({ loggedIn: !!(req.session && req.session.loggedIn) });
});

// --- Berichten API (alleen voor ingelogde collega's) ---
app.get('/api/messages', requireLogin, (req, res) => {
  const messages = readMessages().sort((a, b) => b.createdAt - a.createdAt);
  res.json(messages);
});

app.post('/api/messages', requireLogin, (req, res) => {
  const text = (req.body && req.body.text ? String(req.body.text) : '').trim();
  if (!text) return res.status(400).json({ error: 'Bericht mag niet leeg zijn' });
  if (text.length > 500) return res.status(400).json({ error: 'Bericht is te lang (max 500 tekens)' });

  const messages = readMessages();
  const message = {
    id: crypto.randomUUID(),
    text,
    createdAt: Date.now(),
  };
  messages.push(message);
  writeMessages(messages);
  res.status(201).json(message);
});

app.delete('/api/messages/:id', requireLogin, (req, res) => {
  const messages = readMessages();
  const filtered = messages.filter((m) => m.id !== req.params.id);
  if (filtered.length === messages.length) {
    return res.status(404).json({ error: 'Bericht niet gevonden' });
  }
  writeMessages(filtered);
  res.json({ ok: true });
});

// --- RSS feed (publiek toegankelijk, geen login nodig) ---
// Dit is de URL die je invult in de applicatie die het scherm in de hal aanstuurt.
function escapeXml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

app.get('/feed.xml', (req, res) => {
  const messages = readMessages()
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, MAX_FEED_ITEMS);

  const items = messages
    .map((m) => {
      const link = `${SITE_URL}/#${m.id}`;
      return `    <item>
      <title>${escapeXml(m.text.slice(0, 80))}</title>
      <description>${escapeXml(m.text)}</description>
      <link>${escapeXml(link)}</link>
      <guid isPermaLink="false">${escapeXml(m.id)}</guid>
      <pubDate>${new Date(m.createdAt).toUTCString()}</pubDate>
    </item>`;
    })
    .join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>${escapeXml(BOARD_NAME)}</title>
    <link>${escapeXml(SITE_URL)}</link>
    <description>Actuele mededelingen</description>
    <language>nl-NL</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
${items}
  </channel>
</rss>`;

  res.set('Content-Type', 'application/rss+xml; charset=utf-8');
  res.send(xml);
});

app.listen(PORT, () => {
  console.log(`${BOARD_NAME} draait op poort ${PORT}`);
});
