/**
 * Fresh recursive wasm32 builds and relocated, offline npm/Composer consumers.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdir, readFile, readdir, realpath, rename, rm, statfs, symlink } from "node:fs/promises";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { buildCanonicalProject } from "../../src/build/canonical-build.mjs";
import { buildPhpWasmCopiedRuntime } from "../../src/build/php-wasm-copied-component.mjs";
import { nativeAllocationGuardHeader } from "../../src/build/native-allocation-guard.mjs";
import { phpWasmCopiedPins as pins, readVerifiedPhpWasmCopiedComponent } from "../../src/build/php-wasm-copied-artifacts.mjs";
import { buildPhpWasmCopiedPackages, readVerifiedPhpWasmCopiedPackageSet } from "../../src/release/php-wasm-copied-package.mjs";
import { createDeterministicTarGz } from "../../src/release/deterministic-archive.mjs";
import { nativeRecursiveSource } from "./native-recursive-transport.mjs";
import { nativeRecursiveReviewedIr } from "./native-recursive-reviewed.mjs";
import { lakeInputState, saveLakeFile } from "./lake-workspace.mjs";
import { copiedCleanEnvironment, runCopied } from "./copied-fixture-install.mjs";
import { brickMathRepository, validateBrickMathInstall } from "./brick-math.mjs";
import { phpWasmInventory } from "./type-corpus-php-wasm-install.mjs";
import { bundlePhpWasmGraph, checkPhpWasmGraphBrowser } from "./php-wasm-graph-browser.mjs";

const hashFiles = files => Object.fromEntries(Object.entries(files).map(([path, bytes]) => [path, { bytes: bytes.length, sha256: sha256(bytes) }]));
const phpPaths = ["src/Api.php", "src/Internal/Native.php", "src/Internal/Values.php", "src/Internal/GraphTypes.php", "src/Internal/Wire.php"];

const checkAllocationGuard = async (directory, runtime, sdk) => {
	await saveLakeFile(directory, "allocation-guard.h", nativeAllocationGuardHeader);
	const observations = [];
	const cases = [["0", "0", null], ["1", "510", null], ["255", "1023", null]
		, ["256", "0", "object-field limit"], ["0", "1024", "scalar-byte limit"]
		, ["-1", "0", "object-field limit"], ["0", "-1", "scalar-byte limit"]
		, ["count", "0", "compiler-constant field sizes"]
		, ["0", "count", "compiler-constant field sizes"]];
	for(const [objects, scalars, expected] of cases)
	{
		const source = `#include "allocation-guard.h"\nlean_object *probe(unsigned count) { (void)count; return lean_alloc_ctor(0, ${objects}, ${scalars}); }\n`;
		await saveLakeFile(directory, "allocation-probe.c", source);
		const invoke = () => runCopied(join(sdk, "upstream/emscripten/emcc"), ["-std=c11", "-O2", "-DLEAN_EMSCRIPTEN", "-fsyntax-only", "-I", join(runtime, "include"), "allocation-probe.c"], directory
			, { ...process.env, EM_CONFIG: join(sdk, ".emscripten"), EMSDK: sdk });
		let diagnostic = "";
		if(expected) await assert.rejects(invoke, error => { diagnostic = error.details?.stderr ?? ""; return diagnostic.includes(expected); });
		else await invoke();
		observations.push({ objects, scalars, accepted: !expected, expected, sourceSha256: sha256(source), diagnostic });
	}
	await rm(join(directory, "allocation-guard.h")); await rm(join(directory, "allocation-probe.c"));
	return observations;
};

const rejectArtifactDrift = async (root, runtimeIdentity) => {
	const read = async path => JSON.parse(await readFile(join(root, path), "utf8"));
	const inventory = await read("artifacts.json"), receipt = await read("php-wasm-component.json");
	const replace = async (path, bytes) => {
		await saveLakeFile(root, path, bytes);
		await saveLakeFile(root, "artifacts.json", canonicalJson({ ...inventory, files: { ...inventory.files, ...hashFiles({ [path]: Buffer.from(bytes) }) } }));
	};
	const rejected = [];
	try
	{
		for(const copiedGraph of [undefined, { ...receipt.copiedGraph, layoutSha256: "0".repeat(64) }, { ...receipt.copiedGraph, extra: true }])
		{
			await replace("php-wasm-component.json", canonicalJson({ ...receipt, copiedGraph }));
			await assert.rejects(() => readVerifiedPhpWasmCopiedComponent(root, runtimeIdentity), /differs from compiler metadata/);
			rejected.push("graph-receipt");
		}
		await saveLakeFile(root, "php-wasm-component.json", canonicalJson(receipt));
		for(const path of [...phpPaths, "graph/transport.c", "graph/runtime.c", "graph/allocation-guard.h", "include/recursive-graph-types.h", "include/recursive-graph.h"])
		{
			const original = await readFile(join(root, path)), changed = Buffer.concat([original, Buffer.from("\n/* re-signed drift */\n")]);
			try
			{
				await replace(path, changed);
				await assert.rejects(() => readVerifiedPhpWasmCopiedComponent(root, runtimeIdentity), /Zend source drift/);
				rejected.push(path);
			}
			finally
			{ await saveLakeFile(root, path, original); }
		}
	}
	finally
	{
		await saveLakeFile(root, "php-wasm-component.json", canonicalJson(receipt));
		await saveLakeFile(root, "artifacts.json", canonicalJson(inventory));
	}
	await readVerifiedPhpWasmCopiedComponent(root, runtimeIdentity);
	return rejected;
};

