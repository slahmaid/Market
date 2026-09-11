import { GRID_SIZE } from "@/lib/pricing/constants";
import { buildPlatformQuote } from "@/lib/pricing";

export type PreviewSquare = {
  id: string;
  x: number;
  y: number;
  status: "platform";
  imageUrl: null;
  linkUrl: null;
  listPriceCents: null;
  ownerId: null;
};

export function previewSquareId(x: number, y: number): string {
  return `preview-${x}-${y}`;
}

export function parsePreviewSquareId(
  id: string,
): { x: number; y: number } | null {
  const match = /^preview-(\d+)-(\d+)$/.exec(id);
  if (!match) return null;
  const x = Number(match[1]);
  const y = Number(match[2]);
  if (
    !Number.isInteger(x) ||
    !Number.isInteger(y) ||
    x < 0 ||
    y < 0 ||
    x >= GRID_SIZE ||
    y >= GRID_SIZE
  ) {
    return null;
  }
  return { x, y };
}

export function listPreviewSquares(): PreviewSquare[] {
  const squares: PreviewSquare[] = [];
  for (let y = 0; y < GRID_SIZE; y++) {
    for (let x = 0; x < GRID_SIZE; x++) {
      squares.push({
        id: previewSquareId(x, y),
        x,
        y,
        status: "platform",
        imageUrl: null,
        linkUrl: null,
        listPriceCents: null,
        ownerId: null,
      });
    }
  }
  return squares;
}

export function getPreviewSquareDetail(id: string) {
  const coords = parsePreviewSquareId(id);
  if (!coords) return null;
  const quote = buildPlatformQuote(coords);
  return {
    square: {
      id,
      x: coords.x,
      y: coords.y,
      status: "platform" as const,
      imageUrl: null,
      linkUrl: null,
      listPriceCents: null,
      ownerId: null,
    },
    quote: {
      askCents: quote.askCents,
      suggestedPriceCents: quote.suggestedPriceCents,
      label: quote.label,
      reason: quote.reason,
    },
    preview: true as const,
  };
}
