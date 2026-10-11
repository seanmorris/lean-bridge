// Generated from Binding IR SHA-256 135475dc7186ce36f93cb1d31171d6f2c2d6c814e762fe0a1a284f854105599d.
/**
 * Call StructuralSubtypes.aliasArguments.
 */
export declare function aliasArguments(arg0: ReadonlyArray<Readonly<{ tag: "none" }> | Readonly<{ tag: "some"; value: bigint }>>, arg1: ReadonlyArray<Readonly<{ tag: "none" }> | Readonly<{ tag: "some"; value: bigint }>>): ReadonlyArray<Readonly<{ tag: "none" }> | Readonly<{ tag: "some"; value: bigint }>>;

/**
 * Call StructuralSubtypes.aliasPair.
 */
export declare function aliasPair(arg0: readonly [ReadonlyArray<Readonly<{ tag: "none" }> | Readonly<{ tag: "some"; value: bigint }>>, ReadonlyArray<Readonly<{ tag: "none" }> | Readonly<{ tag: "some"; value: bigint }>>]): readonly [ReadonlyArray<Readonly<{ tag: "none" }> | Readonly<{ tag: "some"; value: bigint }>>, ReadonlyArray<Readonly<{ tag: "none" }> | Readonly<{ tag: "some"; value: bigint }>>];

/**
 * Call StructuralSubtypes.arrays.
 */
export declare function arrays(arg0: ReadonlyArray<bigint>): ReadonlyArray<bigint>;

/**
 * Call StructuralSubtypes.branch.
 */
export declare function branch(arg0: Readonly<{ ok: bigint }> | Readonly<{ error: string }>): Readonly<{ ok: bigint }> | Readonly<{ error: string }>;

/**
 * Call StructuralSubtypes.byteBranches.
 */
export declare function byteBranches(arg0: ReadonlyArray<Readonly<{ tag: "none" }> | Readonly<{ tag: "some"; value: readonly [number, bigint] }>>): ReadonlyArray<Readonly<{ tag: "none" }> | Readonly<{ tag: "some"; value: readonly [number, bigint] }>>;

/**
 * Call StructuralSubtypes.lists.
 */
export declare function lists(arg0: ReadonlyArray<bigint>): ReadonlyArray<bigint>;

/**
 * Call StructuralSubtypes.nested.
 */
export declare function nested(arg0: ReadonlyArray<ReadonlyArray<Readonly<{ tag: "none" }> | Readonly<{ tag: "some"; value: readonly [bigint, bigint] }>>>): bigint;

/**
 * Call StructuralSubtypes.options.
 */
export declare function options(arg0: Readonly<{ tag: "none" }> | Readonly<{ tag: "some"; value: bigint }>): Readonly<{ tag: "none" }> | Readonly<{ tag: "some"; value: bigint }>;

/**
 * Call StructuralSubtypes.plainFin.
 */
export declare function plainFin(arg0: ReadonlyArray<Readonly<{ tag: "none" }> | Readonly<{ tag: "some"; value: bigint }>>): bigint;

/**
 * Call StructuralSubtypes.product.
 */
export declare function product(arg0: readonly [bigint, string]): readonly [bigint, string];

/**
 * Call StructuralSubtypes.scalar.
 */
export declare function scalar(arg0: bigint): bigint;

/**
 * Call StructuralSubtypes.specialized.
 */
export declare function specialized(arg0: ReadonlyArray<bigint>): ReadonlyArray<bigint>;

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
