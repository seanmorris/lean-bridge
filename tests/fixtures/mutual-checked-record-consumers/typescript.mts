/**
 * Strict public types for the mutually recursive proof-free package.
 *
 * @file
 */
import * as api from "mutualcheckedrecords";

/** An inhabited optional carrier preserves its exact recursive payload. */
type Some<T> = Readonly<{
	/** Public present-value discriminator. */
	tag: "some";
	/** Proof-free recursive payload. */
	value: T;
}>;
/** An absent optional carrier has no payload. */
type None = Readonly<{
	/** Public absent-value discriminator. */
	tag: "none";
}>;
const none: None = { tag: "none" };
const child: api.Envelope = { value: 80n, mode: 1n, next: none };
const step: api.Step = { kind: "more", packet: child };
const value: api.EnvelopeAlias = {
	value: 40n, mode: 2n, next: { tag: "some", value: step }
};
const stopped: api.Envelope = {
	value: 40n, mode: 2n, next: { tag: "some", value: { kind: "stop" } }
};
const first: bigint = api.first(value) + api.second(stopped);
const echoed: api.Envelope = api.echo(value);
const grouped: bigint = api.groups([{ tag: "some", value }, none]);
const echoedGroups: ReadonlyArray<None | Some<api.EnvelopeAlias>>
	= api.echoGroups([{ tag: "some", value }]);
const produced: api.Envelope = api.produce(5n);
// @ts-expect-error The erased proof is never a public record field.
api.first({ value: 40n, mode: 2n, next: none, linked: true });
// @ts-expect-error Fin and Subtype payloads retain bigint Nat representation.
api.first({ value: 40, mode: 2n, next: none });
// @ts-expect-error The active recursive variant case requires its packet.
api.first({ value: 40n, mode: 2n, next: { tag: "some", value: { kind: "more" } } });
void first; void echoed; void grouped; void echoedGroups; void produced;
