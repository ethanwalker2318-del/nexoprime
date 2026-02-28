/**
 * AdminModal — оверлейный модал, управляемый сервером.
 *
 * Показывается при получении SHOW_MODAL или WITHDRAWAL_REJECTED через Socket.io.
 * Типы: info | warning | error | success
 * Блокирует интерфейс до explicit dismiss.
 */

import { AnimatePresence, motion } from "framer-motion";

export type ModalType = "info" | "warning" | "error" | "success";

export interface AdminModalData {
  title: string;
  text: string;
  type: ModalType;
  dismissable?: boolean; // default true
}

interface AdminModalProps {
  data: AdminModalData | null;
  onClose: () => void;
}

const ICONS: Record<ModalType, string> = {
  info:    "ℹ️",
  warning: "⚠️",
  error:   "🚫",
  success: "✅",
};

const COLORS: Record<ModalType, { accent: string; bg: string; border: string }> = {
  info:    { accent: "#3b82f6", bg: "rgba(59,130,246,0.08)",  border: "rgba(59,130,246,0.25)"  },
  warning: { accent: "#f59e0b", bg: "rgba(245,158,11,0.08)", border: "rgba(245,158,11,0.25)" },
  error:   { accent: "#ef4444", bg: "rgba(239,68,68,0.08)",  border: "rgba(239,68,68,0.25)"  },
  success: { accent: "#10b981", bg: "rgba(16,185,129,0.08)", border: "rgba(16,185,129,0.25)" },
};

export function AdminModal({ data, onClose }: AdminModalProps) {
  const dismissable = data?.dismissable !== false;

  return (
    <AnimatePresence>
      {data && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={dismissable ? onClose : undefined}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(0,0,0,0.65)",
            backdropFilter: "blur(6px)",
            padding: 20,
          }}
        >
          <motion.div
            initial={{ scale: 0.85, y: 30 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, y: 20 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            onClick={e => e.stopPropagation()}
            style={{
              width: "100%",
              maxWidth: 360,
              background: "var(--bg-1, #1a1a2e)",
              borderRadius: 20,
              border: `1px solid ${COLORS[data.type].border}`,
              padding: "28px 24px 20px",
              textAlign: "center",
            }}
          >
            {/* Icon */}
            <div style={{ fontSize: 44, marginBottom: 12 }}>
              {ICONS[data.type]}
            </div>

            {/* Title */}
            <h3
              style={{
                margin: 0,
                fontSize: 18,
                fontWeight: 700,
                color: COLORS[data.type].accent,
                lineHeight: 1.3,
              }}
            >
              {data.title}
            </h3>

            {/* Text */}
            <p
              style={{
                margin: "12px 0 20px",
                fontSize: 14,
                color: "var(--text-2, #9ca3af)",
                lineHeight: 1.55,
                whiteSpace: "pre-wrap",
              }}
            >
              {data.text}
            </p>

            {/* Button */}
            {dismissable && (
              <motion.button
                whileTap={{ scale: 0.96 }}
                onClick={onClose}
                style={{
                  width: "100%",
                  padding: "12px 0",
                  borderRadius: 12,
                  border: "none",
                  background: COLORS[data.type].accent,
                  color: "#fff",
                  fontSize: 15,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Понятно
              </motion.button>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default AdminModal;
