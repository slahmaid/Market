export { MAX_LIST_PRICE_CENTS, dollarsToCents } from "./listPrice";

export type SquareListSnapshot = {
  status: "platform" | "owned" | "listed";
  ownerId: string | null;
};

export function assertCanList(
  square: SquareListSnapshot,
  userId: string,
): void {
  if (square.ownerId !== userId) {
    throw new Error("Only the owner can list this square");
  }
  if (square.status !== "owned" && square.status !== "listed") {
    throw new Error("Square cannot be listed");
  }
}

export function assertCanUnlist(
  square: SquareListSnapshot,
  userId: string,
): void {
  if (square.ownerId !== userId) {
    throw new Error("Only the owner can unlist this square");
  }
  if (square.status !== "listed") {
    throw new Error("Square is not listed");
  }
}
