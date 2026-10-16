// Generated from Binding IR SHA-256 65fe883f76fbd604d547d00b4fa1a86fbe04a7d3e1a320b7f0a4253bf1ab30f8.
/**
 * Checked Lean NestedCheckedRecords.Packet.
 */
export interface Packet {
  readonly digit: bigint;
  readonly word: bigint;
}

/**
 * Call NestedCheckedRecords.produceArray.
 */
export declare function produceArray(arg0: bigint): ReadonlyArray<Packet>;

/**
 * Lean-produced checked records need no input constructor. 
 */
export declare function produceOption(arg0: bigint): Readonly<{ tag: "none" }> | Readonly<{ tag: "some"; value: Packet }>;

declare const bindings: Readonly<{
  readonly produceArray: typeof produceArray;
  readonly produceOption: typeof produceOption;
}>;
export default bindings;
