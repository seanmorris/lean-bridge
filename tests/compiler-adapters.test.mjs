/**
 * Tests the compiler adapters behavior.
 *
 * @file
 */

import assert from "node:assert/strict";
import { cp, mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";

import { analyzeLeanProject } from "../src/analyze/lean-project.mjs";
import { createComponentBuildPlan, prepareComponentBuildPlan } from "../src/build/component-plan.mjs";
import { CompilerAdapterError, generateCompilerAdapters, validateCompilerAdapterPlan, writeCompilerAdapters } from "../src/build/compiler-adapters.mjs";

const generate = async projectRoot => {
	const analysis = await analyzeLeanProject(projectRoot);
	const componentPlan = await prepareComponentBuildPlan({ projectRoot, engineRoot: process.cwd(), targets: ["npm"] });
	return generateCompilerAdapters({ analysis, componentPlan });
};

test("plain functions receive deterministic generated Lean exports and direct private symbols", async () => {
  const generated = await generate("tests/fixtures/onboarding/small");
  assert.deepEqual(Object.keys(generated.files), ["LeanBridgeGenerated.lean", "compiler-adapters.json", "private-abi.json"]);
  assert.match(generated.files["LeanBridgeGenerated.lean"], /^import OnboardingSmall$/m);
  assert.match(generated.files["LeanBridgeGenerated.lean"], /def export_[0-9a-f]{20} \(left : _root_\.Nat\) \(right : _root_\.Nat\) : _root_\.Nat :=\n {2}_root_\.OnboardingSmall\.add left right/);
  assert.match(generated.files["LeanBridgeGenerated.lean"], /def export_[0-9a-f]{20} \(value : _root_\.String\) : _root_\.Bool :=\n {2}_root_\.OnboardingSmall\.isEmpty value/);
  assert.equal((generated.files["LeanBridgeGenerated.lean"].match(/@\[export lean_bridge_/g) ?? []).length, 2);
  assert.equal(generated.plan.privateAbi.dispatch, "scalar-frame-v2");
  assert.ok(generated.plan.privateAbi.exports.every(item => /^lean_bridge_[0-9a-f]{24}$/.test(item.symbol)));
  assert.doesNotMatch(JSON.stringify(generated), /ccall|cwrap|generic.?dispatch|Alpha/);
  assert.doesNotMatch(await readFile("tests/fixtures/onboarding/small/OnboardingSmall.lean", "utf8"), /@\[export/);
});

test("compiler adapters are identical across source checkout roots", async () => {
  const copyRoot = await mkdtemp(join(tmpdir(), "lean-bridge-compiler-adapter-"));
  const copied = join(copyRoot, "component");
  try
{
    await cp(resolve("tests/fixtures/onboarding/scalar-modules"), copied, { recursive: true });
    const first = await generate("tests/fixtures/onboarding/scalar-modules");
    const second = await generate(copied);
    assert.deepEqual(first, second);
    assert.deepEqual(first.plan.imports, ["ScalarModules", "ScalarModules.Operations"]);
    assert.equal(first.plan.exports.length, 5);
} finally
{
    await rm(copyRoot, { recursive: true, force: true });
}
});

test("ordinary IO exports are blocked before compilation", async () => {
  const analysis = await analyzeLeanProject("tests/fixtures/onboarding/async");
  assert.ok(analysis.adapterHints.some(item => item.required));
  await assert.rejects(generate("tests/fixtures/onboarding/async"), { code: "component-binding-ir-required" });
});

test("existing hand-authored Binding IR cannot silently enter the inferred adapter generator", async () => {
  const analysis = await analyzeLeanProject(process.cwd());
  const runtime = JSON.parse(await readFile("poc/lean-link-spike/graph-lock.json", "utf8")).runtime;
  const componentPlan = createComponentBuildPlan({ analysis, runtime });
  assert.throws(
    () => generateCompilerAdapters({ analysis, componentPlan }),
    error => error instanceof CompilerAdapterError && error.code === "compiler-adapter-ir-origin",
  );
});

test("compiler adapter plan fields and direct dispatch fail closed", async () => {
  const generated = await generate("tests/fixtures/onboarding/small");
  const changed = structuredClone(generated.plan);
  changed.privateAbi.dispatch = "generic-dispatch";
  assert.throws(
    () => validateCompilerAdapterPlan(changed),
    error => error instanceof CompilerAdapterError && error.code === "invalid-compiler-adapter-plan",
  );
});

test("source-scanned APIs cannot supply compiler specialization applications", async () => {
	const projectRoot = "tests/fixtures/onboarding/small";
	const analysis = await analyzeLeanProject(projectRoot);
	const componentPlan = await prepareComponentBuildPlan({ projectRoot, engineRoot: process.cwd(), targets: ["npm"] });
	const declaration = analysis.bindingIr.document.declarations[0];
	declaration.source.extensions["lean-lang.org/specialization"] = { name: declaration.source.declaration
		, declaration: declaration.source.declaration
		, types: ["Nat"], application: "fun _ _ => 0" };
	assert.throws(() => generateCompilerAdapters({ analysis, componentPlan }), { code: "compiler-specialization-drift" });
});

test("adapter materialization is atomic and never changes the plain project", async () => {
  const scratch = await mkdtemp(join(tmpdir(), "lean-bridge-compiler-output-"));
  const output = join(scratch, "generated");
  const projectRoot = "tests/fixtures/onboarding/small";
  try
{
    const analysis = await analyzeLeanProject(projectRoot);
    const componentPlan = await prepareComponentBuildPlan({ projectRoot, engineRoot: process.cwd(), targets: ["npm"] });
    const before = await readFile(join(projectRoot, "OnboardingSmall.lean"), "utf8");
    const result = await writeCompilerAdapters({ outputRoot: output, analysis, componentPlan });
    assert.deepEqual(await readdir(output), ["LeanBridgeGenerated.lean", "compiler-adapters.json", "private-abi.json"]);
    assert.deepEqual(result.files, ["LeanBridgeGenerated.lean", "compiler-adapters.json", "private-abi.json"]);
    assert.equal(await readFile(join(projectRoot, "OnboardingSmall.lean"), "utf8"), before);
    await assert.rejects(
      writeCompilerAdapters({ outputRoot: output, analysis, componentPlan }),
      error => error instanceof CompilerAdapterError && error.code === "compiler-adapter-output-exists",
    );
} finally
{
    await rm(scratch, { recursive: true, force: true });
}
});

test("the compiler adapter schema closes generated and private ABI fields", async () => {
  const schema = JSON.parse(await readFile("schema/compiler-adapter-plan.schema.json", "utf8"));
  assert.equal(schema.additionalProperties, false);
  assert.equal(schema.$defs.export.additionalProperties, false);
  assert.equal(schema.$defs.privateAbi.additionalProperties, false);
  assert.equal(schema.$defs.privateExport.additionalProperties, false);
});
