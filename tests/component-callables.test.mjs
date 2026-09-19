/**
 * Installed real-Lean npm primitive callables on both producer paths.
 *
 * @file
 */
import assert from "node:assert/strict";
import test from "node:test";
import { callableArities, callablePrimitives, callableReviewedIr, callableSignatures } from "./helpers/callable-fixture.mjs";
import { checkInstalledScalars } from "./helpers/component-scalar-install.mjs";

const callback = (parameters, result) => ({ callback: { parameters, result } });
const unary = callback(["uint32"], "uint32"), sixteen = callback(Array(16).fill("uint32"), "uint32");
const signatures = [...callableSignatures
	, { name: "Callables.retainCallback", parameters: [unary], result: unary }
	, { name: "Callables.combine", parameters: ["string", "uint64", callback(["string", "uint64"], "string"), callback(["string"], "string")], result: "string" }
	, { name: "Callables.apply16", parameters: [sixteen], result: "uint32" }
	, { name: "Callables.make16", parameters: ["uint32"], result: sixteen }];

const typedCases = callablePrimitives.map(([name, type]) => {
	const host = type === "unit" ? "void" : type === "bool" ? "boolean" : ["string", "char"].includes(type) ? "string" : type === "bytes" ? "Uint8Array" : ["uint64", "int64", "nat", "int"].includes(type) ? "bigint" : "number";
	const value = { void: "undefined", boolean: "true", string: '"🌱"', Uint8Array: "new Uint8Array([0, 255])", bigint: "42n", number: "42" }[host];
	return `{
  const value: ${host} = ${value};
  const direct: ${host} = api.call${name}(value, input => input);
  const twice: ${host} = api.twice${name}(value, input => input);
  const fn = api.make${name}(value);
  const returned: ${host} = fn(true, value);
  if (${host === "Uint8Array" ? "direct[1] !== 255 || twice[1] !== 255 || returned[1] !== 255" : "!Object.is(direct, value) || !Object.is(twice, value) || !Object.is(returned, value)"}) throw new Error("${name} typed round trip");
  fn.dispose();
  // @ts-expect-error Wrong primitive argument type must not be accepted.
  const wrong: (value: ${host === "string" ? "number" : "string"}, callback: (value: ${host}) => ${host}) => ${host} = api.call${name};
  void wrong;
}`;
}).join("\n");

test("installed npm primitive callables work in Node, strict TypeScript, browsers, React and workers", { timeout: 600_000 }, async t => checkInstalledScalars(t, {
	name: "callables"
	, module: "Callables"
	, sourceDir: "callables"
	, extension: "tests/fixtures/callable-consumers/Npm.lean"
	, consumer: "callable-consumers/npm.mjs", signatures
	, arities: { ...callableArities, "Callables.retainCallback": 1, "Callables.make16": 1 }
	, reviewedIr: () => callableReviewedIr(signatures)
	, check: "checkCallables", reportDir: "callables/npm"
	, trace: true, browserTimeout: 120_000
	, assertIr: ir => {
		const types = new Map(ir.types.map(type => [type.id, type]));
		const shape = type => type.kind === "primitive" ? type.name : callback(types.get(type.id).callable.parameters.map(p => shape(p.type)), shape(types.get(type.id).callable.result.type));
		assert.deepEqual(ir.declarations.map(d => ({ name: d.source.declaration, parameters: d.parameters.map(p => shape(p.type)), result: shape(d.result.type) })).sort((a, b) => a.name.localeCompare(b.name)), signatures.toSorted((a, b) => a.name.localeCompare(b.name)));
	}
	, assertResult: result => { assert.equal(result.primitives, 19); assert.equal(result.wordBits, 32); assert.ok(result.checks > 8000); }
	, typescript: `import * as api from "callables";
${typedCases}
const result: bigint = api.callNat(1n << 100n, value => value + 1n);
const closure = api.makeString("🌱");
const text: string = closure(true, "unused");
const closed: boolean = closure.disposed;
if (text !== "🌱" || closed || result !== (1n << 100n) + 1n) throw new Error("TypeScript callable mismatch");
closure[Symbol.dispose]();
if (!closure.disposed) throw new Error("TypeScript disposal mismatch");
// @ts-expect-error Nat callbacks must return bigint, not number.
const bad: (value: bigint, callback: (value: bigint) => number) => bigint = api.callNat;
`
}));
