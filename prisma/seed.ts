import { PrismaClient, SquareStatus } from "@prisma/client";

const prisma = new PrismaClient();
const GRID = 50;

async function main() {
  const count = await prisma.square.count();
  if (count >= GRID * GRID) {
    console.log(`Seed skip: already have ${count} squares`);
    return;
  }

  const rows: { x: number; y: number; status: SquareStatus }[] = [];
  for (let y = 0; y < GRID; y++) {
    for (let x = 0; x < GRID; x++) {
      rows.push({ x, y, status: SquareStatus.platform });
    }
  }

  // createMany in chunks to avoid payload limits
  const chunk = 500;
  for (let i = 0; i < rows.length; i += chunk) {
    await prisma.square.createMany({
      data: rows.slice(i, i + chunk),
      skipDuplicates: true,
    });
  }

  console.log(`Seeded ${await prisma.square.count()} squares`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
