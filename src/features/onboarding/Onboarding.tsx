import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useExchange } from "../../shared/store/exchangeStore";

type Step = "email" | "otp";

// Генерируем mock OTP локально
function genOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

export function Onboarding() {
  const { login } = useExchange();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [mockCode, setMockCode] = useState("");
  const [timer, setTimer] = useState(0);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Таймер обратный отсчёт
  useEffect(() => {
    if (timer <= 0) return;
    const id = setInterval(() => setTimer((t) => t - 1), 1000);
    return () => clearInterval(id);
  }, [timer]);

  const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  function handleSendOTP() {
    if (!isValidEmail) return;
    setLoading(true);
    setTimeout(() => {
      const code = genOTP();
      setMockCode(code);
      console.info(`[NEXO OTP] Код для ${email}: ${code}`); // mock — показываем в консоли
      setStep("otp");
      setTimer(30);
      setLoading(false);
      setTimeout(() => inputRefs.current[0]?.focus(), 100);
    }, 800);
  }

  function handleOtpChange(idx: number, val: string) {
    const digit = val.replace(/\D/, "").slice(-1);
    const next = [...otp];
    next[idx] = digit;
    setOtp(next);
    setError("");
    if (digit && idx < 5) {
      inputRefs.current[idx + 1]?.focus();
    }
    // Автоподтверждение когда все 6 введены
    if (next.every((d) => d !== "") && digit) {
      const entered = next.join("");
      validateOTP(entered);
    }
  }

  function handleOtpKey(idx: number, e: React.KeyboardEvent) {
    if (e.key === "Backspace" && !otp[idx] && idx > 0) {
      inputRefs.current[idx - 1]?.focus();
    }
  }

  function validateOTP(entered: string) {
    if (entered === mockCode) {
      setLoading(true);
      setTimeout(() => {
        login(email);
      }, 400);
    } else {
      setError("Неверный код");
      setOtp(["", "", "", "", "", ""]);
      setTimeout(() => inputRefs.current[0]?.focus(), 50);
    }
  }

  function handleConfirm() {
    const entered = otp.join("");
    if (entered.length < 6) { setError("Введите полный код"); return; }
    validateOTP(entered);
  }

  function handleResend() {
    if (timer > 0) return;
    const code = genOTP();
    setMockCode(code);
    console.info(`[NEXO OTP] Новый код для ${email}: ${code}`);
    setOtp(["", "", "", "", "", ""]);
    setTimer(30);
    setError("");
    setTimeout(() => inputRefs.current[0]?.focus(), 100);
  }

  return (
    <div style={{
      minHeight: "100dvh",
      background: "var(--bg-0)",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: "24px 20px",
    }}>
      {/* Лого */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: EASE }}
        style={{ marginBottom: 40, textAlign: "center" }}
      >
        <div style={{
          width: 56, height: 56, borderRadius: 16,
          background: "linear-gradient(135deg, var(--accent) 0%, #2D7FCC 100%)",
          display: "flex", alignItems: "center", justifyContent: "center",
          margin: "0 auto 12px",
          boxShadow: "0 8px 24px rgba(77,163,255,0.28)",
        }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none"
            stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
          </svg>
        </div>
        <div style={{ fontSize: 22, fontWeight: 700, color: "var(--text-1)" }}>NEXO</div>
        <div style={{ fontSize: 12, color: "var(--text-3)", marginTop: 2 }}>Криптобиржа</div>
      </motion.div>

      {/* Форма */}
      <AnimatePresence mode="wait">
        {step === "email" ? (
          <motion.div
            key="email"
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }}
            transition={{ duration: 0.22, ease: EASE }}
            style={{ width: "100%", maxWidth: 340 }}
          >
            <div style={{
              background: "var(--surface-1)", borderRadius: "var(--r-lg)",
              padding: "24px 20px", boxShadow: "var(--shadow-card)",
              border: "1px solid var(--line-1)",
            }}>
              <h2 style={{ margin: "0 0 6px", fontSize: 18, fontWeight: 700, color: "var(--text-1)" }}>
                Войти в NEXO
              </h2>
              <p style={{ margin: "0 0 20px", fontSize: 13, color: "var(--text-2)" }}>
                Введите email для входа или регистрации
              </p>

              <label style={{ display: "block", marginBottom: 12 }}>
                <div style={{ fontSize: 12, color: "var(--text-3)", marginBottom: 6 }}>Email</div>
                <input
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setError(""); }}
                  onKeyDown={(e) => e.key === "Enter" && isValidEmail && handleSendOTP()}
                  autoFocus
                  style={{
                    width: "100%", padding: "11px 14px",
                    background: "var(--surface-2)", border: "1px solid var(--line-2)",
                    borderRadius: "var(--r-md)", color: "var(--text-1)",
                    fontSize: 15, outline: "none",
                    transition: "border-color var(--dur-fast)",
                  }}
                />
              </label>

              <button
                onClick={handleSendOTP}
                disabled={!isValidEmail || loading}
                style={{
                  width: "100%", padding: "13px",
                  background: isValidEmail && !loading ? "var(--accent)" : "var(--surface-3)",
                  border: "none", borderRadius: "var(--r-md)",
                  color: isValidEmail && !loading ? "#fff" : "var(--text-4)",
                  fontSize: 15, fontWeight: 600, cursor: isValidEmail ? "pointer" : "not-allowed",
                  transition: "all var(--dur-fast) var(--ease-out)",
                }}
              >
                {loading ? "Отправляем..." : "Получить код"}
              </button>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="otp"
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }}
            transition={{ duration: 0.22, ease: EASE }}
            style={{ width: "100%", maxWidth: 340 }}
          >
            <div style={{
              background: "var(--surface-1)", borderRadius: "var(--r-lg)",
              padding: "24px 20px", boxShadow: "var(--shadow-card)",
              border: "1px solid var(--line-1)",
            }}>
              <button
                onClick={() => { setStep("email"); setOtp(["","","","","",""]); setError(""); }}
                style={{
                  background: "none", border: "none", color: "var(--text-3)",
                  fontSize: 13, cursor: "pointer", padding: 0, marginBottom: 12,
                  display: "flex", alignItems: "center", gap: 4,
                }}
              >
                ← Назад
              </button>

              <h2 style={{ margin: "0 0 6px", fontSize: 18, fontWeight: 700, color: "var(--text-1)" }}>
                Код подтверждения
              </h2>
              <p style={{ margin: "0 0 20px", fontSize: 13, color: "var(--text-2)" }}>
                Код отправлен на <span style={{ color: "var(--accent)" }}>{email}</span>
              </p>

              {/* OTP inputs */}
              <div style={{ display: "flex", gap: 8, justifyContent: "center", marginBottom: 16 }}>
                {otp.map((digit, i) => (
                  <input
                    key={i}
                    ref={(el) => { inputRefs.current[i] = el; }}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleOtpChange(i, e.target.value)}
                    onKeyDown={(e) => handleOtpKey(i, e)}
                    style={{
                      width: 44, height: 52, textAlign: "center",
                      background: "var(--surface-2)",
                      border: `1px solid ${error ? "var(--neg)" : digit ? "var(--accent-border)" : "var(--line-2)"}`,
                      borderRadius: "var(--r-md)", color: "var(--text-1)",
                      fontSize: 22, fontWeight: 700, outline: "none",
                      transition: "border-color var(--dur-fast)",
                    }}
                  />
                ))}
              </div>

              {error && (
                <div style={{ color: "var(--neg)", fontSize: 12, textAlign: "center", marginBottom: 12 }}>
                  {error}
                </div>
              )}

              <button
                onClick={handleConfirm}
                disabled={otp.some((d) => !d) || loading}
                style={{
                  width: "100%", padding: "13px",
                  background: otp.every((d) => d) ? "var(--accent)" : "var(--surface-3)",
                  border: "none", borderRadius: "var(--r-md)",
                  color: otp.every((d) => d) ? "#fff" : "var(--text-4)",
                  fontSize: 15, fontWeight: 600,
                  cursor: otp.every((d) => d) ? "pointer" : "not-allowed",
                  marginBottom: 14,
                  transition: "all var(--dur-fast) var(--ease-out)",
                }}
              >
                {loading ? "Проверяем..." : "Войти"}
              </button>

              {/* Resend */}
              <div style={{ textAlign: "center" }}>
                {timer > 0 ? (
                  <span style={{ fontSize: 13, color: "var(--text-3)" }}>
                    Повторно через {timer}с
                  </span>
                ) : (
                  <button
                    onClick={handleResend}
                    style={{
                      background: "none", border: "none",
                      color: "var(--accent)", fontSize: 13,
                      cursor: "pointer", padding: 0,
                    }}
                  >
                    Отправить повторно
                  </button>
                )}
              </div>

              {/* Подсказка для dev */}
              <div style={{
                marginTop: 16, padding: "8px 12px",
                background: "var(--warn-dim)", borderRadius: "var(--r-sm)",
                border: "1px solid var(--warn)",
                fontSize: 11, color: "var(--warn)", textAlign: "center",
              }}>
                Demo: код в консоли браузера (F12)
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
