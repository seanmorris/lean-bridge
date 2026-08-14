/**
 * Tests the iterator adapter behavior.
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
import {
	IteratorGenerationError,
	compileAsyncIteratorV1,
	compileIteratorV1,
} from "../../../src/abi/iterator.mjs";
import { analyzeJavaScriptCoverage } from "../../../src/backends/javascript/coverage.mjs";
import { generateJavaScriptPackage } from "../../../src/backends/javascript/generate.mjs";
import {
	JavaScriptProjectionError,
	compileJavaScriptProjection,
} from "../../../src/backends/javascript/projection.mjs";

const iteratorFixture = () => {
	const ir = structuredClone(alpha.bindingIr);
	ir.declarations.push({
		id: "bridge:Alpha.range"
		, name: "range"
		, kind: "function"
		, owner: null
		, overloadKey: "range(uint32)"
		, typeParameters: []
		, receiver: null
		, parameters: [
			{
				name: "end"
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
		, effects: ["allocates"]
		, failure: { mode: "none", errors: [], unexpected: "poison-runtime" }
		, resultMode: "iterator"
		, capabilities: ["capability:shared-runtime"]
		, assurance: []
		, documentation: {
			summary: "Iterate over unsigned values below an exclusive bound."
			, details: "Iteration state closes on completion, early return, or collection."
		}
		, source: {
			producer: "bridge"
			, declaration: "Alpha.range"
			, extensions: { "lean-wasm.org/intrinsic": "iterator-probe" }
		}
	});
	const privateAbi = structuredClone(alpha.privateAbi);
	privateAbi.initialize = null;
	privateAbi.declarations["bridge:Alpha.range"] = {
		symbol: "_bridge_range_start"
		, adapter: {
			kind: "iterator-v1"
			, abiVersion: 1
			, side: "lean"
			, handleKind: 3
			, next: "_bridge_range_next"
			, dispose: "_bridge_range_release"
		}
	};
	return { ir, privateAbi };
};

const asyncIteratorFixture = () => {
	const { ir, privateAbi } = iteratorFixture();
	const declaration = ir.declarations.find(
		candidate => candidate.id === "bridge:Alpha.range",
	);
	declaration.id = "bridge:Alpha.asyncRange";
	declaration.name = "asyncRange";
	declaration.overloadKey = "asyncRange(uint32)";
	declaration.resultMode = "async-iterator";
	declaration.effects.push("async");
	declaration.source.declaration = "Alpha.asyncRange";
	delete privateAbi.declarations["bridge:Alpha.range"];
	privateAbi.declarations["bridge:Alpha.asyncRange"] = {
		symbol: "_bridge_async_range_start"
		, adapter: {
			kind: "async-iterator-v1"
			, abiVersion: 1
			, side: "lean"
			, handleKind: 4
			, next: "_bridge_async_range_next"
			, cancel: "_bridge_async_range_cancel"
			, dispose: "_bridge_async_range_release"
		}
	};
	return { ir, privateAbi };
};

const withGeneratedPackage = async (files, operation) => {
	const directory = await mkdtemp(join(tmpdir(), "lean-bridge-iterator-"));
	try
	{
		for(const [relativePath, source] of Object.entries({
			...files,
			"internal/runtime.mjs": `
export const runtime = Object.freeze({
  iterate(declaration, args) {
    if (declaration !== "bridge:Alpha.range") throw new Error("unknown iterator");
    return Array.from({ length: args[0] }, (_, index) => index);
  },
  call() {},
  construct() {},
  method() {},
  dispose() {},
});
`
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

test("iterator plans derive cursor ownership and pull frames from Binding IR", () => {
  const { ir, privateAbi } = iteratorFixture();
  const options = privateAbi.declarations["bridge:Alpha.range"].adapter;
  const plan = compileIteratorV1(ir, "bridge:Alpha.range", options);
  assert.equal(plan.kind, "iterator-v1");
  assert.equal(plan.delivery, "iterator");
  assert.equal(plan.cursor.handle.kind, 3);
  assert.equal(plan.cursor.disposal.hostProtocol, "return");
  assert.equal(plan.cursor.disposal.fallback, "queued-finalizer");
  assert.equal(plan.step.byteSize, 20);
  assert.deepEqual(plan.step.states, { value: 0, done: 1 });
  assert.deepEqual(plan.step.value.type, { kind: "primitive", name: "uint32" });
  assert.equal(analyzeJavaScriptCoverage(ir).supported, true);

  const unsupported = structuredClone(ir);
  unsupported.declarations.find(
    declaration => declaration.id === "bridge:Alpha.range",
  ).result.type = { kind: "primitive", name: "string" };
  assert.throws(
    () => compileIteratorV1(unsupported, "bridge:Alpha.range", options),
    error =>
      error instanceof IteratorGenerationError
      && error.code === "unsupported-iterator-value",
  );
});

test("projection requires one unique private cursor adapter", () => {
  const { ir, privateAbi } = iteratorFixture();
  const projection = compileJavaScriptProjection(ir, privateAbi);
  const binding = projection.bindings.find(binding => binding.name === "range");
  assert.equal(binding.adapter.kind, "iterator-v1");
  assert.equal(binding.adapter.step.symbol, "_bridge_range_next");

  const missing = structuredClone(privateAbi);
  missing.declarations["bridge:Alpha.range"].adapter = null;
  assert.throws(
    () => compileJavaScriptProjection(ir, missing),
    error =>
      error instanceof JavaScriptProjectionError
      && error.code === "missing-iterator-adapter",
  );

  const collision = structuredClone(privateAbi);
  collision.declarations["bridge:Alpha.range"].adapter.handleKind = 1;
  assert.throws(
    () => compileJavaScriptProjection(ir, collision),
    error =>
      error instanceof JavaScriptProjectionError
      && error.code === "duplicate-resource-tag",
  );
});

test("native iterator objects pull lazily and release on completion or early return", () => {
  const { ir, privateAbi } = iteratorFixture();
  const projection = compileJavaScriptProjection(ir, privateAbi);
  const binding = projection.bindings.find(binding => binding.name === "range");
  const buffer = new ArrayBuffer(1024);
  const view = new DataView(buffer);
  const cursors = new Map();
  let generation = 0;
  let releases = 0;
  const module = {
    HEAP8: new Int8Array(buffer)
    , _malloc: () => 64
    , _free: () => {}
    , _bridge_range_start:
      /**
       * Allocates the synchronous range cursor used to test generated iterator startup.
       *
       * @param end - Exclusive upper bound encoded into the iterator range created by the test probe.
       */
      function(end) {
      generation += 1;
      const token = ((3 << 24) | (generation << 12) | 1) >>> 0;
      cursors.set(token, { end, current: 0 });
      return token;
      }
    , _bridge_range_next:
      /**
       * Advances the synchronous range cursor and writes its next value into the bridge result slot.
       *
       * @param token - Generation-safe handle identifying the live native entry.
       * @param pointer - Linear-memory address passed to the generated bridge probe.
       */
      function(token, pointer) {
      const cursor = cursors.get(token);
      view.setUint32(pointer, 1, true);
      view.setUint32(pointer + 4, 20, true);
      if(cursor.current >= cursor.end)
{
        view.setUint32(pointer + 8, 1, true);
} else
{
        view.setUint32(pointer + 8, 0, true);
        view.setUint32(pointer + 16, cursor.current, true);
        cursor.current += 1;
}
      return 0;
      }
    , _bridge_range_release:
      /**
       * Records synchronous range-cursor release so the test can assert exactly-once disposal.
       *
       * @param token - Generation-safe handle identifying the live native entry.
       */
      function(token) {
      if(!cursors.delete(token)) return 0xffff_ffff;
      releases += 1;
      return 0;
      }
  };
  const api = createLibrarySurface(module, {
    id: "poc/iterator@0.0.0"
    , buildHash: "iterator-test"
    , bindingIr: ir
    , bindings: Object.freeze([binding])
  });

  const complete = api.range(4);
  assert.equal(complete[Symbol.iterator](), complete);
  assert.deepEqual(Array.from(complete), [0, 1, 2, 3]);
  assert.deepEqual(complete.next(), { done: true, value: undefined });
  assert.equal(releases, 1);

  const early = api.range(10);
  for(const value of early)
{
    assert.equal(value, 0);
    break;
}
  assert.deepEqual(early.next(), { done: true, value: undefined });
  assert.equal(releases, 2);
});

