import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";

import { alpha } from "../../../poc/lean-link-spike/descriptors.mjs";
import { createLibrarySurface } from "../../../poc/link-spike/loader.mjs";
import { compileGenericSpecializationV1 } from "../../../src/abi/generic-specialization.mjs";
import { analyzeJavaScriptCoverage } from "../../../src/backends/javascript/coverage.mjs";
import { generateJavaScriptPackage } from "../../../src/backends/javascript/generate.mjs";
import { compileJavaScriptProjection } from "../../../src/backends/javascript/projection.mjs";

const genericFixture = () => {
  const ir = structuredClone(alpha.bindingIr);
  const declaration = ir.declarations.find(
    item => item.id === "lean:Alpha.roundTrip",
  );
  declaration.name = "echo";
  declaration.overloadKey = "echo<T>(T)";
  declaration.typeParameters = [
    { id: "T", representation: "copied", constraints: [] },
  ];
  declaration.parameters = [
    {
      name: "value",
      type: { kind: "parameter", id: "T" },
      ownership: "copy",
      lifetime: null,
      mutability: "immutable",
      optional: false,
      default: null,
    },
  ];
  declaration.result = {
    type: { kind: "parameter", id: "T" },
    ownership: "copy",
    lifetime: null,
  };
  declaration.documentation = {
    summary: "Return a value through a compiled value path.",
    details: "The package advertises only concrete types with private implementations.",
  };
  declaration.source.extensions["lean-wasm.org/specializations"] = [
    { id: "uint32", type: { kind: "primitive", name: "uint32" } },
    { id: "string", type: { kind: "primitive", name: "string" } },
  ];

  const privateAbi = structuredClone(alpha.privateAbi);
  privateAbi.initialize = null;
  privateAbi.declarations[declaration.id] = {
    symbol: "_bridge_echo_uint32",
    adapter: {
      kind: "generic-specialization-v1",
      abiVersion: 1,
      branches: [
        { id: "uint32", symbol: "_bridge_echo_uint32" },
        { id: "string", symbol: "_bridge_echo_string" },
      ],
    },
  };
  return { ir, privateAbi, declaration };
};

test("generic plans bind canonical specializations to disjoint runtime guards", () => {
  const { ir, privateAbi, declaration } = genericFixture();
  const plan = compileGenericSpecializationV1(
    ir,
    declaration.id,
    privateAbi.declarations[declaration.id].adapter,
  );
  assert.deepEqual(
    plan.branches.map(branch => [branch.id, branch.guard]),
    [
      ["uint32", "number"],
      ["string", "string"],
    ],
  );
  assert.equal(Object.isFrozen(plan.branches), true);

  declaration.source.extensions["lean-wasm.org/specializations"].push({
    id: "int32",
    type: { kind: "primitive", name: "int32" },
  });
  assert.throws(
    () => compileGenericSpecializationV1(ir, declaration.id),
    error => error.code === "ambiguous-generic-specialization",
  );
});

test("the loader dispatches a native generic function without type tokens", () => {
  const { ir, privateAbi } = genericFixture();
  assert.equal(analyzeJavaScriptCoverage(ir).supported, true);
  const projection = compileJavaScriptProjection(ir, privateAbi);
  const binding = projection.bindings.find(item => item.name === "echo");
  const module = {
    _bridge_echo_uint32: value => value + 1,
    _bridge_echo_string: value => `${value}!`,
    _bridge_lean_alpha_make: () => 0x01001001,
    _bridge_lean_alpha_read: () => 0,
    _bridge_lean_handle_identity: value => value,
    _bridge_lean_release: () => 0,
    _bridge_lean_alpha_with_callback: () => 0,
    _bridge_lean_alpha_make_adder: () => 0,
    _bridge_lean_alpha_transform_call: () => 0,
    _bridge_lean_alpha_transform_release: () => 0,
  };
  const api = createLibrarySurface(module, {
    id: "poc/generic@0.0.0",
    buildHash: "generic-test",
    bindingIr: ir,
    bindings: projection.bindings,
  });
  assert.equal(api.echo(41), 42);
  assert.equal(api.echo("lean"), "lean!");
  assert.throws(() => api.echo(true), error => error.code === "unsupported-generic-value");
  assert.equal("specialize" in api, false);
  assert.equal(binding.adapter.branches.every(branch => "symbol" in branch), true);
});

test("generated packages advertise only compiled generic signatures", async () => {
  const { ir } = genericFixture();
  const files = generateJavaScriptPackage(ir);
  assert.equal(
    [...files["index.d.ts"].matchAll(/export declare function echo\(/g)].length,
    2,
  );
  assert.match(files["index.d.ts"], /echo\(value: number\): number/);
  assert.match(files["index.d.ts"], /echo\(value: string\): string/);
  assert.doesNotMatch(files["index.d.ts"], /echo<T>/);
  assert.doesNotMatch(files["index.mjs"], /specialization|_bridge_/);

  const directory = await mkdtemp(join(tmpdir(), "lean-bridge-generic-"));
  try {
    for (const [relativePath, source] of Object.entries({
      ...files,
      "internal/runtime.mjs": `
export const runtime = Object.freeze({
  call(declaration, args) {
    if (declaration !== "lean:Alpha.roundTrip") throw new Error("unexpected call");
    return typeof args[0] === "number" ? args[0] + 1 : args[0] + "!";
  },
});
`,
    })) {
      const destination = join(directory, relativePath);
      await mkdir(join(destination, ".."), { recursive: true });
      await writeFile(destination, source);
    }
    const module = await import(
      `${pathToFileURL(join(directory, "index.mjs")).href}?test=generic`
    );
    assert.equal(module.echo(4), 5);
    assert.equal(module.echo("ok"), "ok!");
    assert.throws(() => module.echo(true), /does not support this value type/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("missing metadata, constrained types, and private drift remain gated", () => {
  const missing = genericFixture();
  delete missing.declaration.source.extensions["lean-wasm.org/specializations"];
  let coverage = analyzeJavaScriptCoverage(missing.ir);
  assert.equal(coverage.gaps.some(gap => gap.code === "missing-generic-specializations"), true);

  const constrained = genericFixture();
  constrained.declaration.typeParameters[0].constraints.push("constraint:copyable");
  coverage = analyzeJavaScriptCoverage(constrained.ir);
  assert.equal(coverage.gaps.some(gap => gap.code === "unsupported-generic-shape"), true);

  const drifted = genericFixture();
  drifted.privateAbi.declarations[drifted.declaration.id].adapter.branches.pop();
  assert.throws(
    () => compileJavaScriptProjection(drifted.ir, drifted.privateAbi),
    error => error.code === "missing-generic-symbol",
  );
});
