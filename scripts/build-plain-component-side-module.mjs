#!/usr/bin/env node

import { mkdir, mkdtemp, rename, rm, stat, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { analyzeLeanProject } from "../src/analyze/lean-project.mjs";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { prepareComponentBuildPlan } from "../src/build/component-plan.mjs";
import { generateCompilerAdapters } from "../src/build/compiler-adapters.mjs";
import { prepareComponentCompilationPlan, writeComponentCompilationInputs } from "../src/build/component-compilation-plan.mjs";
import { compileLeanComponentSources } from "../src/build/lean-component-compiler.mjs";
import { linkComponentSideModule } from "../src/build/component-side-linker.mjs";
import { auditComponentSideModule } from "../src/build/side-module-audit.mjs";

const arguments_ = process.argv.slice(2);
const option = name => {
  const index = arguments_.indexOf(name);
  return index === -1 ? null : arguments_[index + 1] ?? null;
};
const projectRoot = resolve(option("--project") ?? process.cwd());
const engineRoot = resolve(option("--engine") ?? fileURLToPath(new URL("..", import.meta.url)));
const outputRoot = resolve(option("--output") ?? `${projectRoot}/build/lean-bridge-side-module`);

try {
  await stat(outputRoot);
  throw new Error(`Output already exists: ${outputRoot}`);
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}

await mkdir(dirname(outputRoot), { recursive: true });
const staging = await mkdtemp(`${dirname(outputRoot)}/.lean-bridge-side-build-`);
try {
  const analysis = await analyzeLeanProject(projectRoot);
  const componentPlan = await prepareComponentBuildPlan({ projectRoot, engineRoot });
  const compilerAdapters = generateCompilerAdapters({ analysis, componentPlan });
  const compilationPlan = await prepareComponentCompilationPlan({ projectRoot, analysis, componentPlan, compilerAdapters });
  await writeComponentCompilationInputs({ projectRoot, outputRoot: `${staging}/inputs`, analysis, componentPlan, compilerAdapters });
  const compiled = await compileLeanComponentSources({ inputRoot: `${staging}/inputs`, outputRoot: `${staging}/target-c`, engineRoot, compilationPlan });
  const linked = await linkComponentSideModule({ targetCRoot: `${staging}/target-c`, outputRoot: `${staging}/side-module`, engineRoot, compilationPlan });
  const audited = await auditComponentSideModule({ sideRoot: `${staging}/side-module`, compilationPlan, reportPath: `${staging}/side-module/audit/component-side-module-audit.json` });
  const report = Object.freeze({
    schemaVersion: 1,
    component: compilationPlan.document.component.id,
    componentPlanSha256: componentPlan.sha256,
    compilationPlanSha256: compilationPlan.sha256,
    targetCManifestSha256: compiled.manifestSha256,
    sideModuleLinkManifestSha256: linked.manifestSha256,
    sideModuleAuditSha256: sha256(canonicalJson(audited)),
    sideModule: linked.manifest.artifact,
    sourceReadOnly: true,
    linksRuntime: false,
    importsSharedMemory: true,
    importsSharedTable: true,
  });
  await writeFile(`${staging}/build-report.json`, canonicalJson(report));
  await rename(staging, outputRoot);
  process.stdout.write(canonicalJson({ ...report, output: outputRoot }));
} catch (error) {
  await rm(staging, { recursive: true, force: true });
  throw error;
}
