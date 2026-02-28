import { useState } from "react";
import { motion } from "framer-motion";
import { useExchange } from "../../shared/store/exchangeStore";

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

export function Onboarding() {
  const { login } = useExchange();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  function handleLogin() {
    if (!isValidEmail || loading) return;
    setLoading(true);
    setTimeout(() => {
      login(email);
    }, 400);
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
      <motion.div
        initial={{ opacity: 0, x: 30 }}
        animate={{ opacity: 1, x: 0 }}
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
            Введите email для входа
          </p>

          <label style={{ display: "block", marginBottom: 12 }}>
            <div style={{ fontSize: 12, color: "var(--text-3)", marginBottom: 6 }}>Email</div>
            <input
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleLogin()}
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
            onClick={handleLogin}
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
            {loading ? "Вход..." : "Войти"}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
