import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  runScalingSuite,
  scalingGraphCounts,
  scalingProfiles,
} from "../src/performance/scaling.mjs";

test("the scaling contract fixes real Lean graphs at 1, 3, 10, and 50 libraries", async () => {
  const specification = JSON.parse(await readFile(
    "poc/performance/scale/graph.v1.json",
    "utf8",
  ));
  assert.deepEqual(specification.graphCounts, [1, 3, 10, 50]);
  assert.equal(specification.maximumLibraries, 50);
  assert.equal(specification.dependencyShape, "linear-chain");
  assert.deepEqual(scalingGraphCounts, [1, 3, 10, 50]);
  assert.deepEqual(scalingProfiles, ["lazy", "startup", "final-static", "isolated"]);

  const manifest = JSON.parse(await readFile("build/performance-scale/manifest.json", "utf8"));
  assert.equal(manifest.components.length, 50);
  for (const component of manifest.components) {
    const source = await readFile(
      `build/performance-scale/generated/${component.moduleName}.lean`,
      "utf8",
    );
    assert.match(source, /@\[export lean_bridge_scale_\d{3}_ping\]/);
    assert.equal(component.binding.name, "ping");
    assert.equal(component.binding.input, "uint32");
  }
});

test("the scaling result schema closes the report envelope", async () => {
  const schema = JSON.parse(await readFile(
    "schema/performance-scaling-result.schema.json",
    "utf8",
  ));
  assert.equal(schema.$schema, "https://json-schema.org/draft/2020-12/schema");
  assert.equal(schema.additionalProperties, false);
  assert.equal(schema.$defs.run.additionalProperties, false);
});

test("all graph sizes use native callables across composed and isolated profiles", async () => {
  const result = await runScalingSuite();
  assert.equal(result.runs.length, 16);
  for (const run of result.runs) {
    assert.equal(run.correctness.accepted, true);
    assert.equal(run.correctness.checkedNativeCalls, run.graph.libraryCount);
    assert.equal(run.composition.shutdown.every(Boolean), true);
    assert.equal(run.composition.runtimeInstances, run.profile === "isolated" ? run.graph.libraryCount : 1);
    assert.equal(run.composition.diagnostics.length, run.composition.runtimeInstances);
    assert.equal(
      run.memory.phaseSnapshots.at(-1).wasmMemoryBytes,
      run.memory.phaseSnapshots.at(-2).wasmMemoryBytes,
    );
    assert.ok(run.bytes.totalBytes > 0);
    assert.ok(run.phases.firstNativeCall.samples === run.graph.libraryCount);
  }
  const isolated50 = result.runs.find(run => (
    run.profile === "isolated" && run.graph.libraryCount === 50
  ));
  const shared50 = result.runs.find(run => (
    run.profile === "lazy" && run.graph.libraryCount === 50
  ));
  assert.ok(
    isolated50.memory.phaseSnapshots.at(-2).wasmMemoryBytes >=
      shared50.memory.phaseSnapshots.at(-2).wasmMemoryBytes * 50,
  );
});

test("every dynamic component imports the main runtime memory and table", () => {
  for (let ordinal = 1; ordinal <= 50; ordinal += 1) {
    const suffix = String(ordinal).padStart(3, "0");
    const output = execFileSync(
      "wasm-objdump",
      ["-x", `build/performance-scale/modules/scale-${suffix}.so.wasm`],
      { encoding: "utf8" },
    );
    assert.match(output, /<- env\.memory/);
    assert.match(output, /<- env\.__indirect_function_table/);
  }
});

test("the scaling benchmark client never exposes the private bridge dispatcher", async () => {
  const client = await readFile("scripts/benchmark-library-scaling.mjs", "utf8");
  const harness = await readFile("src/performance/scaling.mjs", "utf8");
  for (const source of [client, harness]) {
    assert.doesNotMatch(source, /\bccall\b|\bcwrap\b|_bridge_|generic\s+(?:invoke|dispatch)|numeric handle/i);
  }
  const bindings = await readFile("build/performance-scale/bindings.mjs", "utf8");
  assert.match(bindings, /createLibraries/);
  const runtime = await readFile("poc/performance/scale/runtime.mjs", "utf8");
  assert.match(runtime, /ping\(value\)/);
});