/**
 * Install the original graph package archives offline and relocate the consumer.
 *
 * @param options - Release coordinates and a test-owned consumer workspace.
 * @param options.root - Test-owned installation parent.
 * @param options.release - Original package report and handoff directory.
 * @param options.host - Pinned PHP-Wasm host package directory.
 * @param options.diagnostic - Progress reporter.
 */
export const installPhpWasmGraphPackages = async ({ root, release, host, diagnostic }) => {
	const project = join(root, "install"), deployment = join(root, "deployed"), feed = join(root, "feed");
	await saveLakeFile(project, "package.json", canonicalJson({ private: true, type: "module" })); await mkdir(feed);
	const npm = [], archives = [];
	let composer;
	for(const item of release.report.archives)
	{
		const path = join(feed, item.archive), bytes = await readFile(join(release.output, "archives", item.archive));
		assert.equal(bytes.length, item.bytes); assert.equal(sha256(bytes), item.sha256);
		await saveLakeFile(feed, item.archive, bytes); archives.push({ ...item });
		if(item.ecosystem === "npm") npm.push(path); else composer = path;
	}
	diagnostic("Installing the original npm archives and companion Composer ZIP offline");
	const hostManifest = JSON.parse(await readFile(join(host, "package.json")));
	assert.equal(hostManifest.name, "php-wasm"); assert.equal(hostManifest.version, "0.1.0");
	const hostFiles = await phpWasmInventory(host);
	const hostArchive = await createDeterministicTarGz({ directory: host, archiveRoot: "package", sourceDateEpoch: 1 });
	await saveLakeFile(feed, "host.tgz", hostArchive);
	const bin = join(root, "bin"), cache = join(root, "npm-cache");
	for(const path of [bin, cache])
	{ await mkdir(path); assert.deepEqual(await readdir(path), []); }
	await symlink(process.execPath, join(bin, "node"));
	for(const path of ["user.npmrc", "global.npmrc"]) await saveLakeFile(project, path, "");
	const npmTool = await realpath(join(process.execPath, "../../bin/npm"));
	const npmArgs = [npmTool, "install", "--offline", "--ignore-scripts"
		, "--no-audit", "--no-fund", "--userconfig", join(project, "user.npmrc")
		, "--globalconfig", join(project, "global.npmrc"), "--cache", cache
		, ...npm, join(feed, "host.tgz")];
	await runCopied(process.execPath, npmArgs, project, { ...copiedCleanEnvironment, PATH: bin });
	assert.deepEqual(await phpWasmInventory(join(project, "node_modules/php-wasm")), hostFiles);
	const npmLock = JSON.parse(await readFile(join(project, "package-lock.json")));
	assert.deepEqual(Object.keys(npmLock.packages).sort(), ["", "node_modules/php-wasm", "node_modules/@lean-bridge/php-wasm-copied-runtime", `node_modules/${release.report.npmSettings.name}`].sort());
	const composerMetadata = JSON.parse(await readFile(join(release.output, "composer/composer.json")));
	const composerHome = join(root, "composer-home"), composerCache = join(root, "composer-cache");
	for(const path of [composerHome, composerCache])
	{ await mkdir(path); assert.deepEqual(await readdir(path), []); }
	await saveLakeFile(project, "composer.json", canonicalJson({ name: "test/recursive-php-wasm-consumer"
		, config: { "allow-plugins": false, platform: { php: "8.4.1" } }
		, repositories: [{ "packagist.org": false }, await brickMathRepository(feed)
			, { type: "package", package: { ...composerMetadata, dist: { type: "zip", url: pathToFileURL(composer).href } } }]
		, require: { [composerMetadata.name]: composerMetadata.version } }));
	await runCopied(process.env.LEAN_BRIDGE_COMPOSER ?? "composer", ["--no-plugins", "--no-scripts", "--no-interaction", "install", "--prefer-dist", "--no-progress", "--no-dev"], project
		, { ...process.env, COMPOSER_ALLOW_SUPERUSER: "1", COMPOSER_DISABLE_NETWORK: "1", COMPOSER_HOME: composerHome, COMPOSER_CACHE_DIR: composerCache });
	const composerEvidence = { manifest: JSON.parse(await readFile(join(project, "composer.json")))
		, lock: JSON.parse(await readFile(join(project, "composer.lock")))
		, installed: JSON.parse(await readFile(join(project, "vendor/composer/installed.json"))) };
	validateBrickMathInstall(composerEvidence, await phpWasmInventory(project));
	const installed = {};
	for(const [from, into] of [["runtime/package", "node_modules/@lean-bridge/php-wasm-copied-runtime"], ["component/package", `node_modules/${release.report.npmSettings.name}`], ["composer", `vendor/${composerMetadata.name}`]])
	{
		installed[into] = await phpWasmInventory(join(project, into));
		assert.deepEqual(installed[into], await phpWasmInventory(join(release.output, from)));
	}
	await rename(project, deployment);
	await rm(feed, { recursive: true }); await rm(composerHome, { recursive: true }); await rm(composerCache, { recursive: true });
	await rm(bin, { recursive: true }); await rm(cache, { recursive: true });
	return { deployment, installed, archives
		, composer: composerMetadata.name, composerEvidence, npmLock
		, host: { manifest: hostManifest, files: hostFiles
			, archiveSha256: sha256(hostArchive) } };
};

