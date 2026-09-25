/**
 * Compare current acyclic builds with the original pre-graph implementation.
 * All predecessor modules come from unchanged, checksummed execution records.
 *
 * @file
 */
import assert from "node:assert/strict";
import { cp, mkdir, readFile, rm, symlink } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { generateNativeCopiedGraphAdapters } from "../../src/backends/c/native-graph-adapters.mjs";
import { readVerifiedPhpWasmCopiedComponent } from "../../src/build/php-wasm-copied-artifacts.mjs";
import { recursiveCarrierAbi } from "./recursive-carriers.mjs";
import { recursiveReviewedIr } from "./recursive-fixture.mjs";
import { nativeRecursiveReviewedIr } from "./native-recursive-reviewed.mjs";
import { phpLinkedGraphIr } from "./php-graph-values-fixture.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";

export const phpWasmPreGraphRecords = {
	"docs/evidence/wasm32-recursive-transport-20260923.json": "06ad97d62407230fda2a8cf259dde11cf3cb6644a4ad7b80850328539822c3a0"
	, "docs/evidence/php-wasm-recursive-packages-20260924.json": "8b3831e1b79729d1e5c6a6745d99a93014b5b0da2035e7104f72b97fba906f76"
};
export const phpWasmSharedRegressionSources = [
	"src/backends/c/copied-graph-layout.mjs"
	, "src/backends/c/native-graph-adapters.mjs"
	, "src/backends/php/php-wasm-copied-host.mjs"
	, "src/backends/php/php-wasm-copied-loader.mjs"
	, "src/backends/php/copied-zend.mjs", "src/backends/php/copied-model.mjs"
	, "src/backends/native/runtime-broker.mjs"
	, "src/build/php-wasm-copied-component.mjs"
	, "src/build/php-wasm-copied-artifacts.mjs"
	, "src/build/php-wasm-graph-model.mjs"
	, "src/build/php-wasm-graph-component.mjs"
	, "src/build/native-model.mjs", "src/build/elaborated-component.mjs"
	, "src/release/php-wasm-copied-package.mjs"
	, "src/release/deterministic-archive.mjs"
	, "src/release/deterministic-zip.mjs"
	, "src/release/php-wasm-compiler-inputs.mjs"
	, "tests/php-wasm-ordinary.test.mjs", "tests/helpers/php-wasm-ordinary.mjs"
	, "tests/helpers/php-wasm-packages.mjs", "tests/helpers/php-wasm-browser.mjs"
	, "tests/helpers/php-wasm-loading-failures.mjs"
	, "tests/helpers/php-wasm-legacy-comparison.mjs"
].sort();
const identity = bytes => ({ bytes: Buffer.byteLength(bytes), sha256: sha256(bytes) });
const digest = value => sha256(canonicalJson(value));
const fixtures = { recursiveReviewedIr, nativeRecursiveReviewedIr, phpLinkedGraphIr };
const hostPath = "src/backends/php/php-wasm-copied-host.mjs";
const packagePath = "src/release/php-wasm-copied-package.mjs";
const changedPaths = [
	"component/package/package.json", "runtime/package/host.mjs"
	, "runtime/package/index.mjs"
	, "runtime/package/package.json", "runtime/package/runtime-identity.json"
];

/** Load original source bytes only after authenticating both retained records. */
export const phpWasmPreGraphSources = async () => {
	const records = [];
	for(const [path, expected] of Object.entries(phpWasmPreGraphRecords))
	{
		const bytes = await readFile(path); assert.equal(sha256(bytes), expected, path);
		records.push(JSON.parse(bytes));
	}
	const sources = Object.fromEntries(records[0].preChangeSources.map(item => [item.path, { source: item.text, sha256: item.sha256 }]));
	Object.assign(sources, records[1].preAdmissionSources);
	assert.equal(Object.keys(sources).length, 6);
	for(const item of Object.values(sources)) assert.equal(sha256(item.source), item.sha256);
	return { sources, nativeBaseline: records[0].nativeBaseline };
};

/**
 * Check each difference in an acyclic package, including the deliberate runtime
 * identity change caused by its new host validator and packager source bytes.
 *
 * @param run - Complete previous/current file inventories and changed texts.
 * @param sources - The six original implementation sources.
 * @param options - Explicit source context for a retained historical execution.
 * @param options.packagingSource - Authenticated historical packager, or current source by default.
 */
