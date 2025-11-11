import { Result } from "./result";
import { tryCatchAsync } from "./try";

export type AsyncResult<T, E> = Promise<Result<T, E>>;

export const from = <T, E = Error>(
  fn: () => Promise<T>,
): AsyncResult<T, E> => tryCatchAsync(fn);

