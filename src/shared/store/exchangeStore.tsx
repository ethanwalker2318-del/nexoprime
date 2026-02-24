import React, {
  createContext, useContext, useReducer, useCallback, useEffect, useRef,
} from "react";
import { subscribeTickers, getTicker } from "./mockEngine";
import type { Ticker } from "./mockEngine";

// ─── Типы ────────────────────────────────────────────────────────────────────

export type OrderSide   = "buy" | "sell";
export type OrderType   = "market" | "limit";
export type OrderStatus = "pending" | "queued" | "partial" | "filled" | "cancelled" | "rejected";

export interface Order {
  id:         string;
  symbol:     string;
  side:       OrderSide;
  type:       OrderType;
  price:      number;     // исполненная цена (market) или лимитная
  qty:        number;
  filledQty:  number;
  status:     OrderStatus;
  fee:        number;
  feeAsset:   string;
  createdAt:  number;
  updatedAt:  number;
}

// Лог каждого фактического трейда (fill)
export interface Trade {
  id:       string;
  orderId:  string;
  symbol:   string;
  side:     OrderSide;
  price:    number;
  qty:      number;
  fee:      number;
  feeAsset: string;
  ts:       number;
  realizedPnl?: number; // только для sell
}

export interface Asset {
  symbol:       string;
  available:    number;
  locked:       number;
  avgBuyPrice:  number;   // средняя цена покупки (VWAP)
  realizedPnl:  number;   // зафиксированная прибыль/убыток
  totalBought:  number;   // накопленное куплено (qty) — для расчёта avg
}

export interface DepositRecord {
  id:                    string;
  asset:                 string;
  amount:                number;
  address:               string;
  status:                "pending" | "confirming" | "credited";
  confirmations:         number;
  requiredConfirmations: number;
  createdAt:             number;
}

export interface WithdrawRecord {
  id:        string;
  asset:     string;
  amount:    number;
  address:   string;
  fee:       number;
  status:    "pending" | "processing" | "sent" | "failed";
  createdAt: number;
  txHash?:   string;
}

export interface User {
  email:         string;
  emailVerified: boolean;
  uid:           string;
  level:         1 | 2 | 3;
}

// ─── State ───────────────────────────────────────────────────────────────────

interface State {
  user:        User | null;
  assets:      Record<string, Asset>;
  orders:      Order[];
  trades:      Trade[];           // история исполнений
  deposits:    DepositRecord[];
  withdrawals: WithdrawRecord[];
  tickers:     Record<string, Ticker>;
}

function makeAsset(symbol: string, available = 0, locked = 0): Asset {
  return { symbol, available, locked, avgBuyPrice: 0, realizedPnl: 0, totalBought: 0 };
}

const INITIAL_STATE: State = {
  user: null,
  assets: {
    USDT: { ...makeAsset("USDT", 10_000) },
    BTC:  { ...makeAsset("BTC",  0.025), avgBuyPrice: 62_000, totalBought: 0.025 },
    ETH:  { ...makeAsset("ETH",  0.5),   avgBuyPrice: 3_200,  totalBought: 0.5   },
    SOL:  { ...makeAsset("SOL",  5),     avgBuyPrice: 160,    totalBought: 5     },
    BNB:  { ...makeAsset("BNB",  0) },
  },
  orders:      [],
  trades:      [],
  deposits:    [],
  withdrawals: [],
  tickers:     {},
};

// ─── Actions ─────────────────────────────────────────────────────────────────

type Action =
  | { type: "SET_USER";          user: User | null }
  | { type: "SET_TICKERS";       tickers: Record<string, Ticker> }
  | { type: "PLACE_ORDER";       order: Order }
  | { type: "UPDATE_ORDER";      id: string; patch: Partial<Order> }
  | { type: "UPDATE_ASSET";      symbol: string; patch: Partial<Asset> }
  | { type: "ADD_TRADE";         trade: Trade }
  | { type: "ADD_DEPOSIT";       deposit: DepositRecord }
  | { type: "UPDATE_DEPOSIT";    id: string; patch: Partial<DepositRecord> }
  | { type: "ADD_WITHDRAWAL";    withdrawal: WithdrawRecord }
  | { type: "UPDATE_WITHDRAWAL"; id: string; patch: Partial<WithdrawRecord> }
  | { type: "CANCEL_ORDER";      id: string };

