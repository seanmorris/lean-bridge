import assert from "node:assert/strict";
import test from "node:test";

import { alpha } from "../poc/lean-link-spike/descriptors.mjs";
import {
  JavaScriptProjectionError,
  compileJavaScriptProjection,
} from "../src/backends/javascript/projection.mjs";

const clone = value => structuredClone(value);

const projectionError = (operation, code) => {
  assert.throws(operation, error => {
    assert.equal(error instanceof JavaScriptProjectionError, true);
    assert.equal(error.code, code);
    return true;
  });
};

test("the Alpha JavaScript projection is generated from the reviewed Binding IR", () => {
  const projection = compileJavaScriptProjection(alpha.bindingIr, alpha.privateAbi);
  assert.equal(projection.bindingIrSha256, alpha.bindingIrSha256);
  assert.deepEqual(projection.bindings, alpha.bindings);
  assert.deepEqual(
    projection.bindings.map(binding => binding.name),
    ["Box", "roundTrip"],
  );
  assert.deepEqual(
    projection.bindings[0].methods.map(method => method.name),
    ["read", "identity"],
  );
});

test("public names come from Binding IR rather than the private ABI map", () => {
  const ir = clone(alpha.bindingIr);
  ir.declarations.find(item => item.id === "lean:Alpha.Box.read").name = "value";
  const projection = compileJavaScriptProjection(ir, alpha.privateAbi);
  assert.deepEqual(
    projection.bindings[0].methods.map(method => method.name),
    ["value", "identity"],
  );

  const privateText = JSON.stringify(alpha.privateAbi);
  assert.equal(privateText.includes('"name"'), false);
  assert.equal(privateText.includes('"ownership"'), false);
  assert.equal(privateText.includes('"methods"'), false);
});

test("every projected declaration requires an explicit private implementation", () => {
  const abi = clone(alpha.privateAbi);
  delete abi.declarations["lean:Alpha.roundTrip"];
  projectionError(
    () => compileJavaScriptProjection(alpha.bindingIr, abi),
    "missing-abi-declaration",
  );
});

test("private ABI metadata is closed and cannot inject public binding policy", () => {
  const abi = clone(alpha.privateAbi);
  abi.declarations["lean:Alpha.roundTrip"].publicName = "unsafeOverride";
  projectionError(
    () => compileJavaScriptProjection(alpha.bindingIr, abi),
    "invalid-private-abi",
  );
});

test("unknown private symbols cannot hide outside the semantic declaration graph", () => {
  const abi = clone(alpha.privateAbi);
  abi.declarations["bridge:Undeclared.call"] = {
    symbol: "_bridge_hidden",
    adapter: null,
  };
  projectionError(
    () => compileJavaScriptProjection(alpha.bindingIr, abi),
    "unknown-abi-declaration",
  );
});

test("the POC projector rejects semantic modes it cannot preserve", () => {
  const ir = clone(alpha.bindingIr);
  const declaration = ir.declarations.find(item => item.id === "lean:Alpha.roundTrip");
  declaration.resultMode = "promise";
  declaration.effects.push("async");
  const abi = clone(alpha.privateAbi);
  abi.declarations["lean:Alpha.roundTrip"].adapter = null;
  projectionError(
    () => compileJavaScriptProjection(ir, abi),
    "missing-pending-adapter",
  );
});

test("Promise declarations receive a generated pending-operation plan", () => {
  const ir = clone(alpha.bindingIr);
  const declaration = ir.declarations.find(item => item.id === "lean:Alpha.roundTrip");
  declaration.resultMode = "promise";
  declaration.effects.push("async");
  const abi = clone(alpha.privateAbi);
  abi.declarations["lean:Alpha.roundTrip"].adapter = {
    kind: "pending-operation-v1",
    abiVersion: 1,
  };

  const projection = compileJavaScriptProjection(ir, abi);
  const binding = projection.bindings.find(item => item.name === "roundTrip");
  assert.equal(binding.adapter.kind, "pending-operation-v1");
  assert.equal(binding.adapter.declarationId, declaration.id);
  assert.equal(binding.adapter.settlement.cardinality, "exactly-once");
});

test("class ABI adapters cannot be accepted and then ignored", () => {
  const abi = clone(alpha.privateAbi);
  abi.declarations["lean:Alpha.box"].adapter = {
    kind: "value-frame-v1",
    abiVersion: 1,
    maxCopyBytes: 4,
    maxArrayLength: 1,
  };
  projectionError(
    () => compileJavaScriptProjection(alpha.bindingIr, abi),
    "unsupported-lifecycle-adapter",
  );
});

test("each private resource tag is unique inside one component", () => {
  const ir = clone(alpha.bindingIr);
  const box = ir.types.find(item => item.id === "lean:Alpha.Box");
  ir.types.push({ ...box, id: "lean:Alpha.OtherBox", name: "OtherBox" });
  const abi = clone(alpha.privateAbi);
  abi.resources["lean:Alpha.OtherBox"] = { ...abi.resources["lean:Alpha.Box"] };
  projectionError(
    () => compileJavaScriptProjection(ir, abi),
    "duplicate-resource-tag",
  );
});
