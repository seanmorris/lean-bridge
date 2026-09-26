/**
 * Compiler-produced recursive callables through original offline PHP-Wasm archives.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile, readdir, rm, statfs } from "node:fs/promises";
import { join, resolve } from "node:path";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { buildCanonicalProject } from "../../src/build/canonical-build.mjs";
import { buildPhpWasmCopiedRuntime } from "../../src/build/php-wasm-copied-component.mjs";
import { phpWasmCopiedPins as pins } from "../../src/build/php-wasm-copied-artifacts.mjs";
import { buildPhpWasmCopiedPackages, readVerifiedPhpWasmCopiedPackageSet } from "../../src/release/php-wasm-copied-package.mjs";
import { nativeRecursiveCallableExports, nativeRecursiveCallableArities, nativeRecursiveCallableReviewedIr } from "./native-recursive-callable-fixture.mjs";
import { jvmRecursiveMixedFixture } from "./jvm-recursive-callable-mixed.mjs";
import { lakeInputState, saveLakeFile } from "./lake-workspace.mjs";
import { phpWasmInventory } from "./type-corpus-php-wasm-install.mjs";
import { installPhpWasmGraphPackages } from "./php-wasm-graph-packages.mjs";
import { bundlePhpWasmGraph } from "./php-wasm-graph-browser.mjs";
import { phpWasmRecursiveCallableConsumer } from "./php-wasm-recursive-callable-fixture.mjs";
import { checkPhpWasmRecursiveHosts } from "./php-wasm-recursive-callable-hosts.mjs";
import { phpRecursiveCallableDocumentation } from "./php-recursive-callable-docs.mjs";
import { runCopied } from "./copied-fixture-install.mjs";

/**
 * Check both authors, compiler-free reassembly, every loading path and Chromium.
 *
 * @param directory - Task-owned scratch, removed by the calling test.
 * @param diagnostic - Progress reporter.
 * @param mixed - Include all primitive signatures and sixteen-argument Unit calls.
 */
