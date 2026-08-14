/**
 * Tests the Cargo package behavior.
 *
 * @file
 */

import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { promisify } from "node:util";

import { buildCargoPackage } from "../src/release/cargo-package.mjs";
import {
	canonicalPackageManifestJson,
	hashCanonicalPackageManifest,
	parseCanonicalPackageManifest,
} from "../src/release/canonical-package-manifest.mjs";
import { buildUniversalReleaseBundle } from "../src/release/universal-release-bundle.mjs";

const execute = promisify(execFile);
const revision = "8cd060c40175f15e2fb9ed334ee3531f88b1cd78";

const withBundle = async operation => {
	const scratch = await mkdtemp(join(tmpdir(), "lean-bridge-cargo-package-"));
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

const enableReviewedRustBindingTarget = async (bundle, destination) => {
	await cp(bundle, destination, { recursive: true });
	const manifest = structuredClone(parseCanonicalPackageManifest(
		await readFile(join(destination, "canonical-package.json"), "utf8"),
	));
	const rustArtifacts = manifest.artifacts.filter(artifact => artifact.path.startsWith("bindings/rust/"));
	rustArtifacts.forEach(artifact => { artifact.target = "rust-bindings"; });
	manifest.targets.push({
		id: "rust-bindings"
		, eligible: true
		, reason: null
		, platforms: ["rust-2021"]
		, capabilities: ["external-runtime-adapter", "typed-bindings"]
		, entryPoints: [
			{ name: "library", kind: "library", artifact: rustArtifacts.find(artifact => artifact.path.endsWith("src/lib.rs")).id }
			, { name: "types", kind: "types", artifact: "binding-ir" }
			, { name: "documentation", kind: "documentation", artifact: rustArtifacts.find(artifact => artifact.path.endsWith("README.md")).id }
		]
	});
	const mapping = manifest.packages.find(candidate => candidate.ecosystem === "cargo");
	mapping.target = "rust-bindings";
	mapping.eligible = true;
	mapping.reason = null;
	mapping.publicArtifacts = [
		...rustArtifacts.map(artifact => artifact.id)
		, "license"
		, "assurance"
		, "core-artifact-set"
		, "sbom"
		, "provenance"
	];
	const manifestSha256 = hashCanonicalPackageManifest(manifest);
	await writeFile(join(destination, "canonical-package.json"), canonicalPackageManifestJson(manifest));
	await writeFile(join(destination, "canonical-package.sha256"), `${manifestSha256}  canonical-package.json\n`);
	const identityPath = join(destination, "bundle-identity.json");
	const identity = JSON.parse(await readFile(identityPath, "utf8"));
	identity.canonicalManifestSha256 = manifestSha256;
	await writeFile(identityPath, `${JSON.stringify(identity, null, 2)}\n`);
};

test("Cargo projection fails closed while the canonical native target is ineligible", async () => withBundle(async ({ scratch, bundle }) => {
  await assert.rejects(
    buildCargoPackage({ bundleRoot: bundle, outputRoot: join(scratch, "cargo") }),
    error => error.code === "package-ineligible" && /no native component library/.test(error.message),
  );
}));

test("an eligible Rust binding target produces a deterministic crate without compiler access", async () => withBundle(async ({ scratch, bundle }) => {
  const eligible = join(scratch, "eligible");
  await enableReviewedRustBindingTarget(bundle, eligible);
  const first = await buildCargoPackage({ bundleRoot: eligible, outputRoot: join(scratch, "first") });
  const second = await buildCargoPackage({ bundleRoot: eligible, outputRoot: join(scratch, "second") });
  assert.equal(first.archiveSha256, second.archiveSha256);
  assert.deepEqual(await readFile(first.archive), await readFile(second.archive));
  assert.deepEqual(first.coreArtifacts, []);

  const crateRoot = join(scratch, "first/lean_bridge_alpha-0.0.0");
  const cargo = await readFile(join(crateRoot, "Cargo.toml"), "utf8");
  assert.match(cargo, /name = "lean_bridge_alpha"/);
  assert.match(cargo, /version = "0\.0\.0"/);
  assert.match(cargo, /all-features = true/);
  assert.match(cargo, /shared_runtime = true/);
  assert.doesNotMatch(cargo, /build\s*=/);
  const plan = JSON.parse(await readFile(join(scratch, "first/cargo-projection.json"), "utf8"));
  assert.equal(plan.compilerAccess, false);
  assert.equal(plan.scriptPolicy, "disabled");
  assert.equal(plan.commands.some(command => /cargo|rustc/.test(command)), false);

  const { stdout: archiveFiles } = await execute("tar", ["-tzf", first.archive]);
  assert.match(archiveFiles, /^lean_bridge_alpha-0\.0\.0\/Cargo\.toml$/m);
  assert.match(archiveFiles, /^lean_bridge_alpha-0\.0\.0\/metadata\/provenance\.intoto\.json$/m);
  const { stdout, stderr } = await execute("cargo", [
    "test"
    , "--offline"
    , "--manifest-path"
    , join(crateRoot, "Cargo.toml")
  ], { env: { ...process.env, RUSTFLAGS: "-D warnings" } });
  assert.match(`${stdout}\n${stderr}`, /test result: ok/);
}));

test("Cargo projection requires every generated Rust file in the reviewed selection", async () => withBundle(async ({ scratch, bundle }) => {
  const eligible = join(scratch, "eligible");
  await enableReviewedRustBindingTarget(bundle, eligible);
  const source = await readFile(join(eligible, "canonical-package.json"), "utf8");
  const manifest = structuredClone(parseCanonicalPackageManifest(source));
  const mapping = manifest.packages.find(candidate => candidate.ecosystem === "cargo");
  const omitted = manifest.artifacts.find(artifact => artifact.path === "bindings/rust/src/lib.rs");
  mapping.publicArtifacts = mapping.publicArtifacts.filter(id => id !== omitted.id);
  const manifestSha256 = hashCanonicalPackageManifest(manifest);
  await writeFile(join(eligible, "canonical-package.json"), canonicalPackageManifestJson(manifest));
  await writeFile(join(eligible, "canonical-package.sha256"), `${manifestSha256}  canonical-package.json\n`);
  const identityPath = join(eligible, "bundle-identity.json");
  const identity = JSON.parse(await readFile(identityPath, "utf8"));
  identity.canonicalManifestSha256 = manifestSha256;
  await writeFile(identityPath, `${JSON.stringify(identity, null, 2)}\n`);

  await assert.rejects(
    buildCargoPackage({ bundleRoot: eligible, outputRoot: join(scratch, "rejected") }),
    error => error.code === "binding-artifact-omitted" && error.message.includes("src/lib.rs"),
  );
}));
