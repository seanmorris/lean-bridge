import assert from "node:assert/strict";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";

import { analyzeLeanProject } from "../src/analyze/lean-project.mjs";
import { prepareComponentBuildPlan } from "../src/build/component-plan.mjs";
import { generateCompilerAdapters } from "../src/build/compiler-adapters.mjs";
import { prepareComponentCompilationPlan, writeComponentCompilationInputs } from "../src/build/component-compilation-plan.mjs";
import { LeanComponentCompilerError, compileLeanComponentSources } from "../src/build/lean-component-compiler.mjs";

const fixture = async ({ root, scratch }) => {
  const analysis = await analyzeLeanProject(root);
  const componentPlan = await prepareComponentBuildPlan({ projectRoot: root, engineRoot: process.cwd() });
  const compilerAdapters = generateCompilerAdapters({ analysis, componentPlan });
  const compilationPlan = await prepareComponentCompilationPlan({ projectRoot: root, analysis, componentPlan, compilerAdapters });
  const inputs = join(scratch, "inputs");
  await writeComponentCompilationInputs({ projectRoot: root, outputRoot: inputs, analysis, componentPlan, compilerAdapters });
  return { compilationPlan, inputs };
};

const fakeRunner = calls => ({
  capture: async request => {
    calls.push(request);
    if (request.args[0] === "--version") return { stdout: "Lean (version 4.32.2, x86_64-unknown-linux-gnu, commit f3b06c705e6c85f5314019d5d3baab0fec5b580c, Release)\n", stderr: "", code: 0 };
    const olean = request.args[request.args.indexOf("-o") + 1];
    const c = request.args[request.args.indexOf("-c") + 1];
    await mkdir(dirname(olean), { recursive: true });
    await mkdir(dirname(c), { recursive: true });
    await writeFile(olean, `olean:${request.args.at(-1).split("/").at(-1)}\n`);
    await writeFile(c, `// target C:${request.args.at(-1).split("/").at(-1)}\n`);
    return { stdout: "", stderr: "", code: 0 };
  },
});

test("the compiler follows the planned module order and writes outside the source closure", async () => {
  const scratch = await mkdtemp(join(tmpdir(), "lean-bridge-target-c-test-"));
  try {
    const prepared = await fixture({ root: "tests/fixtures/onboarding/medium", scratch });
    const calls = [];
    const output = join(scratch, "target-c");
    const result = await compileLeanComponentSources({ inputRoot: prepared.inputs, outputRoot: output, engineRoot: process.cwd(), compilationPlan: prepared.compilationPlan, runner: fakeRunner(calls) });
    assert.deepEqual(result.manifest.modules.map(module => module.module), ["OnboardingMedium.Collections", "OnboardingMedium", "LeanBridgeGenerated"]);
    assert.equal(calls.length, 4);
    assert.ok(calls.slice(1).every(call => call.args.includes("-R") && call.env.LEAN_PATH.startsWith(output.slice(0, output.lastIndexOf("/") + 1))));
    assert.equal(result.manifest.sourceReadOnly, true);
    assert.equal(JSON.parse(await readFile(join(output, "lean-target-c-manifest.json"), "utf8")).compilationPlanSha256, prepared.compilationPlan.sha256);
  } finally {
    await rm(scratch, { recursive: true, force: true });
  }
});

test("the compiler rejects a Lean commit that differs from the shared runtime", async () => {
  const scratch = await mkdtemp(join(tmpdir(), "lean-bridge-target-c-drift-"));
  try {
    const prepared = await fixture({ root: "tests/fixtures/onboarding/small", scratch });
    const runner = { capture: async () => ({ stdout: `Lean (version 4.32.2, x86_64-unknown-linux-gnu, commit ${"0".repeat(40)}, Release)\n`, stderr: "", code: 0 }) };
    await assert.rejects(
      compileLeanComponentSources({ inputRoot: prepared.inputs, outputRoot: join(scratch, "target-c"), engineRoot: process.cwd(), compilationPlan: prepared.compilationPlan, runner }),
      error => error instanceof LeanComponentCompilerError && error.code === "lean-compiler-drift",
    );
  } finally {
    await rm(scratch, { recursive: true, force: true });
  }
});

test("the target C manifest schema is closed", async () => {
  const schema = JSON.parse(await readFile("schema/lean-target-c-manifest.schema.json", "utf8"));
  assert.equal(schema.additionalProperties, false);
  assert.equal(schema.properties.compiler.additionalProperties, false);
  assert.equal(schema.$defs.module.additionalProperties, false);
});

test("the pinned Lean compiler emits root-independent target C with every direct symbol", async () => {
  const scratch = await mkdtemp(join(tmpdir(), "lean-bridge-real-target-c-"));
  try {
    const original = await fixture({ root: "tests/fixtures/onboarding/small", scratch: join(scratch, "original") });
    const first = await compileLeanComponentSources({ inputRoot: original.inputs, outputRoot: join(scratch, "first"), engineRoot: process.cwd(), compilationPlan: original.compilationPlan });
    const relocatedRoot = join(scratch, "relocated-source");
    await cp("tests/fixtures/onboarding/small", relocatedRoot, { recursive: true });
    const relocated = await fixture({ root: relocatedRoot, scratch: join(scratch, "relocated") });
    const second = await compileLeanComponentSources({ inputRoot: relocated.inputs, outputRoot: join(scratch, "second"), engineRoot: process.cwd(), compilationPlan: relocated.compilationPlan });
    assert.deepEqual(first.manifest, second.manifest);
    const firstGenerated = await readFile(join(scratch, "first/c/LeanBridgeGenerated.c"), "utf8");
    const secondGenerated = await readFile(join(scratch, "second/c/LeanBridgeGenerated.c"), "utf8");
    assert.equal(firstGenerated, secondGenerated);
    assert.match(firstGenerated, /initialize_LeanBridgeGenerated/);
    for (const symbol of original.compilationPlan.document.compilerAdapters.directSymbols) assert.match(firstGenerated, new RegExp(symbol));
    assert.doesNotMatch(firstGenerated, /ccall|cwrap|generic.?dispatch/);
  } finally {
    await rm(scratch, { recursive: true, force: true });
  }
});