export const checkPhpWasmRecursivePackages = async (directory, diagnostic = () => {}, mixed = false) => {
	const sdk = resolve(process.env.LEAN_BRIDGE_PHP_EMSDK ?? ".toolchains/emsdk-php-wasm");
	const lean = resolve(process.env.LEAN_BRIDGE_LEAN_PREFIX ?? ".toolchains/elan/toolchains/leanprover--lean4---v4.32.2");
	const host = resolve(process.env.LEAN_BRIDGE_PHP_WASM_HOST ?? "build/php-wasm-host/node_modules/php-wasm");
	const documentation = await phpRecursiveCallableDocumentation();
	const docRoot = join(directory, "documentation");
	await saveLakeFile(docRoot, "Structured.lean", documentation.author);
	const checked = await runCopied(join(lean, "bin/lean"), ["Structured.lean"], docRoot, process.env);
	assert.equal(checked.stdout, ""); assert.equal(checked.stderr, "");
	await rm(docRoot, { recursive: true });
	const fixture = mixed ? await jvmRecursiveMixedFixture(documentation.source) : {
		ir: nativeRecursiveCallableReviewedIr()
		, source: documentation.source
		, exports: nativeRecursiveCallableExports
		, arities: nativeRecursiveCallableArities
	};
	const consumer = await phpWasmRecursiveCallableConsumer();
	const space = await statfs(directory);
	assert.ok(Number(space.bavail) * Number(space.bsize) >= 2 * 1024 ** 3, "PHP-Wasm recursive acceptance needs 2 GiB free");
	diagnostic("Building a fresh callback-aware wasm32 runtime");
	const runtime = await buildPhpWasmCopiedRuntime({
		outputRoot: join(directory, "runtime"), emsdkRoot: sdk
		, leanRuntimeRoot: resolve(process.env.LEAN_BRIDGE_PHP_LEAN_RUNTIME ?? `build/lean-runtime/${pins.leanCommit}-${pins.patchSetSha256}-browser-php-wasm-3.1.68`) });
	const environment = { ...process.env
		, LEAN_BRIDGE_LEAN_PREFIX: lean, LEAN_BRIDGE_PHP_EMSDK: sdk
		, LEAN_BRIDGE_PHP_SOURCE: resolve(process.env.LEAN_BRIDGE_PHP_SOURCE ?? "build/php-wasm-sdk/php8.4-src")
		, LEAN_BRIDGE_PHP_COPIED_RUNTIME: runtime.root };
	delete environment.LEAN_BRIDGE_PHP_INPUTS;
	const observations = [];
	for(const reviewed of [false, true])
	{
		const path = reviewed ? "reviewed" : "ordinary", root = join(directory, path), author = join(root, "author");
		const projectRoot = join(author, "project"), outputRoot = join(author, "release");
		await saveLakeFile(projectRoot, "Structured.lean", fixture.source);
		await saveLakeFile(projectRoot, "lean-toolchain", "leanprover/lean4:v4.32.2\n");
		await saveLakeFile(projectRoot, "lakefile.toml", 'name = "structured"\nversion = "1.0.0"\n[[lean_lib]]\nname = "Structured"\n');
		await saveLakeFile(projectRoot, "lean-bridge.exports.json", canonicalJson({
			schemaVersion: 1, modules: ["Structured"]
			, ...reviewed ? {} : { exports: fixture.exports, arities: fixture.arities }
			, targets: { "php-wasm": { npm: { name: "@lean-bridge-test/recursive-callables", version: "1.0.0" }
				, composer: { name: "lean-bridge-test/recursive-callables", version: "1.0.0" } } } }));
		if(reviewed) await saveLakeFile(projectRoot, "reviewed.binding-ir.json", canonicalJson(fixture.ir));
		const before = await lakeInputState(projectRoot), producerSources = await phpWasmInventory(projectRoot);
		diagnostic(path + ": canonical " + (mixed ? "mixed" : "recursive") + " PHP-Wasm build");
		const built = await buildCanonicalProject({ projectRoot, outputRoot, targets: ["php-wasm"], environment })
			.catch(error => { error.message += ": " + JSON.stringify(error.details); throw error; });
		assert.deepEqual(await lakeInputState(projectRoot), before); assert.deepEqual(built.targets, ["php-wasm"]);
		const packageRoot = join(outputRoot, "packages/php-wasm"), componentRoot = join(outputRoot, "php-wasm/component");
		const verified = await readVerifiedPhpWasmCopiedPackageSet(packageRoot), { model, receipt } = verified;
		assert.equal(model.exports.length, mixed ? 98 : 33); assert.equal(model.copiedGraph.callbacks.length, mixed ? 59 : 18);
		assert.equal(model.pointerBits, 32); assert.equal(model.profile, "php-wasm-copied-v1");
		assert.match(receipt.copiedGraph.callbacksSha256, /^[a-f0-9]{64}$/);
		assert.equal((await readFile(join(componentRoot, receipt.library))).includes(Buffer.from(directory)), false);
		const repeated = await buildPhpWasmCopiedPackages({ componentRoot
			, runtimeRoot: join(outputRoot, "php-wasm/runtime")
			, outputRoot: join(author, "repackaged"), leanPrefix: lean
			, npmSettings: verified.report.npmSettings
			, composerSettings: verified.report.composerSettings });
		assert.deepEqual(repeated.report, verified.report);
		const generated = JSON.parse(await readFile(join(componentRoot, "graph-zend-manifest.json")));
		const metadata = JSON.parse(await readFile(join(componentRoot, "metadata.json")));
		const installed = await installPhpWasmGraphPackages({ root, release: { output: packageRoot, report: verified.report }, host, diagnostic });
		await bundlePhpWasmGraph(installed.deployment, verified.report.npmSettings.name);
		await rm(author, { recursive: true }); await assert.rejects(() => readdir(author), { code: "ENOENT" });
		const consumers = await checkPhpWasmRecursiveHosts({
			deployment: installed.deployment, name: verified.report.npmSettings.name
			, request: { path, mixed, extension: generated.extension }
			, consumer, documentation: documentation.example.source, diagnostic });
		for(const [path, files] of Object.entries(installed.installed))
			assert.deepEqual(await phpWasmInventory(join(installed.deployment, path)), files);
		assert.deepEqual(await phpWasmInventory(join(installed.deployment, "node_modules/php-wasm")), installed.host.files);
		observations.push({ path, reviewed, model, metadata, receipt
			, generatedManifest: generated, producerSources
			, archives: installed.archives, installedFiles: installed.installed
			, npmLock: installed.npmLock
			, composer: installed.composerEvidence, host: installed.host
			, ...consumers
			, sourceSha256: sha256(fixture.source)
			, documentation: { authorSha256: sha256(documentation.author)
				, configurationSha256: sha256(documentation.configuration)
				, consumerSha256: sha256(documentation.example.source)
				, standaloneLeanChecked: true, compiledVerbatim: true }
			, sourceUnchanged: true, authorRemoved: true
			, installedFilesUnchanged: true, compilerFreeReassembly: true
			, deterministicReassembly: true });
		diagnostic(path + ": all original installed archives passed Node and Chromium");
		await rm(root, { recursive: true });
	}
	return { schemaVersion: 1, mixed, compiledLean: true, installedPackage: true
		, runtimeIdentity: runtime.identity, runtimeManifest: runtime.manifest
		, observations };
};
