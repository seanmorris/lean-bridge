/**
 * Require exact public field types for all nineteen primitive bases and Fin.
 *
 * @file
 */
import type { Packet, RawPacket } from "nominalprimitivesubtypes";

/** Require exact type identity, including readonly fields and absence of extras. */
type Equal<Left, Right> =
	(<Value>() => Value extends Left ? 1 : 2) extends
	(<Value>() => Value extends Right ? 1 : 2) ? true : false;
/** Fail compilation when the public declaration differs from the expected type. */
type Assert<Condition extends true> = Condition;
/** Preserve each Lean primitive's public wasm32 representation. */
type Expected = Readonly<{
	/** Unit has no runtime payload. */
	unitValue: void;
	/** Bool retains its boolean representation. */
	boolValue: boolean;
	/** UInt8 fits exactly in a JavaScript number. */
	uint8Value: number;
	/** UInt16 fits exactly in a JavaScript number. */
	uint16Value: number;
	/** UInt32 fits exactly in a JavaScript number. */
	uint32Value: number;
	/** UInt64 requires bigint to preserve all bits. */
	uint64Value: bigint;
	/** Int8 retains its signed numeric representation. */
	int8Value: number;
	/** Int16 retains its signed numeric representation. */
	int16Value: number;
	/** Int32 retains its signed numeric representation. */
	int32Value: number;
	/** Int64 requires bigint to preserve all bits. */
	int64Value: bigint;
	/** Nat preserves arbitrary nonnegative precision. */
	natValue: bigint;
	/** Int preserves arbitrary signed precision. */
	intValue: bigint;
	/** Float32 uses JavaScript's numeric type. */
	float32Value: number;
	/** Float uses JavaScript's numeric type. */
	float64Value: number;
	/** String preserves Unicode text and embedded NUL. */
	textValue: string;
	/** ByteArray exposes copied unsigned bytes. */
	bytesValue: Uint8Array;
	/** Char is a string containing one Unicode scalar. */
	charValue: string;
	/** A wasm32 unsigned machine word fits exactly in number. */
	usizeValue: number;
	/** A wasm32 signed machine word fits exactly in number. */
	isizeValue: number;
	/** Fin retains its natural-number representation and bound. */
	digit: bigint;
}>;

/** Keep the optional result's tag and payload independent of generated declarations. */
export type PrimitiveOption = Readonly<{
	/** An absent result has no payload. */
	tag: "none";
}> | Readonly<{
	/** A present result retains its constructor tag. */
	tag: "some";
	/** Only the present branch contains a packet. */
	value: Packet;
}>;

/** Require exact readonly field types on checked results. */
export type PrimitiveContract = Assert<Equal<Packet, Expected>>;
/** Require exact readonly field types on unchecked producer inputs. */
export type RawContract = Assert<Equal<RawPacket, Expected>>;
