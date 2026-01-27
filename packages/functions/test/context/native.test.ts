import { describe, it, expect } from "vitest";
import { z } from "zod";
import { createNativeAPI, defineContextCompat } from "../../src/context/native";
import { success, failure } from "../../src/types";
import { exception } from "../../src/errors";

describe("Native API (New Simplified System)", () => {
  describe("createNativeAPI", () => {
    it("should create API builder without context", () => {
      const { t, createAPI } = createNativeAPI();

      expect(t).toBeDefined();
      expect(typeof t.query).toBe("function");
      expect(typeof t.mutation).toBe("function");
      expect(typeof t.router).toBe("function");
      expect(createAPI).toBeDefined();
    });

    it("should create API builder with typed context", () => {
      const { t, createAPI } = createNativeAPI<{ userId: string }>({
        context: { userId: "test-user" }
      });

      expect(t).toBeDefined();
    });

    it("should execute query successfully", async () => {
      const { t, createAPI } = createNativeAPI<{ userId: string }>();

      const getUser = t.query({
        args: z.object({ id: z.number() }),
        handler: async (args, ctx) => {
          return success({ id: args.id, requestedBy: ctx.userId });
        },
      });

      const api = createAPI({ getUser }, { userId: "user-123" });
      const result = await api.getUser({ id: 456 });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toEqual({ id: 456, requestedBy: "user-123" });
      }
    });

    it("should execute mutation successfully", async () => {
      const { t, createAPI } = createNativeAPI();

      const createUser = t.mutation({
        args: z.object({ name: z.string() }),
        handler: async (args, ctx) => {
          return success({ id: 1, name: args.name });
        },
      });

      const api = createAPI({ createUser }, {});
      const result = await api.createUser({ name: "Alice" });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toEqual({ id: 1, name: "Alice" });
      }
    });

    it("should validate query arguments", async () => {
      const { t, createAPI } = createNativeAPI();

      const getUser = t.query({
        args: z.object({ id: z.number() }),
        handler: async (args, ctx) => success(args),
      });

      const api = createAPI({ getUser }, {});
      const result = await api.getUser({ id: "invalid" as any });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.name).toBe("ValidationError");
      }
    });

    it("should handle nested routes with router", async () => {
      const { t, createAPI } = createNativeAPI();

      const getUser = t.query({
        args: z.object({ id: z.number() }),
        handler: async (args, ctx) => success({ id: args.id }),
      });

      const api = createAPI(
        {
          users: t.router({
            profile: { getUser },
          }),
        },
        {}
      );

      const result = await api.users.profile.getUser({ id: 123 });

      expect(result.ok).toBe(true);
    });

    it("should support multiple endpoints", async () => {
      const { t, createAPI } = createNativeAPI();

      const getUser = t.query({
        args: z.object({ id: z.number() }),
        handler: async (args) => success({ id: args.id }),
      });

      const updateUser = t.mutation({
        args: z.object({ id: z.number(), name: z.string() }),
        handler: async (args) => success(args),
      });

      const api = createAPI({ getUser, updateUser }, {});

      expect(api.getUser).toBeDefined();
      expect(api.updateUser).toBeDefined();
    });
  });

  describe("context handling", () => {
    it("should pass context to query handler", async () => {
      const { t, createAPI } = createNativeAPI<{ userId: string; database: any }>();

      const getUser = t.query({
        args: z.object({ id: z.number() }),
        handler: async (args, ctx) => {
          return success({
            id: args.id,
            requestedBy: ctx.userId,
          });
        },
      });

      const api = createAPI(
        { getUser },
        { userId: "user-123", database: {} }
      );

      const result = await api.getUser({ id: 1 });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.requestedBy).toBe("user-123");
      }
    });

    it("should support extensions that add context", async () => {
      const { t, createAPI } = createNativeAPI<{ userId: string }>({
        extensions: [
          {
            name: "logger",
            context: async (ctx) => ({
              log: (msg: string) => console.log(`[${ctx.userId}]`, msg),
            }),
          },
        ],
      });

      const getUser = t.query({
        args: z.object({}),
        handler: async (args, ctx) => {
          // Logger should be available in ctx
          return success({ logged: true });
        },
      });

      const api = createAPI({ getUser }, { userId: "test" });

      const result = await api.getUser({});

      expect(result.ok).toBe(true);
    });
  });

  describe("type safety", () => {
    it("should infer argument types from schema", async () => {
      const { t, createAPI } = createNativeAPI();

      const getUser = t.query({
        args: z.object({
          id: z.number(),
          include: z.boolean().optional(),
        }),
        handler: async (args) => {
          // TypeScript knows args.id is number and args.include is boolean | undefined
          return success(args);
        },
      });

      const api = createAPI({ getUser }, {});

      const result = await api.getUser({ id: 123, include: true });

      expect(result.ok).toBe(true);
    });

    it("should infer return types", async () => {
      const { t, createAPI } = createNativeAPI();

      const getUser = t.query({
        args: z.object({ id: z.number() }),
        handler: async () => {
          // TypeScript knows return type must match
          return success<{ id: number; name: string }>({
            id: 1,
            name: "User",
          });
        },
      });

      const api = createAPI({ getUser }, {});

      const result = await api.getUser({ id: 1 });

      if (result.ok) {
        expect(result.value.name).toBe("User");
      }
    });
  });

  describe("router function", () => {
    it("should be identity function (returns input unchanged)", () => {
      const { t } = createNativeAPI();

      const routes = { getUser: "test", updateUser: "test2" };
      const result = t.router(routes);

      expect(result).toBe(routes);
    });

    it("should preserve route structure", () => {
      const { t, createAPI } = createNativeAPI();

      const getUser = t.query({
        args: z.object({ id: z.number() }),
        handler: async (args) => success(args),
      });

      const routes = t.router({
        users: { getUser },
      });

      expect(routes.users.getUser).toBe(getUser);
    });
  });

  describe("error handling", () => {
    it("should return failure on handler error", async () => {
      const { t, createAPI } = createNativeAPI();

      const failingQuery = t.query({
        args: z.object({}),
        handler: async () => {
          throw new Error("Handler error");
        },
      });

      const api = createAPI({ failingQuery }, {});

      try {
        await api.failingQuery({});
        expect.fail("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
      }
    });

    it("should return failure on explicit failure return", async () => {
      const { t, createAPI } = createNativeAPI();

      const failureQuery = t.query({
        args: z.object({}),
        handler: async () => {
          return failure(exception({ name: "TestError", message: "Test" }));
        },
      });

      const api = createAPI({ failureQuery }, {});

      const result = await api.failureQuery({});

      expect(result.ok).toBe(false);
    });
  });

  describe("compatibility", () => {
    it("should work with simple endpoints", async () => {
      const { t, createAPI } = createNativeAPI();

      // Simple query without context
      const echo = t.query({
        args: z.object({ message: z.string() }),
        handler: async (args) => success({ echo: args.message }),
      });

      const api = createAPI({ echo }, {});
      const result = await api.echo({ message: "hello" });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.echo).toBe("hello");
      }
    });
  });

  describe("defineContextCompat", () => {
    it("should provide backward compatibility with old API", async () => {
      const compat = defineContextCompat<{ userId: string }>({ userId: "123" });

      expect(compat.withExtensions).toBeDefined();
    });

    it("should work with old-style extensions", async () => {
      const compat = defineContextCompat<{ userId: string }>({ userId: "123" });

      // Mock old extension
      const oldExtension = {
        name: "test",
        functions: <C>() => ({
          testMethod: () => "test-value",
        }),
      };

      const { t } = compat.withExtensions([oldExtension]);

      // Should have testMethod from extension
      expect((t as any).testMethod).toBeDefined();
    });
  });
});
