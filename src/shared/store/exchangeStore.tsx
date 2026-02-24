import React, {
  createContext, useContext, useReducer, useCallback, useEffect, useRef,
} from "react";
import { subscribeTickers, getTicker } from "./mockEngine";
import type { Ticker } from "./mockEngine";

// ─── Типы ────────────────────────────────────────────────────────────────────

export type OrderSide = "buy" | "sell";
export type OrderType = "market" | "limit";
export type OrderStatus =
  | "pending"
  | "queued"
  | "partial"
  | "filled"
  | "cancelled"
  | "rejected";

export interface Order {
  id: string;
  symbol: string;
  side: OrderSide;
  type: OrderType;
  price: number;       // для лимитных; для маркетных — цена исполнения
  qty: number;
  filledQty: number;
  status: OrderStatus;
  fee: number;
  feeAsset: string;
  createdAt: number;
  updatedAt: number;
}

export interface Asset {
  symbol: string;
  available: number;
  locked: number;     // в ордерах
}

export interface DepositRecord {
  id: string;
  asset: string;
  amount: number;
  address: string;
  status: "pending" | "confirming" | "credited";
  confirmations: number;
  requiredConfirmations: number;
  createdAt: number;
}

export interface WithdrawRecord {
  id: string;
  asset: string;
  amount: number;
  address: string;
  fee: number;
  status: "pending" | "processing" | "sent" | "failed";
  createdAt: number;
  txHash?: string;
}

export interface User {
  email: string;
  emailVerified: boolean;
  uid: string;
  level: 1 | 2 | 3;    // уровень верификации
}

// ─── Начальное состояние ─────────────────────────────────────────────────────

interface State {
  user: User | null;
  assets: Record<string, Asset>;
  orders: Order[];
  deposits: DepositRecord[];
  withdrawals: WithdrawRecord[];
  tickers: Record<string, Ticker>;
}

const INITIAL_STATE: State = {
  user: null,
  assets: {
    USDT: { symbol: "USDT", available: 10_000, locked: 0 },
    BTC:  { symbol: "BTC",  available: 0.025,  locked: 0 },
    ETH:  { symbol: "ETH",  available: 0.5,    locked: 0 },
    SOL:  { symbol: "SOL",  available: 5,      locked: 0 },
    BNB:  { symbol: "BNB",  available: 0,      locked: 0 },
  },
  orders: [],
  deposits: [],
  withdrawals: [],
  tickers: {},
};

// ─── Actions ─────────────────────────────────────────────────────────────────

type Action =
  | { type: "SET_USER"; user: User | null }
  | { type: "SET_TICKERS"; tickers: Record<string, Ticker> }
  | { type: "PLACE_ORDER"; order: Order }
  | { type: "UPDATE_ORDER"; id: string; patch: Partial<Order> }
  | { type: "UPDATE_ASSET"; symbol: string; patch: Partial<Asset> }
  | { type: "ADD_DEPOSIT"; deposit: DepositRecord }
  | { type: "UPDATE_DEPOSIT"; id: string; patch: Partial<DepositRecord> }
  | { type: "ADD_WITHDRAWAL"; withdrawal: WithdrawRecord }
  | { type: "UPDATE_WITHDRAWAL"; id: string; patch: Partial<WithdrawRecord> }
  | { type: "CANCEL_ORDER"; id: string };

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
        orders: state.orders.map((o) =>
          o.id === action.id ? { ...o, ...action.patch, updatedAt: Date.now() } : o
        ),
      };

    case "CANCEL_ORDER": {
      const order = state.orders.find((o) => o.id === action.id);
      if (!order || order.status !== "queued") return state;
      const symParts = order.symbol.split("/");
      const base = symParts[0] ?? "";
      const quote = symParts[1] ?? "USDT";
      const assetKey = order.side === "buy" ? quote : base;
      const unlockAmt = order.side === "buy"
        ? (order.qty - order.filledQty) * order.price
        : (order.qty - order.filledQty);
      const asset = state.assets[assetKey] ?? { symbol: assetKey, available: 0, locked: 0 };
      return {
        ...state,
        orders: state.orders.map((o) =>
          o.id === action.id ? { ...o, status: "cancelled" as OrderStatus, updatedAt: Date.now() } : o
        ),
        assets: {
          ...state.assets,
          [assetKey]: {
            ...asset,
            available: asset.available + unlockAmt,
            locked: Math.max(0, asset.locked - unlockAmt),
          },
        },
      };
    }

    case "UPDATE_ASSET": {
      const prev = state.assets[action.symbol] ?? { symbol: action.symbol, available: 0, locked: 0 };
      return {
        ...state,
        assets: { ...state.assets, [action.symbol]: { ...prev, ...action.patch } },
      };
    }

    case "ADD_DEPOSIT":
      return { ...state, deposits: [action.deposit, ...state.deposits] };

    case "UPDATE_DEPOSIT":
      return {
        ...state,
        deposits: state.deposits.map((d) =>
          d.id === action.id ? { ...d, ...action.patch } : d
        ),
      };

    case "ADD_WITHDRAWAL":
      return { ...state, withdrawals: [action.withdrawal, ...state.withdrawals] };

    case "UPDATE_WITHDRAWAL":
      return {
        ...state,
        withdrawals: state.withdrawals.map((w) =>
          w.id === action.id ? { ...w, ...action.patch } : w
        ),
      };

    default:
      return state;
  }
}

