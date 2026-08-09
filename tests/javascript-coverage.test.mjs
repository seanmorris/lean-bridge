import assert from "node:assert/strict";
import test from "node:test";

import { alpha } from "../poc/lean-link-spike/descriptors.mjs";
import { analyzeJavaScriptCoverage } from "../src/backends/javascript/coverage.mjs";
import { generateJavaScriptPackage } from "../src/backends/javascript/generate.mjs";
import { JavaScriptProjectionError } from "../src/backends/javascript/projection.mjs";

const clone = value => structuredClone(value);

const roundTrip = ir =>
  ir.declarations.find(declaration => declaration.id === "lean:Alpha.roundTrip");

const expectGap = (ir, code) => {
  const coverage = analyzeJavaScriptCoverage(ir);
  assert.equal(coverage.supported, false);
  assert.equal(coverage.gaps.some(item => item.code === code), true);
  assert.throws(
    () => generateJavaScriptPackage(ir),
    error => error instanceof JavaScriptProjectionError && error.code === coverage.gaps[0].code,
  );
};

test("the reviewed Alpha surface has complete JavaScript lowering coverage", () => {
  const coverage = analyzeJavaScriptCoverage(alpha.bindingIr);
  assert.equal(coverage.supported, true);
  assert.deepEqual(coverage.gaps, []);
});

test("iterator delivery accepts scalar plans and rejects values without pull frames", () => {
  const iterator = clone(alpha.bindingIr);
  roundTrip(iterator).resultMode = "iterator";
  expectGap(iterator, "unsupported-iterator-value");

  const asyncIterator = clone(alpha.bindingIr);
  roundTrip(asyncIterator).resultMode = "async-iterator";
  roundTrip(asyncIterator).effects.push("async");
  expectGap(asyncIterator, "unsupported-iterator-value");
});

test("properties and static methods fail until they have native projections", () => {
  const property = clone(alpha.bindingIr);
  const read = property.declarations.find(
    declaration => declaration.id === "lean:Alpha.Box.read",
  );
  read.kind = "property";
  expectGap(property, "unsupported-declaration-kind");

  const staticMethod = clone(alpha.bindingIr);
  roundTrip(staticMethod).kind = "static-method";
  expectGap(staticMethod, "unsupported-declaration-kind");
});

test("generic and constructed values fail without runtime specialization", () => {
  const generic = clone(alpha.bindingIr);
  const declaration = roundTrip(generic);
  declaration.typeParameters.push({
    id: "T",
    representation: "copied",
    constraints: [],
  });
  declaration.parameters[0].type = { kind: "parameter", id: "T" };
  declaration.result.type = { kind: "parameter", id: "T" };
  expectGap(generic, "unsupported-generic");

  const option = clone(alpha.bindingIr);
  roundTrip(option).parameters[0].type = {
    kind: "apply",
    constructor: "option",
    arguments: [{ kind: "primitive", name: "uint32" }],
  };
  expectGap(option, "unsupported-type-constructor");
});

test("optional arguments and overload groups fail instead of changing call behavior", () => {
  const optional = clone(alpha.bindingIr);
  const parameter = roundTrip(optional).parameters[0];
  parameter.optional = true;
  parameter.default = null;
  expectGap(optional, "unsupported-optional-parameter");

  const overloaded = clone(alpha.bindingIr);
  const declaration = structuredClone(roundTrip(overloaded));
  declaration.id = "bridge:Alpha.roundTripCount";
  declaration.overloadKey = "roundTrip(uint32)";
  declaration.parameters = [
    {
      name: "count",
      type: { kind: "primitive", name: "uint32" },
      ownership: "copy",
      lifetime: null,
      mutability: "immutable",
      optional: false,
      default: null,
    },
  ];
  declaration.result = {
    type: { kind: "primitive", name: "uint32" },
    ownership: "copy",
    lifetime: null,
  };
  declaration.source = {
    producer: "bridge",
    declaration: "Alpha.roundTripCount",
    extensions: { "lean-wasm.org/intrinsic": "coverage-probe" },
  };
  overloaded.declarations.push(declaration);
  expectGap(overloaded, "unsupported-overload-group");
});

test("callback domain errors and nonscalar payloads fail outside envelope coverage", () => {
  const domain = clone(alpha.bindingIr);
  const declaredError = domain.errors.find(error => error.id === "error:callback-threw");
  declaredError.category = "domain";
  expectGap(domain, "unsupported-error-envelope");

  const payload = clone(alpha.bindingIr);
  payload.errors.find(error => error.id === "error:callback-threw").payload = {
    kind: "primitive",
    name: "string",
  };
  expectGap(payload, "unsupported-error-envelope");
});
