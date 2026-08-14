/**
 * Tests the component artifact manifest behavior.
 *
 * @file
 */

import assert from "node:assert/strict";
import { cp, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { analyzeLeanProject } from "../src/analyze/lean-project.mjs";
import { prepareComponentBuildPlan } from "../src/build/component-plan.mjs";
import { generateCompilerAdapters } from "../src/build/compiler-adapters.mjs";
import { prepareComponentCompilationPlan, writeComponentCompilationInputs } from "../src/build/component-compilation-plan.mjs";
import { compileLeanComponentSources } from "../src/build/lean-component-compiler.mjs";
import { linkComponentSideModule } from "../src/build/component-side-linker.mjs";
import { auditComponentSideModule } from "../src/build/side-module-audit.mjs";
import { ComponentArtifactManifestError, createComponentArtifactManifest, writeComponentArtifactManifest } from "../src/build/component-artifact-manifest.mjs";

const build = async ({ projectRoot, scratch, name }) => {
	const analysis = await analyzeLeanProject(projectRoot);
	const componentPlan = await prepareComponentBuildPlan({ projectRoot, engineRoot: process.cwd() });
	const compilerAdapters = generateCompilerAdapters({ analysis, componentPlan });
	const compilationPlan = await prepareComponentCompilationPlan({ projectRoot, analysis, componentPlan, compilerAdapters });
	const inputs = join(scratch, `${name}-inputs`);
	const targetC = join(scratch, `${name}-target-c`);
	const side = join(scratch, `${name}-side`);
	await writeComponentCompilationInputs({ projectRoot, outputRoot: inputs, analysis, componentPlan, compilerAdapters });
	const compiled = await compileLeanComponentSources({ inputRoot: inputs, outputRoot: targetC, engineRoot: process.cwd(), compilationPlan });
	const linked = await linkComponentSideModule({ targetCRoot: targetC, outputRoot: side, engineRoot: process.cwd(), compilationPlan });
	const audited = await auditComponentSideModule({ sideRoot: side, compilationPlan });
	return { analysis, componentPlan, compilerAdapters, compilationPlan, compiled, linked, audited, side };
};

test("the component artifact manifest closes the semantic, compiler, runtime, and Wasm identity chain", async () => {
  const scratch = await mkdtemp(join(tmpdir(), "lean-bridge-component-artifact-"));
  try
{
    const built = await build({ projectRoot: "tests/fixtures/onboarding/small", scratch, name: "small" });
    const written = await writeComponentArtifactManifest({ sideRoot: built.side, ...built });
    const disk = JSON.parse(await readFile(join(built.side, written.path), "utf8"));
    assert.equal(disk.bindingIr.semanticSha256, built.analysis.bindingIr.semanticSha256);
    assert.equal(disk.runtime.shared, true);
    assert.equal(disk.wasm.artifact.sha256, built.linked.manifest.artifact.sha256);
    assert.deepEqual(disk.structure.definitions, { memory: 0, table: 0 });
    assert.equal(disk.policies.targetSpecificRebuild, false);
} finally
{
    await rm(scratch, { recursive: true, force: true });
}
});

test("component artifact identity is stable after checkout relocation", async () => {
  const scratch = await mkdtemp(join(tmpdir(), "lean-bridge-component-artifact-root-"));
  try
{
    const relocated = join(scratch, "relocated-source");
    await cp("tests/fixtures/onboarding/small", relocated, { recursive: true });
    const first = await build({ projectRoot: "tests/fixtures/onboarding/small", scratch, name: "first" });
    const second = await build({ projectRoot: relocated, scratch, name: "second" });
    assert.deepEqual(createComponentArtifactManifest(first), createComponentArtifactManifest(second));
} finally
{
    await rm(scratch, { recursive: true, force: true });
}
});

test("the component manifest refuses a broken audit and link identity chain", async () => {
  const scratch = await mkdtemp(join(tmpdir(), "lean-bridge-component-artifact-drift-"));
  try
{
    const built = await build({ projectRoot: "tests/fixtures/onboarding/small", scratch, name: "small" });
    const audited = structuredClone(built.audited);
    audited.artifact.sha256 = "0".repeat(64);
    assert.throws(
      () => createComponentArtifactManifest({ ...built, audited }),
      error => error instanceof ComponentArtifactManifestError && error.code === "component-artifact-evidence-drift",
    );
} finally
{
    await rm(scratch, { recursive: true, force: true });
}
});

test("the component artifact schema closes the top level and policy fields", async () => {
  const schema = JSON.parse(await readFile("schema/component-artifact-manifest.schema.json", "utf8"));
  assert.equal(schema.additionalProperties, false);
  assert.equal(schema.properties.policies.additionalProperties, false);
  for(const definition of ["component", "source", "bindingIr", "compilerAdapters", "tool", "compilation", "runtime", "artifact", "wasm", "structure"])
{
    assert.equal(schema.$defs[definition].additionalProperties, false);
}
});
