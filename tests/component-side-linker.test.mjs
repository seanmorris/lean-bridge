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

const build = async ({ projectRoot, scratch, name }) => {
  const analysis = await analyzeLeanProject(projectRoot);
  const componentPlan = await prepareComponentBuildPlan({ projectRoot, engineRoot: process.cwd() });
  const compilerAdapters = generateCompilerAdapters({ analysis, componentPlan });
  const compilationPlan = await prepareComponentCompilationPlan({ projectRoot, analysis, componentPlan, compilerAdapters });
  const inputs = join(scratch, `${name}-inputs`);
  const targetC = join(scratch, `${name}-target-c`);
  const side = join(scratch, `${name}-side`);
  await writeComponentCompilationInputs({ projectRoot, outputRoot: inputs, analysis, componentPlan, compilerAdapters });
  await compileLeanComponentSources({ inputRoot: inputs, outputRoot: targetC, engineRoot: process.cwd(), compilationPlan });
  const linked = await linkComponentSideModule({ targetCRoot: targetC, outputRoot: side, engineRoot: process.cwd(), compilationPlan });
  return { compilationPlan, linked, side };
};

test("a plain component links once against shared runtime imports and direct exports", async () => {
  const scratch = await mkdtemp(join(tmpdir(), "lean-bridge-real-side-module-"));
  try {
    const built = await build({ projectRoot: "tests/fixtures/onboarding/small", scratch, name: "small" });
    const wasm = await readFile(join(built.side, built.linked.manifest.artifact.path));
    const module = await WebAssembly.compile(wasm);
    const imports = WebAssembly.Module.imports(module);
    const exports = WebAssembly.Module.exports(module);
    assert.deepEqual(imports.filter(item => item.kind === "memory"), [{ module: "env", name: "memory", kind: "memory" }]);
    assert.deepEqual(imports.filter(item => item.kind === "table"), [{ module: "env", name: "__indirect_function_table", kind: "table" }]);
    assert.deepEqual(exports.filter(item => item.kind === "memory" || item.kind === "table"), []);
    const functionExports = new Set(exports.filter(item => item.kind === "function").map(item => item.name));
    for (const symbol of built.compilationPlan.document.compilerAdapters.directSymbols) assert.equal(functionExports.has(symbol), true);
    assert.equal(functionExports.has("initialize_LeanBridgeGenerated"), true);
    assert.equal(functionExports.has(built.linked.manifest.exports.internalInitializer), true);
    const linkMap = await readFile(join(built.side, built.linked.manifest.linkMap.path), "utf8");
    assert.doesNotMatch(linkMap, /libleanrt\.a|libInit\.a|ccall|cwrap|generic.?dispatch/);
    assert.doesNotMatch(linkMap, new RegExp(scratch.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  } finally {
    await rm(scratch, { recursive: true, force: true });
  }
});

test("the side module and normalized link manifest are identical after checkout relocation", async () => {
  const scratch = await mkdtemp(join(tmpdir(), "lean-bridge-side-relocation-"));
  try {
    const relocated = join(scratch, "relocated-source");
    await cp("tests/fixtures/onboarding/small", relocated, { recursive: true });
    const first = await build({ projectRoot: "tests/fixtures/onboarding/small", scratch, name: "first" });
    const second = await build({ projectRoot: relocated, scratch, name: "second" });
    assert.deepEqual(first.linked.manifest, second.linked.manifest);
    assert.equal(
      Buffer.compare(await readFile(join(first.side, first.linked.manifest.artifact.path)), await readFile(join(second.side, second.linked.manifest.artifact.path))),
      0,
    );
  } finally {
    await rm(scratch, { recursive: true, force: true });
  }
});

test("the side-module link schema is closed", async () => {
  const schema = JSON.parse(await readFile("schema/side-module-link-manifest.schema.json", "utf8"));
  assert.equal(schema.additionalProperties, false);
  assert.equal(schema.properties.exports.additionalProperties, false);
  assert.equal(schema.properties.policies.additionalProperties, false);
  assert.equal(schema.$defs.artifact.additionalProperties, false);
});
