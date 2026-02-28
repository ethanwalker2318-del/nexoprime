import React, {
  createContext, useContext, useReducer, useCallback, useEffect, useRef,
} from "react";
import { subscribeTickers, getTicker } from "./mockEngine";
import type { Ticker } from "./mockEngine";
import { getProfile, getActiveTrades, getTradeHistory } from "../api/client";
import type { Trade as ApiTrade } from "../api/client";

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

// ─── Бинарный опцион ─────────────────────────────────────────────────────────
export type BinaryDirection = "call" | "put";
export type BinaryStatus    = "active" | "won" | "lost" | "draw";
export const PAYOUT_RATE    = 0.8; // 80% выплата

export interface BinaryOption {
  id:          string;
  symbol:      string;
  direction:   BinaryDirection;
  stake:       number;        // ставка в USDT
  openPrice:   number;        // цена на момент открытия
  closePrice?: number;        // цена на момент экспирации
  expiryMs:    number;        // длительность, мс
  expiresAt:   number;        // Unix-время экспирации
  status:      BinaryStatus;
  pnl:         number;        // итоговый PnL (0 пока активен)
  createdAt:   number;
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

interface ProfileData {
  tgId:            string;
  username:        string | null;
  firstName:       string | null;
  kycStatus:       string;       // "NONE" | "PENDING" | "VERIFIED"
  tradingEnabled:  boolean;
  requiredTax:     number;
  isBlocked:       boolean;
  // Security Incident flags
  isFrozen:        boolean;
  insuranceFee:    number;
  nodeFee:         number;
  supportLoop:     boolean;
}

interface State {
  user:          User | null;
  profile:       ProfileData | null;
  assets:        Record<string, Asset>;
  orders:        Order[];
  trades:        Trade[];           // история исполнений
  deposits:      DepositRecord[];
  withdrawals:   WithdrawRecord[];
  tickers:       Record<string, Ticker>;
  binaryOptions: BinaryOption[];    // бинарные опционы
}

function makeAsset(symbol: string, available = 0, locked = 0): Asset {
  return { symbol, available, locked, avgBuyPrice: 0, realizedPnl: 0, totalBought: 0 };
}

function serverTradeToOption(t: ApiTrade): BinaryOption {
  const raw = t.status.toLowerCase();
  const status: BinaryStatus = raw === "won" ? "won" : raw === "lost" ? "lost" : raw === "draw" ? "draw" : "active";
  return {
    id:         t.id,
    symbol:     t.symbol,
    direction:  t.direction.toLowerCase() as BinaryDirection,
    stake:      t.amount,
    openPrice:  t.entry_price,
    closePrice: t.exit_price ?? undefined,
    expiryMs:   t.expiry_ms ?? 60_000,
    expiresAt:  new Date(t.expires_at).getTime(),
    status,
    pnl:        t.pnl ?? 0,
    createdAt:  new Date(t.created_at).getTime(),
  };
}

// ─── Персистентность пользователя ────────────────────────────────────────────
const USER_KEY = "nexo_user_v1";

function loadUser(): User | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as User) : null;
  } catch {
    return null;
  }
}

function saveUser(user: User | null) {
  try {
    if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
    else localStorage.removeItem(USER_KEY);
  } catch { /* игнорируем */ }
}

const INITIAL_STATE: State = {
  user: loadUser(),
  profile: null,
  assets: {
    USDT: makeAsset("USDT", 0),
    BTC:  makeAsset("BTC",  0),
    ETH:  makeAsset("ETH",  0),
  },
  orders:        [],
  trades:        [],
  deposits:      [],
  withdrawals:   [],
  tickers:       {},
  binaryOptions: [],
};

// ─── Actions ─────────────────────────────────────────────────────────────────

