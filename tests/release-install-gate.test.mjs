import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { cp, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { promisify } from "node:util";

import { validatePackagingBackendPlan } from "../src/release/backend-policy.mjs";
import {
	canonicalPackageManifestJson,
	hashCanonicalPackageManifest,
	parseCanonicalPackageManifest,
} from "../src/release/canonical-package-manifest.mjs";
import { traceInstalledPackage } from "../src/release/install-trace.mjs";
import { parsePublicationIndex } from "../src/release/release-rehearsal.mjs";
import { buildUniversalReleaseBundle } from "../src/release/universal-release-bundle.mjs";

const execute = promisify(execFile);
const revision = "5f0e70569cd85982cbf11e08224243dc448feae8";

const rewriteIdentity = async (directory, manifest) => {
	const manifestSha256 = hashCanonicalPackageManifest(manifest);
	await writeFile(join(directory, "canonical-package.json"), `${canonicalPackageManifestJson(manifest)}\n`);
	await writeFile(join(directory, "canonical-package.sha256"), `${manifestSha256}  canonical-package.json\n`);
	const identityPath = join(directory, "bundle-identity.json");
	const identity = JSON.parse(await readFile(identityPath, "utf8"));
	identity.canonicalManifestSha256 = manifestSha256;
	await writeFile(identityPath, `${JSON.stringify(identity, null, 2)}\n`);
};

const enableReviewedCBindingTarget = async (bundle, destination) => {
	await cp(bundle, destination, { recursive: true });
	const manifest = structuredClone(parseCanonicalPackageManifest(
		await readFile(join(destination, "canonical-package.json"), "utf8"),
	));
	const cArtifacts = manifest.artifacts.filter(artifact => artifact.path.startsWith("bindings/c/"));
	cArtifacts.forEach(artifact => { artifact.target = "c-bindings"; });
	manifest.targets.push({
		id: "c-bindings"
		, eligible: true
		, reason: null
		, platforms: ["c11"]
		, capabilities: ["external-runtime-adapter", "source-bindings", "typed-bindings"]
		, entryPoints: [
			{ name: "library", kind: "library", artifact: cArtifacts.find(artifact => artifact.path.endsWith("include/lean_alpha.h")).id }
			, { name: "types", kind: "types", artifact: "binding-ir" }
			, { name: "documentation", kind: "documentation", artifact: cArtifacts.find(artifact => artifact.path.endsWith("README.md")).id }
		]
	});
	const mapping = manifest.packages.find(candidate => candidate.ecosystem === "c");
	mapping.target = "c-bindings";
	mapping.eligible = true;
	mapping.reason = null;
	mapping.publicArtifacts = [
		...cArtifacts.map(artifact => artifact.id)
		, "license"
		, "assurance"
		, "core-artifact-set"
		, "sbom"
		, "provenance"
	];
	await rewriteIdentity(destination, manifest);
};

const cConsumer = `#include "lean_alpha.h"
#include "lean_alpha_runtime.h"

#include <stdint.h>
#include <stdio.h>

static unsigned disposals = 0;

static lean_alpha_status box_create(void *context, uint32_t value, uintptr_t *out, lean_alpha_error *error) {
  (void)context;
  (void)error;
  *out = (uintptr_t)value + 1u;
  return LEAN_ALPHA_STATUS_OK;
}

static lean_alpha_status box_read(void *context, uintptr_t self, uint32_t *out, lean_alpha_error *error) {
  (void)context;
  (void)error;
  *out = (uint32_t)(self - 1u);
  return LEAN_ALPHA_STATUS_OK;
}

static lean_alpha_status box_identity(void *context, uintptr_t self, uintptr_t *out, lean_alpha_error *error) {
  (void)context;
  (void)error;
  *out = self;
  return LEAN_ALPHA_STATUS_OK;
}

static void box_dispose(void *context, uintptr_t value) {
  (void)context;
  (void)value;
  disposals += 1;
}

int main(void) {
  lean_alpha_error error = {0};
  const lean_alpha_runtime_v1 runtime = {
    .abi_version = LEAN_ALPHA_BINDING_ABI_VERSION,
    .box_create = box_create,
    .box_read = box_read,
    .box_identity = box_identity,
    .box_dispose = box_dispose,
  };
  if (lean_alpha_runtime_install_v1(&runtime, &error) != LEAN_ALPHA_STATUS_OK) return 1;
  lean_alpha_box *box = NULL;
  if (lean_alpha_box_create(42, &box, &error) != LEAN_ALPHA_STATUS_OK) return 2;
  uint32_t value = 0;
  if (lean_alpha_box_read(box, &value, &error) != LEAN_ALPHA_STATUS_OK) return 3;
  const lean_alpha_box *same = NULL;
  if (lean_alpha_box_identity(box, &same, &error) != LEAN_ALPHA_STATUS_OK) return 4;
  const int identity = same == box;
  lean_alpha_box_dispose(&box);
  printf("{\\\"value\\\":%u,\\\"identity\\\":%s,\\\"disposed\\\":%u}", value, identity ? "true" : "false", disposals);
  return 0;
}
`;

test("permission-isolated rehearsal passes clean npm and C consumers with complete install traces", async () => {
  const scratch = await mkdtemp(join(tmpdir(), "lean-bridge-release-install-gate-"));
  try
{
    const bundle = join(scratch, "bundle");
    await buildUniversalReleaseBundle({
      projectRoot: process.cwd()
      , coreRoot: "build/lean-link-spike"
      , outputRoot: bundle
      , revision
      , sourceDateEpoch: 1786261809
    });
    const eligible = join(scratch, "eligible");
    await enableReviewedCBindingTarget(bundle, eligible);

    const release = join(scratch, "release");
    const { stdout: rehearsalOutput } = await execute("node", [
      "--permission"
      , `--allow-fs-read=${process.cwd()}`
      , `--allow-fs-read=${eligible}`
      , `--allow-fs-read=${release}`
      , `--allow-fs-read=${release}/*`
      , `--allow-fs-write=${release}`
      , `--allow-fs-write=${release}/*`
      , "scripts/rehearse-release.mjs"
      , "--bundle", eligible
      , "--output", release
    ], { cwd: process.cwd() });
    const rehearsal = JSON.parse(rehearsalOutput);
    assert.equal(rehearsal.ready, 2);
    const index = parsePublicationIndex(await readFile(join(release, "publication-index.json"), "utf8"));
    const ready = index.packages.filter(item => item.status === "ready");
    for(const item of ready)
{
      const planSource = await readFile(join(release, item.backendPlan.path), "utf8");
      const plan = JSON.parse(planSource);
      assert.equal(validatePackagingBackendPlan(plan), true);
      assert.equal(plan.compilerAccess, false);
      assert.equal(plan.commands.some(command => /lean|lake|cc|clang|emcc|cargo|cmake|make|ld/.test(command)), false);
}

    const npm = ready.find(item => item.ecosystem === "npm");
    const npmConsumer = join(scratch, "npm-consumer");
    await mkdir(npmConsumer);
    await execute("npm", ["init", "--yes"], { cwd: npmConsumer });
    await execute("npm", [
      "install", "--offline", "--ignore-scripts", "--no-audit", "--no-fund"
      , join(release, npm.archives[0].path)
    ], { cwd: npmConsumer });
    const npmProgram = join(npmConsumer, "consumer.mjs");
    await writeFile(npmProgram, `import { Box } from "@lean-bridge/alpha";\nconst box = new Box(42);\nconst result = { value: box.read(), identity: box.identity() === box };\nbox.dispose();\nprocess.stdout.write(JSON.stringify(result));\n`);
    const { stdout: npmStdout } = await execute("node", [npmProgram], { cwd: npmConsumer });
    const npmObservation = JSON.parse(npmStdout);
    const npmRoot = join(npmConsumer, "node_modules/@lean-bridge/alpha");
    const npmTrace = await traceInstalledPackage({ bundleRoot: eligible, installRoot: npmRoot, ecosystem: "npm" });
    assert.equal(npmTrace.installedFiles, npmTrace.canonicalFiles + npmTrace.derivedFiles);
    assert.equal(npmTrace.derivedFiles, 2);
    const npmMetadata = JSON.parse(await readFile(join(npmRoot, "package.json"), "utf8"));
    assert.equal(npmMetadata.version, index.bundle.version);
    assert.equal((await readFile(join(npmRoot, "README.md"), "utf8")).length > 0, true);
    for(const artifact of npm.coreArtifacts)
{
      assert.deepEqual(
        await readFile(join(eligible, artifact.sourcePath)),
        await readFile(join(npmRoot, artifact.packagePath)),
        artifact.packagePath,
      );
}

    const c = ready.find(item => item.ecosystem === "c");
    const cInstall = join(scratch, "c-install");
    await mkdir(cInstall);
    await execute("tar", ["-xzf", join(release, c.archives[0].path), "-C", cInstall]);
    const [cRootName] = await readdir(cInstall);
    const cRoot = join(cInstall, cRootName);
    const cTrace = await traceInstalledPackage({ bundleRoot: eligible, installRoot: cRoot, ecosystem: "c" });
    assert.equal(cTrace.installedFiles, cTrace.canonicalFiles + cTrace.derivedFiles);
    assert.equal(cTrace.derivedFiles, 4);
    assert.match(await readFile(join(cRoot, "lib/pkgconfig/lean-bridge-alpha.pc"), "utf8"), /Version: 0\.0\.0/);
    assert.equal((await readFile(join(cRoot, "README.md"), "utf8")).length > 0, true);

    const cConsumerRoot = join(scratch, "c-consumer");
    await mkdir(cConsumerRoot);
    await writeFile(join(cConsumerRoot, "main.c"), cConsumer);
    await writeFile(join(cConsumerRoot, "CMakeLists.txt"), `cmake_minimum_required(VERSION 3.20)\nproject(consumer C)\nfind_package(LeanBridgeAlpha 0.0.0 EXACT CONFIG REQUIRED PATHS "${cRoot}/lib/cmake/LeanBridgeAlpha" NO_DEFAULT_PATH)\nadd_executable(consumer main.c)\ntarget_link_libraries(consumer PRIVATE LeanBridge::Alpha)\n`);
    await execute("cmake", ["-S", cConsumerRoot, "-B", join(cConsumerRoot, "build")]);
    await execute("cmake", ["--build", join(cConsumerRoot, "build")]);
    const { stdout: cStdout } = await execute(join(cConsumerRoot, "build/consumer"));
    const cObservation = JSON.parse(cStdout);
    assert.deepEqual({ value: cObservation.value, identity: cObservation.identity }, npmObservation);
    assert.equal(cObservation.disposed, 1);

    await writeFile(join(cRoot, "unreviewed-generated-file.txt"), "not traced\n");
    await assert.rejects(
      traceInstalledPackage({ bundleRoot: eligible, installRoot: cRoot, ecosystem: "c" }),
      error => error.code === "untraceable-installed-file" && error.message.includes("unreviewed-generated-file.txt"),
    );
} finally
{
    await rm(scratch, { recursive: true, force: true });
}
});
