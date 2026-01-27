import { ExtensionWithHKT, ExtractContext, MergeAPIs, TransformAPI } from "../extensions/types";
import { UnionToIntersection } from "../utils";

/**
 * Creates a context builder for defining type-safe APIs with context management.
 *
 * @template InitCtx - The type of the initial context (default: {})
 * @param defaultContext - Optional default context values
 * @returns A context builder with `withExtensions` method
 *
 * @example
 * ```ts
 * // Create a context builder with typed context
 * const { t, createAPI } = defineContext<{ userId: string }>({
 *   userId: "default-user"
 * }).withExtensions([rpc]);
 * ```
 *
 * @example
 * ```ts
 * // Create without default context
 * const { t, createAPI } = defineContext().withExtensions([rpc]);
 * ```
 */
export const defineContext = <const InitCtx = {}>(defaultContext: InitCtx = {} as any) => ({

  /**
   * Adds extensions to the context builder.
   *
   * Extensions provide additional functionality like query/mutation builders,
   * logging, caching, etc.
   *
   * @template Exts - Array of extension types
   * @param extensions - Array of extensions to add
   * @returns Object containing `t` (API builder) and `createAPI` (runtime factory)
   *
   * @example
   * ```ts
   * const { t, createAPI } = defineContext()
   *   .withExtensions([rpc, loggingExtension, cacheExtension]);
   * ```
   */
  withExtensions: <const Exts extends readonly ExtensionWithHKT<any>[]>(
    extensions: Exts
  ) => {

    /**
     * @ignore
     * Final context type after merging default context and extension contexts
     */
    type FinalCtx = InitCtx &
      UnionToIntersection<ExtractContext<Exts[number]>>;

    /**
     * @ignore
     * API type with query, mutation, and router methods
     */
    type T_API = MergeAPIs<Exts, FinalCtx> & {
      router: <R>(routes: R) => R;
    };

    // --- Runtime t ---
    /**
     * API builder object containing query, mutation, and router methods.
     *
     * Used to define typed API endpoints.
     *
     * @example
     * ```ts
     * const getUser = t.query({
     *   args: z.object({ id: z.number() }),
     *   handler: async (ctx, args) => {
     *     return success({ id: args.id, name: "User" });
     *   },
     * });
     * ```
     */
    const t = extensions.reduce(
      (acc, ext) => ({
        ...acc,
        ...(ext.functions ? ext.functions() : {})
      }),
      { router: (r: any) => r }
    ) as T_API;

    // --- Runtime createAPI ---
    /**
     * Creates a runtime API from defined endpoints.
     *
     * Activates all query/mutation functions by injecting context.
     *
     * @template Root - Type of the root object containing endpoints
     * @param options - Configuration options
     * @param options.root - Root object containing query/mutation definitions
     * @param options.context - Optional context override (static or async function)
     * @returns Activated API with all endpoints ready to call
     *
     * @example
     * ```ts
     * const api = createAPI({
     *   root: {
     *     getUser,
     *     createUser,
     *   },
     *   runtimeContext: { userId: "123" }
     * });
     *
     * // Call the endpoints
     * const result = await api.getUser({ id: 123 });
     * ```
     *
     * @example
     * ```ts
     * // With async context
     * const api = createAPI({
     *   root: { getUser },
     *   runtimeContext: async () => {
     *     const user = await fetchUser();
     *     return { userId: user.id };
     *   }
     * });
     * ```
     */
    const createAPI = <Root>(options: {
      root: Root;
      runtimeContext?: InitCtx | (() => Promise<InitCtx> | InitCtx);
    }): TransformAPI<Root> => {

      /**
       * @ignore
       * Extension states Map
       */
      const states = new Map();

      /**
       * @ignore
       * Initialize all extensions
       */
      extensions.forEach((e) => e.init && states.set(e.name, e.init()));

      /**
       * @ignore
       * Get the runtime context by merging default, provided, and extension contexts
       */
      const getContext = async () => {
        let base: any = defaultContext;
        if (options.runtimeContext) {
          base = typeof options.runtimeContext === 'function'
            ? await (options.runtimeContext as Function)()
            : options.runtimeContext;
        }

        let ctx = { ...base };
        for (const ext of extensions) {
          if (ext.request) {
            const part = await ext.request(states.get(ext.name), ctx);
            ctx = { ...ctx, ...part };
          }
        }
        return ctx;
      };

      /**
       * @ignore
       * Recursively activate all functions in the API tree
       */
      const activate = (node: any): any => {
        if (typeof node === "function") return node(getContext);
        if (typeof node === "object" && node !== null) {
          const res: any = {};
          for (const k in node) res[k] = activate(node[k]);
          return res;
        }
        return node;
      };

      return activate(options.root);
    };

    return { t, createAPI };
  },
});
