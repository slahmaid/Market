import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  getStoreCommissionBalance,
  MIN_COMMISSION_CHECKOUT_CENTS,
  PENDING_CHECKOUT_GUARD_MS,
} from "@/lib/commission/balance";
import { requireSquareStoreOwner } from "@/lib/store/assertSquareStoreOwner";
import { getStripe } from "@/lib/stripe";

type Params = { params: Promise<{ squareId: string }> };

function appBaseUrl(): string {
  const raw = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (raw) return raw.replace(/\/$/, "");
  console.warn(
    "NEXT_PUBLIC_APP_URL is unset; Stripe return URLs default to http://localhost:3000",
  );
  return "http://localhost:3000";
}

export async function POST(_req: Request, { params }: Params) {
  const session = await auth();
  const { squareId } = await params;

  const gate = await requireSquareStoreOwner(squareId, session?.user?.id);
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }
  if (!gate.store) {
    return NextResponse.json({ error: "Store not found" }, { status: 404 });
  }

  const storeId = gate.store.id;
  const payerId = session!.user!.id!;

  let balance;
  try {
    balance = await getStoreCommissionBalance(storeId);
  } catch {
    return NextResponse.json(
      { error: "Database unavailable" },
      { status: 503 },
    );
  }

  if (balance.unpaidCents < MIN_COMMISSION_CHECKOUT_CENTS) {
    return NextResponse.json(
      { error: "Balance too small to pay yet" },
      { status: 400 },
    );
  }

  const guardSince = new Date(Date.now() - PENDING_CHECKOUT_GUARD_MS);
  try {
    const recentPending = await prisma.commissionPayment.findFirst({
      where: {
        storeId,
        status: "pending",
        createdAt: { gte: guardSince },
      },
      select: { id: true },
    });
    if (recentPending) {
      return NextResponse.json(
        { error: "Checkout already in progress" },
        { status: 409 },
      );
    }
  } catch {
    return NextResponse.json(
      { error: "Database unavailable" },
      { status: 503 },
    );
  }

  const amountCents = balance.unpaidCents;
  const base = appBaseUrl();

  try {
    const stripe = getStripe();
    const checkout = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: amountCents,
            product_data: { name: "Square Market commission" },
          },
        },
      ],
      metadata: {
        type: "commission",
        storeId,
        squareId,
        amountCents: String(amountCents),
        payerId,
      },
      success_url: `${base}/store/${squareId}/edit?commission=success`,
      cancel_url: `${base}/store/${squareId}/edit?commission=cancel`,
    });

    if (!checkout.url) {
      return NextResponse.json({ error: "Checkout failed" }, { status: 502 });
    }

    await prisma.commissionPayment.create({
      data: {
        storeId,
        amountCents,
        stripeCheckoutSessionId: checkout.id,
        status: "pending",
      },
    });

    return NextResponse.json({ url: checkout.url });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("STRIPE_SECRET_KEY")) {
      return NextResponse.json(
        { error: "Stripe is not configured" },
        { status: 503 },
      );
    }
    console.error("Commission checkout session create failed", err);
    return NextResponse.json({ error: "Checkout failed" }, { status: 502 });
  }
}
