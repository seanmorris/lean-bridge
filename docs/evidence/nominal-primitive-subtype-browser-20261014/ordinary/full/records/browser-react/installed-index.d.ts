// Generated from Binding IR SHA-256 a7fbef6be0dcbfb7c575f5e198bf6cbbd04f7946592efd6e0b323ebfec795cf9.
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
 * Call NominalPrimitiveSubtypes.aliases.
 */
export declare function aliases(arg0: ReadonlyArray<Readonly<{ tag: "none" }> | Readonly<{ tag: "some"; value: PacketAlias }>>, arg1: ReadonlyArray<Readonly<{ tag: "none" }> | Readonly<{ tag: "some"; value: PacketAlias }>>): ReadonlyArray<Readonly<{ tag: "none" }> | Readonly<{ tag: "some"; value: PacketAlias }>>;

/**
 * Call NominalPrimitiveSubtypes.combine.
 */
export declare function combine(arg0: Packet, arg1: Packet): readonly [Packet, Packet];

/**
 * Call NominalPrimitiveSubtypes.echoA.
 */
export declare function echoA(arg0: Packet): Packet;

/**
 * Call NominalPrimitiveSubtypes.echoB.
 */
export declare function echoB(arg0: Packet): Packet;

/**
 * Call NominalPrimitiveSubtypes.echoEventA.
 */
export declare function echoEventA(arg0: Event): Event;

/**
 * Call NominalPrimitiveSubtypes.echoEventB.
 */
export declare function echoEventB(arg0: Event): Event;

/**
 * Call NominalPrimitiveSubtypes.echoPair.
 */
export declare function echoPair(arg0: Pair): Pair;

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
 * Call NominalPrimitiveSubtypes.refuseUnit.
 */
export declare function refuseUnit(arg0: Packet): Packet;

/**
 * Call NominalPrimitiveSubtypes.wordBits.
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