test("generated packages expose standard Iterable values", async () => {
  const { ir } = iteratorFixture();
  const files = generateJavaScriptPackage(ir);
  assert.match(files["index.mjs"], /runtime\.iterate\("bridge:Alpha\.range"/);
  assert.match(files["index.d.ts"], /range\(end: number\): Iterable<number>/);
  assert.doesNotMatch(files["index.d.ts"], /cursor|handle|pointer/i);

  await withGeneratedPackage(files, async directory => {
    const module = await import(
      `${pathToFileURL(join(directory, "index.mjs")).href}?test=iterator`
    );
    assert.deepEqual(Array.from(module.range(5)), [0, 1, 2, 3, 4]);
  });
});

test("async iterator plans use exactly-once pending pulls and cancellation", () => {
  const { ir, privateAbi } = asyncIteratorFixture();
  const options = privateAbi.declarations["bridge:Alpha.asyncRange"].adapter;
  const plan = compileAsyncIteratorV1(ir, "bridge:Alpha.asyncRange", options);
  assert.equal(plan.kind, "async-iterator-v1");
  assert.equal(plan.delivery, "async-iterator");
  assert.equal(plan.cursor.handle.kind, 4);
  assert.equal(plan.step.pending.kind, "pending-operation-v1");
  assert.equal(plan.step.pending.settlement.cardinality, "exactly-once");
  assert.equal(plan.step.pending.cancellation.supported, true);
  assert.equal(plan.step.resolver, "__leanBridgePendingResolveIteratorU32");
  assert.equal(analyzeJavaScriptCoverage(ir).supported, true);

  const projection = compileJavaScriptProjection(ir, privateAbi);
  const binding = projection.bindings.find(binding => binding.name === "asyncRange");
  assert.equal(binding.adapter.kind, "async-iterator-v1");
  const missing = structuredClone(privateAbi);
  missing.declarations["bridge:Alpha.asyncRange"].adapter = null;
  assert.throws(
    () => compileJavaScriptProjection(ir, missing),
    error =>
      error instanceof JavaScriptProjectionError
      && error.code === "missing-async-iterator-adapter",
  );
});

test("native async iterators serialize pulls and cancel active work on return", async () => {
  const { ir, privateAbi } = asyncIteratorFixture();
  const projection = compileJavaScriptProjection(ir, privateAbi);
  const binding = projection.bindings.find(binding => binding.name === "asyncRange");
  const cursors = new Map();
  const pending = new Map();
  let generation = 0;
  let releases = 0;
  let cancellations = 0;
  let autoResolve = true;
  const module = {
    _bridge_async_range_start:
      /**
       * Allocates the asynchronous range cursor used to test projected iterator startup.
       *
       * @param end - Exclusive upper bound encoded into the iterator range created by the test probe.
       */
      function(end) {
      generation += 1;
      const token = ((4 << 24) | (generation << 12) | 1) >>> 0;
      cursors.set(token, { current: 0, end });
      return token;
      }
    , _bridge_async_range_next:
      /**
       * Advances the asynchronous range cursor and settles the supplied pending-operation token.
       *
       * @param pendingToken - Generation-safe pending-operation handle used to advance or cancel asynchronous work.
       * @param cursorToken - Generation-safe iterator cursor consumed by the async next probe.
       */
      function(pendingToken, cursorToken) {
      const job = { cursorToken, cancelled: false };
      pending.set(pendingToken, job);
      if(autoResolve)
{
        queueMicrotask(() => {
          if(job.cancelled) return;
          pending.delete(pendingToken);
          const cursor = cursors.get(cursorToken);
          if(cursor.current >= cursor.end)
{
            module.__leanBridgePendingResolveIteratorU32(pendingToken, 1, 0);
} else
{
            const value = cursor.current;
            cursor.current += 1;
            module.__leanBridgePendingResolveIteratorU32(pendingToken, 0, value);
}
        });
}
      return 1;
      }
    , _bridge_async_range_cancel:
      /**
       * Cancels the pending range step and records the token used by generated cancellation.
       *
       * @param pendingToken - Generation-safe pending-operation handle used to advance or cancel asynchronous work.
       */
      function(pendingToken) {
      const job = pending.get(pendingToken);
      if(!job) return 0;
      job.cancelled = true;
      pending.delete(pendingToken);
      cancellations += 1;
      return 1;
      }
    , _bridge_async_range_release:
      /**
       * Records asynchronous cursor release so the test can assert cleanup after completion or cancellation.
       *
       * @param token - Generation-safe handle identifying the live native entry.
       */
      function(token) {
      if(!cursors.delete(token)) return 0xffff_ffff;
      releases += 1;
      return 0;
      }
  };
  const api = createLibrarySurface(module, {
    id: "poc/async-iterator@0.0.0"
    , buildHash: "async-iterator-test"
    , bindingIr: ir
    , bindings: Object.freeze([binding])
  });

  const values = [];
  const complete = api.asyncRange(4);
  assert.equal(complete[Symbol.asyncIterator](), complete);
	for await(const value of complete) values.push(value);
  assert.deepEqual(values, [0, 1, 2, 3]);
  assert.equal(releases, 1);

  autoResolve = false;
  const cancelled = api.asyncRange(10);
  const next = cancelled.next();
  await Promise.resolve();
  const returned = cancelled.return();
  await assert.rejects(next, error => error.code === "operation-cancelled");
  assert.deepEqual(await returned, { done: true, value: undefined });
  assert.equal(cancellations, 1);
  assert.equal(releases, 2);
});

test("generated packages expose standard AsyncIterable values", async () => {
  const { ir } = asyncIteratorFixture();
  const files = generateJavaScriptPackage(ir);
  assert.match(files["index.mjs"], /runtime\.iterateAsync\("bridge:Alpha\.asyncRange"/);
  assert.match(
    files["index.d.ts"],
    /asyncRange\(end: number\): AsyncIterable<number>/,
  );
  assert.doesNotMatch(files["index.d.ts"], /cursor|handle|pointer/i);

  const directory = await mkdtemp(join(tmpdir(), "lean-bridge-async-iterator-"));
  try
{
    for(const [relativePath, source] of Object.entries({
      ...files,
      "internal/runtime.mjs": `
export const runtime = Object.freeze({
  async *iterateAsync(declaration, args) {
    if (declaration !== "bridge:Alpha.asyncRange") throw new Error("unknown iterator");
    for (let value = 0; value < args[0]; value += 1) yield value;
  },
  call() {},
  construct() {},
  method() {},
  dispose() {},
});
`
    })) {
      const destination = join(directory, relativePath);
      await mkdir(join(destination, ".."), { recursive: true });
      await writeFile(destination, source);
    }
    const module = await import(
      `${pathToFileURL(join(directory, "index.mjs")).href}?test=async-iterator`
    );
    const values = [];
		for await(const value of module.asyncRange(3)) values.push(value);
    assert.deepEqual(values, [0, 1, 2]);
} finally
{
    await rm(directory, { recursive: true, force: true });
}
});
