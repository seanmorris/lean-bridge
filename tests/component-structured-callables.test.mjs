/**
 * Installed structured npm callbacks and closures, including primitive coexistence.
 *
 * @file
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { createComponentPrivateAbi } from "../src/build/component-callable-adapters.mjs";
import { checkInstalledScalars } from "./helpers/component-scalar-install.mjs";
import { npmStructuredCallableReviewedIr, npmStructuredCallableArities } from "./helpers/npm-structured-callable-install-fixture.mjs";

const shape = ir => {
	const abi = createComponentPrivateAbi(ir);
	return { ...abi, types: abi.types.toSorted((a, b) => a.id.localeCompare(b.id))
		, callbacks: abi.callbacks.toSorted((a, b) => a.id.localeCompare(b.id))
		, exports: abi.exports.toSorted((a, b) => a.bindingId.localeCompare(b.bindingId)) };
};

test("installed npm structured callbacks preserve all nine shapes in Node, strict TypeScript, browsers, React and workers", { timeout: 1_800_000 }, async t => checkInstalledScalars(t, {
	name: "structured", module: "Structured", sourceDir: "structured-callables"
	, extension: "tests/fixtures/structured-callable-consumers/Npm.lean"
	, consumer: "structured-callable-consumers/npm.mjs"
	, consumerPrelude: ["callable-consumers/npm.mjs"]
	, signatures: npmStructuredCallableReviewedIr().declarations.map(item => ({ name: item.source.declaration }))
	, arities: npmStructuredCallableArities
	, reviewedIr: npmStructuredCallableReviewedIr
	, check: "checkStructuredCallables"
	, reportDir: "structured-callables/npm"
	, removeProducer: true
	, trace: true
	, browserTimeout: 180_000
	, requiredRuntimeSymbol: "bridge_recursive_abi"
	, documentation: async () => {
		const path = "docs/javascript-typescript.md";
		const section = (await readFile(path, "utf8")).split("### Structured callbacks\n")[1].split("### Type conversions\n")[0];
		const blocks = [...section.matchAll(/```js\n([\s\S]*?)```/g)];
		assert.equal(blocks.length, 1);
		return { path, source: blocks[0][1], stdout: "copied\n2\nleaf\n" };
	}
	, assertIr: ir => assert.deepEqual(shape(ir), shape(npmStructuredCallableReviewedIr()))
	, assertResult: result => { assert.equal(result.shapes, 9); assert.ok(result.checks > 100000); assert.ok(result.rejections > 40); assert.equal(result.primitive.primitives, 19); assert.ok(result.primitive.checks > 8000); }
	, typescript: `import * as api from "structured";
const payload: api.Payload = { text: "copied", rows: [{ tag: "none" }], count: 2n, nested: { tag: "some", value: { ok: [3n, undefined] } } };
const result: api.Payload = api.callRecord(payload, value => value);
const closure = api.makeRecord(payload);
const alias: api.Alias = closure(true, result);
if (alias.text !== "copied" || alias.count !== 2n) throw new Error("Structured closure mismatch");
closure[Symbol.dispose]();
api.callArray([{ tag: "some", value: "🌱" }], value => value);
api.callList([{ ok: [42, "list"] }, { error: "error" }], value => value);
api.callOption({ tag: "some", value: { tag: "some", value: undefined } }, value => value);
api.callResult({ error: ["error"] }, value => value);
api.callTuple(["tuple", [new Uint8Array([0, 255]), 7n]], value => value);
api.callAlias(payload, value => value);
const packet: api.Packet = api.callVariant({ kind: "counts", positive: 5n, negative: -9n }, value => value);
const tree: api.Tree = api.callRecursive({ kind: "branch", children: [{ kind: "leaf", value: 19n }] }, value => value);
const recursive = api.makeRecursive(tree); recursive(false, tree); recursive.dispose();
if (packet.kind !== "counts" || tree.kind !== "branch") throw new Error("Structured constructors mismatch");
const primitive = api.makeNat(1n << 100n); if (primitive(true, 0n) !== 1n << 100n) throw new Error("Primitive coexistence"); primitive.dispose();
const array = api.makeArray([{ tag: "none" }]); array(true, []); array.dispose();
const list = api.makeList([{ error: "error" }]); list(false, [{ ok: [1, "one"] }]); list.dispose();
const option = api.makeOption({ tag: "none" }); option(true, { tag: "some", value: { tag: "none" } }); option.dispose();
const outcome = api.makeResult({ ok: { tag: "some", value: 42 } }); outcome(false, { error: [] }); outcome.dispose();
const tuple = api.makeTuple(["one", [new Uint8Array(), 1n]]); tuple(false, ["two", [new Uint8Array([1]), 2n]]); tuple.dispose();
const aliasClosure = api.makeAlias(payload); aliasClosure(true, payload); aliasClosure.dispose();
const variant = api.makeVariant(packet); variant(false, { kind: "empty" }); variant.dispose();
// @ts-expect-error A record callback cannot replace the natural number with number.
const bad: (value: api.Payload, callback: (value: api.Payload) => { text: string; rows: never[]; count: number; nested: { tag: "none" } }) => api.Payload = api.callRecord; void bad;
// @ts-expect-error Recursive branches require Trees, not scalar numbers.
const wrong: api.Tree = { kind: "branch", children: [1] }; void wrong;
`
}));
