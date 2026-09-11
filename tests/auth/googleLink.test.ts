import { beforeEach, describe, expect, it, vi } from "vitest";

const userFindUnique = vi.fn();
const userCreate = vi.fn();
const accountUpsert = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    user: {
      findUnique: (...args: unknown[]) => userFindUnique(...args),
      create: (...args: unknown[]) => userCreate(...args),
    },
    account: {
      upsert: (...args: unknown[]) => accountUpsert(...args),
    },
  },
}));

import { ensureGoogleUser } from "@/lib/auth-google";

describe("ensureGoogleUser", () => {
  beforeEach(() => {
    userFindUnique.mockReset();
    userCreate.mockReset();
    accountUpsert.mockReset();
  });

  it("creates new user and account when email is unknown", async () => {
    userFindUnique.mockResolvedValue(null);
    userCreate.mockResolvedValue({ id: "user1", email: "alice@example.com" });
    accountUpsert.mockResolvedValue({ id: "acc1" });

    const result = await ensureGoogleUser({
      email: "Alice@Example.com",
      providerAccountId: "google-sub-1",
    });

    expect(result).toEqual({ id: "user1", email: "alice@example.com" });
    expect(userFindUnique).toHaveBeenCalledWith({
      where: { email: "alice@example.com" },
    });
    expect(userCreate).toHaveBeenCalledWith({
      data: { email: "alice@example.com", passwordHash: null },
    });
    expect(accountUpsert).toHaveBeenCalledWith({
      where: {
        provider_providerAccountId: {
          provider: "google",
          providerAccountId: "google-sub-1",
        },
      },
      create: {
        userId: "user1",
        type: "oidc",
        provider: "google",
        providerAccountId: "google-sub-1",
      },
      update: { userId: "user1" },
    });
  });

  it("links account to existing user with same email without creating a second user", async () => {
    userFindUnique.mockResolvedValue({
      id: "existing-user",
      email: "bob@example.com",
    });
    accountUpsert.mockResolvedValue({ id: "acc2" });

    const result = await ensureGoogleUser({
      email: "bob@example.com",
      providerAccountId: "google-sub-2",
    });

    expect(result).toEqual({ id: "existing-user", email: "bob@example.com" });
    expect(userCreate).not.toHaveBeenCalled();
    expect(accountUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ userId: "existing-user" }),
        update: { userId: "existing-user" },
      }),
    );
  });

  it("is idempotent on second call with same google id", async () => {
    userFindUnique.mockResolvedValue({
      id: "user1",
      email: "alice@example.com",
    });
    accountUpsert.mockResolvedValue({ id: "acc1" });

    const input = {
      email: "alice@example.com",
      providerAccountId: "google-sub-1",
    };

    const first = await ensureGoogleUser(input);
    const second = await ensureGoogleUser(input);

    expect(first).toEqual(second);
    expect(accountUpsert).toHaveBeenCalledTimes(2);
    expect(userCreate).not.toHaveBeenCalled();
  });
});
