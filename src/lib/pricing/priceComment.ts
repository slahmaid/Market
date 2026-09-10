import { BALANCED_BAND, FAIR_BAND } from "./constants";

export type PriceLabelName = "fair" | "balanced" | "unfair";

export function classifyPrice(
  askCents: number,
  suggestedCents: number,
): { label: PriceLabelName; reason: string } {
  if (suggestedCents <= 0) {
    return { label: "fair", reason: "No market suggestion yet." };
  }
  const delta = (askCents - suggestedCents) / suggestedCents;
  const abs = Math.abs(delta);
  const direction = delta > 0 ? "above" : delta < 0 ? "below" : "at";

  if (abs <= FAIR_BAND) {
    return {
      label: "fair",
      reason: `Ask is ${direction} suggested value within 10%.`,
    };
  }
  if (abs <= BALANCED_BAND) {
    return {
      label: "balanced",
      reason: `Ask is ${direction} suggested value (${Math.round(abs * 100)}%).`,
    };
  }
  return {
    label: "unfair",
    reason: `Ask is clearly ${direction} suggested value (${Math.round(abs * 100)}%).`,
  };
}
