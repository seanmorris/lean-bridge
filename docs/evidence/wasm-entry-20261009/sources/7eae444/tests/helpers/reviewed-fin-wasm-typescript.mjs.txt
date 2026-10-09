/**
 * Independently stated TypeScript signatures for the Fin-only installed corpus.
 *
 * @file
 */
import { reviewedFinWasmSelections } from "./reviewed-fin-wasm-fixture.mjs";

/**
 * Compile and execute public calls without deriving expected types from emitted declarations.
 *
 * @param selection - Scalar-only or scalar plus structural exports.
 */
export const reviewedFinWasmTypeScript = selection => {
	if(!reviewedFinWasmSelections.includes(selection)) throw new Error("Unknown Fin selection");
	return `import * as api from "reviewed-fin";
import { executeCorpus } from "./javascript.mjs";
import { loadApi, request } from "./package.mjs";
type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;
type Expect<T extends true> = T;
type Scalar = (value: bigint) => bigint;
export type Mirror = Expect<Equal<typeof api.mirror, Scalar>>;
export type Never = Expect<Equal<typeof api.never, Scalar>>;
export type Only = Expect<Equal<typeof api.only, Scalar>>;
export type Huge = Expect<Equal<typeof api.huge, Scalar>>;
export type Tenth = Expect<Equal<typeof api.tenth, Scalar>>;
export type Label = Expect<Equal<typeof api.label, (before: string, digit: bigint, after: string) => string>>;
// Fin bounds are runtime checked; their representation remains Nat's bigint.
const value: bigint = api.mirror(9n);
const label: string = api.label("prefix", 0n, "suffix");
void value; void label;
if (false) {
  // @ts-expect-error Fin cannot be passed as a machine number.
  api.mirror(9);
  // @ts-expect-error Fin cannot be passed as text.
  api.huge("9");
  // @ts-expect-error The later bounded argument retains its static representation.
  api.label("prefix", 9, "suffix");
}
${selection === "structural" ? `type Rows = ReadonlyArray<ReadonlyArray<bigint>>;
type Item = Readonly<{ tag: "none" }> | Readonly<{ tag: "some"; value: readonly [bigint, Readonly<{ ok: bigint }> | Readonly<{ error: bigint }>] }>;
type Items = ReadonlyArray<Item>;
export type RowSignature = Expect<Equal<typeof api.rows, (values: Rows) => Rows>>;
export type EmptySignature = Expect<Equal<typeof api.empty, (values: ReadonlyArray<bigint>) => ReadonlyArray<bigint>>>;
export type NestedSignature = Expect<Equal<typeof api.nested, (values: Items) => Items>>;
const rows: Rows = api.rows([[0n, 9n]]);
const nested: Items = api.nested([{ tag: "some", value: [2n, { error: 1n }] }]);
void rows; void nested;
if (false) {
  // @ts-expect-error Nested Fin cannot be passed as a number.
  api.rows([[1]]);
  // @ts-expect-error Active error branch retains its bounded Nat representation.
  api.nested([{ tag: "some", value: [2n, { error: 1 }] }]);
}
` : ""}
console.log(JSON.stringify(executeCorpus(request, await loadApi())));
`;
};
