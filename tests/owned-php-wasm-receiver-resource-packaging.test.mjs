/**
 * Install receiver-only releases without callback transport or result anchors.
 *
 * @file
 */
import assert from "node:assert/strict";
import { cp, mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { buildPhpWasmCopiedComponent } from "../src/build/php-wasm-copied-component.mjs";
import { readVerifiedPhpWasmCopiedComponent } from "../src/build/php-wasm-copied-artifacts.mjs";
import { buildPhpWasmCopiedPackages, readVerifiedPhpWasmCopiedPackageSet } from "../src/release/php-wasm-copied-package.mjs";
import { ownedJvmPlainReceiverConfiguration, ownedJvmPlainReceiverReviewedIr, ownedJvmPlainReceiverSource } from "./helpers/owned-jvm-receiver-fixture.mjs";
import { ownedPhpPlainInstalledReceiverProbe } from "./helpers/owned-php-receiver-fixture.mjs";
import { prepareOwnedPhpWasmRuntime } from "./helpers/owned-php-wasm-runtime.mjs";
import { buildOwnedPhpWasmObserver } from "./helpers/owned-php-wasm-observer.mjs";
import { ownedPhpWasmInstalledHost } from "./helpers/owned-php-wasm-packages.mjs";
import { checkOwnedPhpWasmBrowser } from "./helpers/owned-php-wasm-browser.mjs";
import { installPhpWasmGraphPackages } from "./helpers/php-wasm-graph-packages.mjs";
import { bundlePhpWasmGraph } from "./helpers/php-wasm-graph-browser.mjs";
import { copiedCleanEnvironment, runCopied } from "./helpers/copied-fixture-install.mjs";
import { phpWasmInventory } from "./helpers/type-corpus-php-wasm-install.mjs";
import { lakeInputState, saveLakeFile } from "./helpers/lake-workspace.mjs";

for(const mode of ["ordinary", "reviewed"])
	test(`source-free PHP-Wasm resource receivers (${mode})`, {
		skip: process.env.LEAN_BRIDGE_OWNED_PHP_WASM_RECEIVER_TEST !== "1"
		, timeout: 1800000
	}, async t => {
		const directory = await mkdtemp(join(tmpdir(), "lean-php-wasm-resource-receivers-installed-"));
		t.after(() => rm(directory, { recursive: true, force: true }));
		const diagnostic = message => { t.diagnostic(message); process.stderr.write(mode + ": " + message + "\n"); };
		const author = join(directory, "author"), projectRoot = join(author, "project");
		const componentRoot = join(author, "component"), releaseRoot = join(author, "packages");
		const runtime = await prepareOwnedPhpWasmRuntime(directory), runtimeRoot = runtime.root;
		const consuming = mode === "reviewed";
		const leanPrefix = resolve(process.env.LEAN_BRIDGE_LEAN_PREFIX ?? ".toolchains/elan/toolchains/leanprover--lean4---v4.32.2");
		const emsdkRoot = resolve(process.env.LEAN_BRIDGE_PHP_EMSDK ?? ".toolchains/emsdk-php-wasm");
		const phpSource = resolve(process.env.LEAN_BRIDGE_PHP_SOURCE ?? "build/php-wasm-sdk/php8.4-src");
		const host = resolve(process.env.LEAN_BRIDGE_PHP_WASM_HOST ?? "build/php-wasm-host/node_modules/php-wasm");
		for(const path of ["Owned.lean", "lakefile.toml", "lean-toolchain"])
			await saveLakeFile(projectRoot, path, await readFile(join("tests/fixtures/onboarding/owned-aggregates", path), "utf8")
				+ (path === "Owned.lean" ? ownedJvmPlainReceiverSource : ""));
		const configuration = await ownedJvmPlainReceiverConfiguration(consuming, mode === "reviewed");
		delete configuration.targets;
		await saveLakeFile(projectRoot, "lean-bridge.exports.json", canonicalJson(configuration));
		if(mode === "reviewed") await saveLakeFile(projectRoot, "reviewed.binding-ir.json", canonicalJson(ownedJvmPlainReceiverReviewedIr(consuming)));
		const before = await lakeInputState(projectRoot);
		const compile = (projectRoot, outputRoot) => buildPhpWasmCopiedComponent({
			projectRoot, outputRoot
			, leanPrefix, runtimeRoot, emsdkRoot, phpSource
			, receiverExports: true, hostCallbacks: false
			, anchoredResults: false, transferredInputs: consuming });
		diagnostic("compile the callback-free release through the PHP-Wasm build API");
		await compile(projectRoot, componentRoot);
		const { model, receipt } = await readVerifiedPhpWasmCopiedComponent(componentRoot, runtime.identity);
		assert.equal(model.ownedGraph.hostCallbacks, undefined);
		assert.equal(model.ownedGraph.resultAnchors, undefined);
		assert.equal(model.ownedGraph.receiverExports.exports.length, consuming ? 4 : 3);
		const metadata = JSON.parse(await readFile(join(componentRoot, "metadata.json"), "utf8"));
		const npmSettings = { name: "@lean-bridge-test/owned-php-wasm", version: "1.0.0" };
		const composerSettings = { name: "lean-bridge-test/owned-php-wasm", version: "1.0.0" };
		const pack = (componentRoot, outputRoot) => buildPhpWasmCopiedPackages({
			componentRoot, outputRoot
			, runtimeRoot, leanPrefix, npmSettings, composerSettings });
		const release = await pack(componentRoot, releaseRoot);
		const reassembled = await pack(componentRoot, join(author, "reassembled"));
		assert.deepEqual(reassembled.report, release.report);
		const repeatedProject = join(author, "relocated-project"), repeatedRoot = join(author, "repeated");
		await cp(projectRoot, repeatedProject, { recursive: true });
		const repeatedBefore = await lakeInputState(repeatedProject);
		diagnostic("rebuild independently from relocated source");
		await compile(repeatedProject, repeatedRoot);
		assert.deepEqual(await lakeInputState(projectRoot), before);
		assert.deepEqual(await lakeInputState(repeatedProject), repeatedBefore);
		const repeated = await pack(repeatedRoot, join(author, "repeated-packages"));
		assert.deepEqual(repeated.report, release.report);
		const observer = await buildOwnedPhpWasmObserver({ directory: join(author, "observer"), runtimeRoot, emsdkRoot, phpSource });
		const handoff = join(directory, "handoff"); await cp(releaseRoot, handoff, { recursive: true });
		await rm(author, { recursive: true }); await assert.rejects(readdir(author), { code: "ENOENT" });
		assert.deepEqual((await readVerifiedPhpWasmCopiedPackageSet(handoff)).report, release.report);
		const installed = await installPhpWasmGraphPackages({ root: directory, release: { ...release, output: handoff }, host, diagnostic });
		installed.inventory = await phpWasmInventory(installed.deployment);
		await rm(handoff, { recursive: true }); await assert.rejects(readdir(handoff), { code: "ENOENT" });
		await saveLakeFile(installed.deployment, "observer.so", observer.bytes);
		await bundlePhpWasmGraph(installed.deployment, npmSettings.name);
		const consumer = ownedPhpPlainInstalledReceiverProbe(consuming)
			.replace("require __DIR__ . '/vendor/autoload.php';", "// The host loads the installed public autoloader.")
			.replace("'ordinaryAutoload' => true", "'ordinaryAutoload' => true, 'phpBits' => PHP_INT_SIZE * 8");
		const runner = ownedPhpWasmInstalledHost(npmSettings.name, true);
		await saveLakeFile(installed.deployment, "consumer.php", consumer);
		await saveLakeFile(installed.deployment, "run.mjs", runner);
		const expected = { checks: consuming ? 26 : 25, ordinaryAutoload: true, phpBits: 32 };
		const executions = [];
		for(const arrangement of ["embedded", "composer"])
		for(const loading of ["startup", "lazy"])
		for(const strict of [0, 1])
		{
			diagnostic(`installed ${arrangement}/${loading}/strict${strict}`);
			const result = await runCopied(process.execPath, ["run.mjs", arrangement, loading, String(strict)], installed.deployment, copiedCleanEnvironment);
			assert.equal(result.stderr, ""); const observed = JSON.parse(result.stdout);
			for(const [key, value] of Object.entries(expected)) assert.deepEqual(observed.observed[key], value, key);
			assert.equal(observed.cleaned.liveIdentities, 0); assert.equal(observed.refreshed.liveIdentities, 0);
			executions.push(observed);
		}
		const browser = await checkOwnedPhpWasmBrowser(installed.deployment, diagnostic, expected, { anchoredResults: true, minimumChecks: expected.checks });
		const report = { schemaVersion: 1, mode, consuming
			, profile: "installed-owned-php-wasm-resource-receivers"
			, compiledLean: true, installedPackage: true, installedCli: false
			, producerInterface: "php-wasm-build-api"
			, hostCallbacks: false, resultAnchors: false
			, runtimeIdentity: runtime.identity, runtimeManifest: runtime.manifest
			, model, receipt, metadata, packageReceipt: release.report
			, independentBuild: true, reproducedArchives: repeated.report.archives
			, sourceUnchanged: true, deterministicReassembly: true
			, sourceFreeInstallation: true, authorRemoved: true, handoffRemoved: true
			, receiptVerifiedWithoutProducer: true, installed
			, observer: observer.identity
			, consumerSha256: sha256(consumer), runnerSha256: sha256(runner)
			, executions, browser };
		await saveLakeFile("build/owned-php-wasm-receivers", `${mode}-resource-package.json`, canonicalJson(report));
	});
