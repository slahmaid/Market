import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { assertSquareBuyable } from "@/lib/ownership";
import { buildPlatformQuote } from "@/lib/pricing";
import { getStripe } from "@/lib/stripe";

const bodySchema = z.object({
  squareId: z.string().min(1),
});

/** Base URL for Checkout return links. Defaults to local Next when unset. */
function appBaseUrl(): string {
  const raw = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (raw) return raw.replace(/\/$/, "");
  return "http://localhost:3000";
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const buyerId = session.user.id;
  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const { squareId } = parsed.data;

  let square;
  try {
    square = await prisma.square.findUnique({ where: { id: squareId } });
  } catch {
    return NextResponse.json(
      { error: "Database unavailable" },
      { status: 503 },
    );
  }

  // Prefer real DB for buy path — do not fall back to preview squares.
  if (!square) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    assertSquareBuyable(
      { status: square.status, ownerId: square.ownerId },
      buyerId,
    );
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Square is not available for purchase";
    return NextResponse.json({ error: message }, { status: 409 });
  }

  const quote = buildPlatformQuote({ x: square.x, y: square.y });
  const base = appBaseUrl();

  try {
    const stripe = getStripe();
    const checkout = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: quote.askCents,
            product_data: {
              name: `Square (${square.x},${square.y})`,
            },
          },
        },
      ],
      metadata: {
        squareId: square.id,
        buyerId,
        type: "primary",
      },
      success_url: `${base}/buy/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${base}/buy/cancel`,
    });

    if (!checkout.url) {
      return NextResponse.json(
        { error: "Failed to create checkout session" },
        { status: 502 },
      );
    }

    return NextResponse.json({ url: checkout.url });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Checkout failed";
    if (message.includes("STRIPE_SECRET_KEY")) {
      return NextResponse.json(
        { error: "Stripe is not configured" },
        { status: 503 },
      );
    }
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
