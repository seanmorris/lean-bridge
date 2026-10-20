// Generated from Binding IR SHA-256 bf75c1cec8b074f336582b4567d89e48924982edb6217f4cf5a28281438b01db.
/**
 * Checked Lean CheckedRecordValueIndices.Ab.
 */
export interface Ab {
  readonly size: bigint;
}

/**
 * Checked Lean CheckedRecordValueIndices.EmptySized.
 */
export interface EmptySized {
  readonly data: ReadonlyArray<bigint>;
}

/**
 * Checked Lean CheckedRecordValueIndices.EmptyToken.
 */
export interface EmptyToken {
  readonly count: bigint;
}

/**
 * Checked Lean CheckedRecordValueIndices.Off.
 */
export interface Off {
  readonly count: bigint;
}

/**
 * Checked Lean CheckedRecordValueIndices.On.
 */
export interface On {
  readonly count: bigint;
}

/**
 * Checked Lean CheckedRecordValueIndices.UnicodeToken.
 */
export interface UnicodeToken {
  readonly count: bigint;
}

/**
 * Checked Lean CheckedRecordValueIndices.WideToken.
 */
export interface WideToken {
  readonly count: bigint;
}

/**
 * Checked Lean CheckedRecordValueIndices.ZeroToken.
 */
export interface ZeroToken {
  readonly count: bigint;
}

/**
 * Call CheckedRecordValueIndices.produceAb.
 */
export declare function produceAb(): Ab;

/**
 * Call CheckedRecordValueIndices.produceEmptySized.
 */
export declare function produceEmptySized(): EmptySized;

/**
 * Call CheckedRecordValueIndices.produceEmptyString.
 */
export declare function produceEmptyString(arg0: bigint): EmptyToken;

/**
 * Call CheckedRecordValueIndices.produceFalseBool.
 */
export declare function produceFalseBool(): Off;

/**
 * Lean-produced records need no host-side checked constructor. 
 */
export declare function produceTrueBool(): On;

/**
 * Call CheckedRecordValueIndices.produceUnicodeString.
 */
export declare function produceUnicodeString(arg0: bigint): UnicodeToken;

/**
 * Call CheckedRecordValueIndices.produceWideNat.
 */
export declare function produceWideNat(arg0: bigint): WideToken;

/**
 * Call CheckedRecordValueIndices.produceZeroNat.
 */
export declare function produceZeroNat(arg0: bigint): ZeroToken;

declare const bindings: Readonly<{
  readonly produceAb: typeof produceAb;
  readonly produceEmptySized: typeof produceEmptySized;
  readonly produceEmptyString: typeof produceEmptyString;
  readonly produceFalseBool: typeof produceFalseBool;
  readonly produceTrueBool: typeof produceTrueBool;
  readonly produceUnicodeString: typeof produceUnicodeString;
  readonly produceWideNat: typeof produceWideNat;
  readonly produceZeroNat: typeof produceZeroNat;
}>;
export default bindings;
