/** Strict result-only package: proof-free records are produced without checked inputs. */
import * as api from "checkedrecordvalueindices";

const on: api.On = api.produceTrueBool();
const off: api.Off = api.produceFalseBool();
const ab: api.Ab = api.produceAb();
const empty: api.EmptyToken = api.produceEmptyString(3n);
const unicode: api.UnicodeToken = api.produceUnicodeString(4n);
const sized: api.EmptySized = api.produceEmptySized();
const zero: api.ZeroToken = api.produceZeroNat(5n);
const wide: api.WideToken = api.produceWideNat(6n);
// @ts-expect-error Proof fields are absent from Lean-produced results too.
const proof: boolean = sized.sized;
// @ts-expect-error A result-only package does not expose checked-input functions.
api.trueBoolIndex(on);
void off; void ab; void empty; void unicode; void zero; void wide; void proof;
