import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";

import { alpha } from "../../../poc/lean-link-spike/descriptors.mjs";
import { createLibrarySurface } from "../../../poc/link-spike/loader.mjs";
import {
	ErrorEnvelopeGenerationError,
	compileErrorEnvelopeV1,
} from "../../../src/abi/error-envelope.mjs";
import { generateJavaScriptPackage } from "../../../src/backends/javascript/generate.mjs";
import {
	JavaScriptProjectionError,
	compileJavaScriptProjection,
} from "../../../src/backends/javascript/projection.mjs";

const errorFixture = () => {
	const ir = structuredClone(alpha.bindingIr);
	ir.errors.push({
		id: "error:underflow"
		, name: "Underflow"
		, category: "domain"
		, payload: { kind: "primitive", name: "uint32" }
		, documentation: {
			summary: "The requested predecessor is below zero."
			, details: "The payload preserves the rejected unsigned input."
		}
	});
	ir.declarations.push({
		id: "bridge:Alpha.checkedPred"
		, name: "checkedPred"
		, kind: "function"
		, owner: null
		, overloadKey: "checkedPred(uint32)"
		, typeParameters: []
		, receiver: null
		, parameters: [
			{
				name: "value"
				, type: { kind: "primitive", name: "uint32" }
				, ownership: "copy"
				, lifetime: null
				, mutability: "immutable"
				, optional: false
				, default: null
			}
		]
		, result: {
			type: { kind: "primitive", name: "uint32" }
			, ownership: "copy"
			, lifetime: null
		}
		, mutability: "immutable"
		, effects: ["fails"]
		, failure: {
			mode: "declared"
			, errors: ["error:underflow"]
			, unexpected: "poison-runtime"
		}
		, resultMode: "value"
		, capabilities: ["capability:shared-runtime"]
		, assurance: []
		, documentation: {
			summary: "Return the predecessor of a positive unsigned value."
			, details: "Zero produces a typed Underflow error."
		}
		, source: {
			producer: "bridge"
			, declaration: "Alpha.checkedPred"
			, extensions: { "lean-wasm.org/intrinsic": "error-envelope-probe" }
		}
	});
	const privateAbi = structuredClone(alpha.privateAbi);
	privateAbi.initialize = null;
	privateAbi.declarations["bridge:Alpha.checkedPred"] = {
		symbol: "_bridge_error_probe"
		, adapter: {
			kind: "error-envelope-v1"
			, abiVersion: 1
			, maxEnvelopeBytes: 256
		}
	};
	return { ir, privateAbi };
};

const withGeneratedPackage = async (files, runtimeSource, operation) => {
	const directory = await mkdtemp(join(tmpdir(), "lean-bridge-errors-"));
	try
	{
		for(const [relativePath, source] of Object.entries({
			...files,
			"internal/runtime.mjs": runtimeSource
		})) {
			const destination = join(directory, relativePath);
			await mkdir(join(destination, ".."), { recursive: true });
			await writeFile(destination, source);
		}
		await operation(directory);
	} finally
	{
		await rm(directory, { recursive: true, force: true });
	}
};

test("error envelope plans derive tags, scalar layout, and poison policy from Binding IR", () => {
  const { ir } = errorFixture();
  const plan = compileErrorEnvelopeV1(ir, "bridge:Alpha.checkedPred");
  assert.equal(plan.kind, "error-envelope-v1");
  assert.equal(plan.byteSize, 24);
  assert.deepEqual(plan.header, {
    abiVersion: 0
    , byteSize: 4
    , outcome: 8
    , errorTag: 12
  });
  assert.deepEqual(plan.result, {
    type: { kind: "primitive", name: "uint32" }
    , codec: "uint32"
    , byteWidth: 4
    , alignment: 4
    , offset: 16
  });
  assert.equal(plan.errors[0].tag, 1);
  assert.equal(plan.errors[0].id, "error:underflow");
  assert.equal(plan.errors[0].payload.offset, 20);
  assert.equal(plan.unexpected, "poison-runtime");

  const unsupported = structuredClone(ir);
  unsupported.errors.find(error => error.id === "error:underflow").payload = {
    kind: "primitive"
    , name: "string"
  };
  assert.throws(
    () => compileErrorEnvelopeV1(unsupported, "bridge:Alpha.checkedPred"),
    error =>
      error instanceof ErrorEnvelopeGenerationError
      && error.code === "unsupported-error-value",
  );
});

test("projection requires the generated error envelope for rich declared errors", () => {
  const { ir, privateAbi } = errorFixture();
  const projection = compileJavaScriptProjection(ir, privateAbi);
  const binding = projection.bindings.find(binding => binding.name === "checkedPred");
  assert.equal(binding.adapter.kind, "error-envelope-v1");
  assert.equal(binding.adapter.errors[0].id, "error:underflow");

  privateAbi.declarations["bridge:Alpha.checkedPred"].adapter = null;
  assert.throws(
    () => compileJavaScriptProjection(ir, privateAbi),
    error =>
      error instanceof JavaScriptProjectionError
      && error.code === "missing-error-envelope-adapter",
  );
});

