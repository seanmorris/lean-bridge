/**
 * Tests the PyPI package behavior.
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

import {
	canonicalPackageManifestJson,
	hashCanonicalPackageManifest,
	parseCanonicalPackageManifest,
} from "../src/release/canonical-package-manifest.mjs";
import { buildPyPiPackage } from "../src/release/pypi-package.mjs";
import { buildUniversalReleaseBundle } from "../src/release/universal-release-bundle.mjs";

const execute = promisify(execFile);
const revision = "d95de399beb69b6a92d132b38f6813342ecce9f5";

const withBundle = async operation => {
	const scratch = await mkdtemp(join(tmpdir(), "lean-bridge-pypi-package-"));
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
	await writeFile(join(directory, "canonical-package.json"), `${canonicalPackageManifestJson(manifest)}\n`);
	await writeFile(join(directory, "canonical-package.sha256"), `${manifestSha256}  canonical-package.json\n`);
	const identityPath = join(directory, "bundle-identity.json");
	const identity = JSON.parse(await readFile(identityPath, "utf8"));
	identity.canonicalManifestSha256 = manifestSha256;
	await writeFile(identityPath, `${JSON.stringify(identity, null, 2)}\n`);
};

const enableReviewedPythonBindingTarget = async (bundle, destination) => {
	await cp(bundle, destination, { recursive: true });
	const manifest = structuredClone(parseCanonicalPackageManifest(
		await readFile(join(destination, "canonical-package.json"), "utf8"),
	));
	const pythonArtifacts = manifest.artifacts.filter(artifact => artifact.path.startsWith("bindings/python/"));
	pythonArtifacts.forEach(artifact => { artifact.target = "python-bindings"; });
	manifest.targets.push({
		id: "python-bindings"
		, eligible: true
		, reason: null
		, platforms: ["python3"]
		, capabilities: ["external-runtime-adapter", "pure-python-bindings", "typed-bindings"]
		, entryPoints: [
			{ name: "library", kind: "library", artifact: pythonArtifacts.find(artifact => artifact.path.endsWith("lean_alpha/__init__.py")).id }
			, { name: "types", kind: "types", artifact: "binding-ir" }
			, { name: "documentation", kind: "documentation", artifact: pythonArtifacts.find(artifact => artifact.path.endsWith("README.md")).id }
		]
	});
	const mapping = manifest.packages.find(candidate => candidate.ecosystem === "pypi");
	mapping.target = "python-bindings";
	mapping.eligible = true;
	mapping.reason = null;
	mapping.publicArtifacts = [
		...pythonArtifacts.map(artifact => artifact.id)
		, "license"
		, "assurance"
		, "core-artifact-set"
		, "sbom"
		, "provenance"
	];
	await rewriteIdentity(destination, manifest);
};

test("PyPI projection fails closed while the canonical native target is ineligible", async () => withBundle(async ({ scratch, bundle }) => {
  await assert.rejects(
    buildPyPiPackage({ bundleRoot: bundle, outputRoot: join(scratch, "pypi") }),
    error => error.code === "package-ineligible" && /no native component library or Python extension adapter/.test(error.message),
  );
}));

test("an eligible Python binding target produces deterministic wheel and source archives", async () => withBundle(async ({ scratch, bundle }) => {
  const eligible = join(scratch, "eligible");
  await enableReviewedPythonBindingTarget(bundle, eligible);
  const first = await buildPyPiPackage({ bundleRoot: eligible, outputRoot: join(scratch, "first") });
  const second = await buildPyPiPackage({ bundleRoot: eligible, outputRoot: join(scratch, "second") });
  assert.equal(first.tag, "py3-none-any");
  assert.equal(first.wheelSha256, second.wheelSha256);
  assert.equal(first.sdistSha256, second.sdistSha256);
  assert.deepEqual(await readFile(first.wheel), await readFile(second.wheel));
  assert.deepEqual(await readFile(first.sdist), await readFile(second.sdist));
  assert.deepEqual(first.coreArtifacts, []);

  const plan = JSON.parse(await readFile(join(scratch, "first/pypi-projection.json"), "utf8"));
  assert.equal(plan.compilerAccess, false);
  assert.equal(plan.scriptPolicy, "disabled");
  assert.equal(plan.commands.some(command => /python|pip|lean|emcc/.test(command)), false);
  const { stdout: wheelFiles } = await execute("python3", ["-m", "zipfile", "-l", first.wheel]);
  assert.match(wheelFiles, /lean_alpha\/__init__\.pyi/);
  assert.match(wheelFiles, /lean_bridge_alpha-0\.0\.0\.dist-info\/RECORD/);
  const { stdout: sourceFiles } = await execute("tar", ["-tzf", first.sdist]);
  assert.match(sourceFiles, /^lean_bridge_alpha-0\.0\.0\/pyproject\.toml$/m);
  assert.match(sourceFiles, /^lean_bridge_alpha-0\.0\.0\/lean_alpha\/lean_bridge\/metadata\/provenance\.intoto\.json$/m);

  const installed = join(scratch, "installed");
  await execute("python3", ["-m", "pip", "install", "--no-index", "--no-deps", "--target", installed, first.wheel]);
  const { stdout } = await execute("python3", ["-B", "-c"
  , [
    "from lean_alpha import Payload"
    , "value = Payload(True, 7, 'typed', bytearray([0, 255]), [1, 2])"
    , "assert value.bytes == bytes([0, 255])"
    , "assert value.values == (1, 2)"
    , "print(value.count)"
  ].join("; ")], { env: { ...process.env, PYTHONPATH: installed } });
  assert.equal(stdout.trim(), "7");
}));

test("PyPI projection requires a reviewed wheel tag and every generated Python file", async () => withBundle(async ({ scratch, bundle }) => {
  const eligible = join(scratch, "eligible");
  await enableReviewedPythonBindingTarget(bundle, eligible);
  let manifest = structuredClone(parseCanonicalPackageManifest(
    await readFile(join(eligible, "canonical-package.json"), "utf8"),
  ));
  const target = manifest.targets.find(candidate => candidate.id === "python-bindings");
  target.capabilities = target.capabilities.filter(capability => capability !== "pure-python-bindings");
  await rewriteIdentity(eligible, manifest);
  await assert.rejects(
    buildPyPiPackage({ bundleRoot: eligible, outputRoot: join(scratch, "missing-tag") }),
    error => error.code === "wheel-tag-absent",
  );

  target.capabilities.push("pure-python-bindings");
  const mapping = manifest.packages.find(candidate => candidate.ecosystem === "pypi");
  const omitted = manifest.artifacts.find(artifact => artifact.path === "bindings/python/lean_alpha/__init__.pyi");
  mapping.publicArtifacts = mapping.publicArtifacts.filter(id => id !== omitted.id);
  await rewriteIdentity(eligible, manifest);
  await assert.rejects(
    buildPyPiPackage({ bundleRoot: eligible, outputRoot: join(scratch, "omitted") }),
    error => error.code === "binding-artifact-omitted" && error.message.includes("__init__.pyi"),
  );
}));
