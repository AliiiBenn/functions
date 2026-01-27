import { Exception } from "../errors/types";

/**
 * A Result type that represents either success with a value or failure with an error.
 *
 * This is a type-safe alternative to throwing exceptions, allowing you to handle
 * errors explicitly without try-catch blocks.
 *
 * @template T - The success value type
 * @template E - The error type (default: Exception)
 *
 * @example
 * ```ts
 * function divide(a: number, b: number): Result<number, Error> {
 *   if (b === 0) {
 *     return failure(new Error("Division by zero"));
 *   }
 *   return success(a / b);
 * }
 *
 * const result = divide(10, 2);
 *
 * if (result.isSuccess()) {
 *   console.log(result.value); // 5
 * } else {
 *   console.error(result.error); // Handle error
 * }
 * ```
 *
 * @example
 * ```ts
 * // Using match for pattern matching
 * result.match({
 *   onSuccess: (value) => console.log("Result:", value),
 *   onFailure: (error) => console.error("Error:", error),
 * });
 * ```
 */
export type Result<T, E = Exception> = Success<T> | Failure<E>;

/**
 * Represents a successful operation containing a value.
 *
 * @template T - The type of the success value
 *
 * @example
 * ```ts
 * const success: Success<number> = {
 *   _tag: "Success",
 *   value: 42,
 *   isSuccess() { return true; },
 *   isFailure() { return false; },
 *   match<U>(handlers) { return handlers.onSuccess(this.value); }
 * };
 * ```
 */
export type Success<T> = {
  /** Discriminator tag for type narrowing */
  readonly _tag: "Success";
  /** The success value */
  readonly value: T;

  /**
   * Type guard: Check if this is a Success
   *
   * @returns true (this is a Success)
   *
   * @example
   * ```ts
   * if (result.isSuccess()) {
   *   console.log(result.value); // TypeScript knows this is Success
   * }
   * ```
   */
  isSuccess(): this is Success<T>;

  /**
   * Type guard: Check if this is a Failure
   *
   * @returns false (this is a Success, not a Failure)
   */
  isFailure(): this is Failure<never>;

  /**
   * Pattern matching: Handle both success and failure cases
   *
   * @template U - The return type of the handlers
   * @param handlers - Object with onSuccess and onFailure handlers
   * @param handlers.onSuccess - Called for Success results
   * @param handlers.onFailure - Never called (Success has no error)
   * @returns The result of calling the appropriate handler
   *
   * @example
   * ```ts
   * result.match({
   *   onSuccess: (value) => `Got: ${value}`,
   *   onFailure: (error) => `Error: ${error.message}`,
   * });
   * ```
   */
  match<U>(handlers: {
    onSuccess: (value: T) => U;
    onFailure: (error: never) => U;
  }): U;
};

/**
 * Represents a failed operation containing an error.
 *
 * @template E - The type of the error
 *
 * @example
 * ```ts
 * const failure: Failure<Error> = {
 *   _tag: "Failure",
 *   error: new Error("Something went wrong"),
 *   isSuccess() { return false; },
 *   isFailure() { return true; },
 *   match<U>(handlers) { return handlers.onFailure(this.error); }
   };
 * ```
 */
export type Failure<E> = {
  /** Discriminator tag for type narrowing */
  readonly _tag: "Failure";
  /** The error value */
  readonly error: E;

  /**
   * Type guard: Check if this is a Success
   *
   * @returns false (this is a Failure, not a Success)
   */
  isSuccess(): this is Success<never>;

  /**
   * Type guard: Check if this is a Failure
   *
   * @returns true (this is a Failure)
   *
   * @example
   * ```ts
   * if (result.isFailure()) {
   *   console.error(result.error); // TypeScript knows this is Failure
   * }
   * ```
   */
  isFailure(): this is Failure<E>;

  /**
   * Pattern matching: Handle both success and failure cases
   *
   * @template U - The return type of the handlers
   * @param handlers - Object with onSuccess and onFailure handlers
   * @param handlers.onSuccess - Never called (Failure has no value)
   * @param handlers.onFailure - Called for Failure results
   * @returns The result of calling the appropriate handler
   *
   * @example
   * ```ts
   * result.match({
   *   onSuccess: (value) => `Got: ${value}`,
   *   onFailure: (error) => `Error: ${error.message}`,
   * });
   * ```
   */
  match<U>(handlers: {
    onSuccess: (value: never) => U;
    onFailure: (error: E) => U;
  }): U;
};

/**
 * Creates a Success result containing a value.
 *
 * @template T - The type of the value
 * @param value - The success value
 * @returns A Success result
 *
 * @example
 * ```ts
 * const result = success(42);
 * if (result.isSuccess()) {
 *   console.log(result.value); // 42
 * }
 * ```
 */
export const success = <T>(value: T): Success<T> => ({
  _tag: "Success",
  value,
  isSuccess(): this is Success<T> {
    return true;
  },
  isFailure(): this is Failure<never> {
    return false;
  },
  match<U>(handlers: {
    onSuccess: (value: T) => U;
    onFailure: (error: never) => U;
  }): U {
    return handlers.onSuccess(value);
  },
});

/**
 * Creates a Failure result containing an error.
 *
 * @template E - The type of the error
 * @param error - The error value
 * @returns A Failure result
 *
 * @example
 * ```ts
 * const result = failure(new Error("Something went wrong"));
 * if (result.isFailure()) {
 *   console.error(result.error.message);
 * }
 * ```
 */
export const failure = <E>(error: E): Failure<E> => ({
  _tag: "Failure",
  error,
  isSuccess(): this is Success<never> {
    return false;
  },
  isFailure(): this is Failure<E> {
    return true;
  },
  match<U>(handlers: {
    onSuccess: (value: never) => U;
    onFailure: (error: E) => U;
  }): U {
    return handlers.onFailure(error);
  },
});
