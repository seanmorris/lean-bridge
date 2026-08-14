/**
 * Tests the C family package behavior.
 *
 * @file
 */

import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { chmod, cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { promisify } from "node:util";

import { buildCPackage, buildCppPackage } from "../src/release/c-family-package.mjs";
import {
	canonicalPackageManifestJson,
	hashCanonicalPackageManifest,
	parseCanonicalPackageManifest,
} from "../src/release/canonical-package-manifest.mjs";
import { buildUniversalReleaseBundle } from "../src/release/universal-release-bundle.mjs";

const execute = promisify(execFile);
const revision = "7a7d48df70174be7c4247cc19c314d3584411c5a";

const withBundle = async operation => {
	const scratch = await mkdtemp(join(tmpdir(), "lean-bridge-c-family-package-"));
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
		return await operation({ scratch, bundle });
	} finally
	{
		await rm(scratch, { recursive: true, force: true });
	}
};

const rewriteIdentity = async (directory, manifest) => {
	const manifestSha256 = hashCanonicalPackageManifest(manifest);
	await writeFile(join(directory, "canonical-package.json"), canonicalPackageManifestJson(manifest));
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

test("C and C++ projections fail closed while native package targets are ineligible", async () => withBundle(async ({ scratch, bundle }) => {
  await assert.rejects(
    buildCPackage({ bundleRoot: bundle, outputRoot: join(scratch, "c") }),
    error => error.code === "package-ineligible" && /no native component library/.test(error.message),
  );
  await assert.rejects(
    buildCppPackage({ bundleRoot: bundle, outputRoot: join(scratch, "cpp") }),
    error => error.code === "package-ineligible" && /no native component library or C\+\+ binding projection/.test(error.message),
  );
}));

test("an eligible C binding target produces a deterministic package with pkg-config and CMake discovery", async () => withBundle(async ({ scratch, bundle }) => {
  const eligible = join(scratch, "eligible");
  await enableReviewedCBindingTarget(bundle, eligible);
  await chmod(join(eligible, "bindings/c/include/lean_alpha.h"), 0o444);
  const first = await buildCPackage({ bundleRoot: eligible, outputRoot: join(scratch, "first") });
  const second = await buildCPackage({ bundleRoot: eligible, outputRoot: join(scratch, "second") });
  assert.equal(first.archiveSha256, second.archiveSha256);
  assert.deepEqual(await readFile(first.archive), await readFile(second.archive));
  assert.deepEqual(first.coreArtifacts, []);

  const packageRoot = join(scratch, "first/lean-bridge-alpha-0.0.0-c");
  const pkgConfigPath = join(packageRoot, "lib/pkgconfig");
  const { stdout: flags } = await execute("pkg-config", ["--cflags", "lean-bridge-alpha"], {
    env: { ...process.env, PKG_CONFIG_PATH: pkgConfigPath }
  });
  assert.match(flags, /include/);
  assert.match(flags, /internal/);
  const { stdout: bindingSource } = await execute("pkg-config", ["--variable=lean_bridge_binding_source", "lean-bridge-alpha"], {
    env: { ...process.env, PKG_CONFIG_PATH: pkgConfigPath }
  });
  assert.match(bindingSource.trim(), /src\/lean_alpha\.c$/);

  const consumer = join(scratch, "consumer");
  await mkdir(consumer);
  await writeFile(join(consumer, "main.c"), `#include "lean_alpha.h"\nint main(void) { return LEAN_ALPHA_BINDING_ABI_VERSION == 1u ? 0 : 1; }\n`);
  await writeFile(join(consumer, "CMakeLists.txt"), `cmake_minimum_required(VERSION 3.20)\nproject(consumer C)\nfind_package(LeanBridgeAlpha 0.0.0 EXACT CONFIG REQUIRED PATHS "${packageRoot}/lib/cmake/LeanBridgeAlpha" NO_DEFAULT_PATH)\nadd_executable(consumer main.c)\ntarget_link_libraries(consumer PRIVATE LeanBridge::Alpha)\n`);
  await execute("cmake", ["-S", consumer, "-B", join(consumer, "build")]);
  await execute("cmake", ["--build", join(consumer, "build")]);
  await execute(join(consumer, "build/consumer"));

  const plan = JSON.parse(await readFile(join(scratch, "first/c-projection.json"), "utf8"));
  assert.equal(plan.compilerAccess, false);
  assert.equal(plan.scriptPolicy, "disabled");
  assert.equal(plan.commands.some(command => /cc|cmake|lean|emcc/.test(command)), false);
  const { stdout: archiveFiles } = await execute("tar", ["-tzf", first.archive]);
  assert.match(archiveFiles, /^lean-bridge-alpha-0\.0\.0-c\/lib\/pkgconfig\/lean-bridge-alpha\.pc$/m);
  assert.match(archiveFiles, /^lean-bridge-alpha-0\.0\.0-c\/lib\/cmake\/LeanBridgeAlpha\/LeanBridgeAlphaTargets\.cmake$/m);
  assert.match(archiveFiles, /^lean-bridge-alpha-0\.0\.0-c\/share\/lean-bridge-alpha\/metadata\/provenance\.intoto\.json$/m);
}));

test("C projection requires complete artifacts and an explicit source runtime contract", async () => withBundle(async ({ scratch, bundle }) => {
  const eligible = join(scratch, "eligible");
  await enableReviewedCBindingTarget(bundle, eligible);
  const manifest = structuredClone(parseCanonicalPackageManifest(
    await readFile(join(eligible, "canonical-package.json"), "utf8"),
  ));
  const mapping = manifest.packages.find(candidate => candidate.ecosystem === "c");
  const omitted = manifest.artifacts.find(artifact => artifact.path === "bindings/c/src/lean_alpha.c");
  mapping.publicArtifacts = mapping.publicArtifacts.filter(id => id !== omitted.id);
  await rewriteIdentity(eligible, manifest);
  await assert.rejects(
    buildCPackage({ bundleRoot: eligible, outputRoot: join(scratch, "omitted") }),
    error => error.code === "binding-artifact-omitted" && error.message.includes("src/lean_alpha.c"),
  );

  mapping.publicArtifacts.push(omitted.id);
  const target = manifest.targets.find(candidate => candidate.id === "c-bindings");
  target.capabilities = target.capabilities.filter(capability => capability !== "source-bindings");
  await rewriteIdentity(eligible, manifest);
  await assert.rejects(
    buildCPackage({ bundleRoot: eligible, outputRoot: join(scratch, "missing-runtime-contract") }),
    error => error.code === "runtime-artifact-absent",
  );
}));

test("C++ projection rejects an eligible target without a native runtime artifact", async () => withBundle(async ({ scratch, bundle }) => {
  const eligible = join(scratch, "eligible-cpp");
  await cp(bundle, eligible, { recursive: true });
  const manifest = structuredClone(parseCanonicalPackageManifest(
    await readFile(join(eligible, "canonical-package.json"), "utf8"),
  ));
  manifest.targets.push({
    id: "cpp-bindings"
    , eligible: true
    , reason: null
    , platforms: ["cpp20"]
    , capabilities: ["typed-bindings"]
    , entryPoints: [{ name: "types", kind: "types", artifact: "binding-ir" }]
  });
  const mapping = manifest.packages.find(candidate => candidate.ecosystem === "cpp");
  mapping.target = "cpp-bindings";
  mapping.eligible = true;
  mapping.reason = null;
  mapping.publicArtifacts = ["binding-ir"];
  await rewriteIdentity(eligible, manifest);
  await assert.rejects(
    buildCppPackage({ bundleRoot: eligible, outputRoot: join(scratch, "cpp") }),
    error => error.code === "binding-artifact-omitted" || error.code === "runtime-artifact-absent",
  );
}));