function reducer(state: State, action: Action): State {
  switch (action.type) {

    case "SET_USER":
      return { ...state, user: action.user };

    case "SET_TICKERS":
      return { ...state, tickers: action.tickers };

    case "PLACE_ORDER":
      return { ...state, orders: [action.order, ...state.orders] };

    case "UPDATE_ORDER":
      return {
        ...state,
        orders: state.orders.map(o =>
          o.id === action.id ? { ...o, ...action.patch, updatedAt: Date.now() } : o
        ),
      };

    case "ADD_TRADE":
      return { ...state, trades: [action.trade, ...state.trades] };

    case "CANCEL_ORDER": {
      const order = state.orders.find(o => o.id === action.id);
      if (!order || !["queued","partial","pending"].includes(order.status)) return state;
      const [base = "", quote = "USDT"] = order.symbol.split("/");
      const assetKey  = order.side === "buy" ? quote : base;
      const unlockAmt = order.side === "buy"
        ? (order.qty - order.filledQty) * order.price
        : (order.qty - order.filledQty);
      const asset = state.assets[assetKey] ?? makeAsset(assetKey);
      return {
        ...state,
        orders: state.orders.map(o =>
          o.id === action.id ? { ...o, status: "cancelled" as OrderStatus, updatedAt: Date.now() } : o
        ),
        assets: {
          ...state.assets,
          [assetKey]: { ...asset, available: asset.available + unlockAmt, locked: Math.max(0, asset.locked - unlockAmt) },
        },
      };
    }

    case "UPDATE_ASSET": {
      const prev = state.assets[action.symbol] ?? makeAsset(action.symbol);
      return {
        ...state,
        assets: { ...state.assets, [action.symbol]: { ...prev, ...action.patch } },
      };
    }

    case "ADD_DEPOSIT":
      return { ...state, deposits: [action.deposit, ...state.deposits] };

    case "UPDATE_DEPOSIT":
      return { ...state, deposits: state.deposits.map(d => d.id === action.id ? { ...d, ...action.patch } : d) };

    case "ADD_WITHDRAWAL":
      return { ...state, withdrawals: [action.withdrawal, ...state.withdrawals] };

    case "UPDATE_WITHDRAWAL":
      return { ...state, withdrawals: state.withdrawals.map(w => w.id === action.id ? { ...w, ...action.patch } : w) };

    default:
      return state;
  }
}

// ─── Context ─────────────────────────────────────────────────────────────────

interface ExchangeCtx {
  state:              State;
  dispatch:           React.Dispatch<Action>;
  login:              (email: string) => void;
  logout:             () => void;
  placeOrder:         (symbol: string, side: OrderSide, type: OrderType, qty: number, limitPrice?: number) => { ok: boolean; error?: string; order?: Order };
  cancelOrder:        (id: string) => void;
  closePosition:      (symbol: string) => { ok: boolean; error?: string };
  initiateDeposit:    (asset: string) => DepositRecord;
  initiateWithdrawal: (asset: string, amount: number, address: string) => { ok: boolean; error?: string };
  totalUSDT:          () => number;
  unrealizedPnl:      (symbol: string) => { pnl: number; pct: number };
}

const Ctx = createContext<ExchangeCtx | null>(null);

// ─── Provider ────────────────────────────────────────────────────────────────

