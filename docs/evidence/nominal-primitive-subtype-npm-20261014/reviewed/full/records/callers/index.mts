/**
 * Check full primitive-base package declarations under strict TypeScript.
 *
 * @file
 */
import * as api from "nominalprimitivesubtypes";
import type { Packet, PacketAlias, Pair, Event, RawPacket } from "nominalprimitivesubtypes";
import type { PrimitiveContract, RawContract, PrimitiveOption } from "./types.mjs";

const contracts: readonly [PrimitiveContract, RawContract] = [true, true];
void contracts;

const raw: RawPacket = {
	unitValue: undefined, boolValue: true
	, uint8Value: 42, uint16Value: 42, uint32Value: 42, uint64Value: 42n
	, int8Value: -42, int16Value: -42, int32Value: -42, int64Value: -42n
	, natValue: 42n, intValue: -42n, float32Value: 1.5, float64Value: 1.5
	, textValue: "a\0λ😀", bytesValue: new Uint8Array([0, 128, 255])
	, charValue: "a", usizeValue: 42, isizeValue: -42, digit: 2n
};
const packet: Packet = raw, alias: PacketAlias = packet;
const pair: Pair = { left: [{ tag: "none" }, { tag: "some", value: alias }], right: [] };
const event: Event = { kind: "choices", values: [{ tag: "none" }, { tag: "some", value: { ok: packet } }, { tag: "some", value: { error: packet } }] };
const returned: Packet = api.echoA(packet);
const normalized: Packet = api.echoB({ ...packet, boolValue: false });
const refused: Packet = api.refuseUnit(packet);
const combined: readonly [Packet, Packet] = api.combine(packet, { ...packet, boolValue: false });
const groups: Pair = api.echoPair(pair);
const aliases: Pair["left"] = api.aliases(pair.left, pair.right);
const eventA: Event = api.echoEventA(event), eventB: Event = api.echoEventB(event);
const optional: PrimitiveOption = api.produce(raw);
const producedGroup: Pair["left"] = api.produceGroup(raw), producedPair: Pair = api.producePair(raw);
const producedEvent: Event = api.produceEvent(raw), producedChoices: Event = api.produceChoices(raw);
const bits: number = api.wordBits();

// @ts-expect-error UInt64 must retain its bigint representation.
api.echoA({ ...packet, uint64Value: 42 });
// @ts-expect-error Unit is represented by undefined, not null.
api.echoA({ ...packet, unitValue: null });
// @ts-expect-error ByteArray is copied as Uint8Array, not a numeric Array.
api.echoA({ ...packet, bytesValue: [0, 128, 255] });
// @ts-expect-error The compiled wasm32 word uses number, not bigint.
api.echoA({ ...packet, usizeValue: 42n });
// @ts-expect-error Result projection retains the optional constructor tag.
const missingOption: Packet = api.produce(raw);

void [returned, normalized, refused, combined, groups, aliases, eventA, eventB, optional, producedGroup, producedPair, producedEvent, producedChoices, bits, missingOption];
