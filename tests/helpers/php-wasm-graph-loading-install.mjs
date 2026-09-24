/**
 * Fresh graph/acyclic releases and offline consumers for shared PHP-Wasm loading.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdir, readFile, readdir, realpath, rename, rm, statfs, symlink } from "node:fs/promises";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { build as buildVite } from "vite";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { buildCanonicalProject } from "../../src/build/canonical-build.mjs";
import { buildPhpWasmCopiedRuntime } from "../../src/build/php-wasm-copied-component.mjs";
import { phpWasmCopiedPins as pins } from "../../src/build/php-wasm-copied-artifacts.mjs";
import { readVerifiedPhpWasmCopiedPackageSet } from "../../src/release/php-wasm-copied-package.mjs";
import { createDeterministicTarGz } from "../../src/release/deterministic-archive.mjs";
import { lakeInputState, saveLakeFile } from "./lake-workspace.mjs";
import { copiedCleanEnvironment, runCopied } from "./copied-fixture-install.mjs";
import { brickMathRepository, validateBrickMathInstall } from "./brick-math.mjs";
import { phpWasmInventory } from "./type-corpus-php-wasm-install.mjs";

export const phpWasmGraphLoadingSpecifications = [
	{ name: "cedar", module: "Cedar", artifact: "cedar", graph: true, value: 41 }
	, { name: "maple", module: "Maple", artifact: "maple", graph: true, value: 43 }
	, { name: "stone", module: "Stone", artifact: "stone", graph: false, value: 47 }
	, { name: "cedar", module: "Cedar", artifact: "cedar-conflict", graph: true, value: 99 }
];

const probeSource = `#include <php.h>
#include "lean_bridge_native_runtime.h"
ZEND_BEGIN_ARG_INFO_EX(probe_args, 0, 0, 0)
ZEND_END_ARG_INFO()
static ZEND_FUNCTION(lean_bridge_test_snapshot) {
  lean_bridge_native_snapshot s; lean_bridge_native_snapshot_read(&s);
  array_init(return_value);
  add_next_index_long(return_value, s.abi_version);
  add_next_index_long(return_value, s.runtime_state);
  add_next_index_long(return_value, s.runtime_init_runs);
  add_next_index_long(return_value, s.component_init_runs);
  add_next_index_long(return_value, s.attached_components);
  add_next_index_long(return_value, s.live_identities);
}
static ZEND_FUNCTION(lean_bridge_test_retire) {
  lean_bridge_native_runtime_retire(); RETURN_NULL();
}
static const zend_function_entry functions[] = {
  ZEND_FE(lean_bridge_test_snapshot, probe_args)
  ZEND_FE(lean_bridge_test_retire, probe_args)
  PHP_FE_END
};
zend_module_entry probe_module_entry = {
  STANDARD_MODULE_HEADER, "lean_bridge_graph_loading_probe", functions,
  NULL, NULL, NULL, NULL, NULL, "1", STANDARD_MODULE_PROPERTIES
};
ZEND_GET_MODULE(probe)
`;

const install = async (root, packages, host, diagnostic) => {
	const app = join(root, "app"), feed = join(root, "feed"), cache = join(root, "npm-cache"), bin = join(root, "bin");
	for(const path of [app, cache, bin])
	{ await mkdir(path); assert.deepEqual(await readdir(path), []); }
	const hostManifest = JSON.parse(await readFile(join(host, "package.json")));
	assert.equal(hostManifest.name, "php-wasm"); assert.equal(hostManifest.version, "0.1.0");
	const hostFiles = await phpWasmInventory(host);
	const hostArchive = await createDeterministicTarGz({ directory: host, archiveRoot: "package", sourceDateEpoch: 1 });
	await saveLakeFile(feed, "host.tgz", hostArchive);
	await saveLakeFile(app, "package.json", canonicalJson({ private: true, type: "module" }));
	for(const path of ["user.npmrc", "global.npmrc"]) await saveLakeFile(app, path, "");
	await symlink(process.execPath, join(bin, "node"));
	const npm = await realpath(join(process.execPath, "../../bin/npm"));
	const archives = [...new Set(packages.flatMap(pkg => pkg.report.archives.filter(item => item.ecosystem === "npm").map(item => join(feed, item.archive))))];
	diagnostic("Installing four original component archives, one runtime and the pinned host offline");
	const npmArgs = [npm, "install", "--offline", "--ignore-scripts"
		, "--no-audit", "--no-fund"
		, "--userconfig", join(app, "user.npmrc")
		, "--globalconfig", join(app, "global.npmrc"), "--cache", cache
		, ...archives, join(feed, "host.tgz")];
	await runCopied(process.execPath, npmArgs, app, { ...copiedCleanEnvironment, PATH: bin });
	assert.deepEqual(await phpWasmInventory(join(app, "node_modules/php-wasm")), hostFiles);
	const npmLock = JSON.parse(await readFile(join(app, "package-lock.json")));
	assert.deepEqual(Object.keys(npmLock.packages).sort(), ["", "node_modules/php-wasm", "node_modules/@lean-bridge/php-wasm-copied-runtime", ...packages.map(pkg => `node_modules/${pkg.report.npmSettings.name}`)].sort());
	const composerPackages = packages.slice(0, 3), composerHome = join(root, "composer-home"), composerCache = join(root, "composer-cache");
	for(const path of [composerHome, composerCache])
	{ await mkdir(path); assert.deepEqual(await readdir(path), []); }
	await saveLakeFile(app, "composer.json", canonicalJson({ name: "test/recursive-php-wasm-loading"
		, config: { "allow-plugins": false, platform: { php: "8.4.1" } }
		, repositories: [{ "packagist.org": false }, await brickMathRepository(feed)
			, ...composerPackages.map(pkg => ({ type: "package", package: { ...pkg.composer, dist: { type: "zip", url: pathToFileURL(join(feed, pkg.report.archives.find(item => item.ecosystem === "composer").archive)).href } } }))]
		, require: Object.fromEntries(composerPackages.map(pkg => [pkg.composer.name, pkg.composer.version])) }));
	await runCopied(process.env.LEAN_BRIDGE_COMPOSER ?? "composer", ["--no-plugins", "--no-scripts", "--no-interaction", "install", "--prefer-dist", "--no-progress", "--no-dev"], app
		, { ...process.env, COMPOSER_ALLOW_SUPERUSER: "1", COMPOSER_DISABLE_NETWORK: "1", COMPOSER_HOME: composerHome, COMPOSER_CACHE_DIR: composerCache });
	const composer = { manifest: JSON.parse(await readFile(join(app, "composer.json")))
		, lock: JSON.parse(await readFile(join(app, "composer.lock")))
		, installed: JSON.parse(await readFile(join(app, "vendor/composer/installed.json"))) };
	validateBrickMathInstall(composer, await phpWasmInventory(app));
	const installedFiles = {};
	for(const pkg of packages)
	{
		const locations = [[`node_modules/${pkg.report.npmSettings.name}`, pkg.componentFiles]
			, ["node_modules/@lean-bridge/php-wasm-copied-runtime", pkg.runtimeFiles]
			, ...composerPackages.includes(pkg) ? [[`vendor/${pkg.composer.name}`, pkg.composerFiles]] : []];
		for(const [directory, expected] of locations)
		{
			installedFiles[directory] = await phpWasmInventory(join(app, directory));
			assert.deepEqual(installedFiles[directory], expected);
		}
	}
	const deployment = join(root, "relocated");
	await rename(app, deployment);
	for(const path of [feed, cache, bin, composerHome, composerCache]) await rm(path, { recursive: true });
	await saveLakeFile(deployment, "entry.mjs", packages.map((pkg, index) => `export {default as api${index}} from ${JSON.stringify(pkg.report.npmSettings.name)};`).join("\n") + "\n");
	await buildVite({ root: deployment, configFile: false
		, publicDir: false, logLevel: "silent", base: "./"
		, build: { outDir: "bundled", assetsInlineLimit: 0, modulePreload: false
			, rollupOptions: { input: join(deployment, "entry.mjs"), preserveEntrySignatures: "strict", output: { entryFileNames: "consumer.mjs" } } } });
	return { deployment
		, installation: { installedFiles, npmLock, composer
			, host: { manifest: hostManifest, files: hostFiles, archiveSha256: sha256(hostArchive) }
			, offline: true, emptyCaches: true
			, relocated: true, originalArchives: true } };
};

/**
 * Compile serially, install original archives, then remove every producer tree.
 *
 * @param root - Test-owned scratch directory.
 * @param diagnostic - Progress reporter.
 */
