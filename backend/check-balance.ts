import { prisma } from "./src/lib/prisma";

async function main() {
  const assets = await prisma.asset.findMany({
    where: { user_id: "cmm5qil8b0002hfumqthmoqrw" },
  });
  console.log("Assets:", JSON.stringify(assets, null, 2));

  const user = await prisma.user.findUnique({
    where: { id: "cmm5qil8b0002hfumqthmoqrw" },
    select: { id: true, tg_id: true, first_name: true, username: true },
  });
  console.log("User:", JSON.stringify(user, null, 2));

  await prisma.$disconnect();
}

main();
