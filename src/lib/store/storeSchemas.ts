import { z } from "zod";

const optionalHttps = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((v) => {
    if (v == null) return null;
    const t = v.trim();
    return t === "" ? null : t;
  })
  .pipe(z.string().url().startsWith("https://").nullable());

const optionalTrimmed = (max: number) =>
  z
    .union([z.string(), z.null(), z.undefined()])
    .transform((v) => {
      if (v == null) return null;
      const t = v.trim();
      return t === "" ? null : t;
    })
    .pipe(z.string().max(max).nullable());

export function httpsUrlOrNull(
  raw: string | null | undefined,
): string | null {
  const parsed = optionalHttps.safeParse(raw);
  if (!parsed.success) {
    throw new Error("URL must be https or empty");
  }
  return parsed.data;
}

export const storeUpsertSchema = z.object({
  name: z.string().trim().min(1).max(120),
  about: optionalTrimmed(2000).optional(),
  email: optionalTrimmed(254).optional(),
  phone: optionalTrimmed(64).optional(),
  address: optionalTrimmed(500).optional(),
  hours: optionalTrimmed(500).optional(),
  websiteUrl: optionalHttps.optional(),
});

export const productCreateSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: optionalTrimmed(4000).optional(),
  priceCents: z.number().int().min(0),
  buyUrl: optionalHttps.optional(),
  active: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

export const productPatchSchema = productCreateSchema.partial();

export type StoreUpsertInput = z.infer<typeof storeUpsertSchema>;
export type ProductCreateInput = z.infer<typeof productCreateSchema>;
export type ProductPatchInput = z.infer<typeof productPatchSchema>;
