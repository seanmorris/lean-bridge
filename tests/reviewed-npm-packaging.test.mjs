/**
 * A reviewed npm bundle packages from a project that also holds files outside the compiler's
 * inputs, and its staged source still cannot drift from the authenticated project snapshot.
 *
 * @file
 */
import assert from "node:assert/strict";
import { chmod, cp, mkdtemp, readFile, rm, stat, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { buildCanonicalProject } from "../src/build/canonical-build.mjs";
import { buildComponentNpmPackages } from "../src/release/component-npm-package.mjs";
import { verifyComponentPackageReceipt } from "../src/release/component-package-receipt.mjs";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";
import { refinementEngineTransport } from "./helpers/refinement-engine.mjs";
import { reviewedNativeSpecializationIr } from "./helpers/reviewed-native-specialization-fixture.mjs";
import "./helpers/reviewed-npm-snapshot-source-history-tests.mjs";

const enabled = process.env.LEAN_BRIDGE_REVIEWED_NPM_PACKAGING_TEST === "1";
const engineRoot = process.cwd();
const runtimeRoot = resolve(process.env.LEAN_BRIDGE_LAKE_RUNTIME_ROOT ?? "build/lean-link-spike/lazy");
const fixture = "tests/fixtures/onboarding/native-specializations";
// Ordinary repository files that are not compiler inputs, beside a license notice that is.
const extras = { ".gitignore": "build/\n.lake/\n", "README.md": "# Specialized\n", "docs/notes.md": "Reviewer notes.\n", LICENSE: "MIT License\n" };

const packagingGate = "          LEAN_BRIDGE_REVIEWED_NPM_PACKAGING_TEST=1 node --test --test-concurrency=1 tests/reviewed-npm-packaging.test.mjs\n";
const lockedStep = "      - name: Compile locked and dependency-free projects and install relocated npm releases offline\n";
const assertPackagingGate = workflow => {
	assert.equal(workflow.split(lockedStep).length, 2);
	const rest = workflow.slice(workflow.indexOf(lockedStep) + lockedStep.length);
	const step = rest.slice(0, rest.indexOf("      - name:"));
	assert.equal(workflow.split(packagingGate).length, 2);
	assert.ok(step.includes(packagingGate));
	assert.ok(step.includes("          LEAN_BRIDGE_LAKE_ENGINE: build/locked-lake-engine/bin/lean-bridge-component-engine\n"));
	assert.ok(step.includes("          LEAN_BRIDGE_LAKE_RUNTIME_ROOT: build/consumer-ci-runtime/lazy\n"));
	assert.ok(step.indexOf("          nix build .#component-build-engine --out-link build/locked-lake-engine\n") >= 0);
	assert.ok(step.indexOf("          nix build .#component-build-engine --out-link build/locked-lake-engine\n") < step.indexOf(packagingGate));
	assert.doesNotMatch(step, /continue-on-error:|\bif:|set \+e|\|\|\s*(?:true|:)/u);
};

test("CI executes the reviewed npm snapshot regression through the locked engine", async () => {
	const workflow = await readFile(".github/workflows/consumer-matrix.yml", "utf8");
	assertPackagingGate(workflow);
	const changes = [
		value => value.replace(packagingGate, "")
		, value => value.replace(packagingGate, packagingGate.replace("TEST=1", "TEST=0"))
		, value => value.replace(packagingGate, packagingGate.replace(" --test-concurrency=1", ""))
		, value => value.replace(packagingGate, packagingGate.replace(" node --test ", " node --test --test-name-pattern=missing "))
		, value => value.replace(packagingGate, packagingGate.trimEnd() + " || true\n")
		, value => value.replace(lockedStep, lockedStep + "        continue-on-error: true\n")
		, value => value.replace("          LEAN_BRIDGE_LAKE_ENGINE: build/locked-lake-engine/bin/lean-bridge-component-engine\n", "")
		, value => value.replace("          LEAN_BRIDGE_LAKE_RUNTIME_ROOT: build/consumer-ci-runtime/lazy\n", "")
		, value => value.replace(packagingGate, "").replace(lockedStep, packagingGate + lockedStep)
	];
	for(const change of changes) assert.throws(() => assertPackagingGate(change(workflow)));
});

/**
 * Build the reviewed fixture with extra project files and return its bundle.
 *
 * @param t - Test context.
 */
const reviewedBundle = async t => {
	const directory = await mkdtemp(join(tmpdir(), "lean-bridge-reviewed-npm-packaging-"));
	t.after(() => rm(directory, { recursive: true, force: true }));
	const projectRoot = join(directory, "project"), outputRoot = join(directory, "build");
	await cp(fixture, projectRoot, { recursive: true });
	await saveLakeFile(projectRoot, "lean-bridge.exports.json", canonicalJson({ schemaVersion: 1, modules: ["Specialized"] }));
	await saveLakeFile(projectRoot, "api.binding-ir.json", canonicalJson(reviewedNativeSpecializationIr()));
	for(const [path, contents] of Object.entries(extras)) await saveLakeFile(projectRoot, path, contents);
	// An executable helper keeps its mode in the captured snapshot.
	await saveLakeFile(projectRoot, "tools/check.sh", "#!/bin/sh\nexit 0\n");
	await chmod(join(projectRoot, "tools/check.sh"), 0o755);
	const environment = { ...process.env, LEAN_BRIDGE_BUILD_BACKEND: "nix", LEAN_BRIDGE_RUNTIME_ROOT: runtimeRoot };
	await buildCanonicalProject({ projectRoot, outputRoot, engineRoot, environment, targets: ["npm"], runner: refinementEngineTransport() })
		.catch(error => assert.fail(`${error.message}: ${JSON.stringify(error.details)}`));
	return { directory, bundleRoot: join(outputRoot, "bundle") };
};
const pack = (bundleRoot, directory, name) => buildComponentNpmPackages({ bundleRoot, runtimeRoot, outputRoot: join(directory, name) });

/**
 * Change one bundle file and refresh the outer manifest, so only the inner source and snapshot
 * identities can still refuse it.
 *
 * @param bundleRoot - Built bundle.
 * @param path - Bundle-relative path.
 * @param contents - New bytes, or null to remove the file.
 */
const tamper = async (bundleRoot, path, contents) => {
	const manifestPath = join(bundleRoot, "component-release-bundle.json");
	const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
	const target = join(bundleRoot, path);
	await chmod(target, 0o644).catch(error => { if(error.code !== "ENOENT") throw error; });
	if(contents === null)
	{
		await unlink(target);
		manifest.files = manifest.files.filter(item => item.path !== path);
	}
	else
	{
		await writeFile(target, contents);
		const bytes = Buffer.from(contents), entry = manifest.files.find(item => item.path === path);
		if(entry) Object.assign(entry, { bytes: bytes.length, sha256: sha256(bytes) });
		else
		{
			const mediaType = path.endsWith(".lean") ? "text/x-lean" : path.endsWith(".json") ? "application/json" : "text/plain";
			manifest.files = [...manifest.files, { bytes: bytes.length, mediaType, path, role: "source", sha256: sha256(bytes) }].sort((a, b) => a.path < b.path ? -1 : 1);
		}
	}
	// The outer identity is only a digest of the file list, so a refreshed manifest can always restate it.
	manifest.identitySha256 = sha256(canonicalJson(manifest.files));
	await chmod(manifestPath, 0o644);
	await writeFile(manifestPath, canonicalJson(manifest));
};

test("a reviewed npm bundle packages when the project also holds files outside the compiler inputs", { skip: !enabled, timeout: 1_800_000 }, async t => {
	const { directory, bundleRoot } = await reviewedBundle(t);
	// The complete snapshot keeps every project file and mode; source/ keeps only compiler inputs.
	assert.equal((await stat(join(bundleRoot, "lake/root/tools/check.sh"))).mode & 0o777, 0o755);
	await assert.rejects(stat(join(bundleRoot, "source/README.md")), { code: "ENOENT" });
	assert.equal(await readFile(join(bundleRoot, "source/LICENSE"), "utf8"), extras.LICENSE);
	const release = await pack(bundleRoot, directory, "npm");
	await verifyComponentPackageReceipt({ receiptPath: join(release.output, "component-package-receipt.json") });
});

test("a reviewed npm bundle refuses changed, missing or extra inputs even with a refreshed outer manifest", { skip: !enabled, timeout: 3_600_000 }, async t => {
	const source = /source differs from its captured project inputs/u;
	const cases = [
		["a changed Lean source", "source/Specialized.lean", "-- changed\n", source]
		, ["a missing Lake file", "source/lakefile.toml", null, source]
		, ["an extra Lean source", "source/Extra.lean", "def extra : Nat := 1\n", source]
		, ["a changed review", "source/api.binding-ir.json", "{}", source]
		, ["a changed export configuration", "source/lean-bridge.exports.json", "{\"schemaVersion\":1,\"modules\":[\"Other\"]}", source]
		, ["a changed license notice", "source/LICENSE", "Changed License\n", source]
		, ["a changed non-input snapshot file", "lake/root/README.md", "# Changed\n", /Snapshot files differ from the authorized identity/u]
		, ["a changed snapshot input", "lake/root/Specialized.lean", "-- changed\n", /Snapshot files differ from the authorized identity/u]];
	for(const [label, path, contents, expected] of cases)
	{
		const { directory, bundleRoot } = await reviewedBundle(t);
		await tamper(bundleRoot, path, contents);
		await assert.rejects(() => pack(bundleRoot, directory, "tampered"), error => {
			assert.match(error.message, expected, label);
			return true;
		}, label);
	}
	// A dropped executable bit is a snapshot change the outer manifest cannot hide.
	const { directory, bundleRoot } = await reviewedBundle(t);
	await chmod(join(bundleRoot, "lake/root/tools/check.sh"), 0o644);
	await assert.rejects(() => pack(bundleRoot, directory, "mode"), /Snapshot files differ from the authorized identity/u);
});
