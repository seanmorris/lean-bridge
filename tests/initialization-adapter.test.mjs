import assert from "node:assert/strict";
import test from "node:test";

import { alpha } from "../poc/lean-link-spike/descriptors.mjs";
import {
  __bridgeTest,
  createLibrarySurface,
} from "../poc/link-spike/loader.mjs";
import { compileInitializationV1 } from "../src/abi/initialization.mjs";
import { compileJavaScriptProjection } from "../src/backends/javascript/projection.mjs";

const descriptor = (plan, bindings) => ({
  id: "poc/initialization@0.0.0",
  buildHash: "initialization-test",
  bindingIrSha256: plan.bindingIrSha256,
  bindings,
});

const functionBinding = (name, symbol, plan) => ({
  kind: "function",
  name,
  declarationId: `test:${name}`,
  symbol,
  initialization: plan,
});

test("initialization plans bind first-call policy to canonical Binding IR", () => {
  const required = compileInitializationV1(alpha.bindingIr, alpha.privateAbi);
  assert.deepEqual(
    {
      required: required.required,
      symbol: required.symbol,
      trigger: required.trigger,
      scope: required.scope,
      failure: required.failure,
      retry: required.retry,
    },
    {
      required: true,
      symbol: "_bridge_lean_runtime_init",
      trigger: "first-call",
      scope: "component-runtime",
      failure: "terminal",
      retry: "never",
    },
  );
  assert.equal(Object.isFrozen(required), true);

  const optionalAbi = structuredClone(alpha.privateAbi);
  optionalAbi.initialize = null;
  const optional = compileInitializationV1(alpha.bindingIr, optionalAbi);
  assert.equal(optional.required, false);
  assert.equal(optional.symbol, null);
});

test("every generated binding receives the same initialization plan", () => {
  const projection = compileJavaScriptProjection(alpha.bindingIr, alpha.privateAbi);
  assert.equal(projection.initialization.kind, "initialization-v1");
  for (const binding of projection.bindings) {
    assert.equal(binding.initialization, projection.initialization);
    assert.equal("initialize" in binding, false);
  }
});

test("one component runtime initializes once across native callables", () => {
  let runs = 0;
  const plan = compileInitializationV1(alpha.bindingIr, alpha.privateAbi);
  const module = {
    _initialize: () => {
      runs += 1;
      return 1;
    },
    _first: () => 1,
    _second: () => 2,
  };
  const localPlan = Object.freeze({ ...plan, symbol: "_initialize" });
  const api = createLibrarySurface(
    module,
    descriptor(localPlan, [
      functionBinding("first", "_first", localPlan),
      functionBinding("second", "_second", localPlan),
    ]),
  );
  assert.equal(runs, 0);
  assert.equal(api.first(), 1);
  assert.equal(api.second(), 2);
  assert.equal(api.first(), 1);
  assert.equal(runs, 1);
  assert.deepEqual(Object.values(__bridgeTest.diagnostics(module).initializations), ["ready"]);
});

test("failed or drifted initialization plans never retry", () => {
  let runs = 0;
  const plan = compileInitializationV1(alpha.bindingIr, alpha.privateAbi);
  const localPlan = Object.freeze({ ...plan, symbol: "_initialize" });
  const module = {
    _initialize: () => {
      runs += 1;
      return 0;
    },
    _run: () => 1,
  };
  const api = createLibrarySurface(
    module,
    descriptor(localPlan, [functionBinding("run", "_run", localPlan)]),
  );
  assert.throws(() => api.run(), error => error.code === "runtime-not-ready");
  assert.throws(() => api.run(), error => error.code === "runtime-not-ready");
  assert.equal(runs, 1);

  let driftRuns = 0;
  const drifted = Object.freeze({ ...localPlan, bindingIrSha256: "0".repeat(64) });
  const driftModule = {
    _initialize: () => {
      driftRuns += 1;
      return 1;
    },
    _run: () => 1,
  };
  const driftedApi = createLibrarySurface(
    driftModule,
    descriptor(localPlan, [functionBinding("run", "_run", drifted)]),
  );
  assert.throws(
    () => driftedApi.run(),
    error => error.code === "unsupported-initialization-plan",
  );
  assert.equal(driftRuns, 0);
});
