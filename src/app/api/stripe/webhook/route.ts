import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { prisma } from "@/lib/db";
import { completePrimaryPurchase } from "@/lib/ownership";
import { getStripe } from "@/lib/stripe";

export const runtime = "nodejs";

function paymentIntentId(
  paymentIntent: string | Stripe.PaymentIntent | null,
): string | null {
  if (!paymentIntent) return null;
  return typeof paymentIntent === "string" ? paymentIntent : paymentIntent.id;
}

async function sessionAlreadySettled(sessionId: string): Promise<boolean> {
  const existing = await prisma.transaction.findUnique({
    where: { stripeCheckoutSessionId: sessionId },
  });
  return existing != null;
}

/** Best-effort refund; never throws — ownership outcome is already decided. */
async function refundIfPossible(
  stripe: Stripe,
  session: Stripe.Checkout.Session,
): Promise<void> {
  const pi = paymentIntentId(session.payment_intent);
  if (!pi) return;

  // Same-session winner must never be refunded by a racing delivery.
  if (await sessionAlreadySettled(session.id)) {
    return;
  }

  try {
    await stripe.refunds.create(
      { payment_intent: pi },
      { idempotencyKey: `primary-refund:${session.id}` },
    );
  } catch (error) {
    console.error("Stripe refund failed for checkout session", {
      sessionId: session.id,
      paymentIntent: pi,
      error,
    });
  }
}

async function handlePrimaryCheckout(
  stripe: Stripe,
  session: Stripe.Checkout.Session,
): Promise<void> {
  const squareId = session.metadata?.squareId;
  const buyerId = session.metadata?.buyerId;

  if (!squareId || !buyerId) {
    console.warn("Primary checkout missing squareId/buyerId metadata", {
      sessionId: session.id,
    });
    await refundIfPossible(stripe, session);
    return;
  }

  if (await sessionAlreadySettled(session.id)) {
    return;
  }

  if (session.amount_total == null) {
    console.warn("Primary checkout missing amount_total; refunding", {
      sessionId: session.id,
    });
    await refundIfPossible(stripe, session);
    return;
  }

  const square = await prisma.square.findUnique({ where: { id: squareId } });
  if (!square || square.status !== "platform") {
    await refundIfPossible(stripe, session);
    return;
  }

  const result = await completePrimaryPurchase({
    squareId,
    buyerId,
    amountCents: session.amount_total,
    stripeCheckoutSessionId: session.id,
  });

  if (!result.ok) {
    // Loser only: another session won. Same-session settle is a no-op inside refund.
    await refundIfPossible(stripe, session);
  }
}

export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "Webhook not configured" },
      { status: 503 },
    );
  }

  let stripe: Stripe;
  try {
    stripe = getStripe();
  } catch {
    return NextResponse.json(
      { error: "Stripe is not configured" },
      { status: 503 },
    );
  }

  const body = await req.text();
  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, secret);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    if (session.metadata?.type === "primary") {
      await handlePrimaryCheckout(stripe, session);
    }
  }

  return NextResponse.json({ received: true });
}
