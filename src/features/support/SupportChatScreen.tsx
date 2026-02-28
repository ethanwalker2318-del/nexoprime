/**
 * SupportChatScreen — чат лида с его менеджером (closer).
 *
 * Сообщения хранятся на сервере (SupportMessage).
 * Реалтайм: NEW_SUPPORT_MESSAGE через Socket.io.
 * API: GET /user/messages, POST /user/messages
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import { useRouter } from "../../app/providers/RouterProvider";
import { api } from "../../shared/api/client";

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

interface ChatMessage {
  id:         string;
  sender:     "USER" | "ADMIN" | "CLOSER";
  text:       string;
  created_at: string;
}

export function SupportChatScreen() {
  const { navigate } = useRouter();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput]       = useState("");
  const [loading, setLoading]   = useState(true);
  const [sending, setSending]   = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Загрузка истории
  useEffect(() => {
    let mounted = true;
    api.get<ChatMessage[]>("/user/messages")
      .then(msgs => { if (mounted) setMessages(msgs); })
      .catch(() => {})
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, []);

  // Слушаем NEW_SUPPORT_MESSAGE через CustomEvent (SocketProvider)
  useEffect(() => {
    function handleNewMsg(e: Event) {
      const raw = (e as CustomEvent).detail;
      if (!raw) return;
      // Нормализуем поле created_at (сервер шлёт createdAt)
      const detail: ChatMessage = {
        ...raw,
        created_at: raw.created_at || raw.createdAt || new Date().toISOString(),
      };
      setMessages(prev => {
        // Дедупликация по id
        if (detail.id && prev.some(m => m.id === detail.id)) return prev;
        return [...prev, detail];
      });
    }
    window.addEventListener("nexo:support-message", handleNewMsg);
    return () => window.removeEventListener("nexo:support-message", handleNewMsg);
  }, []);

  // Автоскролл вниз
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || sending) return;
    setSending(true);
    setInput("");

    // Оптимистичное добавление
    const tempMsg: ChatMessage = {
      id:         "tmp_" + Date.now(),
      sender:     "USER",
      text,
      created_at: new Date().toISOString(),
    };
    setMessages(prev => [...prev, tempMsg]);

    try {
      const saved = await api.post<ChatMessage>("/user/messages", { text });
      // Заменяем temp на реальное
      setMessages(prev => prev.map(m => m.id === tempMsg.id ? saved : m));
    } catch {
      // Убираем temp при ошибке
      setMessages(prev => prev.filter(m => m.id !== tempMsg.id));
      setInput(text);
    } finally {
      setSending(false);
    }
  }, [input, sending]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div style={{
      display: "flex", flexDirection: "column", height: "100%",
      background: "var(--bg-0)",
    }}>
      {/* Header */}
      <div style={{
        display: "flex", alignItems: "center", gap: 12,
        padding: "12px 16px",
        background: "var(--bg-1)", borderBottom: "1px solid var(--line-1)",
      }}>
        <button onClick={() => navigate("profile")} style={{
          background: "none", border: "none", cursor: "pointer",
          fontSize: 18, color: "var(--text-1)", padding: 4,
        }}>
          ←
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text-1)" }}>
            Поддержка
          </div>
          <div style={{ fontSize: 11, color: "var(--accent)" }}>
            Онлайн • Обычно отвечаем за 5 мин
          </div>
        </div>
        <div style={{
          width: 36, height: 36, borderRadius: "50%",
          background: "linear-gradient(135deg, var(--accent), #6366f1)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 16, color: "#fff",
        }}>
          💬
        </div>
      </div>

      {/* Messages area */}
      <div
        ref={scrollRef}
        style={{
          flex: 1, overflowY: "auto", padding: "16px 12px",
          display: "flex", flexDirection: "column", gap: 8,
        }}
      >
        {loading && (
          <div style={{ textAlign: "center", color: "var(--text-4)", padding: 40, fontSize: 13 }}>
            Загрузка…
          </div>
        )}

        {!loading && messages.length === 0 && (
          <div style={{
            textAlign: "center", padding: "40px 20px",
            color: "var(--text-3)", fontSize: 13,
          }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>💬</div>
            Напишите ваш вопрос — менеджер ответит в ближайшее время.
          </div>
        )}

        {messages.map((msg, i) => {
          const isUser = msg.sender === "USER";
          return (
            <motion.div
              key={msg.id}
              initial={i >= messages.length - 1 ? { opacity: 0, y: 10 } : false}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, ease: EASE }}
              style={{
                display: "flex",
                justifyContent: isUser ? "flex-end" : "flex-start",
              }}
            >
              <div style={{
                maxWidth: "80%",
                padding: "10px 14px",
                borderRadius: isUser ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
                background: isUser
                  ? "linear-gradient(135deg, var(--accent), #6366f1)"
                  : "var(--surface-1)",
                color: isUser ? "#fff" : "var(--text-1)",
                fontSize: 14, lineHeight: "1.4",
                border: isUser ? "none" : "1px solid var(--line-1)",
              }}>
                {!isUser && (
                  <div style={{
                    fontSize: 11, fontWeight: 600, marginBottom: 4,
                    color: "var(--accent)",
                  }}>
                    Менеджер
                  </div>
                )}
                <div style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                  {msg.text}
                </div>
                <div style={{
                  fontSize: 10, marginTop: 4, textAlign: "right",
                  opacity: 0.6,
                }}>
                  {new Date(msg.created_at).toLocaleTimeString("ru-RU", {
                    hour: "2-digit", minute: "2-digit",
                  })}
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Input area */}
      <div style={{
        display: "flex", alignItems: "flex-end", gap: 8,
        padding: "10px 12px calc(var(--safe-bottom, 0px) + 10px)",
        background: "var(--bg-1)", borderTop: "1px solid var(--line-1)",
      }}>
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Напишите сообщение…"
          rows={1}
          style={{
            flex: 1, resize: "none",
            background: "var(--surface-1)",
            border: "1px solid var(--line-1)",
            borderRadius: 20, padding: "10px 16px",
            fontSize: 14, color: "var(--text-1)",
            outline: "none", maxHeight: 120,
            fontFamily: "inherit",
          }}
          onInput={(e) => {
            const t = e.target as HTMLTextAreaElement;
            t.style.height = "auto";
            t.style.height = Math.min(t.scrollHeight, 120) + "px";
          }}
        />
        <button
          onClick={handleSend}
          disabled={!input.trim() || sending}
          style={{
            width: 40, height: 40, borderRadius: "50%",
            background: input.trim() ? "var(--accent)" : "var(--surface-2)",
            border: "none", cursor: input.trim() ? "pointer" : "default",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 18, color: "#fff", flexShrink: 0,
            transition: "background 0.2s",
          }}
        >
          ↑
        </button>
      </div>
    </div>
  );
}
