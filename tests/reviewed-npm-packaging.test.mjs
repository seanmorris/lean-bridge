/**
 * A reviewed npm bundle packages from a project that also holds files outside the compiler's
 * inputs, and its staged source still cannot drift from the captured project.
 *
 * @file
 */
import assert from "node:assert/strict";
import { chmod, cp, mkdtemp, rm, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { buildCanonicalProject } from "../src/build/canonical-build.mjs";
import { buildComponentNpmPackages } from "../src/release/component-npm-package.mjs";
import { verifyComponentPackageReceipt } from "../src/release/component-package-receipt.mjs";
import { canonicalJson } from "../src/capsule/node.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";
import { refinementEngineTransport } from "./helpers/refinement-engine.mjs";
import { reviewedNativeSpecializationIr } from "./helpers/reviewed-native-specialization-fixture.mjs";

const enabled = process.env.LEAN_BRIDGE_REVIEWED_NPM_PACKAGING_TEST === "1";
const engineRoot = process.cwd();
const runtimeRoot = resolve(process.env.LEAN_BRIDGE_LAKE_RUNTIME_ROOT ?? "build/lean-link-spike/lazy");
const fixture = "tests/fixtures/onboarding/native-specializations";
// Ordinary repository files that are not compiler inputs.
const extras = { ".gitignore": "build/\n.lake/\n", "README.md": "# Specialized\n", "docs/notes.md": "Reviewer notes.\n" };

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
	const environment = { ...process.env, LEAN_BRIDGE_BUILD_BACKEND: "nix", LEAN_BRIDGE_RUNTIME_ROOT: runtimeRoot };
	await buildCanonicalProject({ projectRoot, outputRoot, engineRoot, environment, targets: ["npm"], runner: refinementEngineTransport() })
		.catch(error => assert.fail(`${error.message}: ${JSON.stringify(error.details)}`));
	return { directory, bundleRoot: join(outputRoot, "bundle") };
};
const pack = (bundleRoot, directory, name) => buildComponentNpmPackages({ bundleRoot, runtimeRoot, outputRoot: join(directory, name) });

test("a reviewed npm bundle packages when the project also holds files outside the compiler inputs", { skip: !enabled, timeout: 1_800_000 }, async t => {
	const { directory, bundleRoot } = await reviewedBundle(t);
	const release = await pack(bundleRoot, directory, "npm");
	await verifyComponentPackageReceipt({ receiptPath: join(release.output, "component-package-receipt.json") });
});

test("a reviewed npm bundle still refuses a changed or missing staged source input", { skip: !enabled, timeout: 1_800_000 }, async t => {
	const { directory, bundleRoot } = await reviewedBundle(t);
	const staged = join(bundleRoot, "source/Specialized.lean");
	await chmod(staged, 0o644);
	await writeFile(staged, "-- changed after the build\n", { flag: "a" });
	await assert.rejects(() => pack(bundleRoot, directory, "changed"), "a changed staged input");
	const second = await reviewedBundle(t);
	await unlink(join(second.bundleRoot, "source/lakefile.toml"));
	await assert.rejects(() => pack(second.bundleRoot, second.directory, "missing"), "a missing staged input");
});
