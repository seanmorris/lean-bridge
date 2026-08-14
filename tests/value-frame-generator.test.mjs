/**
 * Tests the value frame generator behavior.
 *
 * @file
 */

import assert from "node:assert/strict";
import test from "node:test";

import { alpha } from "../poc/lean-link-spike/descriptors.mjs";
import {
	ValueFrameGenerationError,
	compileValueFrameV1,
	emitValueFrameV1CHeader,
} from "../src/abi/value-frame.mjs";

const clone = value => structuredClone(value);
const options = Object.freeze({
	abiVersion: 1
	, maxCopyBytes: 1024 * 1024
	, maxArrayLength: 64 * 1024
});

test("value-frame-v1 layout is generated from copied record fields", () => {
  const layout = compileValueFrameV1(alpha.bindingIr, "lean:Alpha.roundTrip", options);
  assert.equal(layout.byteSize, 60);
  assert.deepEqual(layout.header, {
    abiVersion: 0
    , byteSize: 4
    , status: 8
    , detail: 12
  });
  assert.deepEqual(
    layout.fields.map(field => ({
      name: field.name
      , transport: field.transport
      , offset: field.offset
      , pointerOffset: field.pointerOffset
      , lengthOffset: field.lengthOffset
      , capacityOffset: field.capacityOffset
    })),
    [
      { name: "enabled", transport: "scalar", offset: 16, pointerOffset: undefined, lengthOffset: undefined, capacityOffset: undefined }
      , { name: "count", transport: "scalar", offset: 20, pointerOffset: undefined, lengthOffset: undefined, capacityOffset: undefined }
      , { name: "label", transport: "buffer", offset: undefined, pointerOffset: 24, lengthOffset: 28, capacityOffset: 32 }
      , { name: "bytes", transport: "buffer", offset: undefined, pointerOffset: 36, lengthOffset: 40, capacityOffset: 44 }
      , { name: "values", transport: "buffer", offset: undefined, pointerOffset: 48, lengthOffset: 52, capacityOffset: 56 }
    ],
  );
  assert.equal(Object.isFrozen(layout), true);
  assert.equal(Object.isFrozen(layout.fields), true);
});

test("record order drives offsets without a handwritten field table", () => {
  const ir = clone(alpha.bindingIr);
  const payload = ir.types.find(type => type.id === "lean:Alpha.Payload");
  const label = payload.fields.splice(2, 1)[0];
  payload.fields.push(label);
  const layout = compileValueFrameV1(ir, "lean:Alpha.roundTrip", options);
  const fields = new Map(layout.fields.map(field => [field.name, field]));
  assert.equal(fields.get("bytes").pointerOffset, 24);
  assert.equal(fields.get("values").pointerOffset, 36);
  assert.equal(fields.get("label").pointerOffset, 48);
});

test("unsupported fields fail instead of silently changing transport semantics", () => {
  const ir = clone(alpha.bindingIr);
  const payload = ir.types.find(type => type.id === "lean:Alpha.Payload");
  payload.fields.push({
    name: "ratio"
    , type: { kind: "primitive", name: "float64" }
    , mutability: "immutable"
    , documentation: { summary: "An unsupported POC field.", details: "" }
  });
  assert.throws(
    () => compileValueFrameV1(ir, "lean:Alpha.roundTrip", options),
    error =>
      error instanceof ValueFrameGenerationError
      && error.code === "unsupported-frame-field",
  );
});

test("the private ABI requests a frame profile but does not declare its layout", () => {
  const privateAdapter = alpha.privateAbi.declarations["lean:Alpha.roundTrip"].adapter;
  assert.deepEqual(Object.keys(privateAdapter).sort(), [
    "abiVersion"
    , "kind"
    , "maxArrayLength"
    , "maxCopyBytes"
  ]);
  assert.equal("fields" in privateAdapter, false);
  assert.equal("byteSize" in privateAdapter, false);
});

test("the generated C header uses the same frame fields and semantic hash", () => {
  const header = emitValueFrameV1CHeader(
    alpha.bindingIr,
    "lean:Alpha.roundTrip",
    options,
  );
  assert.match(header, new RegExp(alpha.bindingIrSha256));
  assert.match(header, /typedef struct bridge_lean_value_frame_v1/);
  assert.match(header, /uint32_t enabled;/);
  assert.match(header, /uint32_t label_ptr;/);
  assert.match(header, /uint32_t values_capacity;/);
  assert.match(header, /sizeof\(bridge_lean_value_frame_v1\) == 60/);
});
