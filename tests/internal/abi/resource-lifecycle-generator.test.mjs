/**
 * Tests the resource lifecycle generator behavior.
 *
 * @file
 */

import assert from "node:assert/strict";
import test from "node:test";

import { alpha } from "../../../poc/lean-link-spike/descriptors.mjs";
import {
	ResourceLifecycleGenerationError,
	compileResourceLifecycleV1,
} from "../../../src/abi/resource-lifecycle.mjs";
import {
	JavaScriptProjectionError,
	compileJavaScriptProjection,
} from "../../../src/backends/javascript/projection.mjs";

const clone = value => structuredClone(value);

const lifecycleError = (operation, code, ErrorType) => {
	assert.throws(operation, error => {
    assert.equal(error instanceof ErrorType, true);
    assert.equal(error.code, code);
    return true;
	});
};

test("resource lifecycle is generated from ownership and lifetime semantics", () => {
  const ir = clone(alpha.bindingIr);
  const plan = compileResourceLifecycleV1(
    ir,
    "lean:Alpha.Box",
    alpha.privateAbi,
  );

  assert.deepEqual(plan.handle, { side: "lean", kind: 1 });
  assert.deepEqual(plan.identity, {
    projection: "canonical-wrapper"
    , cache: "weak-per-runtime-token"
  });
  assert.deepEqual(plan.disposal, {
    policy: "required"
    , explicit: true
    , runtimeShutdown: true
    , fallback: "queued-finalizer"
    , cycles: "explicit-cut"
    , symbol: "_bridge_lean_release"
  });
  assert.deepEqual(
    {
      ownership: plan.constructor.result.ownership
      , lifetime: plan.constructor.result.lifetime
      , transport: plan.constructor.result.transport
      , transition: plan.constructor.result.transition
      , projection: plan.constructor.result.projection
    },
    {
      ownership: "lease"
      , lifetime: { scope: "explicit", anchor: null }
      , transport: "handle"
      , transition: "acquire-lease"
      , projection: "canonical-owner"
    },
  );

  const read = plan.methods.find(method => method.name === "read");
  assert.deepEqual(
    {
      ownership: read.receiver.ownership
      , lifetime: read.receiver.lifetime
      , transport: read.receiver.transport
      , transition: read.receiver.transition
    },
    {
      ownership: "borrow"
      , lifetime: { scope: "call", anchor: null }
      , transport: "handle"
      , transition: "borrow"
    },
  );

  const identity = plan.methods.find(method => method.name === "identity");
  assert.deepEqual(
    {
      typeId: identity.result.typeId
      , ownership: identity.result.ownership
      , lifetime: identity.result.lifetime
      , projection: identity.result.projection
    },
    {
      typeId: "lean:Alpha.Box"
      , ownership: "borrow"
      , lifetime: { scope: "receiver", anchor: "receiver" }
      , projection: "canonical-borrow"
    },
  );
  assert.equal(Object.isFrozen(plan), true);
  assert.equal(Object.isFrozen(plan.methods[0].receiver), true);
  assert.equal(Object.isFrozen(ir), false);
  assert.equal(Object.isFrozen(ir.declarations[0].result), false);
});

test("resource disposal policy changes the generated cleanup plan", () => {
  const ir = clone(alpha.bindingIr);
  const box = ir.types.find(type => type.id === "lean:Alpha.Box");
  box.resource.disposal = "runtime";
  box.resource.fallback = "none";

  const plan = compileResourceLifecycleV1(ir, box.id, alpha.privateAbi);
  assert.deepEqual(
    {
      policy: plan.disposal.policy
      , explicit: plan.disposal.explicit
      , fallback: plan.disposal.fallback
      , runtimeShutdown: plan.disposal.runtimeShutdown
    },
    {
      policy: "runtime"
      , explicit: false
      , fallback: "none"
      , runtimeShutdown: true
    },
  );
  lifecycleError(
    () => compileJavaScriptProjection(ir, alpha.privateAbi),
    "unsupported-disposal-policy",
    JavaScriptProjectionError,
  );
});

test("JavaScript projection rejects resource ownership it cannot preserve", () => {
  const ir = clone(alpha.bindingIr);
  const identity = ir.declarations.find(
    declaration => declaration.id === "bridge:Alpha.Box.identity",
  );
  identity.result.ownership = "lease";
  identity.result.lifetime = { scope: "runtime", anchor: null };

  lifecycleError(
    () => compileJavaScriptProjection(ir, alpha.privateAbi),
    "unsupported-resource-result",
    JavaScriptProjectionError,
  );
});

test("resource lifecycle fails closed when a private symbol is absent", () => {
  const abi = clone(alpha.privateAbi);
  delete abi.declarations["lean:Alpha.Box.read"];
  lifecycleError(
    () => compileResourceLifecycleV1(alpha.bindingIr, "lean:Alpha.Box", abi),
    "missing-lifecycle-symbol",
    ResourceLifecycleGenerationError,
  );
});

test("resource lifecycle rejects invalid private handle metadata", () => {
  const abi = clone(alpha.privateAbi);
  abi.resources["lean:Alpha.Box"].side = "either";
  lifecycleError(
    () => compileResourceLifecycleV1(alpha.bindingIr, "lean:Alpha.Box", abi),
    "invalid-lifecycle-abi",
    ResourceLifecycleGenerationError,
  );
});
