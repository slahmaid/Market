export type SquareBuySnapshot = {
  status: "platform" | "owned" | "listed";
  ownerId: string | null;
};

export function assertSquareBuyable(
  square: SquareBuySnapshot,
  _buyerId: string,
): void {
  if (square.status === "owned") {
    throw new Error("Square is already owned");
  }
  if (square.status !== "platform" || square.ownerId) {
    throw new Error("Square is not available for primary purchase");
  }
}
