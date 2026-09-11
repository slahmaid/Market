export type ListSquareResult = {
  square: {
    id: string;
    x: number;
    y: number;
    status: string;
    imageUrl: string | null;
    linkUrl: string | null;
    listPriceCents: number | null;
    ownerId: string | null;
    [key: string]: unknown;
  };
  quote: {
    askCents: number;
    suggestedPriceCents: number;
    label: string;
    reason: string;
  };
};

function parseError(data: unknown): string | null {
  return data &&
    typeof data === "object" &&
    "error" in data &&
    typeof (data as { error: unknown }).error === "string"
    ? (data as { error: string }).error
    : null;
}

function parseResult(
  data: unknown,
  failMessage: string,
): ListSquareResult {
  const square =
    data &&
    typeof data === "object" &&
    "square" in data &&
    (data as { square: unknown }).square &&
    typeof (data as { square: unknown }).square === "object"
      ? (data as ListSquareResult).square
      : null;
  const quote =
    data &&
    typeof data === "object" &&
    "quote" in data &&
    (data as { quote: unknown }).quote &&
    typeof (data as { quote: unknown }).quote === "object"
      ? (data as ListSquareResult).quote
      : null;

  if (!square || typeof square.id !== "string" || !quote) {
    throw new Error(failMessage);
  }

  return { square, quote };
}

/** List (or reprice) a square at a fixed ask in cents. */
export async function listSquare(
  squareId: string,
  listPriceCents: number,
): Promise<ListSquareResult> {
  const res = await fetch(`/api/squares/${squareId}/list`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ listPriceCents }),
  });

  const data: unknown = await res.json().catch(() => null);
  const error = parseError(data);

  if (!res.ok) {
    throw new Error(error ?? "List failed");
  }

  return parseResult(data, "List failed");
}

/** Remove a square from the secondary market. */
export async function unlistSquare(
  squareId: string,
): Promise<ListSquareResult> {
  const res = await fetch(`/api/squares/${squareId}/unlist`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });

  const data: unknown = await res.json().catch(() => null);
  const error = parseError(data);

  if (!res.ok) {
    throw new Error(error ?? "Unlist failed");
  }

  return parseResult(data, "Unlist failed");
}