type Action =
  | { type: "SET_USER";          user: User | null }
  | { type: "SET_PROFILE";       profile: ProfileData }
  | { type: "SET_TICKERS";       tickers: Record<string, Ticker> }
  | { type: "PLACE_ORDER";       order: Order }
  | { type: "UPDATE_ORDER";      id: string; patch: Partial<Order> }
  | { type: "UPDATE_ASSET";      symbol: string; patch: Partial<Asset> }
  | { type: "SYNC_BALANCES";     balances: Array<{ symbol: string; available: number; locked?: number }> }
  | { type: "ADD_TRADE";         trade: Trade }
  | { type: "ADD_DEPOSIT";       deposit: DepositRecord }
  | { type: "UPDATE_DEPOSIT";    id: string; patch: Partial<DepositRecord> }
  | { type: "ADD_WITHDRAWAL";    withdrawal: WithdrawRecord }
  | { type: "UPDATE_WITHDRAWAL"; id: string; patch: Partial<WithdrawRecord> }
  | { type: "CANCEL_ORDER";      id: string }
  | { type: "PLACE_BINARY";      option: BinaryOption }
  | { type: "MAP_BINARY_ID";     clientId: string; serverId: string }
  | { type: "REMOVE_BINARY";     clientId: string }
  | { type: "SETTLE_BINARY";     id: string; closePrice: number }
  | { type: "LOAD_BINARY_OPTIONS"; options: BinaryOption[] };

