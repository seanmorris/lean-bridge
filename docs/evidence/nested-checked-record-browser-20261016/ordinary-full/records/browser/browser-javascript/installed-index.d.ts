// Generated from Binding IR SHA-256 4674b92e2e4e6598389449b2160426cc19400876f4f0aa8aff7ddf2cb3c0b05f.
/**
 * Checked Lean NestedCheckedRecords.Choice.
 */
export type Choice = Readonly<{ readonly kind: "empty" }> | Readonly<{ readonly kind: "packet"; readonly value: Packet }>;

/**
 * Checked Lean NestedCheckedRecords.Holder.
 */
export interface Holder {
  readonly packet: Packet;
  readonly tag: bigint;
}

/**
 * Checked Lean NestedCheckedRecords.Packet.
 */
export interface Packet {
  readonly digit: bigint;
  readonly word: bigint;
}

/**
 * Call NestedCheckedRecords.echoArray.
 */
export declare function echoArray(arg0: ReadonlyArray<Packet>): ReadonlyArray<Packet>;

/**
 * Call NestedCheckedRecords.first.
 */
export declare function first(arg0: Packet): bigint;

/**
 * Call NestedCheckedRecords.inArray.
 */
export declare function inArray(arg0: ReadonlyArray<Packet>): bigint;

/**
 * Call NestedCheckedRecords.inChoice.
 */
export declare function inChoice(arg0: Choice): bigint;

/**
 * Call NestedCheckedRecords.inExcept.
 */
export declare function inExcept(arg0: Readonly<{ ok: Packet }> | Readonly<{ error: Packet }>): bigint;

/**
 * Call NestedCheckedRecords.inHolder.
 */
export declare function inHolder(arg0: Holder): bigint;

/**
 * Call NestedCheckedRecords.inList.
 */
export declare function inList(arg0: ReadonlyArray<Packet>): bigint;

/**
 * Call NestedCheckedRecords.inOption.
 */
export declare function inOption(arg0: Readonly<{ tag: "none" }> | Readonly<{ tag: "some"; value: Packet }>): bigint;

/**
 * Call NestedCheckedRecords.inProduct.
 */
export declare function inProduct(arg0: readonly [Packet, Packet]): bigint;

/**
 * Call NestedCheckedRecords.pair.
 */
export declare function pair(arg0: Packet, arg1: Packet): bigint;

/**
 * Call NestedCheckedRecords.produceArray.
 */
export declare function produceArray(arg0: bigint): ReadonlyArray<Packet>;

/**
 * Lean-produced checked records need no input constructor. 
 */
export declare function produceOption(arg0: bigint): Readonly<{ tag: "none" }> | Readonly<{ tag: "some"; value: Packet }>;

/**
 * Call NestedCheckedRecords.second.
 */
export declare function second(arg0: Packet): bigint;

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
