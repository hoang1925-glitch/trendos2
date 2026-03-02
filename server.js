require(‘dotenv’).config();
const express = require(‘express’);
const fetch = require(‘node-fetch’);
const path = require(‘path’);

const app = express();
const PORT = process.env.PORT || 3000;

const ALPACA_KEY    = process.env.ALPACA_KEY;
const ALPACA_SECRET = process.env.ALPACA_SECRET;
const ALPACA_MODE   = process.env.ALPACA_MODE || ‘paper’;
const ACCESS_CODE   = process.env.ACCESS_CODE || ‘trendos2024’;

const BASE_URL = ALPACA_MODE === ‘live’
? ‘https://api.alpaca.markets’
: ‘https://paper-api.alpaca.markets’;
const DATA_URL = ‘https://data.alpaca.markets’;

app.use(express.json());
app.use(express.static(path.join(__dirname, ‘public’)));

// ── Access code verification ──────────────────────────────────────────
app.post(’/auth’, (req, res) => {
const { code } = req.body;
if (code === ACCESS_CODE) {
res.json({ ok: true, mode: ALPACA_MODE });
} else {
res.status(401).json({ ok: false, error: ‘Invalid access code’ });
}
});

// ── Market status ─────────────────────────────────────────────────────
app.get(’/market-status’, async (req, res) => {
try {
const r = await fetch(`${BASE_URL}/v2/clock`, {
headers: {
‘APCA-API-KEY-ID’: ALPACA_KEY,
‘APCA-API-SECRET-KEY’: ALPACA_SECRET,
}
});
const data = await r.json();
res.json(data);
} catch (e) {
res.status(500).json({ error: e.message });
}
});

// ── Snapshots (market + sector ETFs) ─────────────────────────────────
app.get(’/snapshots’, async (req, res) => {
try {
const { symbols } = req.query;
const r = await fetch(`${DATA_URL}/v2/stocks/snapshots?symbols=${symbols}&feed=iex`, {
headers: {
‘APCA-API-KEY-ID’: ALPACA_KEY,
‘APCA-API-SECRET-KEY’: ALPACA_SECRET,
}
});
const data = await r.json();
res.json(data);
} catch (e) {
res.status(500).json({ error: e.message });
}
});

// ── Stock search / quote ──────────────────────────────────────────────
app.get(’/quote/:symbol’, async (req, res) => {
try {
const sym = req.params.symbol.toUpperCase();
const [snapRes, barsRes] = await Promise.all([
fetch(`${DATA_URL}/v2/stocks/${sym}/snapshot?feed=iex`, {
headers: { ‘APCA-API-KEY-ID’: ALPACA_KEY, ‘APCA-API-SECRET-KEY’: ALPACA_SECRET }
}),
fetch(`${DATA_URL}/v2/stocks/${sym}/bars?timeframe=1Day&limit=252&feed=iex`, {
headers: { ‘APCA-API-KEY-ID’: ALPACA_KEY, ‘APCA-API-SECRET-KEY’: ALPACA_SECRET }
})
]);
const snap = await snapRes.json();
const bars = await barsRes.json();
if (snap.code === 40410000) return res.status(404).json({ error: ‘Symbol not found’ });
res.json({ symbol: sym, snapshot: snap, bars: bars.bars || [] });
} catch (e) {
res.status(500).json({ error: e.message });
}
});

// ── News ──────────────────────────────────────────────────────────────
app.get(’/news’, async (req, res) => {
try {
const { symbols, limit } = req.query;
const params = new URLSearchParams({ limit: limit || 30, sort: ‘desc’ });
if (symbols) params.set(‘symbols’, symbols);
const r = await fetch(`${DATA_URL}/v2/news?${params}`, {
headers: { ‘APCA-API-KEY-ID’: ALPACA_KEY, ‘APCA-API-SECRET-KEY’: ALPACA_SECRET }
});
const data = await r.json();
res.json(data);
} catch (e) {
res.status(500).json({ error: e.message });
}
});

// ── Multi-symbol bars (for sector EMA calculations) ──────────────────
app.get(’/bars’, async (req, res) => {
try {
const { symbols, limit } = req.query;
const syms = symbols.split(’,’);
const lim = limit || 60;
const results = {};
await Promise.all(syms.map(async sym => {
const r = await fetch(`${DATA_URL}/v2/stocks/${sym}/bars?timeframe=1Day&limit=${lim}&feed=iex`, {
headers: { ‘APCA-API-KEY-ID’: ALPACA_KEY, ‘APCA-API-SECRET-KEY’: ALPACA_SECRET }
});
const data = await r.json();
results[sym] = data.bars || [];
}));
res.json(results);
} catch (e) {
res.status(500).json({ error: e.message });
}
});

// ── Health check (for Railway/Render) ────────────────────────────────
app.get(’/health’, (req, res) => res.json({ status: ‘ok’, mode: ALPACA_MODE }));

// ── Start ─────────────────────────────────────────────────────────────
app.listen(PORT, () => {
console.log(’\n========================================’);
console.log(’  TrendOS v2 is running!’);
console.log(`  http://localhost:${PORT}`);
console.log(`  Mode: ${ALPACA_MODE.toUpperCase()}`);
console.log(`  Access code: ${ACCESS_CODE}`);
console.log(’========================================\n’);
console.log(’  Press Ctrl+C to stop.\n’);

if (process.env.NODE_ENV !== ‘production’) {
const { exec } = require(‘child_process’);
exec(`start http://localhost:${PORT}`);
}
});
