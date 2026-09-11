export type CustomizeSquareResult = {
  square: {
    id: string;
    imageUrl: string | null;
    linkUrl: string | null;
    [key: string]: unknown;
  };
};

/** POST multipart customize payload; returns updated square fields. */
export async function customizeSquare(
  squareId: string,
  input: { image?: File | null; linkUrl?: string },
): Promise<CustomizeSquareResult> {
  const form = new FormData();
  if (input.image) {
    form.append("image", input.image);
  }
  if (input.linkUrl !== undefined) {
    form.append("linkUrl", input.linkUrl);
  }

  const res = await fetch(`/api/squares/${squareId}/customize`, {
    method: "POST",
    body: form,
  });

  const data: unknown = await res.json().catch(() => null);
  const error =
    data &&
    typeof data === "object" &&
    "error" in data &&
    typeof (data as { error: unknown }).error === "string"
      ? (data as { error: string }).error
      : null;

  if (!res.ok) {
    throw new Error(error ?? "Customize failed");
  }

  const square =
    data &&
    typeof data === "object" &&
    "square" in data &&
    (data as { square: unknown }).square &&
    typeof (data as { square: unknown }).square === "object"
      ? (data as CustomizeSquareResult).square
      : null;

  if (!square || typeof square.id !== "string") {
    throw new Error("Customize failed");
  }

  return { square };
}
