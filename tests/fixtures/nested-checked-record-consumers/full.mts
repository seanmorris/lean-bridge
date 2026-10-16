/**
 * Strict public types for every nested checked-record export.
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
const packet: api.Packet = { digit: 2n, word: 3n };
const holder: api.Holder = { packet, tag: 4n };
const choice: api.Choice = { kind: "packet", value: packet };
const first: bigint = api.first(packet) + api.second(packet) + api.pair(packet, packet);
const nested: bigint = api.inArray([packet]) + api.inList([packet])
	+ api.inOption({ tag: "some", value: packet } satisfies Some<api.Packet>)
	+ api.inProduct([packet, packet]) + api.inExcept({ ok: packet })
	+ api.inHolder(holder) + api.inChoice(choice);
const echoed: ReadonlyArray<api.Packet> = api.echoArray([packet]);
const option: None | Some<api.Packet> = api.produceOption(4n);
const produced: ReadonlyArray<api.Packet> = api.produceArray(4n);
// @ts-expect-error The erased proof is never a public record field.
api.first({ digit: 2n, word: 3n, linked: true });
// @ts-expect-error Fin and Subtype payloads retain bigint Nat representation.
api.first({ digit: 2, word: 3n });
// @ts-expect-error An active variant case requires its checked payload.
api.inChoice({ kind: "packet" });
void first; void nested; void echoed; void option; void produced;