test("the runtime returns values, reports declared errors, and poisons on corrupt outcomes", () => {
  const { ir, privateAbi } = errorFixture();
  const projection = compileJavaScriptProjection(ir, privateAbi);
  const binding = projection.bindings.find(binding => binding.name === "checkedPred");
  const buffer = new ArrayBuffer(1024);
  const view = new DataView(buffer);
  const module = {
    HEAP8: new Int8Array(buffer)
    , _malloc: () => 64
    , _free: () => {}
    , _bridge_error_probe:
      /**
       * Writes the synthetic success or failure envelope used to exercise generated error decoding.
       *
       * @param pointer - Linear-memory address passed to the generated bridge probe.
       * @param value - Probe input that selects and populates the synthetic result envelope.
       */
      function(pointer, value) {
      view.setUint32(pointer, 1, true);
      view.setUint32(pointer + 4, 24, true);
      if(value === 0xffff_ffff)
{
        view.setUint32(pointer + 8, 2, true);
} else if(value === 0)
{
        view.setUint32(pointer + 8, 1, true);
        view.setUint32(pointer + 12, 1, true);
        view.setUint32(pointer + 20, value, true);
} else
{
        view.setUint32(pointer + 8, 0, true);
        view.setUint32(pointer + 16, value - 1, true);
}
      return 0;
      }
  };
  const api = createLibrarySurface(module, {
    id: "poc/error-envelope@0.0.0"
    , buildHash: "error-envelope-test"
    , bindingIr: ir
    , bindings: Object.freeze([binding])
  });

  assert.equal(api.checkedPred(42), 41);
  assert.throws(
    () => api.checkedPred(0),
    error =>
      error.code === "declared-error"
      && error.details.errorId === "error:underflow"
      && error.details.payload === 0,
  );
  assert.throws(
    () => api.checkedPred(0xffff_ffff),
    error => error.code === "unexpected-native-failure",
  );
  assert.throws(() => api.checkedPred(1), error => error.code === "runtime-poisoned");
});

test("trap policy reports one unexpected failure without poisoning later calls", () => {
  const { ir, privateAbi } = errorFixture();
  ir.declarations.find(
    declaration => declaration.id === "bridge:Alpha.checkedPred",
  ).failure.unexpected = "trap";
  const projection = compileJavaScriptProjection(ir, privateAbi);
  const binding = projection.bindings.find(binding => binding.name === "checkedPred");
  const buffer = new ArrayBuffer(1024);
  const view = new DataView(buffer);
  let failNext = true;
  const module = {
    HEAP8: new Int8Array(buffer)
    , _malloc: () => 64
    , _free: () => {}
    , _bridge_error_probe:
      /**
       * Writes the synthetic success or failure envelope used to exercise generated error decoding.
       *
       * @param pointer - Linear-memory address passed to the generated bridge probe.
       * @param value - Probe input encoded into the alternating failure and success envelopes.
       */
      function(pointer, value) {
      view.setUint32(pointer, 1, true);
      view.setUint32(pointer + 4, 24, true);
      view.setUint32(pointer + 8, failNext ? 2 : 0, true);
      view.setUint32(pointer + 16, value - 1, true);
      failNext = false;
      return 0;
      }
  };
  const api = createLibrarySurface(module, {
    id: "poc/error-trap@0.0.0"
    , buildHash: "error-trap-test"
    , bindingIr: ir
    , bindings: Object.freeze([binding])
  });

  assert.throws(
    () => api.checkedPred(4),
    error =>
      error.code === "unexpected-native-failure" && error.details.policy === "trap",
  );
  assert.equal(api.checkedPred(4), 3);
});

test("generated JavaScript translates an internal envelope into an idiomatic error class", async () => {
  const { ir } = errorFixture();
  const files = generateJavaScriptPackage(ir);
  assert.match(files["index.mjs"], /export class Underflow extends Error/);
  assert.match(files["index.d.ts"], /readonly payload: number/);
  assert.doesNotMatch(files["index.d.ts"], /declared-error|error envelope/i);

  const runtimeSource = `
export const runtime = Object.freeze({
  call(declaration, args) {
    if (declaration !== "bridge:Alpha.checkedPred") return undefined;
    if (args[0] === 0) {
      const error = new Error("internal declared error");
      error.code = "declared-error";
      error.details = { errorId: "error:underflow", payload: 0 };
      throw error;
    }
    return args[0] - 1;
  },
  construct() {},
  method() {},
  dispose() {},
});
`;
  await withGeneratedPackage(files, runtimeSource, async directory => {
    const module = await import(
      `${pathToFileURL(join(directory, "index.mjs")).href}?test=error-envelope`
    );
    assert.equal(module.checkedPred(9), 8);
    assert.throws(
      () => module.checkedPred(0),
      error =>
        error instanceof module.Underflow
        && error.code === "error:underflow"
        && error.payload === 0
        && error.cause?.code === "declared-error",
    );
  });
});