export const assertPhpWasmLegacyPackageComparison = async (run, sources, { packagingSource } = {}) => {
	packagingSource ??= await readFile(packagePath, "utf8");
	assert.equal(typeof packagingSource, "string");
	const { previous, current } = run;
	for(const key of ["schemaVersion", "kind", "profile", "component", "componentIdentity", "runtimeIdentity", "npmSettings", "composerSettings", "packing"])
		assert.deepEqual(current[key], previous[key], key);
	assert.notEqual(current.loaderIdentity, previous.loaderIdentity);
	const entries = report => Object.entries(report.files).filter(([path]) => !path.startsWith("archives/"));
	assert.deepEqual(entries(current).map(([path]) => path), entries(previous).map(([path]) => path));
	const changed = entries(current).filter(([path, file]) => canonicalJson(file) !== canonicalJson(previous.files[path])).map(([path]) => path);
	assert.deepEqual(changed.sort(), changedPaths);
	assert.deepEqual(Object.keys(run.changedFiles).sort(), changedPaths);
	for(const [path, pair] of Object.entries(run.changedFiles))
	{
		assert.deepEqual(identity(pair.previous), previous.files[path]);
		assert.deepEqual(identity(pair.current), current.files[path]);
		if(path === "runtime/package/host.mjs")
		{
			assert.equal(pair.previous, sources[hostPath].source);
			assert.equal(pair.current, await readFile(hostPath, "utf8"));
		}
		else if(path === "runtime/package/runtime-identity.json")
		{
			const before = JSON.parse(pair.previous), after = JSON.parse(pair.current);
			assert.equal(digest(before), previous.loaderIdentity); assert.equal(digest(after), current.loaderIdentity);
			assert.deepEqual(before.host, identity(sources[hostPath].source));
			assert.deepEqual(before.packaging, identity(sources[packagePath].source));
			assert.deepEqual(after.host, identity(await readFile(hostPath)));
			assert.deepEqual(after.packaging, identity(packagingSource));
			assert.deepEqual({ ...before, host: after.host, packaging: after.packaging }, after);
		}
		else
		{
			assert.ok(pair.previous.includes(previous.loaderIdentity));
			assert.equal(pair.previous.replaceAll(previous.loaderIdentity, current.loaderIdentity), pair.current);
		}
	}
	assert.deepEqual(current.archives.map(item => [item.ecosystem, item.role]), [["npm", "runtime"], ["npm", "component"], ["composer", "api"]]);
	assert.deepEqual(previous.archives.map(item => [item.ecosystem, item.role]), current.archives.map(item => [item.ecosystem, item.role]));
	for(const [index, archive] of current.archives.entries())
	{
		const before = previous.archives[index];
		assert.deepEqual(current.files[`archives/${archive.archive}`], { bytes: archive.bytes, sha256: archive.sha256 });
		assert.deepEqual(previous.files[`archives/${before.archive}`], { bytes: before.bytes, sha256: before.sha256 });
		if(archive.ecosystem === "composer") assert.deepEqual(archive, before);
		else assert.notEqual(archive.sha256, before.sha256);
	}
	assert.equal(run.previousReaderAccepted, true); assert.equal(run.currentReaderAccepted, true);
	assert.equal(run.exports, 46); assert.equal(run.pointerBits, 32);
	assert.equal(run.componentIdentity, current.componentIdentity);
};

/**
 * Use original modules to read and repackage the actual newly compiled artifacts.
 * No source snapshot changes the running compiler or its installed consumers.
 *
 * @param options - Owned test directory, actual components and package handoffs.
 */
export const comparePhpWasmPreGraphArtifacts = async options => {
	const { working, components, runtimeRoot, releases, leanPrefix } = options;
	const { sources, nativeBaseline } = await phpWasmPreGraphSources();
	const previousRoot = join(working, "pre-graph-implementation");
	await mkdir(previousRoot);
	try
	{
		await cp("src", join(previousRoot, "src"), { recursive: true });
		await cp("LICENSE", join(previousRoot, "LICENSE"));
		await cp("notices", join(previousRoot, "notices"), { recursive: true });
		await symlink(join(process.cwd(), "node_modules"), join(previousRoot, "node_modules"), "dir");
		await saveLakeFile(previousRoot, "package.json", '{"type":"module"}\n');
		for(const [path, item] of Object.entries(sources)) await saveLakeFile(previousRoot, path, item.source);
		const load = path => import(pathToFileURL(join(previousRoot, path)).href);
		const oldNative = await load("src/backends/c/native-graph-adapters.mjs");
		const oldReader = await load("src/build/php-wasm-copied-artifacts.mjs");
		const oldPackage = await load(packagePath);
		const native = [];
		for(const [fixture, make] of Object.entries(fixtures))
		{
			const ir = make(), abi = recursiveCarrierAbi(ir), outputs = [];
			for(const options of [{}, { initializer: "initialize_LeanBridgeNative0123456789abcdef" }])
			{
				const before = oldNative.generateNativeCopiedGraphAdapters(ir, abi, options);
				const after = generateNativeCopiedGraphAdapters(ir, abi, options);
				assert.deepEqual(after, before);
				outputs.push({ options, sha256: digest(after) });
			}
			native.push({ fixture, outputs });
		}
		assert.deepEqual(native, nativeBaseline);
		const packages = [];
		for(const [index, component] of components.entries())
		{
			const { report: current, output } = releases[index];
			const previousComponent = await oldReader.readVerifiedPhpWasmCopiedComponent(component.root, current.runtimeIdentity);
			assert.deepEqual(previousComponent, await readVerifiedPhpWasmCopiedComponent(component.root, current.runtimeIdentity));
			const { report: previous, output: previousOutput } = await oldPackage.buildPhpWasmCopiedPackages({
				componentRoot: component.root, runtimeRoot, leanPrefix
				, outputRoot: join(previousRoot, `packages-${index}`)
				, npmSettings: current.npmSettings
				, composerSettings: current.composerSettings });
			const changedFiles = {};
			for(const path of changedPaths)
				changedFiles[path] = { previous: await readFile(join(previousOutput, path), "utf8"), current: await readFile(join(output, path), "utf8") };
			const run = { name: component.name, previous, current, changedFiles
				, previousReaderAccepted: true, currentReaderAccepted: true
				, exports: previousComponent.model.exports.length
				, pointerBits: previousComponent.model.pointerBits
				, componentIdentity: digest(previousComponent.receipt) };
			await assertPhpWasmLegacyPackageComparison(run, sources);
			packages.push(run);
		}
		return { schemaVersion: 1, kind: "php-wasm-pre-graph-comparison"
			, compiledLean: true
			, baselines: phpWasmPreGraphRecords, native, packages
			, sourceHashes: Object.fromEntries(await Promise.all(phpWasmSharedRegressionSources.map(async path => [path, sha256(await readFile(path))]))) };
	}
	finally
	{ await rm(previousRoot, { recursive: true, force: true }); }
};