const hostSource = (name, composer, request) => `import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {join} from 'node:path';
import {PhpNode} from 'php-wasm/PhpNode';
import installedDescriptor from ${JSON.stringify(name)};
import bundledDescriptor from './bundled/consumer.mjs';
process.setUncaughtExceptionCaptureCallback(error=>{console.error(error.stack);process.exit(1);});
const arrangement=process.argv[2],loading=process.argv[3],mode=process.argv[4],libraries=[];
const descriptor=arrangement==='bundled'?bundledDescriptor:installedDescriptor;
const api=loading==='lazy'?descriptor.lazy:descriptor;
const selected=arrangement==='composer'?api.extensions:api;
const php=new PhpNode({version:'8.4',autoTransaction:false,ini:'memory_limit=256M',sharedLibs:loading==='startup'?[selected]:[],dynamicLibs:loading==='lazy'?[selected]:[],locateFile:name=>{if(name.startsWith('php8.4-lb_')||name.startsWith('liblean_bridge_php_wasm_copied_'))libraries.push(name);}});
let stdout='',stderr='';
php.addEventListener('output',event=>{stdout+=event.detail.join('');});php.addEventListener('error',event=>{stderr+=event.detail.join('');});
const run=async source=>{const status=await php.run(source);if(status||stderr)throw new Error(JSON.stringify({status,stdout,stderr}));};
await php.binary;
const initial=loading==='lazy'?0:2;assert.equal(libraries.length,initial);
const mount=async(source,target)=>{await php.mkdir(target);for(const file of await readdir(source,{withFileTypes:true})){if(file.isDirectory())await mount(join(source,file.name),target+'/'+file.name);else await php.writeFile(target+'/'+file.name,await readFile(join(source,file.name)));}};
if(arrangement==='composer'){await mount('vendor','/app-vendor');await run("<?php require '/app-vendor/autoload.php';");}
else await run("<?php require '"+api.autoload+"';");
assert.equal(libraries.length,initial,'Autoload must not fetch lazy libraries');
await run("<?php try { LeanRecursive\\\\tree(1); throw new Exception('Expected TypeError'); } catch (TypeError $error) {} try { LeanRecursive\\\\never_(new stdClass()); throw new Exception('Expected TypeError'); } catch (TypeError $error) {}");
assert.equal(libraries.length,initial,'Invalid inputs must not fetch lazy libraries');
const aliases=arrangement==='composer'?${JSON.stringify(`/app-vendor/${composer}/lean-bridge/aliases.json`)}:${JSON.stringify(`/vendor/${composer}/lean-bridge/aliases.json`)};
await php.writeFile('/request.json',JSON.stringify({...${JSON.stringify(request)},loading,aliases}));
const caller=(await readFile('consumer.php','utf8')).replace('strict_types=0','strict_types='+(mode==='strict'?'1':'0'));
await php.writeFile('/consumer.php',caller);await run("<?php require '/consumer.php';");
const observed=JSON.parse(stdout);assert.equal(libraries.length,2);assert.equal(new Set(libraries).size,2);
stdout='';for(let index=0;index<20;index++)await run("<?php if (!LeanRecursive\\\\empty_()->equals(new LeanRecursive\\\\TreeBranch([]))) throw new Exception('Repeat failed');");
assert.equal(stdout,'');assert.equal(libraries.length,2);
console.log(JSON.stringify({arrangement,loading,mode,observed,libraries,repeatedRequests:20,invalidStayedCold:true}));
`;

