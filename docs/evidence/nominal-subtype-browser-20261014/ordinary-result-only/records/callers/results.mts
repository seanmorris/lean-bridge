/**
 * Check the copied types of constructor-free nominal Subtype results.
 *
 * @file
 */
import * as api from "nominalsubtypes";

/** An absent optional result has no payload. */
type None = {
	/** The public absent-value discriminator. */
	tag: "none";
};
/** An inhabited optional result carries the projected Nat. */
type Some = {
	/** The public present-value discriminator. */
	tag: "some";
	/** The proof-backed base value returned by Lean. */
	value: bigint;
};
/** A successful result carries a projected Nat. */
type Success = {
	/** The success-side payload. */
	ok: bigint;
};
/** A failed result carries a projected Nat. */
type Failure = {
	/** The error-side payload. */
	error: bigint;
};

const value: bigint = api.scalar(1000n);
const envelope: api.Envelope = api.produceEnvelope(value);
const alias: api.EnvelopeAlias = envelope;
const pair: api.AliasPair = api.pairValues(value);
const event: api.Event = api.eventValue(value);
const array: ReadonlyArray<bigint> = api.arrayValues(value);
const list: ReadonlyArray<bigint> = api.listValues(value);
const option: None | Some = api.optional(value);
const tuple: readonly [bigint, bigint] = api.product(value);
const result: Success | Failure = api.branch(value);
// @ts-expect-error No proof accompanies the projected Subtype value.
const proof: boolean = envelope.payload.property;
// @ts-expect-error Nat transport remains bigint.
api.scalar(1);
// @ts-expect-error No synthetic proof field appears in the record.
const invalid: api.Envelope = { payload: 1n, digit: 0n, proof: true };
void alias; void pair; void event; void array; void list;
void option; void tuple; void result; void proof; void invalid;