// ─── Context ─────────────────────────────────────────────────────────────────

interface ExchangeCtx {
  state: State;
  dispatch: React.Dispatch<Action>;
  // Хелперы
  login: (email: string) => void;
  logout: () => void;
  placeOrder: (
    symbol: string,
    side: OrderSide,
    orderType: OrderType,
    qty: number,
    limitPrice?: number
  ) => { ok: boolean; error?: string; order?: Order };
  cancelOrder: (id: string) => void;
  initiateDeposit: (asset: string) => DepositRecord;
  initiateWithdrawal: (asset: string, amount: number, address: string) => { ok: boolean; error?: string };
  totalUSDT: () => number;
}

const Ctx = createContext<ExchangeCtx | null>(null);

// ─── Provider ────────────────────────────────────────────────────────────────

export function ExchangeProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, INITIAL_STATE);
  const stateRef = useRef(state);
  stateRef.current = state;

  // Подписка на тикеры
  useEffect(() => {
    const unsub = subscribeTickers((tickers) => {
      dispatch({ type: "SET_TICKERS", tickers });
    });
    return () => { unsub(); };
  }, []);

  // Симуляция исполнения лимитных ордеров
  useEffect(() => {
    const iv = setInterval(() => {
      const st = stateRef.current;
      st.orders
        .filter((o) => o.status === "queued" && o.type === "limit")
        .forEach((order) => {
          const tk = getTicker(order.symbol);
          if (!tk) return;
          const shouldFill =
            order.side === "buy" ? tk.ask <= order.price
            : tk.bid >= order.price;
          if (shouldFill) {
            const symParts2 = order.symbol.split("/");
            const base = symParts2[0] ?? "";
            const quote = symParts2[1] ?? "USDT";
            // Частичное или полное исполнение
            const fillFrac = Math.random() > 0.4 ? 1 : Math.random() * 0.8 + 0.1;
            const addFilled = (order.qty - order.filledQty) * fillFrac;
            const newFilled = order.filledQty + addFilled;
            const isFull = newFilled >= order.qty * 0.999;
            const fee = addFilled * order.price * 0.0006; // maker 0.06%

            dispatch({ type: "UPDATE_ORDER", id: order.id, patch: {
              filledQty: isFull ? order.qty : newFilled,
              status: isFull ? "filled" : "partial",
              fee: order.fee + fee,
            }});

            // Зачислить купленный актив
            if (order.side === "buy") {
              const prev = st.assets[base] ?? { symbol: base, available: 0, locked: 0 };
              dispatch({ type: "UPDATE_ASSET", symbol: base, patch: {
                available: prev.available + addFilled,
              }});
              // Разблокировать потраченный USDT
              const quoteAsset = st.assets[quote] ?? { symbol: quote, available: 0, locked: 0 };
              dispatch({ type: "UPDATE_ASSET", symbol: quote, patch: {
                locked: Math.max(0, quoteAsset.locked - addFilled * order.price - fee),
              }});
            } else {
              // Зачислить USDT
              const quoteAsset = st.assets[quote] ?? { symbol: quote, available: 0, locked: 0 };
              dispatch({ type: "UPDATE_ASSET", symbol: quote, patch: {
                available: quoteAsset.available + addFilled * order.price - fee,
              }});
              // Разблокировать базовый актив
              const baseAsset = st.assets[base] ?? { symbol: base, available: 0, locked: 0 };
              dispatch({ type: "UPDATE_ASSET", symbol: base, patch: {
                locked: Math.max(0, baseAsset.locked - addFilled),
              }});
            }
          }
        });
    }, 1500);
    return () => clearInterval(iv);
  }, []);

  // ─── login ──────────────────────────────────────────────────────────────────
  const login = useCallback((email: string) => {
    dispatch({
      type: "SET_USER",
      user: {
        email,
        emailVerified: true,
        uid: "u_" + Math.random().toString(36).slice(2, 10),
        level: 2,
      },
    });
  }, []);

  const logout = useCallback(() => {
    dispatch({ type: "SET_USER", user: null });
  }, []);

  // ─── placeOrder ─────────────────────────────────────────────────────────────
  const placeOrder = useCallback((
    symbol: string,
    side: OrderSide,
    orderType: OrderType,
    qty: number,
    limitPrice?: number,
  ): { ok: boolean; error?: string; order?: Order } => {
    const st = stateRef.current;
    const tk = getTicker(symbol);
    if (!tk) return { ok: false, error: "Пара не найдена" };

    const execPrice = orderType === "market"
      ? (side === "buy" ? tk.ask * (1 + 0.001) : tk.bid * (1 - 0.001))
      : (limitPrice ?? tk.price);

    const symParts3 = symbol.split("/");
    const base = symParts3[0] ?? "";
    const quote = symParts3[1] ?? "USDT";

    // Проверка баланса
    if (side === "buy") {
      const cost = qty * execPrice;
      const feeEst = cost * 0.001;
      const quoteAsset = st.assets[quote] ?? { symbol: quote, available: 0, locked: 0 };
      if (quoteAsset.available < cost + feeEst) {
        return { ok: false, error: `Недостаточно ${quote}` };
      }
    } else {
      const baseAsset = st.assets[base] ?? { symbol: base, available: 0, locked: 0 };
      if (baseAsset.available < qty) {
        return { ok: false, error: `Недостаточно ${base}` };
      }
    }

    // Блокировка средств
    if (side === "buy") {
      const lock = qty * execPrice * 1.001;
      const quoteAsset = st.assets[quote]!;
      dispatch({ type: "UPDATE_ASSET", symbol: quote, patch: {
        available: quoteAsset.available - lock,
        locked: quoteAsset.locked + lock,
      }});
    } else {
      const baseAsset = st.assets[base]!;
      dispatch({ type: "UPDATE_ASSET", symbol: base, patch: {
        available: baseAsset.available - qty,
        locked: baseAsset.locked + qty,
      }});
    }

    const order: Order = {
      id: "ord_" + Date.now().toString(36),
      symbol, side, type: orderType,
      price: execPrice,
      qty, filledQty: 0,
      status: "pending",
      fee: 0,
      feeAsset: side === "buy" ? (base || quote) : (quote || base),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    dispatch({ type: "PLACE_ORDER", order });

    // Маркет — немедленное исполнение
    if (orderType === "market") {
      const fee = qty * execPrice * 0.001; // taker 0.10%
      setTimeout(() => {
        dispatch({ type: "UPDATE_ORDER", id: order.id, patch: {
          status: "filled",
          filledQty: qty,
          fee,
        }});
        if (side === "buy") {
          const prevBase = stateRef.current.assets[base] ?? { symbol: base, available: 0, locked: 0 };
          dispatch({ type: "UPDATE_ASSET", symbol: base, patch: {
            available: prevBase.available + qty,
          }});
          const quoteAsset = stateRef.current.assets[quote]!;
          dispatch({ type: "UPDATE_ASSET", symbol: quote, patch: {
            locked: Math.max(0, quoteAsset.locked - qty * execPrice * 1.001),
          }});
        } else {
          const prevQuote = stateRef.current.assets[quote] ?? { symbol: quote, available: 0, locked: 0 };
          dispatch({ type: "UPDATE_ASSET", symbol: quote, patch: {
            available: prevQuote.available + qty * execPrice - fee,
          }});
          const baseAsset = stateRef.current.assets[base]!;
          dispatch({ type: "UPDATE_ASSET", symbol: base, patch: {
            locked: Math.max(0, baseAsset.locked - qty),
          }});
        }
      }, 400);
    } else {
      // Лимит: перевести в queued
      setTimeout(() => {
        dispatch({ type: "UPDATE_ORDER", id: order.id, patch: { status: "queued" } });
      }, 300);
    }

    return { ok: true, order };
  }, []);

  // ─── cancelOrder ────────────────────────────────────────────────────────────
  const cancelOrder = useCallback((id: string) => {
    dispatch({ type: "CANCEL_ORDER", id });
  }, []);

  // ─── initiateDeposit ────────────────────────────────────────────────────────
  const initiateDeposit = useCallback((asset: string): DepositRecord => {
    const mockAddrs: Record<string, string> = {
      USDT: "TKxXn9QaVZKgijXi2bq5JGp2RHj1XBdGQL",
      BTC:  "bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh",
      ETH:  "0x71C7656EC7ab88b098defB751B7401B5f6d8976F",
      SOL:  "7EcDhSYGxXyscszYEp35KHN8vvw3svAuLKTzXwCFLtV",
      BNB:  "bnb136ns6lfw4zs5hg4n85vdthaad7hq5m4gtkgf23",
    };

    const deposit: DepositRecord = {
      id: "dep_" + Date.now().toString(36),
      asset,
      amount: 0,
      address: mockAddrs[asset] ?? "mock_addr_" + asset,
      status: "pending",
      confirmations: 0,
      requiredConfirmations: asset === "BTC" ? 3 : 12,
      createdAt: Date.now(),
    };

    dispatch({ type: "ADD_DEPOSIT", deposit });

    // Симуляция подтверждений
    let conf = 0;
    const req = deposit.requiredConfirmations;
    const iv = setInterval(() => {
      conf++;
      const mockAmount = asset === "USDT" ? 1000 : asset === "BTC" ? 0.01 : 0.5;
      dispatch({
        type: "UPDATE_DEPOSIT",
        id: deposit.id,
        patch: {
          confirmations: conf,
          amount: mockAmount,
          status: conf >= req ? "credited" : "confirming",
        },
      });
      if (conf >= req) {
        clearInterval(iv);
        // Зачислить баланс
        const prev = stateRef.current.assets[asset] ?? { symbol: asset, available: 0, locked: 0 };
        dispatch({ type: "UPDATE_ASSET", symbol: asset, patch: {
          available: prev.available + mockAmount,
        }});
      }
    }, 4000);

    return deposit;
  }, []);

  // ─── initiateWithdrawal ─────────────────────────────────────────────────────
  const initiateWithdrawal = useCallback((
    asset: string,
    amount: number,
    address: string,
  ): { ok: boolean; error?: string } => {
    const st = stateRef.current;
    if (!st.user?.emailVerified) return { ok: false, error: "Подтвердите email" };
    const a = st.assets[asset];
    const fee = asset === "BTC" ? 0.0002 : asset === "ETH" ? 0.003 : 1;
    if (!a || a.available < amount + fee) return { ok: false, error: `Недостаточно ${asset}` };
    if (amount <= 0) return { ok: false, error: "Укажите сумму" };

    // Списать баланс
    dispatch({ type: "UPDATE_ASSET", symbol: asset, patch: {
      available: a.available - amount - fee,
    }});

    const rec: WithdrawRecord = {
      id: "wdr_" + Date.now().toString(36),
      asset, amount, address, fee,
      status: "pending",
      createdAt: Date.now(),
    };
    dispatch({ type: "ADD_WITHDRAWAL", rec } as unknown as Action);
    dispatch({ type: "ADD_WITHDRAWAL", withdrawal: rec });

    // Симуляция processing → sent
    setTimeout(() => dispatch({ type: "UPDATE_WITHDRAWAL", id: rec.id, patch: { status: "processing" } }), 2000);
    setTimeout(() => dispatch({ type: "UPDATE_WITHDRAWAL", id: rec.id, patch: { status: "sent", txHash: "0x" + Math.random().toString(16).slice(2, 18) } }), 8000);

    return { ok: true };
  }, []);

  // ─── totalUSDT ──────────────────────────────────────────────────────────────
  const totalUSDT = useCallback((): number => {
    const st = stateRef.current;
    let total = 0;
    for (const [sym, asset] of Object.entries(st.assets)) {
      const bal = asset.available + asset.locked;
      if (sym === "USDT") { total += bal; continue; }
      const tk = st.tickers[`${sym}/USDT`];
      if (tk) total += bal * tk.price;
    }
    return total;
  }, []);

  return (
    <Ctx.Provider value={{ state, dispatch, login, logout, placeOrder, cancelOrder, initiateDeposit, initiateWithdrawal, totalUSDT }}>
      {children}
    </Ctx.Provider>
  );
}

export function useExchange() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useExchange requires ExchangeProvider");
  return ctx;
}
