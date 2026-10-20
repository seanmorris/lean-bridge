// Generated from Binding IR SHA-256 9d1ccb24ddb9c697119890d6cc2fe44d7e98c14853a10f33caec53a84f268492.
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
