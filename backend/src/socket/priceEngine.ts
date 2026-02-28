// ─── Server-Side Price Engine ────────────────────────────────────────────────
// Единый источник цен для всех клиентов. Генерирует тики каждые 800ms,
// транслирует MARKET_TICK → все подключённые сокеты получают одинаковые цены.
//
// Также предоставляет getPrice(symbol) для settlement и TICK_OVERRIDE.

export interface ServerTicker {
  symbol: string;
  price:  number;
  bid:    number;
  ask:    number;
  change24h: number;
  high24h:   number;
  low24h:    number;
  vol24h:    number;
}

// ─── Начальные данные (зеркало клиентского mockEngine) ───────────────────────

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

// ─── State ───────────────────────────────────────────────────────────────────

const state: Record<string, ServerTicker> = {};
let marketMood = 0;
let emitAllFn: ((event: string, data: unknown) => void) | null = null;
let running = false;

// Инициализация: создаём стартовые тикеры (чуть отклоняем от INITIAL, как биржевой шум)
function initState() {
  for (const [symbol, init] of Object.entries(INITIAL)) {
    const price  = init.price * (1 + rng(-0.003, 0.003));
    const spread = price * 0.0004;
    state[symbol] = {
      symbol,
      price,
      bid:       price - spread / 2,
      ask:       price + spread / 2,
      change24h: rng(-1.5, 1.5),
      high24h:   price * (1 + rng(0.005, 0.02)),
      low24h:    price * (1 - rng(0.005, 0.02)),
      vol24h:    init.vol,
    };
  }
}

// ─── Основной tick ───────────────────────────────────────────────────────────

function tick() {
  if (!running) return;

  // Плавный дрейф рыночного настроения
  marketMood += rng(-0.05, 0.05);
  marketMood  = Math.max(-1, Math.min(1, marketMood));

  const tickers: Record<string, ServerTicker> = {};

  for (const tk of Object.values(state)) {
    const vol   = 0.0015 + Math.abs(marketMood) * 0.0008;
    const drift = marketMood * 0.00003;
    const delta = rng(-vol, vol) + drift;

    tk.price  *= 1 + delta;
    const spread = tk.price * 0.0004;
    tk.bid     = tk.price - spread / 2;
    tk.ask     = tk.price + spread / 2;
    tk.high24h = Math.max(tk.high24h, tk.price);
    tk.low24h  = Math.min(tk.low24h,  tk.price);
    tk.vol24h *= 1 + rng(-0.001, 0.001);

    // change24h: медленный дрейф
    tk.change24h += rng(-0.02, 0.02);
    tk.change24h  = Math.max(-15, Math.min(15, tk.change24h));

    tickers[tk.symbol] = { ...tk };
  }

  // Broadcast to all connected clients
  if (emitAllFn) {
    emitAllFn("MARKET_TICK", { tickers });
  }

  const delay = rng(700, 900); // немного стабильнее чем клиент (700-900ms)
  setTimeout(tick, delay);
}

// ─── Public API ──────────────────────────────────────────────────────────────

/** Запуск движка. Вызывать один раз при старте Socket.io сервера. */
export function startPriceEngine(emitAll: (event: string, data: unknown) => void): void {
  if (running) return;
  emitAllFn = emitAll;
  initState();
  running = true;
  console.log("[PriceEngine] Started — broadcasting MARKET_TICK to all clients");
  tick();
}

/** Текущая цена пары */
export function getPrice(symbol: string): number {
  return state[symbol]?.price ?? 0;
}

/** Все тикеры */
export function getAllTickers(): Record<string, ServerTicker> {
  return { ...state };
}

/** Принудительно установить цену (для TICK_OVERRIDE / тестов) */
export function setOverridePrice(symbol: string, price: number): void {
  const tk = state[symbol];
  if (!tk) return;
  tk.price = price;
  const spread = price * 0.0004;
  tk.bid = price - spread / 2;
  tk.ask = price + spread / 2;
  tk.high24h = Math.max(tk.high24h, price);
  tk.low24h  = Math.min(tk.low24h,  price);
}

/** Остановить движок (для тестов) */
export function stopPriceEngine(): void {
  running = false;
}
