/**
 * TrustBadges — визуальные индикаторы доверия.
 *
 * Используется на ProfileScreen и WalletScreen для усиления ощущения безопасности.
 * Бейджи: 2FA Protected · Funds Insured · KYC Verified · SSL Encrypted
 */

import { motion } from "framer-motion";

export interface TrustBadge {
  icon: string;
  label: string;
  color: string;
  bgColor: string;
}

const DEFAULT_BADGES: TrustBadge[] = [
  { icon: "🔒", label: "2FA Protected",   color: "#10b981", bgColor: "rgba(16,185,129,0.10)" },
  { icon: "🛡️", label: "Funds Insured",   color: "#3b82f6", bgColor: "rgba(59,130,246,0.10)" },
  { icon: "✅", label: "KYC Level 2",      color: "#8b5cf6", bgColor: "rgba(139,92,246,0.10)" },
  { icon: "🔐", label: "SSL Encrypted",   color: "#f59e0b", bgColor: "rgba(245,158,11,0.10)" },
];

interface TrustBadgesProps {
  badges?: TrustBadge[];
  /** Компактный однострочный режим */
  compact?: boolean;
}

export function TrustBadges({ badges = DEFAULT_BADGES, compact = false }: TrustBadgesProps) {
  if (compact) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          flexWrap: "wrap",
          justifyContent: "center",
        }}
      >
        {badges.map((b, i) => (
          <motion.span
            key={i}
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.08, duration: 0.25 }}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 3,
              fontSize: 11,
              color: b.color,
              background: b.bgColor,
              padding: "3px 8px",
              borderRadius: 100,
              fontWeight: 500,
              whiteSpace: "nowrap",
            }}
          >
            <span style={{ fontSize: 12 }}>{b.icon}</span>
            {b.label}
          </motion.span>
        ))}
      </div>
    );
  }

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: 8,
        padding: "12px 0",
      }}
    >
      {badges.map((b, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.08, duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "10px 12px",
            borderRadius: 12,
            background: b.bgColor,
            border: `1px solid ${b.color}20`,
          }}
        >
          <span style={{ fontSize: 20 }}>{b.icon}</span>
          <span style={{ fontSize: 12, fontWeight: 600, color: b.color, lineHeight: 1.2 }}>
            {b.label}
          </span>
        </motion.div>
      ))}
    </div>
  );
}

export default TrustBadges;
