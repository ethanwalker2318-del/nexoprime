// ─── Mock Price Engine ───────────────────────────────────────────────────────
// Генерирует реалистичные цены с тиками 600-1200ms, bid/ask, спред, объём

// ─── OHLC Candle ─────────────────────────────────────────────────────────────
export interface Candle {
  ts:     number;   // UNIX ms, открытие свечи
  open:   number;
  high:   number;
  low:    number;
  close:  number;
  volume: number;
}

// Таймфреймы в миллисекундах (ускоренное время — 1 тик ≈ 1s реального)
const TF_MS: Record<string, number> = {
  "1м":  60_000,
  "5м":  300_000,
  "15м": 900_000,
  "1ч":  3_600_000,
  "4ч":  14_400_000,
  "1д":  86_400_000,
};

// Хранилище свечей: candleStore[symbol][tf] = Candle[]
const candleStore: Record<string, Record<string, Candle[]>> = {};
// Текущие незакрытые свечи: openCandle[symbol][tf]
const openCandle: Record<string, Record<string, Candle>> = {};

// Генерируем историю свечей (50 закрытых) для всех пар/ТФ
function initCandles() {
  const now = Date.now();
  for (const symbol of Object.keys(INITIAL)) {
    candleStore[symbol] = {};
    openCandle[symbol]  = {};
    for (const [tf, ms] of Object.entries(TF_MS)) {
      const BASE_PRICE = INITIAL[symbol]!.price;
      const candles: Candle[] = [];
      let price = BASE_PRICE * rng(0.92, 1.08);
      for (let i = 50; i >= 1; i--) {
        const ts   = now - i * ms;
        const open = price;
        const moves = 8;
        let high = open, low = open, close = open;
        for (let j = 0; j < moves; j++) {
          price *= 1 + rng(-0.004, 0.004);
          high  = Math.max(high,  price);
          low   = Math.min(low,   price);
          close = price;
        }
        candles.push({ ts, open, high, low, close, volume: rng(50, 500) * (BASE_PRICE * 0.0001) });
      }
      candleStore[symbol][tf] = candles;
      // Открываем текущую свечу
      const curTs = Math.floor(now / ms) * ms;
      openCandle[symbol][tf] = { ts: curTs, open: price, high: price, low: price, close: price, volume: 0 };
    }
  }
}

export function getCandles(symbol: string, tf = "15м", count = 50): Candle[] {
  const hist = candleStore[symbol]?.[tf] ?? [];
  const open = openCandle[symbol]?.[tf];
  const combined = open ? [...hist, open] : hist;
  return combined.slice(-count);
}

// Обновление свечей при каждом тике
function updateCandles(symbol: string, price: number, volume: number) {
  const now = Date.now();
  const symOpen = openCandle[symbol];
  const symStore = candleStore[symbol];
  if (!symOpen || !symStore) return;

  for (const [tf, ms] of Object.entries(TF_MS)) {
    const curTs = Math.floor(now / ms) * ms;
    const candle = symOpen[tf];
    if (!candle) continue;

    if (curTs > candle.ts) {
      // Закрываем предыдущую, открываем новую
      symStore[tf] = [...(symStore[tf] ?? []).slice(-99), { ...candle }];
      symOpen[tf]  = { ts: curTs, open: price, high: price, low: price, close: price, volume };
    } else {
      // Обновляем текущую
      candle.high   = Math.max(candle.high, price);
      candle.low    = Math.min(candle.low,  price);
      candle.close  = price;
      candle.volume += volume;
    }
  }
}

export interface Ticker {
  symbol: string;
  base: string;
  quote: string;
  price: number;
  bid: number;
  ask: number;
  change24h: number;   // %
  high24h: number;
  low24h: number;
  vol24h: number;      // usdt
  history: number[];   // последние 50 цен
}

export interface OrderBookLevel {
  price: number;
  size: number;
  total: number;
}

export interface OrderBook {
  symbol: string;
  bids: OrderBookLevel[];
  asks: OrderBookLevel[];
  ts: number;
}

// ─── Начальные данные ────────────────────────────────────────────────────────
const INITIAL: Record<string, { price: number; vol: number }> = {
  "BTC/USDT":  { price: 67_450,  vol: 1_820_000_000 },
  "ETH/USDT":  { price: 3_510,   vol:   730_000_000 },
  "SOL/USDT":  { price: 178.5,   vol:   310_000_000 },
  "BNB/USDT":  { price: 596,     vol:   180_000_000 },
  "XRP/USDT":  { price: 0.6241,  vol:   140_000_000 },
  "ADA/USDT":  { price: 0.4703,  vol:    92_000_000 },
  "DOGE/USDT": { price: 0.1734,  vol:   115_000_000 },
  "AVAX/USDT": { price: 38.72,   vol:    55_000_000 },
  "LINK/USDT": { price: 17.84,   vol:    48_000_000 },
  "DOT/USDT":  { price: 8.21,    vol:    32_000_000 },
};

