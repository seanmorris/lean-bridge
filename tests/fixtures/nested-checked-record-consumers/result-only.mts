/**
 * Strict public types for the independently selected result-only package.
 *
 * @file
 */
import * as api from "nestedcheckedrecords";

/** An inhabited optional carrier preserves its exact checked payload. */
type Some<T> = Readonly<{
	/** Public present-value discriminator. */
	tag: "some";
	/** Proof-free checked payload. */
	value: T;
}>;
/** An absent optional carrier has no payload. */
type None = Readonly<{
	/** Public absent-value discriminator. */
	tag: "none";
}>;
const option: None | Some<api.Packet> = api.produceOption(4n);
const produced: ReadonlyArray<api.Packet> = api.produceArray(4n);
const packet: api.Packet = produced[0];
const digit: bigint = packet.digit;
const word: bigint = packet.word;
// @ts-expect-error A Lean-produced record carries no erased proof field.
const proof: boolean = packet.linked;
// @ts-expect-error The result-only package does not expose checked inputs.
api.first(packet);
void option; void digit; void word; void proof;
