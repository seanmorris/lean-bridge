// Generated from Binding IR SHA-256 81082c110781d197cd4860b9b39191bc2389afdf0117a1bbf1c250a397912672.
/**
 * Independent corpus contract.
 */
export interface Packet {
  readonly digit: bigint;
  readonly word: bigint;
}

/**
 * Independent corpus contract.
 */
export declare function produceArray(value0: bigint): ReadonlyArray<Packet>;

/**
 * Independent corpus contract.
 */
export declare function produceOption(value0: bigint): Readonly<{ tag: "none" }> | Readonly<{ tag: "some"; value: Packet }>;

declare const bindings: Readonly<{
  readonly produceArray: typeof produceArray;
  readonly produceOption: typeof produceOption;
}>;
export default bindings;
