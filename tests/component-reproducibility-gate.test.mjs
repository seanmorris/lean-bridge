/**
 * Tests the component reproducibility gate behavior.
 *
 * @file
 */

import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { runComponentReproducibilityGate } from "../src/release/component-reproducibility-gate.mjs";
import { ReproducibilityGateError } from "../src/release/reproducibility-gate.mjs";

const hash = character => character.repeat(64);

const fixture = async () => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-component-gate-test-"));
	const project = join(root, "project");
	const runtime = join(root, "runtime");
	await Promise.all([mkdir(project), mkdir(runtime)]);
	await Promise.all([
		writeFile(join(runtime, "main.mjs"), "export default {};\n")
		, writeFile(join(runtime, "main.wasm"), Buffer.from([0, 97, 115, 109]))
	]);
	return { root, project, runtime, output: join(root, "gate") };
};

const sourcePreparer = async ({ projectRoot }) => ({
	roots: [projectRoot, projectRoot]
	, source: {
		repository: "https://example.invalid/plain-lean-project.git"
		, projectPath: "."
		, revision: hash("1").slice(0, 40)
		, tree: hash("2").slice(0, 40)
	}
});

const fakeBuild = async ({ outputRoot }) => {
	await mkdir(join(outputRoot, "bundle"), { recursive: true });
	await writeFile(join(outputRoot, "bundle", "component.wasm"), Buffer.from([0, 97, 115, 109, 1]));
	return {
		backend: "test"
		, engineIdentitySha256: hash("3")
	};
};

const fakePackage = difference => {
	let call = 0;
	return async ({ outputRoot }) => {
		call += 1;
		await mkdir(outputRoot, { recursive: true });
		await Promise.all([
			writeFile(join(outputRoot, "runtime.tgz"), "runtime")
			, writeFile(join(outputRoot, "component.tgz"), difference && call === 2 ? "changed" : "component")
			, writeFile(join(outputRoot, "component-package-receipt.json"), "{}\n")
		]);
		return {
			output: outputRoot
			, report: {
				component: { id: "plain@1.0.0", name: "plain", version: "1.0.0" }
				, componentIdentitySha256: hash("4")
				, runtime: { package: "@lean-bridge/runtime@1.0.0", archive: "runtime.tgz", sha256: hash("5") }
				, package: { package: "plain@1.0.0", archive: "component.tgz", sha256: hash("6") }
			}
		};
	};
};

const verifyReceipt = async () => ({
	verified: true
	, component: "plain@1.0.0"
	, receiptSha256: hash("7")
	, componentIdentitySha256: hash("4")
	, runtime: "@lean-bridge/runtime@1.0.0"
	, package: "plain@1.0.0"
});

test("a plain component dry run emits an installable byte-identical release", async () => {
  const item = await fixture();
  try
{
    const result = await runComponentReproducibilityGate({
      projectRoot: item.project
      , engineRoot: item.root
      , outputRoot: item.output
      , environment: { LEAN_BRIDGE_RUNTIME_ROOT: item.runtime }
      , build: fakeBuild
      , packageComponent: fakePackage(false)
      , verifyReceipt
      , sourcePreparer
      , now: () => 0
      , targets: ["npm"]
    });
    assert.equal(result.kind, "lean-bridge-component-reproducibility-gate");
    assert.equal(result.result, "passed");
    assert.equal(result.externalRegistryWrites, false);
    assert.equal(result.receipt.verified, true);
    const report = JSON.parse(await readFile(result.report, "utf8"));
    const manifest = JSON.parse(await readFile(result.publishManifest, "utf8"));
    assert.equal(report.result, "passed");
    assert.equal(report.builds.length, 2);
    assert.equal(report.differences.length, 0);
    assert.equal(manifest.kind, "lean-bridge-component-publish-plan");
    assert.equal(manifest.targets[0].package.coordinate, "plain@1.0.0");
    assert.equal(manifest.policy.externalRegistryWritesPerformed, false);
} finally
{
    await rm(item.root, { recursive: true, force: true });
}
});

test("a package byte difference blocks component publication with retained evidence", async () => {
  const item = await fixture();
  try
{
    await assert.rejects(
      runComponentReproducibilityGate({
        projectRoot: item.project
        , engineRoot: item.root
        , outputRoot: item.output
        , environment: { LEAN_BRIDGE_RUNTIME_ROOT: item.runtime }
        , build: fakeBuild
        , packageComponent: fakePackage(true)
        , verifyReceipt
        , sourcePreparer
        , now: () => 0
        , targets: ["npm"]
      }),
      error => error instanceof ReproducibilityGateError && error.code === "release-not-reproducible",
    );
    const report = JSON.parse(await readFile(join(item.output, "evidence", "reproducibility.json"), "utf8"));
    assert.equal(report.result, "failed");
    assert.equal(report.failure.code, "release-not-reproducible");
    assert.equal(report.differences.length, 1);
} finally
{
    await rm(item.root, { recursive: true, force: true });
}
});
