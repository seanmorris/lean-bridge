import assert from "node:assert/strict";
import { cp, mkdtemp, readFile, readdir, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { analyzeLeanProject } from "../src/analyze/lean-project.mjs";
import { prepareComponentBuildPlan } from "../src/build/component-plan.mjs";
import { generateCompilerAdapters } from "../src/build/compiler-adapters.mjs";
import { ComponentCompilationPlanError, prepareComponentCompilationPlan, validateComponentCompilationPlan, writeComponentCompilationInputs } from "../src/build/component-compilation-plan.mjs";

const prepare = async root => {
  const analysis = await analyzeLeanProject(root);
  const componentPlan = await prepareComponentBuildPlan({ projectRoot: root, engineRoot: process.cwd(), targets: ["npm"] });
  const compilerAdapters = generateCompilerAdapters({ analysis, componentPlan });
  const compilationPlan = await prepareComponentCompilationPlan({ projectRoot: root, analysis, componentPlan, compilerAdapters });
  return { analysis, componentPlan, compilerAdapters, compilationPlan };
};

test("the component compilation plan orders local Lean modules before generated adapters", async () => {
  const { compilationPlan } = await prepare("tests/fixtures/onboarding/medium");
  assert.deepEqual(compilationPlan.document.source.compileOrder, ["OnboardingMedium.Collections", "OnboardingMedium", "LeanBridgeGenerated"]);
  assert.deepEqual(compilationPlan.document.source.modules.map(item => [item.module, item.localDependencies]), [
    ["OnboardingMedium", ["OnboardingMedium.Collections"]],
    ["OnboardingMedium.Collections", []],
  ]);
  assert.deepEqual(compilationPlan.document.source.externalImports, []);
  assert.equal(compilationPlan.document.compilerAdapters.directSymbols.length, 5);
  assert.equal(compilationPlan.document.compilerAdapters.initializer, "initialize_LeanBridgeGenerated");
});

test("the compilation closure carries shared-runtime and direct-call policies", async () => {
  const { compilationPlan } = await prepare("tests/fixtures/onboarding/small");
  assert.deepEqual(compilationPlan.document.target, {
    triple: "wasm32-unknown-emscripten",
    format: "wasm",
    linkMode: "side-module-2",
    exceptionHandling: "wasm",
    positionIndependent: true,
  });
  assert.deepEqual(compilationPlan.document.policies, {
    compileOnce: true,
    sourceReadOnly: true,
    linksRuntime: false,
    definesMemory: false,
    definesTable: false,
    publicGenericDispatch: false,
  });
  assert.match(compilationPlan.document.outputs.sideModule, /^artifacts\/onboarding-small-[0-9a-f]{16}\.so\.wasm$/);
});

test("the compilation plan is identical after the component moves to another checkout root", async () => {
  const scratch = await mkdtemp(join(tmpdir(), "lean-bridge-compilation-root-"));
  const copied = join(scratch, "component");
  try {
    await cp("tests/fixtures/onboarding/medium", copied, { recursive: true });
    const first = await prepare("tests/fixtures/onboarding/medium");
    const second = await prepare(copied);
    assert.deepEqual(first.compilationPlan, second.compilationPlan);
  } finally {
    await rm(scratch, { recursive: true, force: true });
  }
});

test("staging verifies every input and leaves author source unchanged", async () => {
  const root = "tests/fixtures/onboarding/small";
  const prepared = await prepare(root);
  const scratch = await mkdtemp(join(tmpdir(), "lean-bridge-compilation-inputs-"));
  const output = join(scratch, "closure");
  const before = await readFile(join(root, "OnboardingSmall.lean"), "utf8");
  try {
    const result = await writeComponentCompilationInputs({ projectRoot: root, outputRoot: output, ...prepared });
    assert.equal(result.compilationPlanSha256, prepared.compilationPlan.sha256);
    assert.deepEqual(await readdir(output), ["component-build-plan.json", "component-compilation-plan.json", "generated", "source"]);
    assert.equal(await readFile(join(output, "source/OnboardingSmall.lean"), "utf8"), before);
    assert.equal(await readFile(join(root, "OnboardingSmall.lean"), "utf8"), before);
    assert.equal((await stat(join(output, "source/OnboardingSmall.lean"))).mode & 0o222, 0);
    await assert.rejects(
      writeComponentCompilationInputs({ projectRoot: root, outputRoot: output, ...prepared }),
      error => error instanceof ComponentCompilationPlanError && error.code === "component-compilation-output-exists",
    );
  } finally {
    await rm(scratch, { recursive: true, force: true });
  }
});

test("the validator rejects a private runtime or generic public dispatch", async () => {
  const { compilationPlan } = await prepare("tests/fixtures/onboarding/small");
  for (const change of [
    plan => { plan.policies.linksRuntime = true; },
    plan => { plan.policies.publicGenericDispatch = true; },
    plan => { plan.source.compileOrder.reverse(); },
  ]) {
    const changed = structuredClone(compilationPlan.document);
    change(changed);
    assert.throws(() => validateComponentCompilationPlan(changed), error => error instanceof ComponentCompilationPlanError);
  }
});

test("the JSON schema closes the plan, source modules, target, and policies", async () => {
  const schema = JSON.parse(await readFile("schema/component-compilation-plan.schema.json", "utf8"));
  assert.equal(schema.additionalProperties, false);
  assert.equal(schema.$defs.sourceModule.additionalProperties, false);
  assert.equal(schema.properties.target.additionalProperties, false);
  assert.equal(schema.properties.policies.additionalProperties, false);
});
