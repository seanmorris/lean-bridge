/**
 * Positive and negative public TypeScript calls for structural Subtypes.
 *
 * @file
 */
import * as api from "structuralsubtypes";

/** An inhabited optional carrier preserves its exact payload type. */
type Some<T> = {
	/** The public present-value discriminator. */
	readonly tag: "some";
	/** The payload after Lean erases the proof. */
	readonly value: T;
};
/** An absent optional carrier has no payload. */
type None = {
	/** The public absent-value discriminator. */
	readonly tag: "none";
};
/** A successful result carries the erased Nat base. */
type Success = {
	/** The successfully returned Nat. */
	readonly ok: bigint;
};
/** A failed result carries the erased String base. */
type Failure = {
	/** The error-side String payload. */
	readonly error: string;
};
const some = <T,>(value: T): Some<T> => ({ tag: "some", value });
const none = { tag: "none" } as const;
const nats: ReadonlyArray<bigint> = api.arrays([1n, 2n]);
const lists: ReadonlyArray<bigint> = api.lists(nats);
const specialized: ReadonlyArray<bigint> = api.specialized(lists);
const option: None | Some<bigint> = api.options(some(1n));
const product: readonly [bigint, string] = api.product([2n, "hi"]);
const result: Success | Failure = api.branch({ error: "hi" });
const bytePairs = api.byteBranches([none, some([255, 1n] as const)]);
const total: bigint = api.nested([[some([1n, 2n] as const)]]);
const groups = api.aliasPair([[some(1n)], [none]]);
const joined = api.aliasArguments(groups[0], groups[1]);
const size: bigint = api.plainFin(joined);
// @ts-expect-error Nat inputs use bigint, not floating-point numbers.
api.arrays([1]);
// @ts-expect-error A Subtype crosses as its base value, never a caller-supplied proof object.
api.options(some({ value: 1n, proof: true }));
// @ts-expect-error The result's error branch carries a string.
api.branch({ error: 1n });
// @ts-expect-error UInt8 uses a number, not bigint.
api.byteBranches([some([255n, 1n] as const)]);
void specialized; void option; void product; void result; void bytePairs; void total; void size;
