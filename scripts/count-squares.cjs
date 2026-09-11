const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();
p.square
  .count()
  .then((c) => {
    console.log("square_count=" + c);
    return p.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await p.$disconnect();
    process.exit(1);
  });
