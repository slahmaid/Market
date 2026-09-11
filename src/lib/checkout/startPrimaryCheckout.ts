/** Start a primary Stripe Checkout session and return the hosted URL. */
export async function startPrimaryCheckout(squareId: string): Promise<string> {
  const res = await fetch("/api/checkout/primary", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ squareId }),
  });

  const data: unknown = await res.json().catch(() => null);
  const error =
    data &&
    typeof data === "object" &&
    "error" in data &&
    typeof (data as { error: unknown }).error === "string"
      ? (data as { error: string }).error
      : null;
  const url =
    data &&
    typeof data === "object" &&
    "url" in data &&
    typeof (data as { url: unknown }).url === "string"
      ? (data as { url: string }).url
      : null;

  if (!res.ok) {
    throw new Error(error ?? "Checkout failed");
  }
  if (!url) {
    throw new Error("Checkout failed");
  }
  return url;
}
