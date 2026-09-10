import { GRID_SIZE } from "@/lib/pricing/constants";

export type BoardCoordinate = { x: number; y: number };

export function nextBoardCoordinate(
  current: BoardCoordinate | null,
  key: string,
): BoardCoordinate | null {
  if (!current) {
    if (
      key === "Enter" ||
      key === " " ||
      key.startsWith("Arrow")
    ) {
      const center = Math.floor(GRID_SIZE / 2);
      return { x: center, y: center };
    }
    return null;
  }

  switch (key) {
    case "ArrowLeft":
      return { x: Math.max(0, current.x - 1), y: current.y };
    case "ArrowRight":
      return { x: Math.min(GRID_SIZE - 1, current.x + 1), y: current.y };
    case "ArrowUp":
      return { x: current.x, y: Math.max(0, current.y - 1) };
    case "ArrowDown":
      return { x: current.x, y: Math.min(GRID_SIZE - 1, current.y + 1) };
    case "Enter":
    case " ":
      return current;
    default:
      return null;
  }
}
