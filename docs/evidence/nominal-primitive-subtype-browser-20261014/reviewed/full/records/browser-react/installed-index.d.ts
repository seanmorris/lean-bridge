// Generated from Binding IR SHA-256 35133987661701050c7c643c8ca8063a4f0a205b9b59c316b3d45d2a294238ae.
/**
 * Independent corpus contract.
 */
export type Event = Readonly<{ readonly kind: "empty" }> | Readonly<{ readonly kind: "box"; readonly value: Packet }> | Readonly<{ readonly kind: "choices"; readonly values: ReadonlyArray<Readonly<{ tag: "none" }> | Readonly<{ tag: "some"; value: Readonly<{ ok: Packet }> | Readonly<{ error: Packet }> }>> }>;

/**
 * Independent corpus contract.
 */
export interface Packet {
  readonly unitValue: void;
  readonly boolValue: boolean;
  readonly uint8Value: number;
  readonly uint16Value: number;
  readonly uint32Value: number;
  readonly uint64Value: bigint;
  readonly int8Value: number;
  readonly int16Value: number;
  readonly int32Value: number;
  readonly int64Value: bigint;
  readonly natValue: bigint;
  readonly intValue: bigint;
  readonly float32Value: number;
  readonly float64Value: number;
  readonly textValue: string;
  readonly bytesValue: Uint8Array;
  readonly charValue: string;
  readonly usizeValue: number;
  readonly isizeValue: number;
  readonly digit: bigint;
}

/**
 * Independent corpus contract.
 */
export type PacketAlias = Packet;

/**
 * Independent corpus contract.
 */
export interface Pair {
  readonly left: ReadonlyArray<Readonly<{ tag: "none" }> | Readonly<{ tag: "some"; value: PacketAlias }>>;
  readonly right: ReadonlyArray<Readonly<{ tag: "none" }> | Readonly<{ tag: "some"; value: PacketAlias }>>;
}

/**
 * Independent corpus contract.
 */
export interface RawPacket {
  readonly unitValue: void;
  readonly boolValue: boolean;
  readonly uint8Value: number;
  readonly uint16Value: number;
  readonly uint32Value: number;
  readonly uint64Value: bigint;
  readonly int8Value: number;
  readonly int16Value: number;
  readonly int32Value: number;
  readonly int64Value: bigint;
  readonly natValue: bigint;
  readonly intValue: bigint;
  readonly float32Value: number;
  readonly float64Value: number;
  readonly textValue: string;
  readonly bytesValue: Uint8Array;
  readonly charValue: string;
  readonly usizeValue: number;
  readonly isizeValue: number;
  readonly digit: bigint;
}

/**
 * Independent corpus contract.
 */
export declare function aliases(value0: ReadonlyArray<Readonly<{ tag: "none" }> | Readonly<{ tag: "some"; value: PacketAlias }>>, value1: ReadonlyArray<Readonly<{ tag: "none" }> | Readonly<{ tag: "some"; value: PacketAlias }>>): ReadonlyArray<Readonly<{ tag: "none" }> | Readonly<{ tag: "some"; value: PacketAlias }>>;

/**
 * Independent corpus contract.
 */
export declare function combine(value0: Packet, value1: Packet): readonly [Packet, Packet];

/**
 * Independent corpus contract.
 */
export declare function echoA(value0: Packet): Packet;

/**
 * Independent corpus contract.
 */
export declare function echoB(value0: Packet): Packet;

/**
 * Independent corpus contract.
 */
export declare function echoEventA(value0: Event): Event;

/**
 * Independent corpus contract.
 */
export declare function echoEventB(value0: Event): Event;

/**
 * Independent corpus contract.
 */
export declare function echoPair(value0: Pair): Pair;

/**
 * Independent corpus contract.
 */
export declare function produce(value0: RawPacket): Readonly<{ tag: "none" }> | Readonly<{ tag: "some"; value: Packet }>;

/**
 * Independent corpus contract.
 */
export declare function produceChoices(value0: RawPacket): Event;

/**
 * Independent corpus contract.
 */
export declare function produceEvent(value0: RawPacket): Event;

/**
 * Independent corpus contract.
 */
export declare function produceGroup(value0: RawPacket): ReadonlyArray<Readonly<{ tag: "none" }> | Readonly<{ tag: "some"; value: PacketAlias }>>;

/**
 * Independent corpus contract.
 */
export declare function producePair(value0: RawPacket): Pair;

/**
 * Independent corpus contract.
 */
export declare function refuseUnit(value0: Packet): Packet;

/**
 * Independent corpus contract.
 */
export declare function wordBits(): number;

declare const bindings: Readonly<{
  readonly aliases: typeof aliases;
  readonly combine: typeof combine;
  readonly echoA: typeof echoA;
  readonly echoB: typeof echoB;
  readonly echoEventA: typeof echoEventA;
  readonly echoEventB: typeof echoEventB;
  readonly echoPair: typeof echoPair;
  readonly produce: typeof produce;
  readonly produceChoices: typeof produceChoices;
  readonly produceEvent: typeof produceEvent;
  readonly produceGroup: typeof produceGroup;
  readonly producePair: typeof producePair;
  readonly refuseUnit: typeof refuseUnit;
  readonly wordBits: typeof wordBits;
}>;
export default bindings;
