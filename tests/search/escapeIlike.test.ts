import { describe, expect, it } from "vitest";
import { escapeIlike } from "@/lib/search/escapeIlike";

describe("escapeIlike", () => {
  it("escapes percent, underscore, and backslash", () => {
    expect(escapeIlike("100%_\\off")).toBe("100\\%\\_\\\\off");
  });
});
