// Generated from Binding IR SHA-256 3e61c32da744788dbcde3231f9fe8a5318648ce631fc61240fe8f87ac3f3043d.
/**
 * Independent corpus contract.
 */
export interface Interval {
  readonly lo: bigint;
  readonly hi: bigint;
}

/**
 * Independent corpus contract.
 */
export interface Percent {
  readonly value: bigint;
}

/**
 * Independent corpus contract.
 */
export interface Triple {
  readonly data: ReadonlyArray<bigint>;
}

/**
 * Independent corpus contract.
 */
export declare function complement(value0: Percent): bigint;

/**
 * Independent corpus contract.
 */
export declare function firstOf(value0: Triple): bigint;

/**
 * Independent corpus contract.
 */
export declare function repeated(value0: bigint): Triple;

/**
 * Independent corpus contract.
 */
export declare function scale(value0: bigint, value1: Triple): Triple;

/**
 * Independent corpus contract.
 */
export declare function smallest(value0: Triple): bigint;

/**
 * Independent corpus contract.
 */
export declare function span(value0: Interval, value1: Interval): bigint;

/**
 * Independent corpus contract.
 */
export declare function total(value0: Triple): bigint;

/**
 * Independent corpus contract.
 */
export declare function width(value0: Interval): bigint;

declare const bindings: Readonly<{
  readonly complement: typeof complement;
  readonly firstOf: typeof firstOf;
  readonly repeated: typeof repeated;
  readonly scale: typeof scale;
  readonly smallest: typeof smallest;
  readonly span: typeof span;
  readonly total: typeof total;
  readonly width: typeof width;
}>;
export default bindings;