/**
 * Exercise both authoring paths through normal builds and original archives.
 *
 * @param directory - Test-owned scratch, removed by the calling test.
 * @param diagnostic - Progress reporter.
 */
export const checkPhpWasmGraphPackages = async (directory, diagnostic = () => {}) => {
	const emsdkRoot = resolve(process.env.LEAN_BRIDGE_PHP_EMSDK ?? ".toolchains/emsdk-php-wasm");
	const leanPrefix = resolve(process.env.LEAN_BRIDGE_LEAN_PREFIX ?? ".toolchains/elan/toolchains/leanprover--lean4---v4.32.2");
	const host = resolve(process.env.LEAN_BRIDGE_PHP_WASM_HOST ?? "build/php-wasm-host/node_modules/php-wasm");
	const space = await statfs(directory); assert.ok(Number(space.bavail) * Number(space.bsize) > 1024 ** 3, "PHP-Wasm graph package gate needs 1 GiB of scratch headroom");
	diagnostic("Building a fresh retirement-aware wasm32 runtime");
	const runtime = await buildPhpWasmCopiedRuntime({
		outputRoot: join(directory, "runtime"), emsdkRoot
		, leanRuntimeRoot: resolve(process.env.LEAN_BRIDGE_PHP_LEAN_RUNTIME ?? `build/lean-runtime/${pins.leanCommit}-${pins.patchSetSha256}-browser-php-wasm-3.1.68`) });
	diagnostic("Checking the constructor guard against the actual wasm32 headers");
	const allocationGuard = await checkAllocationGuard(directory, runtime.root, emsdkRoot);
	const environment = { ...process.env
		, LEAN_BRIDGE_LEAN_PREFIX: leanPrefix, LEAN_BRIDGE_PHP_EMSDK: emsdkRoot
		, LEAN_BRIDGE_PHP_SOURCE: resolve(process.env.LEAN_BRIDGE_PHP_SOURCE ?? "build/php-wasm-sdk/php8.4-src")
		, LEAN_BRIDGE_PHP_COPIED_RUNTIME: runtime.root };
	delete environment.LEAN_BRIDGE_PHP_INPUTS;
	const original = (await nativeRecursiveSource()).replace("value == 18446744073709551615", "value == 4294967295").replace("value == -9223372036854775808", "value == -2147483648");
	const fixture = await readFile("tests/fixtures/structured-types/recursive-php-wasm-installed.php", "utf8"), observations = [];
	for(const reviewed of [false, true])
	{
		const root = join(directory, reviewed ? "reviewed" : "ordinary"), author = join(root, "author"), projectRoot = join(author, "project"), outputRoot = join(author, "release");
		const ir = nativeRecursiveReviewedIr();
		await saveLakeFile(projectRoot, "Recursive.lean", original);
		await saveLakeFile(projectRoot, "lean-toolchain", "leanprover/lean4:v4.32.2\n");
		await saveLakeFile(projectRoot, "lakefile.toml", 'name = "recursive"\nversion = "1.0.0"\n[[lean_lib]]\nname = "Recursive"\n');
		await saveLakeFile(projectRoot, "lean-bridge.exports.json", canonicalJson({
			schemaVersion: 1, modules: ["Recursive"]
			, ...reviewed ? {} : { exports: ir.declarations.map(item => item.source.declaration) }
			, targets: { "php-wasm": { npm: { name: "@lean-bridge-test/recursive-php-wasm", version: "1.0.0" }, composer: { name: "lean-bridge-test/recursive-php-wasm", version: "1.0.0" } } } }));
		if(reviewed) await saveLakeFile(projectRoot, "reviewed.binding-ir.json", canonicalJson(ir));
		const before = await lakeInputState(projectRoot);
		diagnostic(`${reviewed ? "reviewed" : "ordinary"}: compiling recursive PHP-Wasm through the canonical build`);
		await buildCanonicalProject({ projectRoot, outputRoot, targets: ["php-wasm"], environment })
			.catch(error => { error.message += `: ${JSON.stringify(error.details)}`; throw error; });
		assert.deepEqual(await lakeInputState(projectRoot), before);
		const componentRoot = join(outputRoot, "php-wasm/component"), packageRoot = join(outputRoot, "packages/php-wasm");
		const verified = await readVerifiedPhpWasmCopiedPackageSet(packageRoot), { model, receipt } = verified;
		assert.equal(model.profile, "php-wasm-copied-v1"); assert.equal(model.pointerBits, 32); assert.equal(model.schemaVersion, reviewed ? 5 : 4);
		assert.equal(model.exports.length, 18); assert.ok(receipt.copiedGraph);
		const binary = await readFile(join(componentRoot, receipt.library)); assert.equal(binary.includes(Buffer.from(directory)), false);
		const rejectedArtifacts = await rejectArtifactDrift(componentRoot, runtime.identity);
		const repeated = await buildPhpWasmCopiedPackages({ componentRoot
			, runtimeRoot: join(outputRoot, "php-wasm/runtime")
			, outputRoot: join(author, "repackaged"), leanPrefix
			, npmSettings: verified.report.npmSettings
			, composerSettings: verified.report.composerSettings });
		assert.deepEqual(repeated.report, verified.report);
		const generated = JSON.parse(await readFile(join(componentRoot, "graph-zend-manifest.json"))), metadata = JSON.parse(await readFile(join(componentRoot, "metadata.json")));
		const installed = await installPhpWasmGraphPackages({ root, release: { output: packageRoot, report: verified.report }, host, diagnostic });
		await bundlePhpWasmGraph(installed.deployment, verified.report.npmSettings.name);
		await rm(author, { recursive: true }); await assert.rejects(() => readdir(author), { code: "ENOENT" });
		const request = { path: reviewed ? "reviewed-ir" : "ordinary-source", extension: generated.extension };
		const runner = hostSource(verified.report.npmSettings.name, installed.composer, request);
		await saveLakeFile(installed.deployment, "run.mjs", runner); await saveLakeFile(installed.deployment, "consumer.php", fixture);
		const executions = [];
		for(const arrangement of ["embedded", "composer", "bundled"])
		for(const loading of ["startup", "lazy"])
		for(const mode of ["weak", "strict"])
		{
			diagnostic(`${request.path}: installed ${arrangement}/${loading}/${mode}`);
			const result = await runCopied(process.execPath, ["run.mjs", arrangement, loading, mode], installed.deployment
				, { PATH: "/unavailable", LEAN_PATH: "/unavailable", LEAN_SYSROOT: "/unavailable", LANG: "C.UTF-8" });
			assert.equal(result.stderr, ""); const observed = JSON.parse(result.stdout);
			assert.equal(observed.observed.exports, 18); assert.ok(observed.observed.checks > 1000); assert.ok(observed.observed.rejections > 30);
			assert.equal(observed.observed.actualPhpBits, 32); assert.equal(observed.observed.compiledLean, true); assert.equal(observed.observed.installedPackage, true);
			executions.push(observed);
		}
		const browser = await checkPhpWasmGraphBrowser(installed.deployment
			, { ...request, aliases: `/vendor/${installed.composer}/lean-bridge/aliases.json` }, diagnostic);
		observations.push({ reviewed, model, metadata, receipt
			, generatedManifest: generated
			, archives: installed.archives, installedFiles: installed.installed
			, composer: installed.composerEvidence, executions, rejectedArtifacts
			, npmLock: installed.npmLock, host: installed.host
			, browser
			, runnerSha256: sha256(runner), consumerSha256: sha256(fixture)
			, sourceSha256: sha256(original)
			, sourceUnchanged: true, authorRemoved: true
			, compilerFreeReassembly: true });
		await rm(root, { recursive: true });
	}
	return { schemaVersion: 1, installedPackage: true, compiledLean: true, runtimeIdentity: runtime.identity, runtimeManifest: runtime.manifest, allocationGuard, observations };
};
