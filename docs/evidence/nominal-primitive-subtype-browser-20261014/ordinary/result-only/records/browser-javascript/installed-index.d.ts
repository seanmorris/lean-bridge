// Generated from Binding IR SHA-256 33636b4cd7eecec1fd9f2531fab598f860f4b225362a156d692bfe57f6cfdaa4.
/**
 * Checked Lean NominalPrimitiveSubtypes.Event.
 */
export type Event = Readonly<{ readonly kind: "empty" }> | Readonly<{ readonly kind: "box"; readonly value: Packet }> | Readonly<{ readonly kind: "choices"; readonly values: ReadonlyArray<Readonly<{ tag: "none" }> | Readonly<{ tag: "some"; value: Readonly<{ ok: Packet }> | Readonly<{ error: Packet }> }>> }>;

/**
 * Checked Lean NominalPrimitiveSubtypes.Packet.
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
 * Checked Lean NominalPrimitiveSubtypes.PacketAlias.
 */
export type PacketAlias = Packet;

/**
 * Checked Lean NominalPrimitiveSubtypes.Pair.
 */
export interface Pair {
  readonly left: ReadonlyArray<Readonly<{ tag: "none" }> | Readonly<{ tag: "some"; value: PacketAlias }>>;
  readonly right: ReadonlyArray<Readonly<{ tag: "none" }> | Readonly<{ tag: "some"; value: PacketAlias }>>;
}

/**
 * Checked Lean NominalPrimitiveSubtypes.RawPacket.
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
 * Call NominalPrimitiveSubtypes.produce.
 */
export declare function produce(arg0: RawPacket): Readonly<{ tag: "none" }> | Readonly<{ tag: "some"; value: Packet }>;

/**
 * Call NominalPrimitiveSubtypes.produceChoices.
 */
export declare function produceChoices(arg0: RawPacket): Event;

/**
 * Call NominalPrimitiveSubtypes.produceEvent.
 */
export declare function produceEvent(arg0: RawPacket): Event;

/**
 * Call NominalPrimitiveSubtypes.produceGroup.
 */
export declare function produceGroup(arg0: RawPacket): ReadonlyArray<Readonly<{ tag: "none" }> | Readonly<{ tag: "some"; value: PacketAlias }>>;

/**
 * Call NominalPrimitiveSubtypes.producePair.
 */
export declare function producePair(arg0: RawPacket): Pair;

/**
 * Call NominalPrimitiveSubtypes.wordBits.
 */
export declare function wordBits(): number;

declare const bindings: Readonly<{
  readonly produce: typeof produce;
  readonly produceChoices: typeof produceChoices;
  readonly produceEvent: typeof produceEvent;
  readonly produceGroup: typeof produceGroup;
  readonly producePair: typeof producePair;
  readonly wordBits: typeof wordBits;
}>;
export default bindings;
