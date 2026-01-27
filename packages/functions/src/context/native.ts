import { z, ZodType } from "zod";
import { Exception } from "../errors/types";
import { Result, success, failure } from "../types";
import { exception } from "../errors";

/**
 * Runtime query definition that can be executed
 */
type QueryFunction<Args, Output, Error> = (input: Args, context: any) => Promise<Result<Output, Error>>;

/**
 * Runtime mutation definition that can be executed
 */
type MutationFunction<Args, Output, Error> = (input: Args, context: any) => Promise<Result<Output, Error>>;

/**
 * Type-safe query definition
 */
export interface QueryDefinition<C, Args, Output, Error extends Exception = Exception> {
  readonly _type: "query";
  readonly args: ZodType<Args>;
  readonly handler: (args: Args, ctx: C) => Promise<Result<Output, Error>>;
}

/**
 * Type-safe mutation definition
 */
export interface MutationDefinition<C, Args, Output, Error extends Exception = Exception> {
  readonly _type: "mutation";
  readonly args: ZodType<Args>;
  readonly handler: (args: Args, ctx: C) => Promise<Result<Output, Error>>;
}

/**
 * Native API builder with query, mutation, and router methods
 * No HKT, no complex type magic - just straightforward TypeScript
 */
export type NativeAPI<C> = {
  /**
   * Creates a query endpoint for read-only operations
   *
   * @template Args - Input arguments type (inferred from Zod schema)
   * @template Output - Return type on success
   * @template Error - Exception type on failure
   * @param options - Query configuration
   * @returns A query function that can be executed with validated input
   */
  query: <
    Args extends ZodType<any, any, any>,
    Output,
    Error extends Exception = Exception
  >(
    options: {
      args: Args;
      handler: (args: z.infer<Args>, ctx: C) => Promise<Result<Output, Error>>;
    }
  ) => QueryDefinition<C, z.infer<Args>, Output, Error>;

  /**
   * Creates a mutation endpoint for write operations
   *
   * @template Args - Input arguments type (inferred from Zod schema)
   * @template Output - Return type on success
   * @template Error - Exception type on failure
   * @param options - Mutation configuration
   * @returns A mutation function that can be executed with validated input
   */
  mutation: <
    Args extends ZodType<any, any, any>,
    Output,
    Error extends Exception = Exception
  >(
    options: {
      args: Args;
      handler: (args: z.infer<Args>, ctx: C) => Promise<Result<Output, Error>>;
    }
  ) => MutationDefinition<C, z.infer<Args>, Output, Error>;

  /**
   * Groups endpoints together (organizational only, identity function)
   *
   * @template R - Routes object type
   * @param routes - Object containing endpoint definitions
   * @returns The same routes object (no transformation)
   *
   * @example
   * ```ts
   * const api = t.router({
   *   users: t.router({
   *     get: t.query({ ... }),
   *     list: t.query({ ... }),
   *   }),
   *   posts: t.router({
   *     get: t.query({ ... }),
   *   })
   * });
   * ```
   */
  router: <R extends Record<string, any>>(routes: R) => R;
};

/**
 * Options for creating a native API
 */
export interface NativeAPIOptions<C> {
  /**
   * Initial context values
   */
  context?: C;

  /**
   * Extensions to add (simple, no HKT)
   */
  extensions?: NativeExtension<C>[];
}

/**
 * Simple extension without HKT complexity
 */
export interface NativeExtension<C> {
  /**
   * Extension name (for debugging)
   */
  name: string;

  /**
   * Add context at runtime
   */
  context?: (ctx: C) => Partial<C> | Promise<Partial<C>>;

  /**
   * Additional methods to add to the API
   */
  methods?: Record<string, (...args: any[]) => any>;
}

/**
 * Creates a native context builder with query, mutation, and router methods
 *
 * This is the new simplified API that replaces the HKT-based system.
 *
 * @template C - Context type
 * @param options - Configuration options
 * @returns Object with API builder (t) and createAPI function
 *
 * @example
 * ```ts
 * // Simple usage
 * const { t, createAPI } = createNativeAPI({
 *   context: { userId: "123" }
 * });
 *
 * const getUser = t.query({
 *   args: z.object({ id: z.number() }),
 *   handler: async (args, ctx) => {
 *     return success({ id: args.id, requestedBy: ctx.userId });
 *   },
 * });
 *
 * const api = createAPI({
 *   root: { getUser },
 *   context: { userId: "123" }
 * });
 * ```
 */
