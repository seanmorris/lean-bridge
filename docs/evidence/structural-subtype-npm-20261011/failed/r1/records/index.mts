import * as api from "structuralsubtypes";

const some = <T,>(value: T): { readonly tag: "some"; readonly value: T } => ({ tag: "some", value });
const none = { tag: "none" } as const;
const nats: ReadonlyArray<bigint> = api.arrays([1n, 2n]);
const lists: ReadonlyArray<bigint> = api.lists(nats);
const specialized: ReadonlyArray<bigint> = api.specialized(lists);
const option: { readonly tag: "none" } | { readonly tag: "some"; readonly value: bigint } = api.options(some(1n));
const product: readonly [bigint, string] = api.product([2n, "hi"]);
const result: { readonly ok: bigint } | { readonly error: string } = api.branch({ error: "hi" });
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
