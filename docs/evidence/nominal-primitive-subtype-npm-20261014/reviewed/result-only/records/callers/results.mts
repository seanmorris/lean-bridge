/**
 * Check result-only primitive-base package declarations under strict TypeScript.
 *
 * @file
 */
import * as api from "nominalprimitivesubtypes";
import type { Packet, Pair, Event, RawPacket } from "nominalprimitivesubtypes";
import type { PrimitiveContract, RawContract, PrimitiveOption } from "./types.mjs";

const contracts: readonly [PrimitiveContract, RawContract] = [true, true];
void contracts;

const raw: RawPacket = {
	unitValue: undefined, boolValue: true
	, uint8Value: 200, uint16Value: 200, uint32Value: 200, uint64Value: 200n
	, int8Value: 120, int16Value: 120, int32Value: 120, int64Value: 120n
	, natValue: 1n << 100n, intValue: -(1n << 100n)
	, float32Value: 12.5, float64Value: 12.5, textValue: "long λ text"
	, bytesValue: new Uint8Array([0, 1, 2, 3, 4, 5, 128, 254, 255])
	, charValue: "λ", usizeValue: 200, isizeValue: 200, digit: 2n
};
const optional: PrimitiveOption = api.produce(raw);
const group: Pair["left"] = api.produceGroup(raw), pair: Pair = api.producePair(raw);
const event: Event = api.produceEvent(raw), choices: Event = api.produceChoices(raw);
const bits: number = api.wordBits();
if(optional.tag === "some")
{
	const unit: void = optional.value.unitValue, bytes: Uint8Array = optional.value.bytesValue;
	const big: bigint = optional.value.natValue, scalar: string = optional.value.charValue;
	void [unit, bytes, big, scalar];
}
// @ts-expect-error Result-only packages must not expose any input-selected API.
api.echoA(raw);
// @ts-expect-error Unit rejection is an input selection, absent from this API.
api.refuseUnit(raw);
// @ts-expect-error Keep the caller-visible optional result tag.
const missingOption: Packet = api.produce(raw);
void [optional, group, pair, event, choices, bits, missingOption];
