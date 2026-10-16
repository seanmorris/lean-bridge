// Generated from Binding IR SHA-256 403aa9c7bfb95f74c6fb6a3043492a30864a18666674b5677701ae1d53a1b985.
/**
 * Independent corpus contract.
 */
export type Choice = Readonly<{ readonly kind: "empty" }> | Readonly<{ readonly kind: "packet"; readonly value: Packet }>;

/**
 * Independent corpus contract.
 */
export interface Holder {
  readonly packet: Packet;
  readonly tag: bigint;
}

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
export declare function echoArray(value0: ReadonlyArray<Packet>): ReadonlyArray<Packet>;

/**
 * Independent corpus contract.
 */
export declare function first(value0: Packet): bigint;

/**
 * Independent corpus contract.
 */
export declare function inArray(value0: ReadonlyArray<Packet>): bigint;

/**
 * Independent corpus contract.
 */
export declare function inChoice(value0: Choice): bigint;

/**
 * Independent corpus contract.
 */
export declare function inExcept(value0: Readonly<{ ok: Packet }> | Readonly<{ error: Packet }>): bigint;

/**
 * Independent corpus contract.
 */
export declare function inHolder(value0: Holder): bigint;

/**
 * Independent corpus contract.
 */
export declare function inList(value0: ReadonlyArray<Packet>): bigint;

/**
 * Independent corpus contract.
 */
export declare function inOption(value0: Readonly<{ tag: "none" }> | Readonly<{ tag: "some"; value: Packet }>): bigint;

/**
 * Independent corpus contract.
 */
export declare function inProduct(value0: readonly [Packet, Packet]): bigint;

/**
 * Independent corpus contract.
 */
export declare function pair(value0: Packet, value1: Packet): bigint;

/**
 * Independent corpus contract.
 */
export declare function produceArray(value0: bigint): ReadonlyArray<Packet>;

/**
 * Independent corpus contract.
 */
export declare function produceOption(value0: bigint): Readonly<{ tag: "none" }> | Readonly<{ tag: "some"; value: Packet }>;

/**
 * Independent corpus contract.
 */
export declare function second(value0: Packet): bigint;

declare const bindings: Readonly<{
  readonly echoArray: typeof echoArray;
  readonly first: typeof first;
  readonly inArray: typeof inArray;
  readonly inChoice: typeof inChoice;
  readonly inExcept: typeof inExcept;
  readonly inHolder: typeof inHolder;
  readonly inList: typeof inList;
  readonly inOption: typeof inOption;
  readonly inProduct: typeof inProduct;
  readonly pair: typeof pair;
  readonly produceArray: typeof produceArray;
  readonly produceOption: typeof produceOption;
  readonly second: typeof second;
}>;
export default bindings;
