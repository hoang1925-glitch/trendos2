require(‘dotenv’).config();
const express = require(‘express’);
const fetch = require(‘node-fetch’);
const path = require(‘path’);

const app = express();
const PORT = process.env.PORT || 3000;

const ALPACA_KEY    = process.env.ALPACA_KEY;
const ALPACA_SECRET = process.env.ALPACA_SECRET;
const ALPACA_MODE   = process.env.ALPACA_MODE || ‘paper’;

const BASE_URL = ALPACA_MODE === ‘live’
? ‘https://api.alpaca.markets’
: ‘https://paper-api.alpaca.markets’;
const DATA_URL = ‘https://data.alpaca.markets’;

app.use(express.json());
app.use(express.static(path.join(__dirname, ‘public’)));

app.get(’/market-status’, async (req, res) => {
try {
const r = await fetch(`${BASE_URL}/v2/clock`, {
headers: { ‘APCA-API-KEY-ID’: ALPACA_KEY, ‘APCA-API-SECRET-KEY’: ALPACA_SECRET }
});
res.json(await r.json());
} catch (e) { res.status(500).json({ error: e.message }); }
});

app.get(’/snapshots’, async (req, res) => {
try {
const { symbols } = req.query;
const r = await fetch(`${DATA_URL}/v2/stocks/snapshots?symbols=${symbols}&feed=iex`, {
headers: { ‘APCA-API-KEY-ID’: ALPACA_KEY, ‘APCA-API-SECRET-KEY’: ALPACA_SECRET }
});
res.json(await r.json());
} catch (e) { res.status(500).json({ error: e.message }); }
});

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
} catch (e) { res.status(500).json({ error: e.message }); }
});

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
} catch (e) { res.status(500).json({ error: e.message }); }
});

app.get(’/news’, async (req, res) => {
try {
const { symbols, limit } = req.query;
const params = new URLSearchParams({ limit: limit || 30, sort: ‘desc’ });
if (symbols) params.set(‘symbols’, symbols);
const r = await fetch(`${DATA_URL}/v2/news?${params}`, {
headers: { ‘APCA-API-KEY-ID’: ALPACA_KEY, ‘APCA-API-SECRET-KEY’: ALPACA_SECRET }
});
res.json(await r.json());
} catch (e) { res.status(500).json({ error: e.message }); }
});

app.get(’/health’, (req, res) => res.json({ status: ‘ok’, mode: ALPACA_MODE }));

app.listen(PORT, () => {
console.log(`TrendOS running on port ${PORT} in ${ALPACA_MODE} mode`);
});