export function ExchangeProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, INITIAL_STATE);
  const stateRef = useRef(state);
  stateRef.current = state;

  // Подписка на тикеры
  useEffect(() => {
    const unsub = subscribeTickers(tickers => dispatch({ type: "SET_TICKERS", tickers }));
    return () => { unsub(); };
  }, []);

  // ── Симуляция исполнения лимитных ордеров ──────────────────────────────────
  useEffect(() => {
    const iv = setInterval(() => {
      const st = stateRef.current;
      st.orders
        .filter(o => o.status === "queued" && o.type === "limit")
        .forEach(order => {
          const tk = getTicker(order.symbol);
          if (!tk) return;
          const hit = order.side === "buy" ? tk.ask <= order.price : tk.bid >= order.price;
          if (!hit) return;

          const [base = "", quote = "USDT"] = order.symbol.split("/");
          const fillFrac   = Math.random() > 0.4 ? 1 : Math.random() * 0.8 + 0.1;
          const addFilled  = (order.qty - order.filledQty) * fillFrac;
          const newFilled  = order.filledQty + addFilled;
          const isFull     = newFilled >= order.qty * 0.999;
          const fee        = addFilled * order.price * 0.0006;

          dispatch({ type: "UPDATE_ORDER", id: order.id, patch: {
            filledQty: isFull ? order.qty : newFilled,
            status:    isFull ? "filled" : "partial",
            fee:       order.fee + fee,
          }});

          // Добавляем трейд
          const trade: Trade = {
            id:      "trd_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
            orderId: order.id, symbol: order.symbol, side: order.side,
            price: order.price, qty: addFilled, fee, feeAsset: order.feeAsset,
            ts: Date.now(),
          };

          if (order.side === "buy") {
            // Обновляем avgBuyPrice
            const baseAsset = st.assets[base] ?? makeAsset(base);
            const oldTotal  = baseAsset.totalBought;
            const oldAvg    = baseAsset.avgBuyPrice;
            const newTotal  = oldTotal + addFilled;
            const newAvg    = newTotal > 0 ? (oldAvg * oldTotal + order.price * addFilled) / newTotal : order.price;
            dispatch({ type: "UPDATE_ASSET", symbol: base, patch: {
              available:   baseAsset.available + addFilled,
              avgBuyPrice: newAvg,
              totalBought: newTotal,
            }});
            const qa = st.assets[quote] ?? makeAsset(quote);
            dispatch({ type: "UPDATE_ASSET", symbol: quote, patch: {
              locked: Math.max(0, qa.locked - addFilled * order.price - fee),
            }});
          } else {
            // Фиксируем P&L при продаже
            const baseAsset = st.assets[base] ?? makeAsset(base);
            const rpnl      = (order.price - baseAsset.avgBuyPrice) * addFilled - fee;
            trade.realizedPnl = rpnl;
            dispatch({ type: "UPDATE_ASSET", symbol: base, patch: {
              locked:      Math.max(0, baseAsset.locked - addFilled),
              realizedPnl: baseAsset.realizedPnl + rpnl,
            }});
            const qa = st.assets[quote] ?? makeAsset(quote);
            dispatch({ type: "UPDATE_ASSET", symbol: quote, patch: {
              available: qa.available + addFilled * order.price - fee,
            }});
          }

          dispatch({ type: "ADD_TRADE", trade });
        });
    }, 1200);
    return () => clearInterval(iv);
  }, []);

  // ── login / logout ──────────────────────────────────────────────────────────
  const login = useCallback((email: string) => {
    dispatch({ type: "SET_USER", user: { email, emailVerified: true, uid: "u_" + Math.random().toString(36).slice(2, 10), level: 2 } });
  }, []);

  const logout = useCallback(() => dispatch({ type: "SET_USER", user: null }), []);

  // ── placeOrder ──────────────────────────────────────────────────────────────
  const placeOrder = useCallback((
    symbol: string, side: OrderSide, type: OrderType, qty: number, limitPrice?: number,
  ): { ok: boolean; error?: string; order?: Order } => {
    const st  = stateRef.current;
    const tk  = getTicker(symbol);
    if (!tk)  return { ok: false, error: "Пара не найдена" };

    const [base = "", quote = "USDT"] = symbol.split("/");
    const execPrice = type === "market"
      ? (side === "buy" ? tk.ask * 1.0005 : tk.bid * 0.9995)
      : (limitPrice ?? tk.price);

    // Проверка баланса
    if (side === "buy") {
      const cost = qty * execPrice * 1.001;
      const qa   = st.assets[quote] ?? makeAsset(quote);
      if (qa.available < cost) return { ok: false, error: `Недостаточно ${quote}. Нужно ${cost.toFixed(2)}, доступно ${qa.available.toFixed(2)}` };
    } else {
      const ba = st.assets[base] ?? makeAsset(base);
      if (ba.available < qty) return { ok: false, error: `Недостаточно ${base}. Нужно ${qty}, доступно ${ba.available.toPrecision(4)}` };
    }

    // Блокируем средства
    if (side === "buy") {
      const lock = qty * execPrice * 1.001;
      const qa   = st.assets[quote]!;
      dispatch({ type: "UPDATE_ASSET", symbol: quote, patch: { available: qa.available - lock, locked: qa.locked + lock } });
    } else {
      const ba = st.assets[base]!;
      dispatch({ type: "UPDATE_ASSET", symbol: base, patch: { available: ba.available - qty, locked: ba.locked + qty } });
    }

    const order: Order = {
      id: "ord_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
      symbol, side, type, price: execPrice, qty, filledQty: 0,
      status: "pending", fee: 0, feeAsset: side === "buy" ? base : quote,
      createdAt: Date.now(), updatedAt: Date.now(),
    };
    dispatch({ type: "PLACE_ORDER", order });

    if (type === "market") {
      // Немедленное исполнение через 350ms
      setTimeout(() => {
        const st2  = stateRef.current;
        const fee  = qty * execPrice * 0.001;
        dispatch({ type: "UPDATE_ORDER", id: order.id, patch: { status: "filled", filledQty: qty, fee } });

        const trade: Trade = {
          id: "trd_" + Date.now().toString(36),
          orderId: order.id, symbol, side,
          price: execPrice, qty, fee, feeAsset: order.feeAsset, ts: Date.now(),
        };

        if (side === "buy") {
          const ba     = st2.assets[base]  ?? makeAsset(base);
          const qa     = st2.assets[quote] ?? makeAsset(quote);
          const oldTot = ba.totalBought;
          const oldAvg = ba.avgBuyPrice;
          const newTot = oldTot + qty;
          const newAvg = newTot > 0 ? (oldAvg * oldTot + execPrice * qty) / newTot : execPrice;
          dispatch({ type: "UPDATE_ASSET", symbol: base, patch: {
            available:   ba.available + qty,
            avgBuyPrice: newAvg,
            totalBought: newTot,
          }});
          dispatch({ type: "UPDATE_ASSET", symbol: quote, patch: {
            locked: Math.max(0, qa.locked - qty * execPrice * 1.001),
          }});
        } else {
          const ba   = st2.assets[base]  ?? makeAsset(base);
          const qa   = st2.assets[quote] ?? makeAsset(quote);
          const rpnl = (execPrice - ba.avgBuyPrice) * qty - fee;
          trade.realizedPnl = rpnl;
          dispatch({ type: "UPDATE_ASSET", symbol: base, patch: {
            locked:      Math.max(0, ba.locked - qty),
            realizedPnl: ba.realizedPnl + rpnl,
          }});
          dispatch({ type: "UPDATE_ASSET", symbol: quote, patch: {
            available: qa.available + qty * execPrice - fee,
          }});
        }

        dispatch({ type: "ADD_TRADE", trade });
      }, 350);
    } else {
      setTimeout(() => dispatch({ type: "UPDATE_ORDER", id: order.id, patch: { status: "queued" } }), 200);
    }

    return { ok: true, order };
  }, []);

  // ── cancelOrder ─────────────────────────────────────────────────────────────
  const cancelOrder = useCallback((id: string) => dispatch({ type: "CANCEL_ORDER", id }), []);

  // ── closePosition: продаём всё что есть на балансе по рынку ─────────────────
  const closePosition = useCallback((symbol: string): { ok: boolean; error?: string } => {
    const [base = ""] = symbol.split("/");
    const ba = stateRef.current.assets[base];
    if (!ba || ba.available <= 0) return { ok: false, error: "Нет открытой позиции" };
    const result = placeOrder(symbol, "sell", "market", ba.available);
    return result;
  }, [placeOrder]);

  // ── initiateDeposit ─────────────────────────────────────────────────────────
  const initiateDeposit = useCallback((asset: string): DepositRecord => {
    const ADDRS: Record<string, string> = {
      USDT: "TKxXn9QaVZKgijXi2bq5JGp2RHj1XBdGQL",
      BTC:  "bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh",
      ETH:  "0x71C7656EC7ab88b098defB751B7401B5f6d8976F",
      SOL:  "7EcDhSYGxXyscszYEp35KHN8vvw3svAuLKTzXwCFLtV",
      BNB:  "bnb136ns6lfw4zs5hg4n85vdthaad7hq5m4gtkgf23",
    };
    const deposit: DepositRecord = {
      id: "dep_" + Date.now().toString(36), asset, amount: 0,
      address: ADDRS[asset] ?? "addr_" + asset,
      status: "pending", confirmations: 0,
      requiredConfirmations: asset === "BTC" ? 3 : 12,
      createdAt: Date.now(),
    };
    dispatch({ type: "ADD_DEPOSIT", deposit });

    let conf = 0;
    const req       = deposit.requiredConfirmations;
    const mockAmt   = asset === "USDT" ? 1000 : asset === "BTC" ? 0.01 : 0.5;
    const iv = setInterval(() => {
      conf++;
      dispatch({ type: "UPDATE_DEPOSIT", id: deposit.id, patch: {
        confirmations: conf, amount: mockAmt,
        status: conf >= req ? "credited" : "confirming",
      }});
      if (conf >= req) {
        clearInterval(iv);
        const prev = stateRef.current.assets[asset] ?? makeAsset(asset);
        dispatch({ type: "UPDATE_ASSET", symbol: asset, patch: { available: prev.available + mockAmt } });
      }
    }, 4000);

    return deposit;
  }, []);

  // ── initiateWithdrawal ──────────────────────────────────────────────────────
  const initiateWithdrawal = useCallback((asset: string, amount: number, address: string): { ok: boolean; error?: string } => {
    const st  = stateRef.current;
    if (!st.user?.emailVerified) return { ok: false, error: "Подтвердите email" };
    const a   = st.assets[asset];
    const fee = asset === "BTC" ? 0.0002 : asset === "ETH" ? 0.003 : 1;
    if (!a || a.available < amount + fee) return { ok: false, error: `Недостаточно ${asset}` };
    if (amount <= 0)                      return { ok: false, error: "Укажите сумму" };
    dispatch({ type: "UPDATE_ASSET", symbol: asset, patch: { available: a.available - amount - fee } });
    const rec: WithdrawRecord = {
      id: "wdr_" + Date.now().toString(36), asset, amount, address, fee,
      status: "pending", createdAt: Date.now(),
    };
    dispatch({ type: "ADD_WITHDRAWAL", withdrawal: rec });
    setTimeout(() => dispatch({ type: "UPDATE_WITHDRAWAL", id: rec.id, patch: { status: "processing" } }), 2000);
    setTimeout(() => dispatch({ type: "UPDATE_WITHDRAWAL", id: rec.id, patch: { status: "sent", txHash: "0x" + Math.random().toString(16).slice(2,18) } }), 8000);
    return { ok: true };
  }, []);

  // ── totalUSDT ───────────────────────────────────────────────────────────────
  const totalUSDT = useCallback((): number => {
    const st = stateRef.current;
    let total = 0;
    for (const [sym, a] of Object.entries(st.assets)) {
      const bal = a.available + a.locked;
      if (sym === "USDT") { total += bal; continue; }
      const tk = st.tickers[`${sym}/USDT`];
      if (tk) total += bal * tk.price;
    }
    return total;
  }, []);

  // ── unrealizedPnl ───────────────────────────────────────────────────────────
  // P&L по текущему балансу актива относительно avgBuyPrice
  const unrealizedPnl = useCallback((symbol: string): { pnl: number; pct: number } => {
    const st     = stateRef.current;
    const [base] = symbol.split("/");
    const asset  = st.assets[base ?? ""];
    const tk     = st.tickers[symbol];
    if (!asset || !tk || asset.avgBuyPrice === 0) return { pnl: 0, pct: 0 };
    const qty  = asset.available + asset.locked;
    const pnl  = (tk.price - asset.avgBuyPrice) * qty;
    const pct  = ((tk.price - asset.avgBuyPrice) / asset.avgBuyPrice) * 100;
    return { pnl, pct };
  }, []);

  return (
    <Ctx.Provider value={{ state, dispatch, login, logout, placeOrder, cancelOrder, closePosition, initiateDeposit, initiateWithdrawal, totalUSDT, unrealizedPnl }}>
      {children}
    </Ctx.Provider>
  );
}

export function useExchange() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useExchange requires ExchangeProvider");
  return ctx;
}
