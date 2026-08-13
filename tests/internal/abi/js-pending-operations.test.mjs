import assert from "node:assert/strict";
import test from "node:test";

import createLazyModule from "../../../build/lean-link-spike/lazy/main.mjs";
import { alpha } from "../../../poc/lean-link-spike/descriptors.mjs";
import {
	__bridgeTest,
	createLibraryLoader,
} from "../../../poc/link-spike/loader.mjs";
import { compilePendingOperationV1 } from "../../../src/abi/pending-operation.mjs";

const pendingPlan = () => {
	const ir = structuredClone(alpha.bindingIr);
	const declaration = ir.declarations.find(item => item.id === "lean:Alpha.roundTrip");
	declaration.resultMode = "promise";
	declaration.effects.push("async");
	return compilePendingOperationV1(ir, declaration.id);
};

test("one runtime owns one pending-operation domain", async () => {
  const module = await createLazyModule();
  const libraries = createLibraryLoader(module);
  const plan = pendingPlan();
  const pending = __bridgeTest.beginPendingOperation(module, plan);

  assert.equal(libraries.diagnostics().pendingOperations.live, 1);
  assert.equal(
    __bridgeTest.resolvePendingOperation(module, pending.token, { count: 42 }),
    true,
  );
  assert.deepEqual(await pending.promise, { count: 42 });
  assert.equal(libraries.diagnostics().pendingOperations.resolved, 1);
  assert.throws(
    () => __bridgeTest.resolvePendingOperation(module, pending.token, "late"),
    error => error.code === "stale-pending-operation",
  );
});

test("runtime shutdown cancels pending work before closing its epoch", async () => {
  const module = await createLazyModule();
  const libraries = createLibraryLoader(module);
  const pending = __bridgeTest.beginPendingOperation(module, pendingPlan());
  const rejected = assert.rejects(
    pending.promise,
    error => error.code === "operation-cancelled",
  );

  assert.equal(libraries.shutdown(), true);
  await rejected;
  const diagnostics = libraries.diagnostics();
  assert.equal(diagnostics.pendingOperations.state, "closed");
  assert.equal(diagnostics.pendingOperations.live, 0);
  assert.equal(diagnostics.pendingOperations.cancelled, 1);
  assert.equal(diagnostics.state, "closed");
});
