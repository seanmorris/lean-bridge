// Generated from Binding IR SHA-256 8d219ee2ae9436719de04f357fefd5da12d754890fb8e36c70493e6be6ee63e5.
/**
 * Checked Lean CheckedRecords.Triple.
 */
export interface Triple {
  readonly data: ReadonlyArray<bigint>;
}

/**
 * A result-only checked record: Lean produces the proof. 
 */
export declare function repeated(arg0: bigint): Triple;

declare const bindings: Readonly<{
  readonly repeated: typeof repeated;
}>;
export default bindings;
