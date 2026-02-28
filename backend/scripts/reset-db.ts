/**
 * Полная очистка БД и пересоздание SUPER_ADMIN.
 * Запуск: npx tsx scripts/reset-db.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🗑️  Удаляю все данные...");

  // Удаляем в правильном порядке (FK constraints)
  await prisma.eventLog.deleteMany();
  await prisma.supportMessage.deleteMany();
  await prisma.kycRequest.deleteMany();
  await prisma.binaryTrade.deleteMany();
  await prisma.transaction.deleteMany();
  await prisma.asset.deleteMany();
  await prisma.user.deleteMany();
  await prisma.admin.deleteMany();

  console.log("✅ БД очищена!");

  // Пересоздаём SUPER_ADMIN
  const saTgId = BigInt(process.env.SUPER_ADMIN_TG_ID ?? "6163006759");
  const sa = await prisma.admin.create({
    data: {
      tg_id:    saTgId,
      username: "JoseAldoa",
      role:     "SUPER_ADMIN",
    },
  });

  console.log(`✅ SUPER_ADMIN создан: id=${sa.id}, tg_id=${sa.tg_id}`);
  console.log("");
  console.log("Теперь запусти бэкенд: npx tsx src/index.ts");

  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
