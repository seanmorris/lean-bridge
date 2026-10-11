import * as api from "nominalsubtypes";

const value: bigint = api.scalar(1000n);
const envelope: api.Envelope = api.produceEnvelope(value);
const alias: api.EnvelopeAlias = envelope;
const pair: api.AliasPair = api.pairValues(value);
const event: api.Event = api.eventValue(value);
const array: ReadonlyArray<bigint> = api.arrayValues(value);
const list: ReadonlyArray<bigint> = api.listValues(value);
const option: { tag: "none" } | { tag: "some"; value: bigint } = api.optional(value);
const tuple: readonly [bigint, bigint] = api.product(value);
const result: { ok: bigint } | { error: bigint } = api.branch(value);
// @ts-expect-error No proof accompanies the projected Subtype value.
const proof: boolean = envelope.payload.property;
// @ts-expect-error Nat transport remains bigint.
api.scalar(1);
// @ts-expect-error No synthetic proof field appears in the record.
const invalid: api.Envelope = { payload: 1n, digit: 0n, proof: true };
void alias; void pair; void event; void array; void list;
void option; void tuple; void result; void proof; void invalid;
