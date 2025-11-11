export type Maybe<T> = Some<T> | None;

export type Some<T> = {
  readonly _tag: "Some";
  readonly value: T;
  isSome(): this is Some<T>;
  isNone(): this is None;
  match<U>(handlers: {
    onSome: (value: T) => U;
    onNone: () => U;
  }): U;
};

export type None = {
  readonly _tag: "None";
  isSome(): this is Some<never>;
  isNone(): this is None;
  match<U>(handlers: {
    onSome: (value: never) => U;
    onNone: () => U;
  }): U;
};

export const some = <T>(value: T): Some<T> => ({
  _tag: "Some",
  value,
  isSome(): this is Some<T> {
    return true;
  },
  isNone(): this is None {
    return false;
  },
  match<U>({ onSome }: { onSome: (value: T) => U; onNone: () => U }): U {
    return onSome(value);
  },
});

export const none = (): None => ({
  _tag: "None",
  isSome(): this is Some<never> {
    return false;
  },
  isNone(): this is None {
    return true;
  },
  match<U>({ onNone }: { onSome: (value: never) => U; onNone: () => U }): U {
    return onNone();
  },
});

