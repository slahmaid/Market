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

async function refundIfPossible(
  stripe: Stripe,
  session: Stripe.Checkout.Session,
): Promise<void> {
  const pi = paymentIntentId(session.payment_intent);
  if (!pi) return;
  await stripe.refunds.create({ payment_intent: pi });
}

async function handlePrimaryCheckout(
  stripe: Stripe,
  session: Stripe.Checkout.Session,
): Promise<void> {
  const squareId = session.metadata?.squareId;
  const buyerId = session.metadata?.buyerId;
  if (!squareId || !buyerId) return;

  const existing = await prisma.transaction.findUnique({
    where: { stripeCheckoutSessionId: session.id },
  });
  if (existing) return;

  const square = await prisma.square.findUnique({ where: { id: squareId } });
  if (!square || square.status !== "platform") {
    await refundIfPossible(stripe, session);
    return;
  }

  const result = await completePrimaryPurchase({
    squareId,
    buyerId,
    amountCents: session.amount_total ?? 0,
    stripeCheckoutSessionId: session.id,
  });

  if (!result.ok) {
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
