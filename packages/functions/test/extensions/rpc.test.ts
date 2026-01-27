import { describe, it, expect } from "vitest";
import { z } from "zod";
import { rpc } from "../../src/extensions/rpc";
import { defineContext } from "../../src/context/define";
import { success, failure } from "../../src/types";
import { exception } from "../../src/errors";

describe("RPC Extension", () => {
  describe("query builder", () => {
    it("should create a query function", async () => {
      const { t, createAPI } = defineContext().withExtensions([rpc]);

      const getUser = t.query({
        args: z.object({ id: z.number() }),
        handler: async (ctx, args) => success({ id: args.id, name: "User" }),
      });

      const api = createAPI({ root: { getUser } });

      expect(typeof api.getUser).toBe("function");
    });

    it("should execute query with valid arguments", async () => {
      const { t, createAPI } = defineContext().withExtensions([rpc]);

      const getUser = t.query({
        args: z.object({ id: z.number() }),
        handler: async (ctx, args) => success({ id: args.id, name: "User" }),
      });

      const api = createAPI({ root: { getUser } });
      const result = await api.getUser({ id: 123 });

      expect(result.isSuccess()).toBe(true);
      if (result.isSuccess()) {
        expect(result.value).toEqual({ id: 123, name: "User" });
      }
    });

    it("should validate query arguments", async () => {
      const { t, createAPI } = defineContext().withExtensions([rpc]);

      const getUser = t.query({
        args: z.object({ id: z.number() }),
        handler: async (ctx, args) => success(args),
      });

      const api = createAPI({ root: { getUser } });
      const result = await api.getUser({ id: "invalid" as any });

      expect(result.isFailure()).toBe(true);
    });

    it("should validate required fields", async () => {
      const { t, createAPI } = defineContext().withExtensions([rpc]);

      const getUser = t.query({
        args: z.object({ id: z.number(), name: z.string() }),
        handler: async (ctx, args) => success(args),
      });

      const api = createAPI({ root: { getUser } });
      const result = await api.getUser({ id: 123 } as any);

      expect(result.isFailure()).toBe(true);
      if (result.isFailure()) {
        expect(result.error).toHaveProperty("name", "ValidatedArgsError");
      }
    });

    it("should pass context to query handler", async () => {
      const context = { userId: "test-user" };

      const { t, createAPI } = defineContext(context).withExtensions([rpc]);

      const getUser = t.query({
        args: z.object({ id: z.number() }),
        handler: async (ctx, args) =>
          success({ id: args.id, requestedBy: ctx.userId }),
      });

      const api = createAPI({ root: { getUser } });
      const result = await api.getUser({ id: 123 });

      expect(result.isSuccess()).toBe(true);
      if (result.isSuccess()) {
        expect(result.value.requestedBy).toBe("test-user");
      }
    });

    it("should handle query handler returning failure", async () => {
      const { t, createAPI } = defineContext().withExtensions([rpc]);

      const failingQuery = t.query({
        args: z.object({}),
        handler: async (ctx, args) =>
          failure(exception({ name: "TestError", message: "Test error" })),
      });

      const api = createAPI({ root: { failingQuery } });
      const result = await api.failingQuery({});

      expect(result.isFailure()).toBe(true);
    });

    it("should support complex argument schemas", async () => {
      const { t, createAPI } = defineContext().withExtensions([rpc]);

      const complexQuery = t.query({
        args: z.object({
          user: z.object({
            id: z.number(),
            profile: z.object({
              name: z.string(),
              email: z.string().email(),
            }),
          }),
          options: z
            .object({
              includeHistory: z.boolean().optional(),
            })
            .optional(),
        }),
        handler: async (ctx, args) => success(args),
      });

      const api = createAPI({ root: { complexQuery } });

      const result = await api.complexQuery({
        user: {
          id: 1,
          profile: { name: "Test", email: "test@example.com" },
        },
      });

      expect(result.isSuccess()).toBe(true);
    });

    it("should support transformed arguments", async () => {
      const { t, createAPI } = defineContext().withExtensions([rpc]);

      const transformedQuery = t.query({
        args: z
          .object({ email: z.string() })
          .transform((data) => ({ ...data, email: data.email.toLowerCase() })),
        handler: async (ctx, args) => success(args),
      });

      const api = createAPI({ root: { transformedQuery } });

      const result = await api.transformedQuery({ email: "TEST@EXAMPLE.COM" });

      expect(result.isSuccess()).toBe(true);
      if (result.isSuccess()) {
        expect(result.value.email).toBe("test@example.com");
      }
    });
  });

  describe("mutation builder", () => {
    it("should create a mutation function", async () => {
      const { t, createAPI } = defineContext().withExtensions([rpc]);

      const createUser = t.mutation({
        args: z.object({ name: z.string() }),
        handler: async (ctx, args) => success({ id: 1, ...args }),
      });

      const api = createAPI({ root: { createUser } });

      expect(typeof api.createUser).toBe("function");
    });

    it("should execute mutation with valid arguments", async () => {
      const { t, createAPI } = defineContext().withExtensions([rpc]);

      const createUser = t.mutation({
        args: z.object({ name: z.string(), email: z.string() }),
        handler: async (ctx, args) => success({ id: 1, ...args }),
      });

      const api = createAPI({ root: { createUser } });
      const result = await api.createUser({ name: "Alice", email: "alice@example.com" });

      expect(result.isSuccess()).toBe(true);
      if (result.isSuccess()) {
        expect(result.value).toEqual({
          id: 1,
          name: "Alice",
          email: "alice@example.com",
        });
      }
    });

    it("should validate mutation arguments", async () => {
      const { t, createAPI } = defineContext().withExtensions([rpc]);

      const createUser = t.mutation({
        args: z.object({ name: z.string().min(3) }),
        handler: async (ctx, args) => success(args),
      });

      const api = createAPI({ root: { createUser } });
      const result = await api.createUser({ name: "AB" });

      expect(result.isFailure()).toBe(true);
    });

    it("should pass context to mutation handler", async () => {
      const context = { database: "test-db" };

      const { t, createAPI } = defineContext(context).withExtensions([rpc]);

      const createRecord = t.mutation({
        args: z.object({ value: z.string() }),
        handler: async (ctx, args) =>
          success({ database: ctx.database, ...args }),
      });

      const api = createAPI({ root: { createRecord } });
      const result = await api.createRecord({ value: "test" });

      expect(result.isSuccess()).toBe(true);
      if (result.isSuccess()) {
        expect(result.value.database).toBe("test-db");
      }
    });

    it("should handle mutation handler returning failure", async () => {
      const { t, createAPI } = defineContext().withExtensions([rpc]);

      const failingMutation = t.mutation({
        args: z.object({}),
        handler: async (ctx, args) =>
          failure(exception({ name: "TestError", message: "Mutation failed" })),
      });

      const api = createAPI({ root: { failingMutation } });
      const result = await api.failingMutation({});

      expect(result.isFailure()).toBe(true);
    });

    it("should support array arguments", async () => {
      const { t, createAPI } = defineContext().withExtensions([rpc]);

      const batchCreate = t.mutation({
        args: z.object({ items: z.array(z.object({ name: z.string() })) }),
        handler: async (ctx, args) =>
          success(args.items.map((item, index) => ({ id: index + 1, ...item }))),
      });

      const api = createAPI({ root: { batchCreate } });
      const result = await api.batchCreate({
        items: [{ name: "Item 1" }, { name: "Item 2" }],
      });

      expect(result.isSuccess()).toBe(true);
      if (result.isSuccess()) {
        expect(result.value).toEqual([
          { id: 1, name: "Item 1" },
          { id: 2, name: "Item 2" },
        ]);
      }
    });
  });

  describe("combined queries and mutations", () => {
    it("should support multiple queries in same API", async () => {
      const { t, createAPI } = defineContext().withExtensions([rpc]);

      const getUser = t.query({
        args: z.object({ id: z.number() }),
        handler: async (ctx, args) => success({ id: args.id, type: "user" }),
      });

      const getPost = t.query({
        args: z.object({ id: z.number() }),
        handler: async (ctx, args) => success({ id: args.id, type: "post" }),
      });

      const api = createAPI({ root: { getUser, getPost } });

      const userResult = await api.getUser({ id: 1 });
      const postResult = await api.getPost({ id: 2 });

      expect(userResult.isSuccess()).toBe(true);
      expect(postResult.isSuccess()).toBe(true);

      if (userResult.isSuccess() && postResult.isSuccess()) {
        expect(userResult.value.type).toBe("user");
        expect(postResult.value.type).toBe("post");
      }
    });

    it("should support queries and mutations in same API", async () => {
      const { t, createAPI } = defineContext({ counter: 0 }).withExtensions([rpc]);

      let counter = 0;

      const getCounter = t.query({
        args: z.object({}),
        handler: async (ctx) => success({ counter }),
      });

      const incrementCounter = t.mutation({
        args: z.object({}),
        handler: async (ctx) => success({ counter: ++counter }),
      });

      const api = createAPI({ root: { getCounter, incrementCounter } });

      const result1 = await api.getCounter({});
      const result2 = await api.incrementCounter({});
      const result3 = await api.getCounter({});

      expect(result1.isSuccess()).toBe(true);
      expect(result2.isSuccess()).toBe(true);
      expect(result3.isSuccess()).toBe(true);

      if (result1.isSuccess() && result2.isSuccess() && result3.isSuccess()) {
        expect(result1.value.counter).toBe(0);
        expect(result2.value.counter).toBe(1);
        expect(result3.value.counter).toBe(1);
      }
    });
  });

  describe("type inference", () => {
    it("should infer handler argument types from schema", async () => {
      const { t, createAPI } = defineContext().withExtensions([rpc]);

      const typedQuery = t.query({
        args: z.object({ id: z.number(), name: z.string() }),
        handler: async (ctx, args) => {
          // TypeScript should know that args.id is number and args.name is string
          return success({ id: args.id, name: args.name.toUpperCase() });
        },
      });

      const api = createAPI({ root: { typedQuery } });
      const result = await api.typedQuery({ id: 123, name: "test" });

      expect(result.isSuccess()).toBe(true);
    });

    it("should infer handler return type", async () => {
      const { t, createAPI } = defineContext().withExtensions([rpc]);

      const typedQuery = t.query({
        args: z.object({}),
        handler: async (ctx, args) => success<string, Error>("test value"),
      });

      const api = createAPI({ root: { typedQuery } });
      const result = await api.typedQuery({});

      expect(result.isSuccess()).toBe(true);
    });
  });

  describe("error handling", () => {
    it("should return validation error for invalid data", async () => {
      const { t, createAPI } = defineContext().withExtensions([rpc]);

      const strictQuery = t.query({
        args: z.object({
          age: z.number().min(0).max(120),
        }),
        handler: async (ctx, args) => success(args),
      });

      const api = createAPI({ root: { strictQuery } });
      const result = await api.strictQuery({ age: 150 });

      expect(result.isFailure()).toBe(true);
      if (result.isFailure()) {
        expect(result.error).toHaveProperty("name", "ValidatedArgsError");
        expect(result.error.message).toBeDefined();
        expect(result.error.message.length).toBeGreaterThan(0);
      }
    });

    it("should include all validation errors", async () => {
      const { t, createAPI } = defineContext().withExtensions([rpc]);

      const strictMutation = t.mutation({
        args: z.object({
          username: z.string().min(3),
          email: z.string().email(),
          age: z.number().min(18),
        }),
        handler: async (ctx, args) => success(args),
      });

      const api = createAPI({ root: { strictMutation } });
      const result = await api.strictMutation({
        username: "ab",
        email: "invalid",
        age: 15,
      });

      expect(result.isFailure()).toBe(true);
    });
  });

  describe("edge cases", () => {
    it("should handle empty args schema", async () => {
      const { t, createAPI } = defineContext().withExtensions([rpc]);

      const noArgsQuery = t.query({
        args: z.object({}),
        handler: async (ctx, args) => success({ message: "No args needed" }),
      });

      const api = createAPI({ root: { noArgsQuery } });
      const result = await api.noArgsQuery({});

      expect(result.isSuccess()).toBe(true);
    });

    it("should handle optional arguments", async () => {
      const { t, createAPI } = defineContext().withExtensions([rpc]);

      const optionalArgsQuery = t.query({
        args: z.object({ name: z.string(), nickname: z.string().optional() }),
        handler: async (ctx, args) => success(args),
      });

      const api = createAPI({ root: { optionalArgsQuery } });
      const result = await api.optionalArgsQuery({ name: "Alice" });

      expect(result.isSuccess()).toBe(true);
    });

    it("should handle default values", async () => {
      const { t, createAPI } = defineContext().withExtensions([rpc]);

      const defaultArgsQuery = t.query({
        args: z.object({ name: z.string(), role: z.string().default("user") }),
        handler: async (ctx, args) => success(args),
      });

      const api = createAPI({ root: { defaultArgsQuery } });
      const result = await api.defaultArgsQuery({ name: "Alice" });

      expect(result.isSuccess()).toBe(true);
      if (result.isSuccess()) {
        expect(result.value.role).toBe("user");
      }
    });

    it("should handle nullable fields", async () => {
      const { t, createAPI } = defineContext().withExtensions([rpc]);

      const nullableQuery = t.query({
        args: z.object({ name: z.string().nullable() }),
        handler: async (ctx, args) => success(args),
      });

      const api = createAPI({ root: { nullableQuery } });

      const result1 = await api.nullableQuery({ name: "Alice" });
      expect(result1.isSuccess()).toBe(true);

      const result2 = await api.nullableQuery({ name: null });
      expect(result2.isSuccess()).toBe(true);
    });

    it("should handle union types in args", async () => {
      const { t, createAPI } = defineContext().withExtensions([rpc]);

      const unionQuery = t.query({
        args: z.object({
          value: z.union([z.string(), z.number()]),
        }),
        handler: async (ctx, args) => success({ type: typeof args.value, value: args.value }),
      });

      const api = createAPI({ root: { unionQuery } });

      const result1 = await api.unionQuery({ value: "string" });
      const result2 = await api.unionQuery({ value: 42 });

      expect(result1.isSuccess()).toBe(true);
      expect(result2.isSuccess()).toBe(true);

      if (result1.isSuccess() && result2.isSuccess()) {
        expect(result1.value.type).toBe("string");
        expect(result2.value.type).toBe("number");
      }
    });
  });
});
