// Generated from Binding IR SHA-256 3c79b04031f90de64c417ca26618d0dd4a6fb65afa89141d60ada7f28015e766.
/**
 * Independent corpus contract.
 */
export declare function aliasArguments(value0: ReadonlyArray<Readonly<{ tag: "none" }> | Readonly<{ tag: "some"; value: bigint }>>, value1: ReadonlyArray<Readonly<{ tag: "none" }> | Readonly<{ tag: "some"; value: bigint }>>): ReadonlyArray<Readonly<{ tag: "none" }> | Readonly<{ tag: "some"; value: bigint }>>;

/**
 * Independent corpus contract.
 */
export declare function aliasPair(value0: readonly [ReadonlyArray<Readonly<{ tag: "none" }> | Readonly<{ tag: "some"; value: bigint }>>, ReadonlyArray<Readonly<{ tag: "none" }> | Readonly<{ tag: "some"; value: bigint }>>]): readonly [ReadonlyArray<Readonly<{ tag: "none" }> | Readonly<{ tag: "some"; value: bigint }>>, ReadonlyArray<Readonly<{ tag: "none" }> | Readonly<{ tag: "some"; value: bigint }>>];

/**
 * Independent corpus contract.
 */
export declare function arrays(value0: ReadonlyArray<bigint>): ReadonlyArray<bigint>;

/**
 * Independent corpus contract.
 */
export declare function branch(value0: Readonly<{ ok: bigint }> | Readonly<{ error: string }>): Readonly<{ ok: bigint }> | Readonly<{ error: string }>;

/**
 * Independent corpus contract.
 */
export declare function byteBranches(value0: ReadonlyArray<Readonly<{ tag: "none" }> | Readonly<{ tag: "some"; value: readonly [number, bigint] }>>): ReadonlyArray<Readonly<{ tag: "none" }> | Readonly<{ tag: "some"; value: readonly [number, bigint] }>>;

/**
 * Independent corpus contract.
 */
export declare function lists(value0: ReadonlyArray<bigint>): ReadonlyArray<bigint>;

/**
 * Independent corpus contract.
 */
export declare function nested(value0: ReadonlyArray<ReadonlyArray<Readonly<{ tag: "none" }> | Readonly<{ tag: "some"; value: readonly [bigint, bigint] }>>>): bigint;

/**
 * Independent corpus contract.
 */
export declare function options(value0: Readonly<{ tag: "none" }> | Readonly<{ tag: "some"; value: bigint }>): Readonly<{ tag: "none" }> | Readonly<{ tag: "some"; value: bigint }>;

/**
 * Independent corpus contract.
 */
export declare function plainFin(value0: ReadonlyArray<Readonly<{ tag: "none" }> | Readonly<{ tag: "some"; value: bigint }>>): bigint;

/**
 * Independent corpus contract.
 */
export declare function product(value0: readonly [bigint, string]): readonly [bigint, string];

/**
 * Independent corpus contract.
 */
export declare function scalar(value0: bigint): bigint;

/**
 * Independent corpus contract.
 */
export declare function specialized(value0: ReadonlyArray<bigint>): ReadonlyArray<bigint>;

declare const bindings: Readonly<{
  readonly aliasArguments: typeof aliasArguments;
  readonly aliasPair: typeof aliasPair;
  readonly arrays: typeof arrays;
  readonly branch: typeof branch;
  readonly byteBranches: typeof byteBranches;
  readonly lists: typeof lists;
  readonly nested: typeof nested;
  readonly options: typeof options;
  readonly plainFin: typeof plainFin;
  readonly product: typeof product;
  readonly scalar: typeof scalar;
  readonly specialized: typeof specialized;
}>;
export default bindings;
