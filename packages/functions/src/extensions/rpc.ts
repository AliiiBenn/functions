import z, { ZodType } from "zod";
import { Exception } from "../errors/types";
import { AsyncResult, failure } from "../types";
import { HKT } from "../utils/hkt";
import { extension, withKind } from ".";
import { parseArgs } from "../functions/parse";

/**
 * Type definition for the core API (query and mutation methods)
 */
type CoreAPI<C> = {
  /**
   * Creates a query endpoint for read-only operations.
   *
   * Queries are used for fetching data without side effects.
   *
   * @template Args - Zod schema type for input arguments
   * @template Output - Return type on success
   * @template Error - Exception type on failure (default: Exception)
   * @param options - Query configuration
   * @param options.args - Zod schema for input validation
   * @param options.handler - Async handler function receiving (context, arguments)
   * @returns A query function that can be called with validated input
   *
   * @example
   * ```ts
   * const getUser = t.query({
   *   args: z.object({ id: z.number() }),
   *   handler: async (ctx, args) => {
   *     // ctx has the context type (e.g., { userId: string })
   *     // args is validated and typed as { id: number }
   *     return success({ id: args.id, name: "User" });
   *   },
   * });
   * ```
   */
  query: <
    Args extends ZodType<any, any, any>,
    Output,
    Error extends Exception
  >(options: {
    args: Args;
    handler: (ctx: C, args: z.infer<Args>) => AsyncResult<Output, Error>;
  }) => (
    contextProvider: () => Promise<C>
  ) => (input: z.input<Args>) => AsyncResult<Output, Error>;

  /**
   * Creates a mutation endpoint for write operations.
   *
   * Mutations are used for operations that modify data or have side effects.
   *
   * @template Args - Zod schema type for input arguments
   * @template Output - Return type on success
   * @template Error - Exception type on failure (default: Exception)
   * @param options - Mutation configuration
   * @param options.args - Zod schema for input validation
   * @param options.handler - Async handler function receiving (context, arguments)
   * @returns A mutation function that can be called with validated input
   *
   * @example
   * ```ts
   * const createUser = t.mutation({
   *   args: z.object({ name: z.string(), email: z.string().email() }),
   *   handler: async (ctx, args) => {
   *     // Create user in database
   *     const user = await db.users.create(args);
   *     return success(user);
   *   },
   * });
   * ```
   *
   * @example
   * ```ts
   * // With error handling
   * const deleteUser = t.mutation({
   *   args: z.object({ id: z.number() }),
   *   handler: async (ctx, args) => {
   *     const deleted = await db.users.delete(args.id);
   *     if (!deleted) {
   *       return failure(exception({
   *         name: "UserNotFound",
   *         message: `User ${args.id} not found`
   *       }));
   *     }
   *     return success({ deleted: true });
   *   },
   * });
   * ```
   */
  mutation: <
    Args extends ZodType<any, any, any>,
    Output,
    Error extends Exception
  >(options: {
    args: Args;
    handler: (ctx: C, args: z.infer<Args>) => AsyncResult<Output, Error>;
  }) => (
    contextProvider: () => Promise<C>
  ) => (input: z.input<Args>) => AsyncResult<Output, Error>;
};

/**
 * HKT interface for the core API
 */
interface MutationHKT extends HKT {
  new: CoreAPI<this["_C"]>;
}

/**
 * RPC extension that provides query and mutation builders.
 *
 * This is the main extension for creating type-safe API endpoints.
 *
 * @example
 * ```ts
 * import { defineContext, rpc } from "@deessejs/functions";
 *
 * const { t, createAPI } = defineContext()
 *   .withExtensions([rpc]);
 *
 * // Define queries
 * const getUser = t.query({
 *   args: z.object({ id: z.number() }),
 *   handler: async (ctx, args) => {
 *     return success({ id: args.id, name: "User" });
 *   },
 * });
 *
 * // Define mutations
 * const createUser = t.mutation({
 *   args: z.object({ name: z.string() }),
 *   handler: async (ctx, args) => {
 *     return success({ id: 1, name: args.name });
 *   },
 * });
 *
 * // Create the API
 * const api = createAPI({
 *   root: { getUser, createUser },
 *   runtimeContext: {}
 * });
 * ```
 */
export const rpc = withKind<MutationHKT>()(
  extension({
    name: "core",
    functions: <C>() => ({
      query: (options: any) => (contextProvider: () => Promise<C>) => async (input: any) => {
        const parsed = parseArgs(options.args, input);
        return parsed.match({
          onSuccess: async (data: any) => {
            const ctx = await contextProvider();
            return options.handler(ctx, data);
          },
          onFailure: (error: Exception) => Promise.resolve(failure(error)),
        });
      },
      mutation: (options: any) => (contextProvider: () => Promise<C>) => async (input: any) => {
        const parsed = parseArgs(options.args, input);
        return parsed.match({
          onSuccess: async (data: any) => {
            const ctx = await contextProvider();
            return options.handler(ctx, data);
          },
          onFailure: (error: Exception) => Promise.resolve(failure(error)),
        });
      },
    }),
  })
);
