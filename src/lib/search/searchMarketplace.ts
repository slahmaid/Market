import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { escapeIlike } from "@/lib/search/escapeIlike";

export type SearchResult = {
  stores: Array<{
    id: string;
    squareId: string;
    name: string;
    about: string | null;
  }>;
  products: Array<{
    id: string;
    name: string;
    priceCents: number;
    storeId: string;
    squareId: string;
    storeName: string;
    imageUrl: string | null;
  }>;
};

const MAX = 20;
const MIN_Q = 2;

function truncateAbout(about: string | null): string | null {
  if (about == null) return null;
  if (about.length <= 160) return about;
  return `${about.slice(0, 157)}…`;
}

export async function searchMarketplace(q: string): Promise<SearchResult> {
  const trimmed = q.trim();
  if (trimmed.length < MIN_Q) {
    return { stores: [], products: [] };
  }

  const pattern = `%${escapeIlike(trimmed)}%`;

  const stores = await prisma.$queryRaw<
    Array<{
      id: string;
      squareId: string;
      name: string;
      about: string | null;
    }>
  >(Prisma.sql`
    SELECT id, "squareId", name, about
    FROM "Store"
    WHERE name ILIKE ${pattern} ESCAPE '\'
       OR (about IS NOT NULL AND about ILIKE ${pattern} ESCAPE '\')
    ORDER BY name ASC
    LIMIT ${MAX}
  `);

  const products = await prisma.$queryRaw<
    Array<{
      id: string;
      name: string;
      priceCents: number;
      storeId: string;
      squareId: string;
      storeName: string;
      imageUrl: string | null;
    }>
  >(Prisma.sql`
    SELECT
      p.id,
      p.name,
      p."priceCents",
      p."storeId",
      s."squareId" AS "squareId",
      s.name AS "storeName",
      (
        SELECT pi.url
        FROM "ProductImage" pi
        WHERE pi."productId" = p.id
        ORDER BY pi."sortOrder" ASC
        LIMIT 1
      ) AS "imageUrl"
    FROM "Product" p
    INNER JOIN "Store" s ON s.id = p."storeId"
    WHERE p.active = true
      AND (
        p.name ILIKE ${pattern} ESCAPE '\'
        OR (p.description IS NOT NULL AND p.description ILIKE ${pattern} ESCAPE '\')
      )
    ORDER BY p.name ASC
    LIMIT ${MAX}
  `);

  return {
    stores: stores.map((s) => ({
      id: s.id,
      squareId: s.squareId,
      name: s.name,
      about: truncateAbout(s.about),
    })),
    products: products.map((p) => ({
      id: p.id,
      name: p.name,
      priceCents: p.priceCents,
      storeId: p.storeId,
      squareId: p.squareId,
      storeName: p.storeName,
      imageUrl: p.imageUrl,
    })),
  };
}