export const preparePhpWasmGraphLoading = async (root, diagnostic) => {
	const emsdkRoot = resolve(process.env.LEAN_BRIDGE_PHP_EMSDK ?? ".toolchains/emsdk-php-wasm");
	const phpSource = resolve(process.env.LEAN_BRIDGE_PHP_SOURCE ?? "build/php-wasm-sdk/php8.4-src");
	const leanPrefix = resolve(process.env.LEAN_BRIDGE_LEAN_PREFIX ?? ".toolchains/elan/toolchains/leanprover--lean4---v4.32.2");
	const space = await statfs(root); assert.ok(Number(space.bavail) * Number(space.bsize) > 1024 ** 3, "PHP-Wasm loading gate needs 1 GiB of scratch headroom");
	diagnostic("Building a fresh wasm32 runtime for multi-package loading");
	const runtime = await buildPhpWasmCopiedRuntime({ emsdkRoot
		, outputRoot: join(root, "runtime")
		, leanRuntimeRoot: resolve(process.env.LEAN_BRIDGE_PHP_LEAN_RUNTIME ?? `build/lean-runtime/${pins.leanCommit}-${pins.patchSetSha256}-browser-php-wasm-3.1.68`) });
	const environment = { ...process.env, LEAN_BRIDGE_LEAN_PREFIX: leanPrefix
		, LEAN_BRIDGE_PHP_EMSDK: emsdkRoot, LEAN_BRIDGE_PHP_SOURCE: phpSource
		, LEAN_BRIDGE_PHP_COPIED_RUNTIME: runtime.root };
	delete environment.LEAN_BRIDGE_PHP_INPUTS;
	const packages = [];
	for(const specification of phpWasmGraphLoadingSpecifications)
	{
		const { name, module, graph, value, artifact } = specification;
		const author = join(root, "author"), projectRoot = join(author, "project"), outputRoot = join(author, "release");
		const source = `namespace ${module}
${graph ? `inductive V where
  | done (value : UInt32)
  | next (value : V)
structure Parcel where
  node : V
def echo (value : Parcel) : Parcel := value
` : ""}def value : UInt32 := ${value}
end ${module}
`;
		await saveLakeFile(projectRoot, `${module}.lean`, source);
		await saveLakeFile(projectRoot, "lean-toolchain", "leanprover/lean4:v4.32.2\n");
		await saveLakeFile(projectRoot, "lakefile.toml", `name = "${name}"\nversion = "1.0.0"\n[[lean_lib]]\nname = "${module}"\n`);
		await saveLakeFile(projectRoot, "lean-bridge.exports.json", canonicalJson({
			schemaVersion: 1, modules: [module]
			, exports: [...graph ? [`${module}.echo`] : [], `${module}.value`]
			, targets: { "php-wasm": { npm: { name: `@lean-bridge-test/${artifact}`, version: "1.0.0" }
				, composer: { name: `lean-bridge-test/${artifact}`, version: "1.0.0" } } } }));
		const before = await lakeInputState(projectRoot);
		diagnostic(`Compiling ${artifact}: ${graph ? "recursive" : "acyclic"} installed package`);
		await buildCanonicalProject({ projectRoot, outputRoot, targets: ["php-wasm"], environment })
			.catch(error => { error.message += `: ${JSON.stringify(error.details)}`; throw error; });
		assert.deepEqual(await lakeInputState(projectRoot), before);
		const release = join(outputRoot, "packages/php-wasm"), verified = await readVerifiedPhpWasmCopiedPackageSet(release);
		assert.equal(verified.model.pointerBits, 32); assert.equal(Boolean(verified.model.copiedGraph), graph);
		const report = verified.report, feed = join(root, "feed");
		for(const item of report.archives)
		{
			const bytes = await readFile(join(release, "archives", item.archive));
			assert.equal(bytes.length, item.bytes); assert.equal(sha256(bytes), item.sha256);
			await saveLakeFile(feed, item.archive, bytes);
		}
		if(packages.length) assert.deepEqual(report.archives[0], packages[0].report.archives[0]);
		packages.push({ ...specification, report
			, model: verified.model, receipt: verified.receipt
			, metadata: JSON.parse(await readFile(join(outputRoot, "php-wasm/component/metadata.json")))
			, composer: JSON.parse(await readFile(join(release, "composer/composer.json")))
			, componentFiles: await phpWasmInventory(join(release, "component/package"))
			, runtimeFiles: await phpWasmInventory(join(release, "runtime/package"))
			, composerFiles: await phpWasmInventory(join(release, "composer"))
			, source, sourceSha256: sha256(source), sourceUnchanged: true });
		await rm(author, { recursive: true });
	}
	assert.equal(packages[0].model.component.id, packages[3].model.component.id);
	assert.notEqual(packages[0].receipt.wasmLibrary.sha256, packages[3].receipt.wasmLibrary.sha256);
	const probeRoot = join(root, "probe-build");
	await saveLakeFile(probeRoot, "probe.c", probeSource);
	const probeArgs = ["-O2", "-g0", "-shared", "-sSIDE_MODULE=2"
		, "-sEXPORTED_FUNCTIONS=['_get_module']"
		, ...[phpSource, ...["Zend", "main", "TSRM", "ext"].map(path => join(phpSource, path)), join(runtime.root, "include")].flatMap(path => ["-I", path])
		, "probe.c", join(runtime.root, runtime.manifest.library)
		, "-o", "probe.so"];
	await runCopied(join(emsdkRoot, "upstream/emscripten/emcc"), probeArgs, probeRoot
		, { ...process.env, EM_CONFIG: join(emsdkRoot, ".emscripten"), EMSDK: emsdkRoot });
	const probe = await readFile(join(probeRoot, "probe.so"));
	const installed = await install(root, packages, resolve(process.env.LEAN_BRIDGE_PHP_WASM_HOST ?? "build/php-wasm-host/node_modules/php-wasm"), diagnostic);
	await saveLakeFile(installed.deployment, "probe.so", probe);
	await rm(probeRoot, { recursive: true }); await rm(join(root, "runtime"), { recursive: true });
	assert.deepEqual(await readdir(root), ["relocated"]);
	return { ...installed, packages, runtimeIdentity: runtime.identity
		, runtimeManifest: runtime.manifest
		, probe: { source: probeSource, sourceSha256: sha256(probeSource), bytes: probe.length, sha256: sha256(probe) }
		, producersRemoved: true };
};