export function createNativeAPI<C = {}>(options: NativeAPIOptions<Partial<C>> = {}): {
  type ContextType = C extends Record<string, never> ? {} : C;

  return {
    /**
     * API builder object
     */
    t: {
      query: <
        Args extends ZodType<any, any, any>,
        Output,
        Error extends Exception = Exception
      >(
        definition: {
          args: Args;
          handler: (args: z.infer<Args>, ctx: ContextType) => Promise<Result<Output, Error>>;
        }
      ): QueryDefinition<ContextType, z.infer<Args>, Output, Error> => {
        return {
          _type: "query",
          args: definition.args,
          handler: definition.handler,
        } as any;
      },

      mutation: <
        Args extends ZodType<any, any, any>,
        Output,
        Error extends Exception = Exception
      >(
        definition: {
          args: Args;
          handler: (args: z.infer<Args>, ctx: ContextType) => Promise<Result<Output, Error>>;
        }
      ): MutationDefinition<ContextType, z.infer<Args>, Output, Error> => {
        return {
          _type: "mutation",
          args: definition.args,
          handler: definition.handler,
        } as any;
      },

      router: <R extends Record<string, any>>(routes: R): R => {
        return routes;
      },
    } as NativeAPI<ContextType>,

    /**
     * Creates a runtime API from endpoint definitions
     *
     * @param root - Root object containing endpoints
     * @param runtimeContext - Runtime context to inject
     * @returns Activated API
     */
    createAPI: <Root extends Record<string, any>>(
      root: Root,
      runtimeContext: ContextType
    ): Root => {
      return activateAPI(root, runtimeContext, options.extensions || []);
    },
  };
}

/**
 * Recursively activate API by injecting context into all functions
 */
function activateAPI<C>(
  node: any,
  context: C,
  extensions: NativeExtension<C>[]
): any {
  // If it's a function, activate it with context
  if (typeof node === "function") {
    // Check if it's a query or mutation definition
    if (node._type === "query" || node._type === "mutation") {
      return async (input: any) => {
        // Parse and validate arguments
        const parsed = node.args.safeParse(input);
        if (!parsed.success) {
          return failure(
            exception({
              name: "ValidationError",
              message: parsed.error.message,
            })
          );
        }

        // Build full context
        let fullContext = { ...context };
        for (const ext of extensions) {
          if (ext.context) {
            const partial = await ext.context(fullContext as C);
            fullContext = { ...fullContext, ...partial };
          }
        }

        // Call handler
        return node.handler(parsed.data, fullContext);
      };
    }
    return node;
  }

  // If it's an object, recursively activate its properties
  if (typeof node === "object" && node !== null) {
    const result: any = {};
    for (const key in node) {
      // Skip prototype properties
      if (!Object.prototype.hasOwnProperty.call(node, key)) continue;
      result[key] = activateAPI(node[key], context, extensions);
    }
    return result;
  }

  // Otherwise return as-is
  return node;
}

/**
 * Legacy wrapper to provide backward compatibility with old API
 * Maps old API to new native API
 */
export function defineContextCompat<C = {}>(defaultContext?: Partial<C>) {
  return {
    withExtensions: (extensions: any[]) => {
      // Map old extensions to new native extensions
      const nativeExtensions: NativeExtension<any>[] = extensions.map((ext) => ({
        name: ext.name,
        context: ext.request ? async (state: any, ctx: any) => {
          if (ext.request) {
            return await ext.request(state, ctx);
          }
          return {};
        } : undefined,
        methods: ext.functions ? ext.functions() : undefined,
      }));

      const { t, createAPI } = createNativeAPI<any>({
        context: defaultContext,
        extensions: nativeExtensions,
      });

      // Old API returned { t, createAPI }
      return {
        t: {
          ...t,
          // Add methods from extensions
          ...nativeExtensions.reduce((acc, ext) => ({
            ...acc,
            ...(ext.methods || {})
          }), {} as any)
        },
        createAPI: (options: any) => createAPI(options.root, options.runtimeContext || {})
      };
    },
  };
}
