// Generated from Binding IR SHA-256 5acf1d04783b810fa31c84fb5286eb6772f342edb40db40191843a957f7ca57d.
/**
 * Checked Lean CheckedRecords.Interval.
 */
export interface Interval {
  readonly lo: bigint;
  readonly hi: bigint;
}

/**
 * Checked Lean CheckedRecords.Percent.
 */
export interface Percent {
  readonly value: bigint;
}

/**
 * Checked Lean CheckedRecords.Triple.
 */
export interface Triple {
  readonly data: ReadonlyArray<bigint>;
}

/**
 * The distance from a checked percentage to 100. 
 */
export declare function complement(arg0: Percent): bigint;

/**
 * The first number, as the caller ordered it. 
 */
export declare function firstOf(arg0: Triple): bigint;

/**
 * A result-only checked record: Lean produces the proof. 
 */
export declare function repeated(arg0: bigint): Triple;

/**
 * An unchecked argument before a checked one, and a Lean-produced checked result. 
 */
export declare function scale(arg0: bigint, arg1: Triple): Triple;

/**
 * The first number after the sorting constructor ran: normalization is visible only to Lean. 
 */
export declare function smallest(arg0: Triple): bigint;

/**
 * Two checked arguments: the second is refused after the first passed. 
 */
export declare function span(arg0: Interval, arg1: Interval): bigint;

/**
 * The sum of exactly three numbers. 
 */
export declare function total(arg0: Triple): bigint;

/**
 * The width of a checked interval. 
 */
export declare function width(arg0: Interval): bigint;

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