function rng(min: number, max: number) {
  return Math.random() * (max - min) + min;
}

function genHistory(base: number): number[] {
  const h: number[] = [];
  let p = base * rng(0.97, 1.03);
  for (let i = 0; i < 50; i++) {
    p *= 1 + rng(-0.004, 0.004);
    h.push(p);
  }
  return h;
}

// ─── Инициализация состояния ─────────────────────────────────────────────────
const state: Record<string, Ticker> = {};

for (const [symbol, init] of Object.entries(INITIAL)) {
  const parts = symbol.split("/");
  const base = parts[0] ?? symbol;
  const quote = parts[1] ?? "USDT";
  const history = genHistory(init.price);
  const price = history[history.length - 1] ?? init.price;
  const spread = price * 0.0004;
  const startPrice = history[0] ?? price;
  state[symbol] = {
    symbol, base, quote,
    price,
    bid: price - spread / 2,
    ask: price + spread / 2,
    change24h: ((price - startPrice) / startPrice) * 100,
    high24h: Math.max(...history) * 1.002,
    low24h:  Math.min(...history) * 0.998,
    vol24h: init.vol,
    history,
  };
}

// ─── Генерация стакана ───────────────────────────────────────────────────────
export function genOrderBook(symbol: string): OrderBook {
  const tk = state[symbol];
  if (!tk) return { symbol, bids: [], asks: [], ts: Date.now() };

  const spread = tk.price * 0.0004;
  const levels = 12;
  const bids: OrderBookLevel[] = [];
  const asks: OrderBookLevel[] = [];

  let bidTotal = 0;
  let askTotal = 0;

  for (let i = 0; i < levels; i++) {
    const bPrice = tk.bid - i * spread * 0.3 * (1 + rng(0, 0.15));
    const aPrice = tk.ask + i * spread * 0.3 * (1 + rng(0, 0.15));
    const bSize = rng(0.1, 4) * (1 / tk.price) * 10_000;
    const aSize = rng(0.1, 4) * (1 / tk.price) * 10_000;
    bidTotal += bPrice * bSize;
    askTotal += aPrice * aSize;
    bids.push({ price: bPrice, size: bSize, total: bidTotal });
    asks.push({ price: aPrice, size: aSize, total: askTotal });
  }

  return { symbol, bids, asks, ts: Date.now() };
}

// ─── Тип слушателя ───────────────────────────────────────────────────────────
type TickListener = (tickers: Record<string, Ticker>) => void;
const listeners = new Set<TickListener>();

export function subscribeTickers(fn: TickListener) {
  listeners.add(fn);
  fn({ ...state });
  return () => listeners.delete(fn);
}

export function getSnapshot(): Record<string, Ticker> {
  return { ...state };
}

export function getTicker(symbol: string): Ticker | undefined {
  return state[symbol];
}

// ─── Волатильность по настроению ────────────────────────────────────────────
let marketMood = 0; // -1..+1

function tick() {
  // Плавный дрейф настроения
  marketMood += rng(-0.05, 0.05);
  marketMood = Math.max(-1, Math.min(1, marketMood));

  for (const tk of Object.values(state)) {
    const vol = 0.0015 + Math.abs(marketMood) * 0.0008;
    const drift = marketMood * 0.00003;
    const delta = rng(-vol, vol) + drift;

    tk.price *= 1 + delta;
    const spread = tk.price * 0.0004;
    tk.bid = tk.price - spread / 2;
    tk.ask = tk.price + spread / 2;
    tk.history = [...tk.history.slice(-49), tk.price];
    tk.high24h = Math.max(tk.high24h, tk.price);
    tk.low24h  = Math.min(tk.low24h,  tk.price);
    // change24h вычисляем от самой старой точки истории (а не случайным дрейфом)
    const refPrice = tk.history[0] ?? tk.price;
    tk.change24h = refPrice > 0 ? ((tk.price - refPrice) / refPrice) * 100 : 0;
    tk.vol24h   *= 1 + rng(-0.001, 0.001);
    updateCandles(tk.symbol, tk.price, rng(0.01, 2));
  }

  for (const fn of listeners) fn({ ...state });

  const delay = rng(600, 1200);
  setTimeout(tick, delay);
}

// Инициализация свечей после объявления INITIAL
initCandles();

// Запустить движок
tick();
