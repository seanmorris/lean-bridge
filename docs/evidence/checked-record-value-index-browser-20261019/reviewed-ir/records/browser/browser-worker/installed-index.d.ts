// Generated from Binding IR SHA-256 e22480b71bdca0b86575bc59232807b1af2e718708bd20dfe752eb1eb66024eb.
/**
 * Independent corpus contract.
 */
export interface Ab {
  readonly size: bigint;
}

/**
 * Independent corpus contract.
 */
export interface EmptySized {
  readonly data: ReadonlyArray<bigint>;
}

/**
 * Independent corpus contract.
 */
export interface EmptyToken {
  readonly count: bigint;
}

/**
 * Independent corpus contract.
 */
export interface Off {
  readonly count: bigint;
}

/**
 * Independent corpus contract.
 */
export interface On {
  readonly count: bigint;
}

/**
 * Independent corpus contract.
 */
export interface UnicodeToken {
  readonly count: bigint;
}

/**
 * Independent corpus contract.
 */
export interface WideToken {
  readonly count: bigint;
}

/**
 * Independent corpus contract.
 */
export interface ZeroToken {
  readonly count: bigint;
}

/**
 * Independent corpus contract.
 */
export declare function abStringIndex(value0: Ab): bigint;

/**
 * Independent corpus contract.
 */
export declare function emptySizedIndex(value0: EmptySized): bigint;

/**
 * Independent corpus contract.
 */
export declare function emptyStringIndex(value0: EmptyToken): bigint;

/**
 * Independent corpus contract.
 */
export declare function falseBoolIndex(value0: Off): bigint;

/**
 * Independent corpus contract.
 */
export declare function produceAb(): Ab;

/**
 * Independent corpus contract.
 */
export declare function produceEmptySized(): EmptySized;

/**
 * Independent corpus contract.
 */
export declare function produceEmptyString(value0: bigint): EmptyToken;

/**
 * Independent corpus contract.
 */
export declare function produceFalseBool(): Off;

/**
 * Independent corpus contract.
 */
export declare function produceTrueBool(): On;

/**
 * Independent corpus contract.
 */
export declare function produceUnicodeString(value0: bigint): UnicodeToken;

/**
 * Independent corpus contract.
 */
export declare function produceWideNat(value0: bigint): WideToken;

/**
 * Independent corpus contract.
 */
export declare function produceZeroNat(value0: bigint): ZeroToken;

/**
 * Independent corpus contract.
 */
export declare function trueBoolIndex(value0: On): bigint;

/**
 * Independent corpus contract.
 */
export declare function unicodeStringIndex(value0: UnicodeToken): bigint;

/**
 * Independent corpus contract.
 */
export declare function wideNatIndex(value0: WideToken): bigint;

/**
 * Independent corpus contract.
 */
export declare function zeroNatIndex(value0: ZeroToken): bigint;

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
