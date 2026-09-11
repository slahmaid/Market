import { beforeEach, describe, expect, it, vi } from "vitest";

const userFindUnique = vi.fn();
const mockCompare = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    user: {
      findUnique: (...args: unknown[]) => userFindUnique(...args),
    },
  },
}));

vi.mock("bcryptjs", () => ({
  default: {
    compare: (...args: unknown[]) => mockCompare(...args),
    hash: vi.fn(),
  },
}));

import { authorizeCredentials } from "@/lib/auth-credentials";

describe("authorizeCredentials", () => {
  beforeEach(() => {
    userFindUnique.mockReset();
    mockCompare.mockReset();
  });

  it("returns null when user has no password hash (OAuth-only)", async () => {
    userFindUnique.mockResolvedValue({
      id: "user1",
      email: "oauth@example.com",
      passwordHash: null,
    });

    const result = await authorizeCredentials({
      email: "oauth@example.com",
      password: "Secret123!",
    });

    expect(result).toBeNull();
    expect(mockCompare).not.toHaveBeenCalled();
  });

  it("returns null when password does not match", async () => {
    userFindUnique.mockResolvedValue({
      id: "user1",
      email: "alice@example.com",
      passwordHash: "hashed",
    });
    mockCompare.mockResolvedValue(false);

    const result = await authorizeCredentials({
      email: "Alice@Example.com",
      password: "wrong",
    });

    expect(result).toBeNull();
    expect(userFindUnique).toHaveBeenCalledWith({
      where: { email: "alice@example.com" },
    });
    expect(mockCompare).toHaveBeenCalledWith("wrong", "hashed");
  });

  it("returns user when password matches", async () => {
    userFindUnique.mockResolvedValue({
      id: "user1",
      email: "alice@example.com",
      passwordHash: "hashed",
    });
    mockCompare.mockResolvedValue(true);

    const result = await authorizeCredentials({
      email: "alice@example.com",
      password: "Secret123!",
    });

    expect(result).toEqual({ id: "user1", email: "alice@example.com" });
  });

  it("returns null when user is not found", async () => {
    userFindUnique.mockResolvedValue(null);

    const result = await authorizeCredentials({
      email: "missing@example.com",
      password: "Secret123!",
    });

    expect(result).toBeNull();
  });
});
