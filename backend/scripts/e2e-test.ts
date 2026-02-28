/**
 * E2E Test Scenario — Полный цикл лида.
 *
 * Симулирует:
 *   1. Регистрация через deep link (invite code)
 *   2. Пополнение (deposit)
 *   3. Rigged trade — FORCE_LOSS
 *   4. Отправка сообщения в поддержку
 *   5. Withdrawal trap (отклонение вывода)
 *   6. Проверка event log
 *
 * Запуск:
 *   npx ts-node --esm scripts/e2e-test.ts
 *
 * Требует запущенный backend на localhost:3000
 */

const API = process.env.API_URL ?? "http://localhost:3000/api/v1";

// Фейковый initData для тестового юзера
const TEST_TG_ID = "999999999";
const FAKE_INIT_DATA = (() => {
  // В dev-режиме auth middleware принимает X-Dev-Tg-Id
  return "";
})();

const headers: Record<string, string> = {
  "Content-Type": "application/json",
  "X-Dev-Tg-Id": TEST_TG_ID,
};

async function req<T = unknown>(
  method: string,
  path: string,
  body?: unknown,
): Promise<{ status: number; data: T }> {
  const res = await fetch(`${API}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({})) as T;
  return { status: res.status, data };
}

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`  ❌ FAIL: ${msg}`);
    process.exitCode = 1;
  } else {
    console.log(`  ✅ PASS: ${msg}`);
  }
}

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ─── Тесты ───────────────────────────────────────────────────────────────────

async function main() {
  console.log("\n╔══════════════════════════════════════════════╗");
  console.log("║          NEXO E2E Test Scenario              ║");
  console.log("╚══════════════════════════════════════════════╝\n");

  // 1. ПРОФИЛЬ
  console.log("─── 1. Получение профиля ───");
  const profile = await req<{ id: string; tg_id: string; balances: Array<{ symbol: string; available: number }> }>("GET", "/user/profile");
  assert(profile.status === 200, `GET /user/profile → ${profile.status}`);
  assert(!!profile.data.id, `User ID: ${profile.data.id}`);
  const userId = profile.data.id;
  console.log(`  → User: ${userId}, tg_id: ${profile.data.tg_id}`);

  // 2. ДЕПОЗИТ
  console.log("\n─── 2. Запрос депозита ───");
  const dep = await req<{ ok: boolean; address?: string; txId?: string }>("POST", "/finance/deposit", {
    amount: 1000,
    symbol: "USDT",
  });
  assert(dep.status === 200 || dep.status === 201, `POST /finance/deposit → ${dep.status}`);
  console.log(`  → Deposit: ${JSON.stringify(dep.data)}`);

  // Подтверждение депозита (если есть txId)
  if (dep.data.txId) {
    const confirm = await req("POST", "/finance/deposit/confirm", { txId: dep.data.txId });
    console.log(`  → Confirm: ${confirm.status}`);
  }

  await sleep(500);

  // 3. РАЗМЕЩЕНИЕ СДЕЛКИ
  console.log("\n─── 3. Binary Trade (ожидаем FORCE_LOSS) ───");
  const trade = await req<{ ok: boolean; tradeId?: string; error?: string }>("POST", "/trade/place", {
    symbol: "BTC/USDT",
    direction: "CALL",
    amount: 100,
    entryPrice: 65000,
    expiryMs: 5000,
  });
  assert(trade.status === 200 || trade.status === 201, `POST /trade/place → ${trade.status}`);
  console.log(`  → Trade: ${JSON.stringify(trade.data)}`);

  // Ждём экспирации
  console.log("  ⏳ Ждём 6 сек для экспирации...");
  await sleep(6000);

  // Проверяем историю
  const history = await req<Array<{ id: string; status: string; pnl: number }>>("GET", "/trade/history?limit=5");
  assert(history.status === 200, `GET /trade/history → ${history.status}`);
  if (Array.isArray(history.data) && history.data.length > 0) {
    const last = history.data[0];
    console.log(`  → Последняя сделка: status=${last?.status}, pnl=${last?.pnl}`);
  }

  // 4. СООБЩЕНИЕ В ПОДДЕРЖКУ
  console.log("\n─── 4. Support Message ───");
  const msg = await req<{ ok: boolean }>("POST", "/user/messages", {
    text: "Здравствуйте! У меня вопрос по выводу средств.",
  });
  assert(msg.status === 200 || msg.status === 201, `POST /user/messages → ${msg.status}`);

  // Получаем сообщения
  const msgs = await req<Array<{ id: string; text: string }>>("GET", "/user/messages");
  assert(msgs.status === 200, `GET /user/messages → ${msgs.status}`);
  console.log(`  → Сообщений: ${Array.isArray(msgs.data) ? msgs.data.length : "?"}`);

  // 5. ВЫВОД (ожидаем потенциальное отклонение)
  console.log("\n─── 5. Withdrawal Request ───");
  const withdraw = await req<{ ok: boolean; txId?: string; error?: string }>("POST", "/finance/withdraw", {
    amount: 500,
    symbol: "USDT",
    address: "TKxXn9QaVZKgijXi2bq5JGp2RHj1XBdGQL",
    network: "TRC20",
  });
  console.log(`  → Withdraw: status=${withdraw.status}, data=${JSON.stringify(withdraw.data)}`);

  // 6. ЛОГИРОВАНИЕ СОБЫТИЙ
  console.log("\n─── 6. Event Logging ───");
  const ev = await req("POST", "/user/event", {
    event: "E2E_TEST_COMPLETE",
    meta: { ts: Date.now(), test: true },
  });
  assert(ev.status === 200 || ev.status === 201, `POST /user/event → ${ev.status}`);

  // 7. ТРАНЗАКЦИИ
  console.log("\n─── 7. Transactions ───");
  const txs = await req<unknown[]>("GET", "/user/transactions?limit=10");
  assert(txs.status === 200, `GET /user/transactions → ${txs.status}`);
  console.log(`  → Транзакций: ${Array.isArray(txs.data) ? txs.data.length : "?"}`);

  // ─── Итог ──────────────────────────────────────────────────────────────────
  console.log("\n══════════════════════════════════════════════");
  console.log(process.exitCode ? "  ⚠️  SOME TESTS FAILED" : "  🎉 ALL TESTS PASSED");
  console.log("══════════════════════════════════════════════\n");
}

main().catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});
