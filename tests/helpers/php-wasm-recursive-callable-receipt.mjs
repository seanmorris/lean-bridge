/**
 * Authenticate original recursive callback packages and installed wasm32 callers.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { createCompiledPhpWasmModel, generateCompiledPhpWasmLeanAdapters } from "../../src/build/php-wasm-graph-model.mjs";
import { generateCompiledPhpWasmGraph } from "../../src/build/php-wasm-graph-component.mjs";
import { phpWasmCopiedPins } from "../../src/build/php-wasm-copied-artifacts.mjs";
import { bundledBrickMath, brickMathSources } from "../../src/backends/php/brick-math.mjs";
import { phpRecursiveCallableDocumentation } from "./php-recursive-callable-docs.mjs";
import { jvmRecursiveMixedFixture } from "./jvm-recursive-callable-mixed.mjs";
import { phpWasmRecursiveCallableConsumer } from "./php-wasm-recursive-callable-fixture.mjs";
import { phpWasmRecursiveNodeSource, phpWasmRecursiveBrowserSource } from "./php-wasm-recursive-callable-hosts.mjs";
import { phpWasmRecursiveShapes } from "./php-wasm-recursive-callable-probes.mjs";

const identity = source => ({ bytes: Buffer.byteLength(source), sha256: sha256(source) });
const hash = digest => assert.match(digest, /^[a-f0-9]{64}$/u);
const inventory = files => {
	assert.ok(Object.keys(files).length > 0);
	for(const [path, file] of Object.entries(files))
	{
		assert.ok(!path.startsWith("/") && path.split("/").every(part => part && part !== "." && part !== ".."));
		hash(file.sha256); assert.ok(Number.isSafeInteger(file.bytes) && file.bytes >= 0);
	}
};
const modes = ["startup", "lazy"].flatMap(loading => ["weak", "strict"].map(mode => [loading, mode]));
const observed = (item, mixed, libraries) => {
	assert.deepEqual(item.observed, {
		actualPhpBits: 32, checks: mixed ? 1249 : 1130
		, compiledLean: true, exports: mixed ? 98 : 33, fiberStartAvailable: false
		, installedPackage: true, primitiveChecks: mixed ? 119 : 0
		, publicApiOnly: true
		, rejections: 388, seeds: 6, shapes: phpWasmRecursiveShapes });
	assert.equal(item.repeatedRequests, 20); assert.equal(item.invalidStayedCold, true);
	assert.deepEqual(item.phases.map(phase => phase.stage), ["ready", "autoload", "invalid", "complete"]);
	for(const [index, phase] of item.phases.entries())
		assert.deepEqual([...phase.libraries].sort(), item.loading === "lazy" && index < 3 ? [] : libraries);
	if(item.arrangement === "composer") assert.deepEqual(item.documentation, { verbatim: true, stdout: "42\n20\n42\n" });
	else assert.equal(item.documentation, undefined);
};

/**
 * Reconstruct metadata and every generated adapter, including browser asset use.
 *
 * @param report - Original offline installation report for both authoring paths.
 * @param mixed - Whether all primitive and sixteen-argument signatures are included.
 */
