/**
 * Strict payload-only types for every admitted closed value-index kind.
 *
 * @file
 */
import * as api from "checkedrecordvalueindices";

const on: api.On = { count: 0n };
const off: api.Off = { count: 1n };
const ab: api.Ab = { size: 2n };
const empty: api.EmptyToken = { count: 3n };
const unicode: api.UnicodeToken = { count: 4n };
const sized: api.EmptySized = { data: [] };
const zero: api.ZeroToken = { count: 5n };
const wide: api.WideToken = { count: 6n };
const total: bigint = api.trueBoolIndex(on) + api.falseBoolIndex(off)
	+ api.abStringIndex(ab) + api.emptyStringIndex(empty)
	+ api.unicodeStringIndex(unicode) + api.emptySizedIndex(sized)
	+ api.zeroNatIndex(zero) + api.wideNatIndex(wide);
const outputs: ReadonlyArray<
	api.On | api.Off | api.Ab | api.EmptyToken | api.UnicodeToken
	| api.EmptySized | api.ZeroToken | api.WideToken
> = [
	api.produceTrueBool(), api.produceFalseBool(), api.produceAb()
	, api.produceEmptyString(3n), api.produceUnicodeString(4n)
	, api.produceEmptySized(), api.produceZeroNat(5n), api.produceWideNat(6n)
];
// @ts-expect-error Erased proof fields never appear in a host record.
api.emptySizedIndex({ data: [], sized: true });
// @ts-expect-error The closed index remains provenance, not a payload field.
const indexed: api.WideToken = { count: 1n, index: 340282366920938463463374607431768211457n };
// @ts-expect-error Nat payloads retain bigint representation.
api.zeroNatIndex({ count: 1 });
void total; void outputs; void indexed;