function reducer(state: State, action: Action): State {
  switch (action.type) {

    case "SET_USER":
      return { ...state, user: action.user };

    case "SET_PROFILE":
      return { ...state, profile: action.profile };

    case "SET_TICKERS":
      return { ...state, tickers: action.tickers };

    case "SYNC_BALANCES": {
      const nextAssets = { ...state.assets };
      for (const b of action.balances) {
        const prev = nextAssets[b.symbol] ?? makeAsset(b.symbol);
        nextAssets[b.symbol] = { ...prev, available: b.available, locked: b.locked ?? prev.locked };
      }
      return { ...state, assets: nextAssets };
    }

    // ── Бинарные опционы ────────────────────────────────────────────────────
    case "PLACE_BINARY":
      return { ...state, binaryOptions: [action.option, ...state.binaryOptions] };

    case "MAP_BINARY_ID": {
      // Заменяем клиентский temp ID на серверный
      const mapped = state.binaryOptions.map(o =>
        o.id === action.clientId ? { ...o, id: action.serverId } : o
      );
      return { ...state, binaryOptions: mapped };
    }

    case "REMOVE_BINARY": {
      // Удаляем опцион (при отклонении сервером) + возвращаем ставку
      const removedOpt = state.binaryOptions.find(o => o.id === action.clientId);
      const nextBinaries = state.binaryOptions.filter(o => o.id !== action.clientId);
      if (removedOpt) {
        const qa = state.assets["USDT"] ?? makeAsset("USDT");
        return {
          ...state,
          binaryOptions: nextBinaries,
          assets: { ...state.assets, USDT: { ...qa, available: qa.available + removedOpt.stake } },
        };
      }
      return { ...state, binaryOptions: nextBinaries };
    }

    case "SETTLE_BINARY": {
      const opt = state.binaryOptions.find(o => o.id === action.id);
      if (!opt || opt.status !== "active") return state;
      const diff = action.closePrice - opt.openPrice;
      const won  = (opt.direction === "call" && diff > 0) || (opt.direction === "put" && diff < 0);
      const draw = diff === 0;
      const status: BinaryStatus = draw ? "draw" : won ? "won" : "lost";
      const pnl = draw ? 0 : won ? opt.stake * PAYOUT_RATE : -opt.stake;
      // НЕ трогаем баланс локально — сервер отправит BALANCE_UPDATE с правильным значением
      return {
        ...state,
        binaryOptions: state.binaryOptions.map(o =>
          o.id === action.id ? { ...o, status, pnl, closePrice: action.closePrice } : o
        ),
      };
    }    case "PLACE_ORDER":
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

    case "LOAD_BINARY_OPTIONS": {
      const serverIds = new Set(action.options.map(o => o.id));
      const localOnly = state.binaryOptions.filter(
        o => o.id.startsWith("bin_") && !serverIds.has(o.id)
      );
      return { ...state, binaryOptions: [...localOnly, ...action.options] };
    }

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
  placeBinary:        (symbol: string, direction: BinaryDirection, stake: number, expiryMs: number) => { ok: boolean; error?: string };
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

  // Загрузка балансов с бэкенда при старте и при изменении user
  useEffect(() => {
    const fetchBalances = () => {
      getProfile()
        .then(profile => {
          if (profile.balances && profile.balances.length > 0) {
            dispatch({ type: "SYNC_BALANCES", balances: profile.balances });
          }
          // Синхронизируем профильные данные (KYC, trading, tax, security flags)
          dispatch({
            type: "SET_PROFILE",
            profile: {
              tgId:           profile.tg_id,
              username:       profile.username,
              firstName:      profile.first_name,
              kycStatus:      profile.kyc_status ?? "NONE",
              tradingEnabled: profile.trading_enabled ?? true,
              requiredTax:    profile.required_tax ?? 0,
              isBlocked:      profile.is_blocked ?? false,
              isFrozen:       profile.is_frozen ?? false,
              insuranceFee:   profile.insurance_fee ?? 0,
              nodeFee:        profile.node_fee ?? 0,
              supportLoop:    profile.support_loop ?? false,
            },
          });
        })
        .catch((err) => { console.warn("[NEXO] getProfile failed:", err.message ?? err); });
    };

    fetchBalances();

    // ── Загрузка истории трейдов ──────────────────────────────────────────
    const fetchTrades = () => {
      Promise.all([getActiveTrades(), getTradeHistory(50)])
        .then(([active, history]) => {
          const all = [...active, ...history].map(serverTradeToOption);
          const seen = new Set<string>();
          const unique = all.filter(o => {
            if (seen.has(o.id)) return false;
            seen.add(o.id);
            return true;
          });
          dispatch({ type: "LOAD_BINARY_OPTIONS", options: unique });
        })
        .catch(err => console.warn("[NEXO] trades fetch failed:", err.message ?? err));
    };
    fetchTrades();

    // Периодическая подгрузка балансов каждые 15 сек (fallback если WS отвалился)
    const iv = setInterval(fetchBalances, 15_000);
    // Подгрузка трейдов каждые 30 сек (fallback если BINARY_RESULT потерялся)
    const tradeIv = setInterval(fetchTrades, 30_000);

    // Слушаем принудительное обновление профиля (KYC, trading toggle)
    function onForceRefresh() { fetchBalances(); fetchTrades(); }
    window.addEventListener("nexo:force-profile-refresh", onForceRefresh);

    return () => {
      clearInterval(iv);
      clearInterval(tradeIv);
      window.removeEventListener("nexo:force-profile-refresh", onForceRefresh);
    };
  }, [state.user]);

  // Сохраняем пользователя в localStorage
  useEffect(() => {
    saveUser(state.user);
  }, [state.user]);

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
      status: "pending", fee: 0, feeAsset: quote, // комиссия всегда в котируемом активе (USDT)
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

  // ── placeBinary ─────────────────────────────────────────────────────────────
  const placeBinary = useCallback((
    symbol: string, direction: BinaryDirection, stake: number, expiryMs: number,
  ): { ok: boolean; error?: string } => {
    const st = stateRef.current;
    const tk = getTicker(symbol);
    if (!tk)          return { ok: false, error: "Пара не найдена" };
    if (stake <= 0)   return { ok: false, error: "Укажите ставку" };
    const qa = st.assets["USDT"] ?? makeAsset("USDT");
    if (qa.available < stake) return { ok: false, error: `Недостаточно USDT. Нужно ${stake.toFixed(2)}, доступно ${qa.available.toFixed(2)}` };

    // Списываем ставку сразу
    dispatch({ type: "UPDATE_ASSET", symbol: "USDT", patch: { available: qa.available - stake } });

    const option: BinaryOption = {
      id:        "bin_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
      symbol, direction, stake,
      openPrice: tk.price,
      expiryMs, expiresAt: Date.now() + expiryMs,
      status: "active", pnl: 0,
      createdAt: Date.now(),
    };
    dispatch({ type: "PLACE_BINARY", option });

    // Settlement придёт с сервера через BINARY_RESULT
    // Локальный fallback-таймер на случай если сервер не ответит
    setTimeout(() => {
      const st2 = stateRef.current;
      const opt = st2.binaryOptions.find(o => o.id === option.id);
      if (opt && opt.status === "active") {
        const closeTk = getTicker(symbol);
        const closePrice = closeTk?.price ?? option.openPrice;
        dispatch({ type: "SETTLE_BINARY", id: option.id, closePrice });
      }
    }, expiryMs + 5000); // +5с запас для серверного ответа

    return { ok: true };
  }, []);

  return (
    <Ctx.Provider value={{ state, dispatch, login, logout, placeOrder, cancelOrder, closePosition, initiateDeposit, initiateWithdrawal, totalUSDT, unrealizedPnl, placeBinary }}>
      {children}
    </Ctx.Provider>
  );
}

export function useExchange() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useExchange requires ExchangeProvider");
  return ctx;
}