export const assertPhpWasmRecursivePackages = async (report, mixed = false) => {
	assert.equal(report.schemaVersion, 1); assert.equal(report.mixed, mixed);
	assert.equal(report.compiledLean, true); assert.equal(report.installedPackage, true);
	assert.equal(report.runtimeIdentity, sha256(canonicalJson(report.runtimeManifest)));
	assert.deepEqual(report.runtimeManifest.pins, phpWasmCopiedPins); assert.equal(report.runtimeManifest.pointerBits, 32);
	inventory(report.runtimeManifest.files);
	assert.deepEqual(report.observations.map(run => [run.path, run.reviewed]), [["ordinary", false], ["reviewed", true]]);
	const documentation = await phpRecursiveCallableDocumentation();
	const source = mixed ? (await jvmRecursiveMixedFixture(documentation.source)).source : documentation.source;
	const consumer = await phpWasmRecursiveCallableConsumer();
	const common = await readFile("tests/fixtures/structured-callable-consumers/php-wasm-recursive-host.mjs", "utf8");
	for(const run of report.observations)
	{
		for(const key of ["sourceUnchanged", "authorRemoved", "installedFilesUnchanged", "compilerFreeReassembly", "deterministicReassembly"]) assert.equal(run[key], true, key);
		assert.equal(run.sourceSha256, sha256(source)); assert.deepEqual(run.producerSources["Structured.lean"], identity(source));
		inventory(run.producerSources);
		assert.deepEqual(run.documentation, {
			authorSha256: sha256(documentation.author)
			, configurationSha256: sha256(documentation.configuration)
			, consumerSha256: sha256(documentation.example.source)
			, standaloneLeanChecked: true, compiledVerbatim: true });
		const { model, metadata, receipt } = run;
		assert.deepEqual(model, createCompiledPhpWasmModel({ metadata, component: model.component, sourceIdentity: receipt.sourceIdentity }));
		assert.equal(model.schemaVersion, run.reviewed ? 5 : 4); assert.equal(model.pointerBits, 32);
		assert.equal(model.exports.length, mixed ? 98 : 33); assert.equal(model.copiedGraph.callbacks.length, mixed ? 59 : 18);
		assert.equal(receipt.runtimeIdentity, report.runtimeIdentity);
		assert.equal(receipt.modelSha256, sha256(canonicalJson(model))); assert.equal(receipt.metadataSha256, sha256(canonicalJson(metadata)));
		assert.equal(receipt.bindingIrSha256, model.bindingIrSha256);
		assert.deepEqual(run.producerSources["lean-bridge.exports.json"], identity(receipt.sourceIdentity.exportConfigurationSource));
		assert.equal(receipt.sourceIdentity.exportConfigurationSha256, run.producerSources["lean-bridge.exports.json"].sha256);
		assert.equal(receipt.sourceIdentity.modules[0].source.sha256, sha256(source));
		const adapters = generateCompiledPhpWasmLeanAdapters(model), graph = generateCompiledPhpWasmGraph(model, adapters);
		assert.deepEqual(receipt.copiedGraph, graph.receipt); assert.deepEqual(run.generatedManifest, graph.manifest);
		assert.equal(receipt.headerSha256, sha256(adapters.header)); assert.equal(receipt.adaptersSha256, sha256(adapters.leanSource));
		assert.equal(receipt.zendSha256, sha256(graph.files[graph.zendManifestPath]));
		assert.deepEqual(receipt.exports, graph.manifest.exports);
		assert.deepEqual(run.archives.map(item => [item.ecosystem, item.role]), [["npm", "runtime"], ["npm", "component"], ["composer", "api"]]);
		for(const archive of run.archives)
		{
			hash(archive.sha256); assert.ok(Number.isSafeInteger(archive.bytes) && archive.bytes > 1000);
			assert.equal(basename(archive.archive), archive.archive);
			assert.ok(archive.archive.endsWith(archive.ecosystem === "npm" ? ".tgz" : ".zip"));
		}
		const [runtimeArchive, npmArchive, composerArchive] = run.archives;
		assert.equal(runtimeArchive.name, "@lean-bridge/php-wasm-copied-runtime");
		assert.equal(npmArchive.name, "@lean-bridge-test/recursive-callables"); assert.equal(npmArchive.version, "1.0.0");
		assert.equal(composerArchive.name, "lean-bridge-test/recursive-callables"); assert.equal(composerArchive.version, "1.0.0");
		const npm = `node_modules/${npmArchive.name}`, composer = `vendor/${composerArchive.name}`, runtime = `node_modules/${runtimeArchive.name}`;
		assert.deepEqual(Object.keys(run.installedFiles).sort(), [npm, composer, runtime].sort());
		for(const files of Object.values(run.installedFiles)) inventory(files);
		const generatedSources = {
			...graph.files, "component.h": adapters.header
			, "generated.lean": adapters.leanSource
			, "model.json": canonicalJson(model)
			, "metadata.json": canonicalJson(metadata)
			, "binding-ir.json": canonicalJson(model.bindingIr)
			, "php-wasm-component.json": canonicalJson(receipt) };
		for(const [path, text] of Object.entries(generatedSources))
		{
			assert.deepEqual(run.installedFiles[npm][`compiled/${path}`], identity(text), path);
			if(path.startsWith("src/") && path.endsWith(".php")) assert.deepEqual(run.installedFiles[composer][path], identity(text), path);
		}
		assert.deepEqual(run.installedFiles[npm][`compiled/${receipt.library}`], receipt.wasmLibrary);
		for(const [path, file] of Object.entries(report.runtimeManifest.files)) assert.deepEqual(run.installedFiles[runtime][`compiled/${path}`], file);
		assert.deepEqual(run.installedFiles[runtime]["compiled/runtime.json"], identity(canonicalJson(report.runtimeManifest)));
		for(const [path, text] of Object.entries(bundledBrickMath())) assert.deepEqual(run.installedFiles[npm]["php/" + path], identity(text));
		assert.equal(run.npmLock.lockfileVersion, 3);
		for(const archive of [runtimeArchive, npmArchive])
		{
			const locked = run.npmLock.packages["node_modules/" + archive.name];
			assert.equal(locked.version, archive.version); assert.equal(locked.resolved, "file:../feed/" + archive.archive);
			assert.match(locked.integrity, /^sha512-[A-Za-z0-9+/]{86}==$/u);
		}
		assert.deepEqual(run.npmLock.packages[npm].dependencies, { [runtimeArchive.name]: runtimeArchive.version });
		assert.deepEqual(run.npmLock.packages[npm].peerDependencies, { "php-wasm": "0.1.0" });
		assert.equal(run.npmLock.packages["node_modules/php-wasm"].version, "0.1.0");
		assert.equal(run.host.manifest.name, "php-wasm"); assert.equal(run.host.manifest.version, "0.1.0");
		hash(run.host.archiveSha256); inventory(run.host.files);
		assert.deepEqual(run.composer.manifest.require, { [composerArchive.name]: "1.0.0" });
		assert.deepEqual(run.composer.manifest.config, { "allow-plugins": false, platform: { php: "8.4.1" } });
		assert.deepEqual(run.composer.manifest.repositories[0], { "packagist.org": false });
		const brick = JSON.parse(brickMathSources()["composer.json"]);
		for(const list of [run.composer.lock.packages, run.composer.installed.packages])
		{
			assert.deepEqual(list.map(item => item.name), ["brick/math", composerArchive.name]);
			assert.equal(list[0].version, "1.0.0"); assert.deepEqual(list[0].autoload, brick.autoload);
			assert.equal(list[1].version, "1.0.0"); assert.deepEqual(list[1].autoload, { files: ["src/Api.php"] });
			assert.deepEqual(list[1].require, { "brick/math": "1.0.0", php: ">=8.4 <8.5" });
			assert.equal(basename(new URL(list[1].dist.url).pathname), composerArchive.archive);
			assert.equal(list[1].extra["lean-bridge"].runtimeIdentity, report.runtimeIdentity);
		}
		const request = { path: run.path, mixed, extension: graph.manifest.extension };
		assert.deepEqual(run.sources, {
			common: sha256(common), consumer: sha256(consumer)
			, documentation: sha256(documentation.example.source)
			, node: sha256(phpWasmRecursiveNodeSource(npmArchive.name, request))
			, browser: sha256(phpWasmRecursiveBrowserSource(request))
			, bundle: run.sources.bundle });
		hash(run.sources.bundle);
		const libraries = [basename(report.runtimeManifest.library), basename(receipt.library)].sort();
		assert.deepEqual(run.executions.map(item => [item.realm, item.arrangement, item.loading, item.mode]), ["embedded", "composer", "bundled"].flatMap(arrangement => modes.map(([loading, mode]) => ["node", arrangement, loading, mode])));
		for(const item of run.executions) observed(item, mixed, libraries);
		hash(run.browser.executableSha256); assert.match(run.browser.version, /^\d+\.\d+\.\d+\.\d+$/u);
		assert.deepEqual(run.browser.executions.map(item => [item.realm, item.arrangement, item.loading, item.mode]), modes.map(([loading, mode]) => ["chromium", "bundled", loading, mode]));
		for(const item of run.browser.executions)
		{
			observed(item, mixed, libraries);
			const requests = Object.fromEntries(item.requests.map(({ path, ...file }) => [path, file]));
			assert.equal(Object.keys(requests).length, item.requests.length); inventory(requests);
			for(const [path, text] of Object.entries({ "consumer.php": consumer, "recursive-host.mjs": common, "browser.mjs": phpWasmRecursiveBrowserSource(request) }))
				assert.deepEqual(requests[path], identity(text));
			assert.equal(requests["bundled/consumer.mjs"].sha256, run.sources.bundle);
			const fetched = Object.values(requests);
			for(const file of [
				receipt.wasmLibrary
				, report.runtimeManifest.files[report.runtimeManifest.library]
				, ...Object.entries(graph.files).filter(([path]) => path.startsWith("src/") && path.endsWith(".php")).map(([, text]) => identity(text))])
				assert.ok(fetched.some(value => value.sha256 === file.sha256 && value.bytes === file.bytes), "Browser missed a generated asset");
			for(const [path, file] of Object.entries(requests).filter(([path]) => path.startsWith("node_modules/php-wasm/")))
				assert.deepEqual(file, run.host.files[path.slice("node_modules/php-wasm/".length)]);
		}
	}
	assert.deepEqual(report.observations[0].archives[0], report.observations[1].archives[0]);
};
