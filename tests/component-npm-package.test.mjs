/**
 * Tests the component npm package behavior.
 *
 * @file
 */

import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { access, copyFile, cp, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";
import test from "node:test";

import { analyzeLeanProject } from "../src/analyze/lean-project.mjs";
import { prepareComponentBuildPlan } from "../src/build/component-plan.mjs";
import { generateCompilerAdapters } from "../src/build/compiler-adapters.mjs";
import { prepareComponentCompilationPlan, writeComponentCompilationInputs } from "../src/build/component-compilation-plan.mjs";
import { compileLeanComponentSources } from "../src/build/lean-component-compiler.mjs";
import { linkComponentSideModule } from "../src/build/component-side-linker.mjs";
import { auditComponentSideModule } from "../src/build/side-module-audit.mjs";
import { writeComponentArtifactManifest } from "../src/build/component-artifact-manifest.mjs";
import { buildComponentReleaseBundle } from "../src/release/component-release-bundle.mjs";
import { buildComponentNpmPackages } from "../src/release/component-npm-package.mjs";
import { verifyComponentPackageReceipt } from "../src/release/component-package-receipt.mjs";
import { assertJsonSchema } from "./helpers/json-schema.mjs";

const execute = promisify(execFile);

const list = async root => {
	const files = [];
	const visit = async relative => {
		for(const entry of await readdir(join(root, relative), { withFileTypes: true }))
		{
			const path = relative === "" ? entry.name : `${relative}/${entry.name}`;
			if(entry.isDirectory()) await visit(path);
			else files.push(path);
		}
	};
	await visit("");
	return files.sort();
};

const buildBundle = async (scratch, projectRoot = "tests/fixtures/onboarding/small") => {
	const analysis = await analyzeLeanProject(projectRoot);
	const componentPlan = await prepareComponentBuildPlan({ projectRoot, engineRoot: process.cwd(), targets: ["npm"] });
	const compilerAdapters = generateCompilerAdapters({ analysis, componentPlan });
	const compilationPlan = await prepareComponentCompilationPlan({ projectRoot, analysis, componentPlan, compilerAdapters });
	const inputRoot = join(scratch, "inputs");
	const targetCRoot = join(scratch, "target-c");
	const sideRoot = join(scratch, "side");
	const outputRoot = join(scratch, "bundle");
	await writeComponentCompilationInputs({ projectRoot, outputRoot: inputRoot, analysis, componentPlan, compilerAdapters });
	const compiled = await compileLeanComponentSources({ inputRoot, outputRoot: targetCRoot, engineRoot: process.cwd(), compilationPlan });
	const linked = await linkComponentSideModule({ targetCRoot, outputRoot: sideRoot, engineRoot: process.cwd(), compilationPlan });
	const audited = await auditComponentSideModule({ sideRoot, compilationPlan });
	const componentArtifact = await writeComponentArtifactManifest({ sideRoot, analysis, componentPlan, compilerAdapters, compilationPlan, compiled, linked, audited });
	await buildComponentReleaseBundle({ projectRoot, inputRoot, targetCRoot, sideRoot, outputRoot, analysis, componentPlan, compilerAdapters, compilationPlan, compiled, linked, audited, componentArtifact });
	return outputRoot;
};

test("sealed npm settings and export selection reach the exact installed public API", async t => {
	const scratch = await mkdtemp(join(tmpdir(), "lean-bridge-selected-npm-"));
	t.after(() => rm(scratch, { recursive: true, force: true }));
	const projectRoot = join(scratch, "source");
	await cp("tests/fixtures/onboarding/small", projectRoot, { recursive: true });
	await writeFile(join(projectRoot, "lean-bridge.exports.json"), JSON.stringify({
		schemaVersion: 1, exports: ["OnboardingSmall.add"]
		, targets: { npm: { name: "@example/_math", version: "2.3.4-beta.1" } }
	}));
	const config = await readFile(join(projectRoot, "lean-bridge.exports.json"));
	const bundleRoot = await buildBundle(scratch, projectRoot);
	await rm(projectRoot, { recursive: true });
	const prepared = await buildComponentNpmPackages({ bundleRoot
		, runtimeRoot: "build/lean-link-spike/lazy"
		, outputRoot: join(scratch, "packages") });
	const repeated = await buildComponentNpmPackages({ bundleRoot
		, runtimeRoot: "build/lean-link-spike/lazy"
		, outputRoot: join(scratch, "repeated") });
	assert.deepEqual(prepared.report, repeated.report);
	assert.equal(prepared.report.schemaVersion, 2);
	assert.equal(prepared.report.component.id, "onboarding-small@1.0.0");
	assert.equal(prepared.report.package.package, "@example/_math@2.3.4-beta.1");
	await assertJsonSchema("component-package-receipt-v2", prepared.report);
	await assert.rejects(() => assertJsonSchema("component-package-receipt", prepared.report));
	const metadata = JSON.parse(await readFile(join(prepared.output, "component/package/package.json"), "utf8"));
	assert.equal(metadata.name, "@example/_math");
	assert.equal(metadata.version, "2.3.4-beta.1");
	assert.equal(metadata.leanBridge.component, "onboarding-small@1.0.0");
	assert.equal(metadata.leanBridge.sharedRuntime, true);
	assert.deepEqual(await readFile(join(prepared.output, "component/package/metadata/lean-bridge.exports.json")), config);
	const consumer = join(scratch, "consumer");
	await mkdir(consumer);
	await execute("npm", ["init", "-y"], { cwd: consumer });
	await execute("npm", ["install", "--ignore-scripts", "--no-audit", "--no-fund"
		, prepared.runtimeArchive, prepared.componentArchive], { cwd: consumer });
	await writeFile(join(consumer, "index.mjs"), [
		'import * as library from "@example/_math";'
		, 'console.log(library.add(100n, 23n).toString());'
		, 'console.log(Object.hasOwn(library, "isEmpty"));'
	].join("\n"));
	assert.equal((await execute(process.execPath, ["index.mjs"], { cwd: consumer })).stdout, "123\nfalse\n");
	const receiptPath = join(prepared.output, "component-package-receipt.json");
	const checked = await verifyComponentPackageReceipt({ receiptPath });
	const portable = JSON.parse((await execute(process.execPath, [join(prepared.output, "verify-component-package-receipt.mjs"), "--receipt", receiptPath], { cwd: consumer })).stdout);
	assert.deepEqual(portable, checked);
	const throughCli = JSON.parse((await execute(process.execPath, [resolve("scripts/lean-bridge.mjs"), "verify", "--receipt", receiptPath, "--json"], { cwd: consumer })).stdout);
	assert.deepEqual(throughCli.result, { ...checked, verificationType: "local-npm", authenticated: false });
	await writeFile(join(bundleRoot, "source/lean-bridge.exports.json"), "{}");
	const rejectedOutput = join(scratch, "tampered-bundle-packages");
	await assert.rejects(() => buildComponentNpmPackages({ bundleRoot, runtimeRoot: "build/lean-link-spike/lazy", outputRoot: rejectedOutput }), /differs from its manifest/);
	await assert.rejects(() => access(rejectedOutput), { code: "ENOENT" });
});

test("an external Lean component installs as native callables over one shared runtime package", async () => {
  const scratch = await mkdtemp(join(tmpdir(), "lean-bridge-component-npm-"));
  try
{
    const bundleRoot = await buildBundle(scratch);
    const first = await buildComponentNpmPackages({ bundleRoot, runtimeRoot: "build/lean-link-spike/lazy", outputRoot: join(scratch, "first") });
    const second = await buildComponentNpmPackages({ bundleRoot, runtimeRoot: "build/lean-link-spike/lazy", outputRoot: join(scratch, "second") });
    assert.deepEqual(first.report, second.report);
    assert.equal(first.report.schemaVersion, 1);
    await assertJsonSchema("component-package-receipt", first.report);
    assert.equal(first.report.component.id, "onboarding-small@1.0.0");
    assert.doesNotMatch(JSON.stringify(first.report), /Alpha/);
    assert.deepEqual(await list(first.output), await list(second.output));
    for(const path of await list(first.output))
{
      assert.deepEqual(await readFile(join(first.output, path)), await readFile(join(second.output, path)), path);
}

    const componentRoot = join(first.output, "component/package");
    const runtimeRoot = join(first.output, "runtime/package");
    const componentManifest = JSON.parse(await readFile(join(componentRoot, "package.json"), "utf8"));
    const runtimeManifest = JSON.parse(await readFile(join(runtimeRoot, "package.json"), "utf8"));
    assert.equal(componentManifest.exports["."].browser, "./index.mjs");
    assert.equal(runtimeManifest.exports["."].browser, "./index.mjs");
		const collisionProject = join(scratch, "collision-source");
		await cp("tests/fixtures/onboarding/small", collisionProject, { recursive: true });
		await writeFile(join(collisionProject, "lean-bridge.exports.json"), JSON.stringify({
			schemaVersion: 1
			, targets: { npm: { name: "lean-bridge-runtime", version: runtimeManifest.version } }
		}));
		const collisionBundle = await buildBundle(join(scratch, "collision-build"), collisionProject);
		const collision = await buildComponentNpmPackages({ bundleRoot: collisionBundle, runtimeRoot: "build/lean-link-spike/lazy", outputRoot: join(scratch, "collision-packages") });
		assert.notEqual(collision.report.package.archive, collision.report.runtime.archive);
		assert.match(collision.report.package.archive, /^component-lean-bridge-runtime-/);
		assert.deepEqual(collision.report.runtime, first.report.runtime);
		await verifyComponentPackageReceipt({ receiptPath: join(collision.output, "component-package-receipt.json") });
    const componentFiles = await list(componentRoot);
    assert.equal(componentFiles.filter(path => path.endsWith(".wasm")).length, 1);
    assert.equal(componentFiles.some(path => path.endsWith("main.wasm")), false);
    assert.deepEqual((await list(runtimeRoot)).filter(path => path.endsWith(".wasm")), ["internal/main.wasm"]);
    const publicSource = await readFile(join(componentRoot, "index.mjs"), "utf8");
    assert.doesNotMatch(publicSource, /ccall|cwrap|lean_bridge_|WebAssembly/);
    assert.match(publicSource, /export function add\(/);
    assert.match(publicSource, /export function isEmpty\(/);

    const consumer = join(scratch, "consumer");
    await mkdir(consumer);
    await execute("npm", ["init", "-y"], { cwd: consumer });
    await execute("npm", ["install", "--ignore-scripts", first.runtimeArchive, first.componentArchive], { cwd: consumer });
    const invocation = await execute("node", ["--input-type=module", "-e"
    , [
      'import { add, isEmpty } from "onboarding-small";'
      , 'process.stdout.write(JSON.stringify({ add: String(add(100n, 23n)), empty: isEmpty(""), nonempty: isEmpty("web") }));'
    ].join("\n")], { cwd: consumer });
    assert.deepEqual(JSON.parse(invocation.stdout), { add: "123", empty: true, nonempty: false });
		await copyFile("tests/fixtures/documentation/lean-author-consumer/index.mjs", join(consumer, "index.mjs"));
		const example = await execute(process.execPath, ["index.mjs"], { cwd: consumer });
		assert.equal(example.stdout, "123n\ntrue\nfalse\n");
    const receipt = await verifyComponentPackageReceipt({ receiptPath: join(first.output, "component-package-receipt.json") });
    assert.deepEqual(receipt, {
      verified: true
      , component: "onboarding-small@1.0.0"
      , receiptSha256: receipt.receiptSha256
      , componentIdentitySha256: first.report.componentIdentitySha256
      , runtime: first.report.runtime.package
      , package: "onboarding-small@1.0.0"
    });
    assert.equal(first.report.verificationCommand, "node verify-component-package-receipt.mjs --receipt component-package-receipt.json");
    const portable = JSON.parse((await execute("node", [
      join(first.output, "verify-component-package-receipt.mjs")
      , "--receipt", join(first.output, "component-package-receipt.json")
    ], { cwd: consumer })).stdout);
    assert.deepEqual(portable, receipt);
		const throughCli = JSON.parse((await execute(process.execPath, [
			resolve("scripts/lean-bridge.mjs"), "verify"
			, "--receipt", join(first.output, "component-package-receipt.json"), "--json"
		], { cwd: consumer })).stdout);
		assert.deepEqual(throughCli.result, { ...receipt, verificationType: "local-npm", authenticated: false });

    const schema = JSON.parse(await readFile("schema/component-package-receipt.schema.json", "utf8"));
    assert.equal(schema.additionalProperties, false);
    assert.equal(schema.$defs.component.additionalProperties, false);
    assert.equal(schema.$defs.source.additionalProperties, false);
    assert.equal(schema.$defs.package.additionalProperties, false);
    assert.equal(schema.$defs.policies.additionalProperties, false);
    await writeFile(first.componentArchive, "tampered");
    await assert.rejects(
      execute("node", [
        join(first.output, "verify-component-package-receipt.mjs")
        , "--receipt", join(first.output, "component-package-receipt.json")
      ], { cwd: consumer }),
      /package archive differs from the receipt/,
    );
		await writeFile(join(bundleRoot, "source/lean-bridge.exports.json"), JSON.stringify({ schemaVersion: 1, targets: { npm: { name: "unsealed-name" } } }));
		const rejectedOutput = join(scratch, "unsealed-packages");
		await assert.rejects(() => buildComponentNpmPackages({ bundleRoot, runtimeRoot: "build/lean-link-spike/lazy", outputRoot: rejectedOutput }), { code: "export-configuration-drift" });
		await assert.rejects(() => access(rejectedOutput), { code: "ENOENT" });
} finally
{
    await rm(scratch, { recursive: true, force: true });
}
});
