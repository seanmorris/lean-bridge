// Generated from Binding IR SHA-256 05eea5ff9cd617970d13fe47bcfea014b32ba9b5fc69e28d5e291395399581ef.
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
 * Call CheckedRecordValueIndices.abStringIndex.
 */
export declare function abStringIndex(arg0: Ab): bigint;

/**
 * Call CheckedRecordValueIndices.emptySizedIndex.
 */
export declare function emptySizedIndex(arg0: EmptySized): bigint;

/**
 * Call CheckedRecordValueIndices.emptyStringIndex.
 */
export declare function emptyStringIndex(arg0: EmptyToken): bigint;

/**
 * Call CheckedRecordValueIndices.falseBoolIndex.
 */
export declare function falseBoolIndex(arg0: Off): bigint;

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

/**
 * Call CheckedRecordValueIndices.trueBoolIndex.
 */
export declare function trueBoolIndex(arg0: On): bigint;

/**
 * Call CheckedRecordValueIndices.unicodeStringIndex.
 */
export declare function unicodeStringIndex(arg0: UnicodeToken): bigint;

/**
 * Call CheckedRecordValueIndices.wideNatIndex.
 */
export declare function wideNatIndex(arg0: WideToken): bigint;

/**
 * Call CheckedRecordValueIndices.zeroNatIndex.
 */
export declare function zeroNatIndex(arg0: ZeroToken): bigint;

declare const bindings: Readonly<{
  readonly abStringIndex: typeof abStringIndex;
  readonly emptySizedIndex: typeof emptySizedIndex;
  readonly emptyStringIndex: typeof emptyStringIndex;
  readonly falseBoolIndex: typeof falseBoolIndex;
  readonly produceAb: typeof produceAb;
  readonly produceEmptySized: typeof produceEmptySized;
  readonly produceEmptyString: typeof produceEmptyString;
  readonly produceFalseBool: typeof produceFalseBool;
  readonly produceTrueBool: typeof produceTrueBool;
  readonly produceUnicodeString: typeof produceUnicodeString;
  readonly produceWideNat: typeof produceWideNat;
  readonly produceZeroNat: typeof produceZeroNat;
  readonly trueBoolIndex: typeof trueBoolIndex;
  readonly unicodeStringIndex: typeof unicodeStringIndex;
  readonly wideNatIndex: typeof wideNatIndex;
  readonly zeroNatIndex: typeof zeroNatIndex;
}>;
export default bindings;
