import assert from "node:assert/strict";
import { cp, mkdtemp, readFile, readdir, rm } from "node:fs/promises";
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
import { writeComponentArtifactManifest } from "../src/build/component-artifact-manifest.mjs";
import { buildComponentReleaseBundle, validateComponentReleaseBundleManifest } from "../src/release/component-release-bundle.mjs";

const list = async root => {
  const files = [];
  const visit = async relative => {
    for (const entry of await readdir(join(root, relative), { withFileTypes: true })) {
      const path = relative === "" ? entry.name : `${relative}/${entry.name}`;
      if (entry.isDirectory()) await visit(path);
      else files.push(path);
    }
  };
  await visit("");
  return files.sort();
};

const build = async ({ projectRoot, scratch, name }) => {
  const analysis = await analyzeLeanProject(projectRoot);
  const componentPlan = await prepareComponentBuildPlan({ projectRoot, engineRoot: process.cwd() });
  const compilerAdapters = generateCompilerAdapters({ analysis, componentPlan });
  const compilationPlan = await prepareComponentCompilationPlan({ projectRoot, analysis, componentPlan, compilerAdapters });
  const inputRoot = join(scratch, `${name}-inputs`);
  const targetCRoot = join(scratch, `${name}-target-c`);
  const sideRoot = join(scratch, `${name}-side`);
  const outputRoot = join(scratch, `${name}-bundle`);
  await writeComponentCompilationInputs({ projectRoot, outputRoot: inputRoot, analysis, componentPlan, compilerAdapters });
  const compiled = await compileLeanComponentSources({ inputRoot, outputRoot: targetCRoot, engineRoot: process.cwd(), compilationPlan });
  const linked = await linkComponentSideModule({ targetCRoot, outputRoot: sideRoot, engineRoot: process.cwd(), compilationPlan });
  const audited = await auditComponentSideModule({ sideRoot, compilationPlan });
  const componentArtifact = await writeComponentArtifactManifest({ sideRoot, analysis, componentPlan, compilerAdapters, compilationPlan, compiled, linked, audited });
  const bundle = await buildComponentReleaseBundle({ projectRoot, inputRoot, targetCRoot, sideRoot, outputRoot, analysis, componentPlan, compilerAdapters, compilationPlan, compiled, linked, audited, componentArtifact });
  return { bundle, outputRoot };
};

test("the component-neutral bundle contains one component and no runtime binary", async () => {
  const scratch = await mkdtemp(join(tmpdir(), "lean-bridge-component-bundle-"));
  try {
    const built = await build({ projectRoot: "tests/fixtures/onboarding/small", scratch, name: "small" });
    assert.equal(validateComponentReleaseBundleManifest(built.bundle.manifest), true);
    assert.equal(built.bundle.manifest.files.filter(file => file.mediaType === "application/wasm").length, 1);
    assert.equal(built.bundle.manifest.files.some(file => file.role === "runtime"), false);
    assert.equal(built.bundle.manifest.runtime.artifactIncluded, false);
    assert.equal(built.bundle.manifest.policies.targetPackagesIncluded, false);
    for (const file of built.bundle.manifest.files) assert.equal((await readFile(join(built.outputRoot, file.path))).length, file.bytes, file.path);
  } finally {
    await rm(scratch, { recursive: true, force: true });
  }
});

test("component-neutral bundles are byte-identical after checkout relocation", async () => {
  const scratch = await mkdtemp(join(tmpdir(), "lean-bridge-component-bundle-root-"));
  try {
    const relocated = join(scratch, "relocated-source");
    await cp("tests/fixtures/onboarding/small", relocated, { recursive: true });
    const first = await build({ projectRoot: "tests/fixtures/onboarding/small", scratch, name: "first" });
    const second = await build({ projectRoot: relocated, scratch, name: "second" });
    assert.equal(first.bundle.manifestSha256, second.bundle.manifestSha256);
    assert.deepEqual(await list(first.outputRoot), await list(second.outputRoot));
    for (const path of await list(first.outputRoot)) assert.deepEqual(await readFile(join(first.outputRoot, path)), await readFile(join(second.outputRoot, path)), path);
  } finally {
    await rm(scratch, { recursive: true, force: true });
  }
});

test("the bundle validator rejects runtime and target package duplication", async () => {
  const scratch = await mkdtemp(join(tmpdir(), "lean-bridge-component-bundle-policy-"));
  try {
    const built = await build({ projectRoot: "tests/fixtures/onboarding/small", scratch, name: "small" });
    for (const change of [
      manifest => { manifest.runtime.artifactIncluded = true; },
      manifest => { manifest.policies.targetPackagesIncluded = true; },
      manifest => { manifest.files.find(file => file.role === "component").role = "runtime"; },
    ]) {
      const changed = structuredClone(built.bundle.manifest);
      change(changed);
      assert.throws(() => validateComponentReleaseBundleManifest(changed));
    }
  } finally {
    await rm(scratch, { recursive: true, force: true });
  }
});

test("the component release bundle schema closes runtime, files, and policies", async () => {
  const schema = JSON.parse(await readFile("schema/component-release-bundle.schema.json", "utf8"));
  assert.equal(schema.additionalProperties, false);
  assert.equal(schema.properties.runtime.additionalProperties, false);
  assert.equal(schema.properties.policies.additionalProperties, false);
  assert.equal(schema.$defs.component.additionalProperties, false);
  assert.equal(schema.$defs.file.additionalProperties, false);
});
