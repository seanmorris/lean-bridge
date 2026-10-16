/** Strict public types for the independently selected result-only package. */
import * as api from "nestedcheckedrecords";

type Some<T> = Readonly<{ tag: "some"; value: T }>;
type None = Readonly<{ tag: "none" }>;
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
