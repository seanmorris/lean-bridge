/**
 * Tests the component engine behavior.
 *
 * @file
 */

import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { analyzeLeanProject } from "../src/analyze/lean-project.mjs";
import { executeComponentEngineRequest } from "../src/build/component-engine.mjs";
import { prepareComponentBuildPlan } from "../src/build/component-plan.mjs";
import { generateCompilerAdapters } from "../src/build/compiler-adapters.mjs";
import { prepareComponentCompilationPlan, writeComponentCompilationInputs } from "../src/build/component-compilation-plan.mjs";
import { writeEngineExecutionRequest } from "../src/build/engine-execution-request.mjs";

test("the component engine consumes one request and emits only its authorized bundle and report", async () => {
  const scratch = await mkdtemp(join(tmpdir(), "lean-bridge-component-engine-"));
  try
{
    const projectRoot = "tests/fixtures/onboarding/small";
    const analysis = await analyzeLeanProject(projectRoot);
    const componentPlan = await prepareComponentBuildPlan({ projectRoot, engineRoot: process.cwd(), targets: ["npm"] });
    const compilerAdapters = generateCompilerAdapters({ analysis, componentPlan });
    const compilationPlan = await prepareComponentCompilationPlan({ projectRoot, analysis, componentPlan, compilerAdapters });
    const inputRoot = join(scratch, "component");
    await writeComponentCompilationInputs({ projectRoot, outputRoot: inputRoot, analysis, componentPlan, compilerAdapters });
    const requestPath = join(scratch, "request.json");
    const request = await writeEngineExecutionRequest({ output: requestPath, engineRoot: process.cwd(), inputRoot, componentPlan, compilationPlan, targets: ["npm"] });
    const outputRoot = join(scratch, "output");
    const result = await executeComponentEngineRequest({ requestPath, inputRoot, outputRoot, engineRoot: process.cwd(), backend: "test-direct" });
    assert.deepEqual(await readdir(outputRoot), ["bundle", "engine-execution-report.json"]);
    assert.equal(result.report.requestSha256, request.sha256);
    assert.equal(result.report.component, "onboarding-small@1.0.0");
    assert.equal(result.report.runtimeBinaryIncluded, false);
    assert.deepEqual((await readdir(join(outputRoot, "bundle"))).sort(), ["README.md", "artifacts", "binding", "component-release-bundle.json", "generated", "locks", "metadata", "source"]);
    const manifest = JSON.parse(await readFile(join(outputRoot, "bundle/component-release-bundle.json"), "utf8"));
    assert.equal(manifest.component.id, "onboarding-small@1.0.0");
    assert.equal(manifest.files.filter(file => file.mediaType === "application/wasm").length, 1);
} finally
{
    await rm(scratch, { recursive: true, force: true });
}
});
