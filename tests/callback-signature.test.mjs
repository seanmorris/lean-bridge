import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  CallbackSignatureGenerationError,
  compileCallbackSignatureV1,
} from "../src/abi/callback-signature.mjs";

const alpha = JSON.parse(
  await readFile("poc/lean-link-spike/bindings/alpha.binding-ir.json", "utf8"),
);
const clone = value => structuredClone(value);

const withCallback = () => {
  const ir = clone(alpha);
  ir.types.push({
    id: "bridge:Alpha.ProgressCallback",
    name: "ProgressCallback",
    kind: "callback",
    representation: "identity",
    mutability: "immutable",
    typeParameters: [],
    fields: [],
    target: null,
    resource: null,
    callable: {
      invocation: "many",
      reentry: "same-agent",
      selfDisposal: "reject",
      parameters: [
        {
          name: "value",
          type: { kind: "primitive", name: "uint32" },
          ownership: "copy",
          lifetime: null,
          mutability: "immutable",
          optional: false,
          default: null,
        },
      ],
      result: {
        type: { kind: "primitive", name: "unit" },
        ownership: "copy",
        lifetime: null,
      },
      effects: ["host-call"],
      failure: { mode: "none", errors: [], unexpected: "poison-runtime" },
      resultMode: "value",
    },
    documentation: {
      summary: "Receive progress from Lean.",
      details: "The callback may re-enter the same shared runtime.",
    },
    source: {
      producer: "bridge",
      declaration: "Alpha.ProgressCallback",
      extensions: { "lean-wasm.org/intrinsic": "host-callback" },
    },
    assurance: [],
  });
  return ir;
};

test("callback plans have stable signature IDs and fixed adapter rules", () => {
  const ir = withCallback();
  const plan = compileCallbackSignatureV1(ir, "bridge:Alpha.ProgressCallback");

  assert.match(plan.signatureId, /^callback-v1:[0-9a-f]{64}$/);
  assert.equal(plan.hostFunction.transport, "generation-safe-handle");
  assert.equal(plan.wasmTable.adapter, "fixed-signature");
  assert.equal(plan.wasmTable.reuse, "by-signature-id");
  assert.deepEqual(plan.reentry, {
    policy: "same-agent",
    agent: "same-agent",
    frames: "nested-lifo",
    maxDepth: 64,
    overflow: "reject-before-call",
    exception: "unwind-to-entry-frame",
  });
  assert.equal(plan.parameters[0].transport, "copy-frame");
  assert.equal(Object.isFrozen(plan), true);
  assert.equal(Object.isFrozen(plan.reentry), true);
});

test("signature identity follows callable ABI semantics, not documentation", () => {
  const firstIr = withCallback();
  const first = compileCallbackSignatureV1(
    firstIr,
    "bridge:Alpha.ProgressCallback",
  );

  const documentation = withCallback();
  documentation.types.at(-1).documentation.summary = "Changed public documentation.";
  const documented = compileCallbackSignatureV1(
    documentation,
    "bridge:Alpha.ProgressCallback",
  );
  assert.equal(documented.signatureId, first.signatureId);
  assert.notEqual(documented.bindingIrSha256, first.bindingIrSha256);

  const changed = withCallback();
  changed.types.at(-1).callable.parameters[0].type = {
    kind: "primitive",
    name: "uint64",
  };
  const widened = compileCallbackSignatureV1(
    changed,
    "bridge:Alpha.ProgressCallback",
  );
  assert.notEqual(widened.signatureId, first.signatureId);
});

test("callback generation rejects non-callbacks and invalid depth budgets", () => {
  assert.throws(
    () => compileCallbackSignatureV1(alpha, "lean:Alpha.Payload"),
    error =>
      error instanceof CallbackSignatureGenerationError &&
      error.code === "not-a-callback",
  );
  assert.throws(
    () =>
      compileCallbackSignatureV1(withCallback(), "bridge:Alpha.ProgressCallback", {
        maxDepth: 0,
      }),
    error =>
      error instanceof CallbackSignatureGenerationError &&
      error.code === "invalid-depth-budget",
  );
});
