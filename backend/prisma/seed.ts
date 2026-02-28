/**
 * Seed скрипт — создаёт SUPER_ADMIN и тестового CLOSER
 * Запуск: npx tsx prisma/seed.ts
 */
import { PrismaClient } from "@prisma/client";
import { randomBytes } from "crypto";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...");

  // ── SUPER_ADMIN ─────────────────────────────────────────────────────────────
  const superAdminTgId = BigInt(process.env.SUPER_ADMIN_TG_ID ?? "0");

  const superAdmin = await prisma.admin.upsert({
    where:  { tg_id: superAdminTgId },
    update: {},
    create: {
      tg_id:    superAdminTgId,
      username: "super_admin",
      role:     "SUPER_ADMIN",
      // SUPER_ADMIN не имеет invite_code
    },
  });
  console.log(`✅ SUPER_ADMIN: id=${superAdmin.id}, tg_id=${superAdmin.tg_id}`);

  // ── CLOSER (тестовый) ───────────────────────────────────────────────────────
  const closerInviteCode = randomBytes(6).toString("hex");

  const closer = await prisma.admin.upsert({
    where:  { tg_id: BigInt(999_999_999) },
    update: {},
    create: {
      tg_id:       BigInt(999_999_999),
      username:    "test_closer",
      role:        "CLOSER",
      invite_code: closerInviteCode,
    },
  });
  console.log(`✅ CLOSER: id=${closer.id}, invite_code=${closer.invite_code}`);
  console.log(`   Deep Link: https://t.me/<BOT_USERNAME>?start=cl_${closer.invite_code}`);

  console.log("✅ Seed complete!");
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
