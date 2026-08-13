import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { analyzeLeanProject } from "../src/analyze/lean-project.mjs";
import { prepareComponentBuildPlan } from "../src/build/component-plan.mjs";
import { generateCompilerAdapters } from "../src/build/compiler-adapters.mjs";
import { prepareComponentCompilationPlan, writeComponentCompilationInputs } from "../src/build/component-compilation-plan.mjs";
import { compileLeanComponentSources } from "../src/build/lean-component-compiler.mjs";
import { linkComponentSideModule } from "../src/build/component-side-linker.mjs";
import { SideModuleAuditError, auditComponentSideModule, auditWasmStructure } from "../src/build/side-module-audit.mjs";

const build = async scratch => {
	const projectRoot = "tests/fixtures/onboarding/small";
	const analysis = await analyzeLeanProject(projectRoot);
	const componentPlan = await prepareComponentBuildPlan({ projectRoot, engineRoot: process.cwd() });
	const compilerAdapters = generateCompilerAdapters({ analysis, componentPlan });
	const compilationPlan = await prepareComponentCompilationPlan({ projectRoot, analysis, componentPlan, compilerAdapters });
	const inputs = join(scratch, "inputs");
	const targetC = join(scratch, "target-c");
	const side = join(scratch, "side");
	await writeComponentCompilationInputs({ projectRoot, outputRoot: inputs, analysis, componentPlan, compilerAdapters });
	await compileLeanComponentSources({ inputRoot: inputs, outputRoot: targetC, engineRoot: process.cwd(), compilationPlan });
	const linked = await linkComponentSideModule({ targetCRoot: targetC, outputRoot: side, engineRoot: process.cwd(), compilationPlan });
	return { compilationPlan, linked, side };
};

test("the side-module audit records every shared-runtime and direct-symbol invariant", async () => {
  const scratch = await mkdtemp(join(tmpdir(), "lean-bridge-side-audit-"));
  try
{
    const built = await build(scratch);
    const reportPath = join(scratch, "audit.json");
    const report = await auditComponentSideModule({ sideRoot: built.side, compilationPlan: built.compilationPlan, reportPath });
    assert.equal(report.passed, true);
    assert.ok(Object.values(report.checks).every(Boolean));
    assert.deepEqual(report.structure.definitions, { memory: 0, table: 0 });
    assert.equal(JSON.parse(await readFile(reportPath, "utf8")).artifact.sha256, built.linked.manifest.artifact.sha256);
} finally
{
    await rm(scratch, { recursive: true, force: true });
}
});

test("the structural audit fails when a planned direct export is absent", async () => {
  const scratch = await mkdtemp(join(tmpdir(), "lean-bridge-side-symbol-audit-"));
  try
{
    const built = await build(scratch);
    const bytes = await readFile(join(built.side, built.linked.manifest.artifact.path));
    await assert.rejects(
      auditWasmStructure({ bytes, directSymbols: [...built.linked.manifest.exports.directSymbols, "lean_bridge_000000000000000000000000"], initializer: built.linked.manifest.exports.initializer, internalInitializer: built.linked.manifest.exports.internalInitializer }),
      error => error instanceof SideModuleAuditError && error.code === "side-module-export-drift",
    );
} finally
{
    await rm(scratch, { recursive: true, force: true });
}
});

test("the audit blocks artifact mutation before structural inspection", async () => {
  const scratch = await mkdtemp(join(tmpdir(), "lean-bridge-side-mutation-"));
  try
{
    const built = await build(scratch);
    const artifact = join(built.side, built.linked.manifest.artifact.path);
    const bytes = await readFile(artifact);
    bytes[bytes.length - 1] ^= 1;
    await writeFile(artifact, bytes);
    await assert.rejects(
      auditComponentSideModule({ sideRoot: built.side, compilationPlan: built.compilationPlan }),
      error => error instanceof SideModuleAuditError && error.code === "side-module-artifact-drift",
    );
} finally
{
    await rm(scratch, { recursive: true, force: true });
}
});

test("the audit report schema closes all boolean gates", async () => {
  const schema = JSON.parse(await readFile("schema/side-module-audit.schema.json", "utf8"));
  assert.equal(schema.additionalProperties, false);
  assert.equal(schema.properties.checks.additionalProperties, false);
  assert.equal(schema.properties.structure.additionalProperties, false);
});
