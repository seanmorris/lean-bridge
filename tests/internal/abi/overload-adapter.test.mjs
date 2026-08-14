/**
 * Tests the overload adapter behavior.
 *
 * @file
 */

import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";

import { alpha } from "../../../poc/lean-link-spike/descriptors.mjs";
import { createLibrarySurface } from "../../../poc/link-spike/loader.mjs";
import { compileOverloadV1 } from "../../../src/abi/overload.mjs";
import { analyzeJavaScriptCoverage } from "../../../src/backends/javascript/coverage.mjs";
import { generateJavaScriptPackage } from "../../../src/backends/javascript/generate.mjs";
import { compileJavaScriptProjection } from "../../../src/backends/javascript/projection.mjs";

const uint32Parameter = name => ({
	name
	, type: { kind: "primitive", name: "uint32" }
	, ownership: "copy"
	, lifetime: null
	, mutability: "immutable"
	, optional: false
	, default: null
});

const overloadFixture = () => {
	const ir = structuredClone(alpha.bindingIr);
	const one = ir.declarations.find(
		declaration => declaration.id === "lean:Alpha.roundTrip",
	);
	one.name = "choose";
	one.overloadKey = "choose(uint32)";
	one.parameters = [uint32Parameter("value")];
	one.result = {
		type: { kind: "primitive", name: "uint32" }
		, ownership: "copy"
		, lifetime: null
	};
	one.documentation = {
		summary: "Choose a value by arity."
		, details: "Generated overload dispatch keeps both private symbols internal."
	};

	const zero = structuredClone(one);
	zero.id = "bridge:Alpha.chooseDefault";
	zero.overloadKey = "choose()";
	zero.parameters = [];
	zero.source = {
		producer: "bridge"
		, declaration: "Alpha.chooseDefault"
		, extensions: { "lean-wasm.org/intrinsic": "overload-probe" }
	};
	ir.declarations.push(zero);

	const privateAbi = structuredClone(alpha.privateAbi);
	privateAbi.initialize = null;
	privateAbi.declarations[one.id] = {
		symbol: "_bridge_choose_one"
		, adapter: null
	};
	privateAbi.declarations[zero.id] = {
		symbol: "_bridge_choose_zero"
		, adapter: null
	};
	return { ir, privateAbi };
};

test("overload plans dispatch unique arities independent of declaration order", () => {
  const { ir } = overloadFixture();
  const plan = compileOverloadV1(ir, "choose");
  assert.equal(plan.strategy, "arity");
  assert.deepEqual(
    plan.branches.map(branch => [branch.arity, branch.overloadKey]),
    [
      [0, "choose()"]
      , [1, "choose(uint32)"]
    ],
  );
  assert.equal(Object.isFrozen(plan.branches), true);

  ir.declarations.reverse();
  assert.deepEqual(compileOverloadV1(ir, "choose"), plan);
});

test("the loader exposes one native callable for all overload branches", () => {
  const { ir, privateAbi } = overloadFixture();
  assert.equal(analyzeJavaScriptCoverage(ir).supported, true);
  const projection = compileJavaScriptProjection(ir, privateAbi);
  const binding = projection.bindings.find(item => item.name === "choose");
  assert.equal(binding.kind, "overload");
  assert.deepEqual(binding.dispatch.branches.map(branch => branch.arity), [0, 1]);

  const api = createLibrarySurface(
    {
      _bridge_choose_zero: () => 10
      , _bridge_choose_one: value => value + 1
      , _bridge_lean_alpha_make: () => 0x01001001
      , _bridge_lean_alpha_read: () => 0
      , _bridge_lean_handle_identity: value => value
      , _bridge_lean_release: () => 0
      , _bridge_lean_alpha_with_callback: () => 0
      , _bridge_lean_alpha_make_adder: () => 0
      , _bridge_lean_alpha_transform_call: () => 0
      , _bridge_lean_alpha_transform_release: () => 0
    },
    {
      id: "poc/overload@0.0.0"
      , buildHash: "overload-test"
      , bindingIr: ir
      , bindings: projection.bindings
    },
  );
  assert.equal(api.choose(), 10);
  assert.equal(api.choose(41), 42);
  assert.throws(() => api.choose(-1), error => error.code === "invalid-argument");
  assert.throws(() => api.choose(1, 2), error => error.code === "invalid-argument-count");
});

test("generated JavaScript and TypeScript preserve ordinary overload syntax", async () => {
  const { ir } = overloadFixture();
  const files = generateJavaScriptPackage(ir);
  assert.match(files["index.mjs"], /export function choose\(\.\.\.args\)/);
  assert.match(files["index.mjs"], /case 0:/);
  assert.match(files["index.mjs"], /case 1:/);
  assert.equal(
    [...files["index.d.ts"].matchAll(/export declare function choose\(/g)].length,
    2,
  );
  assert.equal(
    [...files["index.d.ts"].matchAll(/readonly choose: typeof choose;/g)].length,
    1,
  );

  const directory = await mkdtemp(join(tmpdir(), "lean-bridge-overload-"));
  try
{
    for(const [relativePath, source] of Object.entries({
      ...files,
      "internal/runtime.mjs": `
export const runtime = Object.freeze({
  call(declaration, args) {
    if (declaration === "bridge:Alpha.chooseDefault") return 10;
    if (declaration === "lean:Alpha.roundTrip") return args[0] + 1;
    throw new Error("unexpected call");
  },
});
`
    })) {
      const destination = join(directory, relativePath);
      await mkdir(join(destination, ".."), { recursive: true });
      await writeFile(destination, source);
    }
    const module = await import(
      `${pathToFileURL(join(directory, "index.mjs")).href}?test=overload`
    );
    assert.equal(module.choose(), 10);
    assert.equal(module.choose(41), 42);
    assert.throws(() => module.choose(1, 2), /expects 0 or 1 arguments/);
} finally
{
    await rm(directory, { recursive: true, force: true });
}
});

test("same-arity and asynchronous overload groups remain coverage-gated", () => {
  const ambiguous = overloadFixture();
  ambiguous.ir.declarations.find(
    declaration => declaration.id === "bridge:Alpha.chooseDefault",
  ).parameters = [uint32Parameter("other")];
  let coverage = analyzeJavaScriptCoverage(ambiguous.ir);
  assert.equal(coverage.supported, false);
  assert.equal(coverage.gaps.some(gap => gap.code === "ambiguous-overload-group"), true);

  const asynchronous = overloadFixture();
  const branch = asynchronous.ir.declarations.find(
    declaration => declaration.id === "bridge:Alpha.chooseDefault",
  );
  branch.resultMode = "promise";
  branch.effects.push("async");
  coverage = analyzeJavaScriptCoverage(asynchronous.ir);
  assert.equal(coverage.supported, false);
  assert.equal(
    coverage.gaps.some(gap => gap.code === "unsupported-overload-result-mode"),
    true,
  );
});
