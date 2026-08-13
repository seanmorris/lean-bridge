import assert from "node:assert/strict";
import test from "node:test";

import { alpha } from "../poc/lean-link-spike/descriptors.mjs";
import {
	PhpProjectionError,
	assertPhpTransportSupported,
	compilePhpProjection,
	compilePhpTransportManifest,
} from "../src/backends/php/projection.mjs";

const clone = value => structuredClone(value);

const deliveryFixture = () => {
	const ir = clone(alpha.bindingIr);
	const source = ir.declarations.find(declaration => declaration.id === "lean:Alpha.roundTrip");
	const promise = clone(source);
	promise.id = "bridge:Alpha.roundTripAsync";
	promise.name = "roundTripAsync";
	promise.overloadKey = "roundTripAsync(Payload)";
	promise.resultMode = "promise";
	promise.effects.push("async");
	promise.assurance = [];
	promise.source.producer = "bridge";
	promise.source.declaration = "Alpha.roundTripAsync";

	const iterator = clone(source);
	iterator.id = "bridge:Alpha.payloads";
	iterator.name = "payloads";
	iterator.overloadKey = "payloads(Payload)";
	iterator.resultMode = "iterator";
	iterator.assurance = [];
	iterator.source.producer = "bridge";
	iterator.source.declaration = "Alpha.payloads";

	ir.declarations.push(promise, iterator);
	return ir;
};

test("PHP projection defines one immutable surface for both transports", () => {
  const projection = compilePhpProjection(alpha.bindingIr);
  assert.deepEqual(projection, compilePhpProjection(clone(alpha.bindingIr)));
  assert.equal(Object.isFrozen(projection.operations), true);
  assert.equal(projection.package.namespace, "LeanAlpha");
  assert.equal(projection.transport.interface, "LeanAlpha\\Internal\\Transport");
  assert.equal(projection.transport.dispatch, "one-typed-method-per-declaration");
  assert.equal(projection.identity.phpCache, "identity to WeakReference<object>");

  assert.deepEqual(projection.operations.map(operation => operation.transportMethod), [
    "leanAlphaBox"
    , "leanAlphaBoxRead"
    , "bridgeAlphaBoxIdentity"
    , "leanAlphaRoundTrip"
    , "leanAlphaWithCallback"
    , "leanAlphaMakeAdder"
  ]);
  assert.deepEqual(projection.lifecycle.map(operation => operation.transportMethod), [
    "boxClose"
    , "transformCall"
    , "transformClose"
  ]);
  assert.equal(
    projection.lifecycle.find(operation => operation.kind === "resource-close").failure.unexpected,
    "poison-runtime",
  );
  assert.equal(new Set([
    ...projection.operations.map(operation => operation.transportMethod)
    , ...projection.lifecycle.map(operation => operation.transportMethod)
  ]).size, projection.operations.length + projection.lifecycle.length);
});

test("PHP projection preserves copied primitives as typed values", () => {
  const projection = compilePhpProjection(alpha.bindingIr);
  const payload = projection.types.find(type => type.id === "lean:Alpha.Payload");
  assert.equal(payload.projection, "value-object");
  assert.equal(payload.readonly, true);
  assert.deepEqual(payload.fields.map(field => [field.name, field.type.phpType]), [
    ["enabled", "bool"]
    , ["count", "int"]
    , ["label", "string"]
    , ["bytes", "\\LeanAlpha\\Bytes"]
    , ["values", "array"]
  ]);
  assert.deepEqual(payload.fields.find(field => field.name === "count").type.validation, {
    kind: "integer-range"
    , minimum: 0
    , maximum: 0xffffffff
  });
  assert.equal(
    payload.fields.find(field => field.name === "values").type.phpDocType,
    "list<int<0, 4294967295>>",
  );
  assert.equal(JSON.stringify(payload).includes("json"), false);
  assert.equal(projection.requiredCapabilities.includes("bytes-value-v1"), true);
  assert.equal(projection.requiredCapabilities.includes("utf8-string-v1"), true);
  assert.equal(projection.requiredCapabilities.includes("typed-list-v1"), true);
});

test("PHP resources, callbacks, errors, and delivery use native PHP concepts", () => {
  const projection = compilePhpProjection(deliveryFixture());
  const box = projection.types.find(type => type.id === "lean:Alpha.Box");
  const transform = projection.types.find(type => type.id === "lean:Alpha.Transform");
  const withCallback = projection.operations.find(operation => operation.id === "lean:Alpha.withCallback");
  const makeAdder = projection.operations.find(operation => operation.id === "lean:Alpha.makeAdder");
  const asynchronous = projection.operations.find(operation => operation.id === "bridge:Alpha.roundTripAsync");
  const iterator = projection.operations.find(operation => operation.id === "bridge:Alpha.payloads");

  assert.equal(box.projection, "resource-object");
  assert.equal(box.identity, "canonical-per-runtime");
  assert.equal(box.closeMethod, "close");
  assert.equal(transform.projection, "invokable-object");
  assert.equal(withCallback.parameters[1].publicType, "callable");
  assert.equal(withCallback.parameters[1].transportType, "callable");
  assert.equal(makeAdder.result.publicType, "\\LeanAlpha\\Transform");
  assert.equal(makeAdder.result.transportType, "\\LeanAlpha\\Internal\\Identity");
  assert.equal(asynchronous.delivery.phpType, "\\LeanAlpha\\Awaitable");
  assert.equal(iterator.delivery.phpType, "\\Traversable");
  assert.deepEqual(projection.errors.map(error => error.fqcn), [
    "LeanAlpha\\DisposedResource"
    , "LeanAlpha\\CallbackThrew"
  ]);
});

test("transport capability gaps are explicit and block package generation", () => {
  const projection = compilePhpProjection(alpha.bindingIr);
  const incomplete = compilePhpTransportManifest(projection, {
    id: "php-wasm-v1"
    , capabilities: ["php-8.2-v1", "shared-runtime-v1"]
  });
  assert.equal(incomplete.supported, false);
  assert.equal(incomplete.capabilityGaps.every(gap => gap.blocking), true);
  assert.equal(incomplete.capabilityGaps.some(gap => gap.capability === "callable-adapter-v1"), true);
  assert.throws(
    () => assertPhpTransportSupported(incomplete),
    error => error instanceof PhpProjectionError && error.code === "unsupported-transport",
  );

  const complete = compilePhpTransportManifest(projection, {
    id: "native-zend-v1"
    , capabilities: projection.requiredCapabilities
  });
  assert.equal(complete.supported, true);
  assert.deepEqual(complete.capabilityGaps, []);
  assert.equal(assertPhpTransportSupported(complete), complete);
});

test("PHP projection rejects invalid namespace and typed operation collisions", () => {
  assert.throws(
    () => compilePhpProjection(alpha.bindingIr, { namespace: "bad-name" }),
    error => error instanceof PhpProjectionError && error.code === "invalid-namespace",
  );

  const ir = clone(alpha.bindingIr);
  const collision = clone(ir.declarations.find(declaration => declaration.id === "lean:Alpha.Box.read"));
  collision.id = "lean:Alpha-Box-read";
  collision.name = "readAgain";
  collision.overloadKey = "Box.readAgain()";
  collision.source.declaration = "Alpha.Box.readAgain";
  ir.declarations.push(collision);
  assert.throws(
    () => compilePhpProjection(ir),
    error => error instanceof PhpProjectionError && error.code === "duplicate-transport-method",
  );
});
