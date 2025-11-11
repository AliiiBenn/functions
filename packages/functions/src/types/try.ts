import { AsyncResult } from "./async-result";
import { failure, Result, success } from "./result";

export type Try<T> = () => T;

export const tryCatch = <T, E = unknown>(fn: Try<T>): Result<T, E> => {
  try {
    return success(fn());
  } catch (error) {
    return failure(error as E);
  }
};

export const tryCatchAsync = async <T, E = unknown>(
  fn: () => Promise<T> | T,
): AsyncResult<T, E> => {
  try {
    const value = await Promise.resolve(fn());
    return success<T>(value);
  } catch (error) {
    return failure<E>(error as E);
  }
};
