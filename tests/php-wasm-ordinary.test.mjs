/**
 * Actual Lean compilation and relocated execution in the PHP-Wasm Zend host.
 *
 * @file
 */
import assert from "node:assert/strict";
import { chmod, cp, mkdir, mkdtemp, readFile, rename, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { buildPhpWasmCopiedComponent, buildPhpWasmCopiedRuntime } from "../src/build/php-wasm-copied-component.mjs";
import { phpWasmCopiedPins as pins, readVerifiedPhpWasmCopiedComponent, readVerifiedPhpWasmCopiedRuntime } from "../src/build/php-wasm-copied-artifacts.mjs";
import { createNativeModel, createPhpWasmCopiedModel } from "../src/build/native-model.mjs";
import { buildElaboratedComponent } from "../src/build/elaborated-component.mjs";
import { processBuildRunner } from "../src/build/process-runner.mjs";
import { nativeMetadataFixture } from "./helpers/native-metadata.mjs";
import { lakeInputState, saveLakeFile } from "./helpers/lake-workspace.mjs";
import { createPhpWasmOrdinaryProject, phpWasmOrdinaryConsumer } from "./helpers/php-wasm-ordinary.mjs";
import { buildPhpWasmCopiedPackages, readVerifiedPhpWasmCopiedPackageSet } from "../src/release/php-wasm-copied-package.mjs";
import { exerciseInstalledPhpWasmPackages } from "./helpers/php-wasm-packages.mjs";
import { buildCliNpmPackage } from "../src/release/cli-npm-package.mjs";
import { buildCanonicalProject } from "../src/build/canonical-build.mjs";
import { assertRelocatedPackageSet } from "./helpers/package-set.mjs";
import { buildPhpWasmCompilerInputs, readVerifiedPhpWasmCompilerInputs } from "../src/release/php-wasm-compiler-inputs.mjs";
import { assertPackagedSourceNotices } from "./helpers/source-notices.mjs";
import { tarGzipPackingIdentity } from "../src/release/deterministic-archive.mjs";

const enabled = process.env.LEAN_BRIDGE_PHP_WASM_ORDINARY_TEST === "1";
const leanPrefix = process.env.LEAN_BRIDGE_LEAN_PREFIX ?? join(process.cwd(), ".toolchains/elan/toolchains/leanprover--lean4---v4.32.2");
const emsdkRoot = process.env.LEAN_BRIDGE_PHP_EMSDK ?? join(process.cwd(), ".toolchains/emsdk-php-wasm");
const phpSource = process.env.LEAN_BRIDGE_PHP_SOURCE ?? join(process.cwd(), "build/php-wasm-sdk/php8.4-src");
const leanRuntimeRoot = process.env.LEAN_BRIDGE_PHP_LEAN_RUNTIME ?? join(process.cwd(), `build/lean-runtime/${pins.leanCommit}-${pins.patchSetSha256}-browser-php-wasm-3.1.68`);
const phpHost = process.env.LEAN_BRIDGE_PHP_WASM_HOST ?? join(process.cwd(), "build/php-wasm-host/node_modules/php-wasm");

test("PHP-Wasm uses a fixed wasm32 model without changing native compilation", () => {
	const options = { ...nativeMetadataFixture(), component: { id: "example@1.0.0", name: "example", version: "1.0.0" } };
	const native = createNativeModel(options), wasm = createPhpWasmCopiedModel(options);
	assert.equal(native.profile, "native-library-v1"); assert.equal(native.pointerBits, 64);
	assert.equal(wasm.profile, "php-wasm-copied-v1"); assert.equal(wasm.pointerBits, 32);
	assert.deepEqual(wasm.bindingIr, native.bindingIr);
	assert.deepEqual(wasm.exports, native.exports);
	assert.throws(() => createPhpWasmCopiedModel({ ...options, moduleName: "LeanBridge::Example" }), /Perl namespace/);
	const callback = nativeMetadataFixture(), declaration = callback.metadata.modules[0].declarations[0];
	const scalar = declaration.projection.result;
	declaration.projection.result = { kind: "callback", parameters: [scalar], result: scalar, abi: { cType: "lean_object*", box: "lean_box", unbox: "lean_unbox", heap: true } };
	assert.throws(() => createPhpWasmCopiedModel({ ...callback, component: options.component }), error => error.code === "unsupported-php-wasm-signature" && error.details.source.path === "Sample.lean" && error.details.source.startLine === 2);
});

test("shared compilation rejects arbitrary profiles and receipt paths before reading sources", async () => {
	for(const options of [{ profile: "unknown", receiptName: "native-component.json" }, { profile: "native-library-v1", receiptName: "../outside.json" }, { profile: "php-wasm-copied-v1", receiptName: "native-component.json" }])
		await assert.rejects(buildElaboratedComponent(options), /Invalid compiled component profile/);
	await assert.rejects(buildPhpWasmCopiedComponent({ targets: ["php-wasm", "npm"] }), /own target selection/);
	await assert.rejects(buildPhpWasmCopiedComponent({ moduleName: "LeanBridge::Example" }), /Perl namespace/);
});

test("public PHP-Wasm build rejects unsupported inputs and cache settings without outputs", async t => {
	const working = await mkdtemp(join(tmpdir(), "lean-bridge-php-wasm-cli-errors-"));
	t.after(() => rm(working, { recursive: true, force: true }));
	const project = join(working, "project"), outputRoot = join(working, "release");
	await createPhpWasmOrdinaryProject(project, "Willow");
	const options = { projectRoot: project, outputRoot, targets: ["php-wasm"] };
	for(const cache of [null, { policy: "unknown" }])
		await assert.rejects(buildCanonicalProject({ ...options, cache }), { code: "invalid-cache-policy" });
	await assert.rejects(buildCanonicalProject({ ...options, cache: { policy: "use", directory: join(working, "cache") } }), { code: "cache-directory-unsupported" });
	const before = await lakeInputState(working);
	await assert.rejects(buildCanonicalProject({ ...options, environment: { LEAN_BRIDGE_PHP_EMSDK: join(working, "missing-sdk") } }), { code: "php-wasm-toolchain-unavailable" });
	assert.deepEqual(await lakeInputState(working), before);
	await saveLakeFile(project, "unused.binding-ir.json", "{}");
	await assert.rejects(buildCanonicalProject(options), { code: "reviewed-ir-build-unsupported" });
	await assert.rejects(buildCanonicalProject({ projectRoot: process.cwd(), targets: ["php-wasm"] }), { code: "invalid-package-targets" });
});

test("ordinary Lean copied APIs execute after relocation in one 32-bit PHP-Wasm host", { skip: !enabled, timeout: 600000 }, async t => {
	const working = await mkdtemp(join(tmpdir(), "lean-bridge-php-wasm-ordinary-"));
	t.after(() => rm(working, { recursive: true, force: true }));
	const cachedRuntime = process.env.LEAN_BRIDGE_TEST_PHP_COPIED_RUNTIME;
	const runtime = cachedRuntime
		? { root: cachedRuntime, ...await readVerifiedPhpWasmCopiedRuntime(cachedRuntime) }
		: await buildPhpWasmCopiedRuntime({ outputRoot: join(working, "runtime"), leanRuntimeRoot, emsdkRoot });
	t.diagnostic(`runtime ${runtime.identity}`);
	const compilerInputs = await buildPhpWasmCompilerInputs({ runtimeRoot: runtime.root, phpSource, outputRoot: join(working, "compiler-inputs") });
	t.diagnostic(`compiler inputs ${compilerInputs.identity}, archive ${compilerInputs.archiveSha256}`);
	const inputCopy = join(working, "relocated-compiler-source");
	for(const [path, bytes] of (await readVerifiedPhpWasmCompilerInputs(compilerInputs.directory)).files)
	{
		if(path.startsWith("runtime/") || path.startsWith("php/")) await saveLakeFile(inputCopy, path, bytes);
		else if(path.startsWith("notices/php/")) await saveLakeFile(inputCopy, `php/${path.slice(12)}`, bytes);
	}
	const repeatedInputsArchive = await buildPhpWasmCompilerInputs({ runtimeRoot: join(inputCopy, "runtime"), phpSource: join(inputCopy, "php"), outputRoot: join(working, "compiler-inputs-repeat") });
	assert.deepEqual(await readFile(compilerInputs.archive), await readFile(repeatedInputsArchive.archive));
	await rm(inputCopy, { recursive: true });
	const cliArchive = await buildCliNpmPackage({ outputRoot: join(working, "cli-archive"), phpWasmInputsRoot: compilerInputs.directory });
	const cliHome = join(working, "cli-installed"); await mkdir(cliHome);
	await saveLakeFile(cliHome, "package.json", '{"private":true}');
	await processBuildRunner.capture({ command: "npm", args: ["install", "--offline", "--ignore-scripts", "--no-audit", "--no-fund", cliArchive.archive], cwd: cliHome });
	const cli = join(cliHome, "node_modules/.bin/lean-bridge");
	const installedInputs = join(cliHome, "node_modules/lean-bridge/runtime/php-wasm");
	assert.equal((await readVerifiedPhpWasmCompilerInputs(installedInputs)).identity, compilerInputs.identity);
	await rename(compilerInputs.directory, `${compilerInputs.directory}-unavailable`);
	const build = async (projectRoot, outputRoot, inputRoot = null) => {
		const environment = { ...process.env, LEAN_BRIDGE_LEAN_PREFIX: leanPrefix, LEAN_BRIDGE_PHP_EMSDK: emsdkRoot, LEAN_BRIDGE_RUNTIME_ROOT: "/unused-npm-runtime" };
		for(const name of ["LEAN_BRIDGE_PHP_SOURCE", "LEAN_BRIDGE_PHP_COPIED_RUNTIME", "LEAN_BRIDGE_PHP_LEAN_RUNTIME", "LEAN_BRIDGE_PHP_INPUTS"]) delete environment[name];
		if(inputRoot) environment.LEAN_BRIDGE_PHP_INPUTS = inputRoot;
		const response = await processBuildRunner.capture({
			command: process.execPath
			, args: [cli, "build", "--project", projectRoot, "--output", outputRoot, "--target", "php-wasm", "--json", "--progress", "none"]
			, cwd: working
			, env: environment });
		const { result, status } = JSON.parse(response.stdout);
		assert.equal(status, "ok"); assert.deepEqual(result.targets, ["php-wasm"]);
		return { ...await readVerifiedPhpWasmCopiedComponent(join(outputRoot, "php-wasm/component"), runtime.identity), root: join(outputRoot, "php-wasm/component"), release: { output: join(outputRoot, "packages/php-wasm"), ...(await readVerifiedPhpWasmCopiedPackageSet(join(outputRoot, "packages/php-wasm"))) } };
	};
	const components = [], releases = [];
	for(const name of ["Willow", "Aspen"])
	{
		const project = join(working, name), buildRoot = join(working, `${name}-compiled`);
		await createPhpWasmOrdinaryProject(project, name);
		const before = await lakeInputState(project);
		const result = await build(project, buildRoot), outputRoot = result.root;
		assert.equal(result.receipt.phpHeadersSha256, compilerInputs.phpHeadersSha256);
		await assertPackagedSourceNotices(t, buildRoot, [`Source notice fixture: ${name}\n`]);
		assert.equal(result.model.pointerBits, 32); assert.equal(result.model.exports.length, 44);
		assert.deepEqual(await lakeInputState(project), before);
		await readVerifiedPhpWasmCopiedComponent(outputRoot, runtime.identity);
		const binary = await readFile(join(outputRoot, result.receipt.library));
		assert.equal(binary.includes(Buffer.from(working)), false, "Extension contains an absolute build path");
		assert.equal(binary.includes(Buffer.from(runtime.root)), false, "Extension contains its runtime header path");
		const repeatedSource = join(working, "relocated-source", name);
		await cp(project, repeatedSource, { recursive: true });
		const beforeRepeated = await lakeInputState(repeatedSource);
		const extracted = join(working, "relocated-inputs", name); await mkdir(extracted, { recursive: true });
		await processBuildRunner.capture({ command: "tar", args: ["-xzf", compilerInputs.archive, "-C", extracted], cwd: working });
		const repeatedInputs = join(extracted, "php-wasm-compiler-inputs");
		assert.equal((await readVerifiedPhpWasmCompilerInputs(repeatedInputs)).identity, compilerInputs.identity);
		const repeatedBuild = join(working, `${name}-repeat`);
		// Hide the default bundle so the repeated build must use the explicit,
		// relocated bundle, without raw PHP source or target-archive selectors.
		await rename(installedInputs, `${installedInputs}-unavailable`);
		let repeated;
		try
		{ repeated = await build(repeatedSource, repeatedBuild, repeatedInputs); }
		finally
		{ await rename(`${installedInputs}-unavailable`, installedInputs); }
		assert.deepEqual(await lakeInputState(repeatedSource), beforeRepeated);
		assert.deepEqual(result.receipt, repeated.receipt);
		await assertRelocatedPackageSet(t, buildRoot, cli);
		assert.deepEqual(await readFile(join(outputRoot, "artifacts.json")), await readFile(join(repeated.root, "artifacts.json")));
		t.diagnostic(`${name} extension ${result.receipt.wasmLibrary.sha256}`);
		const release = result.release, repeatRelease = repeated.release;
		assert.deepEqual(release.report, repeatRelease.report);
		await readVerifiedPhpWasmCopiedPackageSet(release.output);
		const runtimeIdentity = JSON.parse(await readFile(join(release.output, "runtime/package/runtime-identity.json")));
		const packing = { archiveRoot: "package", sourceDateEpoch: 1, ...await tarGzipPackingIdentity() };
		assert.deepEqual(release.report.packing, packing);
		assert.deepEqual(runtimeIdentity.packing, packing);
		assert.equal(sha256(canonicalJson(runtimeIdentity)), release.report.loaderIdentity);
		const manifestBytes = await readFile(join(release.output, "runtime/package/compiled/runtime.json"));
		assert.deepEqual(runtimeIdentity.runtimeFiles["runtime.json"], { bytes: manifestBytes.length, sha256: sha256(manifestBytes) });
		const runtimeArchive = release.report.archives[0];
		const componentMetadata = JSON.parse(await readFile(join(release.output, "component/package/package.json")));
		assert.equal(componentMetadata.dependencies[runtimeArchive.name], runtimeArchive.version);
		if(releases.length) assert.deepEqual(release.report.archives[0], releases[0].report.archives[0], "Both packages must depend on the same runtime archive");
		const releaseRoot = join(working, `${name}-packages`);
		await rename(release.output, releaseRoot);
		releases.push({ output: releaseRoot, report: release.report });
		t.diagnostic(`${name} package archives ${JSON.stringify(release.report.archives.map(({ role, sha256 }) => ({ role, sha256 })))}`);
		const relocated = join(working, "installed", name);
		await cp(outputRoot, relocated, { recursive: true });
		await rename(project, `${project}-source-unavailable`);
		await rename(repeatedSource, `${repeatedSource}-unavailable`);
		await rm(buildRoot, { recursive: true }); await rm(repeatedBuild, { recursive: true });
		await rm(repeatedInputs, { recursive: true });
		await saveLakeFile(working, `${name}-consumer.php`, phpWasmOrdinaryConsumer(name));
		components.push({ name, root: relocated, receipt: result.receipt });
	}
	const relocatedRuntime = join(working, "installed/runtime");
	await cp(runtime.root, relocatedRuntime, { recursive: true });
	if(!cachedRuntime) await rm(runtime.root, { recursive: true });
	assert.equal((await readVerifiedPhpWasmCopiedRuntime(relocatedRuntime)).identity, runtime.identity);
	for(const component of components) await readVerifiedPhpWasmCopiedComponent(component.root, runtime.identity);
	// A separate test-only extension observes the production broker. The public
	// generated APIs do not expose a runtime, pointer, counter, or FFI object.
	await saveLakeFile(working, "probe.c", `#include <php.h>
#include "lean_bridge_native_runtime.h"
ZEND_BEGIN_ARG_INFO_EX(probe_args, 0, 0, 0)
ZEND_END_ARG_INFO()
static ZEND_FUNCTION(lean_bridge_test_snapshot) {
  lean_bridge_native_snapshot snapshot;
  lean_bridge_native_snapshot_read(&snapshot);
  array_init(return_value);
  add_next_index_long(return_value, snapshot.abi_version);
  add_next_index_long(return_value, snapshot.runtime_state);
  add_next_index_long(return_value, snapshot.runtime_init_runs);
  add_next_index_long(return_value, snapshot.component_init_runs);
  add_next_index_long(return_value, snapshot.attached_components);
  add_next_index_long(return_value, snapshot.live_identities);
}
static const zend_function_entry probe_functions[] = {
  ZEND_FE(lean_bridge_test_snapshot, probe_args)
  PHP_FE_END
};
zend_module_entry probe_module_entry = {
  STANDARD_MODULE_HEADER, "lean_bridge_test_probe", probe_functions,
  NULL, NULL, NULL, NULL, NULL, "1", STANDARD_MODULE_PROPERTIES
};
ZEND_GET_MODULE(probe)
`);
	const probeIncludes = [phpSource, ...["Zend", "main", "TSRM", "ext"].map(path => join(phpSource, path)), join(relocatedRuntime, "include")];
	const probeArgs = ["-O2", "-shared", "-sSIDE_MODULE=2"
		, "-sEXPORTED_FUNCTIONS=['_get_module']"
		, ...probeIncludes.flatMap(path => ["-I", path])
		, "probe.c", join(relocatedRuntime, runtime.manifest.library)
		, "-o", "probe.so"];
	await processBuildRunner.capture({ command: join(emsdkRoot, "upstream/emscripten/emcc"), args: probeArgs, cwd: working });
	const libraries = [{ name: basename(runtime.manifest.library), url: pathToFileURL(join(relocatedRuntime, runtime.manifest.library)).href, ini: false }
		, { name: "probe.so", url: pathToFileURL(join(working, "probe.so")).href, ini: true }
		, ...components.map(({ root, receipt }) => ({ name: basename(receipt.library), url: pathToFileURL(join(root, receipt.library)).href, ini: true }))];
	await saveLakeFile(working, "host.mjs", `import { readFile } from 'node:fs/promises';
import { PhpNode } from ${JSON.stringify(pathToFileURL(join(phpHost, "PhpNode.mjs")).href)};
try {
const php = new PhpNode({version: '8.4', sharedLibs: ${JSON.stringify(libraries)}.map(lib => ({...lib, url: new URL(lib.url)})), ini: 'memory_limit=512M'});
let stdout = '', stderr = '';
php.addEventListener('output', e => { for (const part of e.detail) stdout += part; });
php.addEventListener('error', e => { for (const part of e.detail) stderr += part; });
await php.binary;
${components.map(({ name, root }) => `await php.mkdir('/${name}'); await php.mkdir('/${name}/src'); await php.mkdir('/${name}/src/Internal');
${["src/Api.php", "src/Internal/Native.php"].map(path => `await php.writeFile('/${name}/${path}', await readFile(${JSON.stringify(join(root, path))}, 'utf8'));`).join("\n")}
await php.writeFile('/${name}/consumer.php', await readFile(${JSON.stringify(join(working, `${name}-consumer.php`))}, 'utf8'));`).join("\n")}
const status = await php.run("<?php require '/Willow/consumer.php'; require '/Aspen/consumer.php';");
if (status || stderr || stdout !== 'Willow:okAspen:ok') throw new Error(JSON.stringify({status,stdout,stderr}));
stdout = ''; stderr = '';
for (let i = 0; i < 20; i++) {
  const status = await php.run("<?php echo LeanWillow\\\\answer(), ':', LeanAspen\\\\answer(), ';';");
  if (status) throw new Error('Repeated request failed');
}
if (stderr || stdout !== '17:29;'.repeat(20)) throw new Error(JSON.stringify({stdout,stderr}));
stdout = ''; stderr = '';
const snapshotStatus = await php.run("<?php echo json_encode(lean_bridge_test_snapshot());");
if (snapshotStatus || stderr || stdout !== '[1,2,1,2,2,0]') throw new Error('Unexpected shared runtime snapshot: ' + JSON.stringify({snapshotStatus,stdout,stderr}));
console.log(JSON.stringify({status: 0, components: 2, pointerBits: 32, exports: 88, repeatedRequests: 20}));
} catch (error) { console.error(error.stack); process.exitCode = 1; }
`);
	const host = await processBuildRunner.capture({ command: process.execPath
		, args: ["host.mjs"], cwd: working, timeoutMs: 120000
		, env: { ...process.env, PATH: join(working, "no-compilers"), LEAN_SYSROOT: "/unavailable", LEAN_PATH: "/unavailable" } });
	assert.deepEqual(JSON.parse(host.stdout.trim()), { status: 0, components: 2, pointerBits: 32, exports: 88, repeatedRequests: 20 });
	// Resealing a receipt cannot authorize changed generated loaders or a new
	// install hook. The reader reconstructs the sources and deterministic archives.
	const packageVictim = releases[0];
	await assert.rejects(buildPhpWasmCopiedPackages({ componentRoot: components[0].root, runtimeRoot: relocatedRuntime, leanPrefix, outputRoot: join(components[0].root, "nested-package-output") }), /inside its compiled inputs/);
	const differentPacking = structuredClone(packageVictim.report);
	differentPacking.packing.zlibVersion = "changed-packing-test";
	await saveLakeFile(packageVictim.output, "php-wasm-package-set.json", canonicalJson(differentPacking));
	await assert.rejects(readVerifiedPhpWasmCopiedPackageSet(packageVictim.output), /packing environment differs.*portable package-set receipt/);
	await saveLakeFile(packageVictim.output, "php-wasm-package-set.json", canonicalJson(packageVictim.report));
	const hostPath = join(packageVictim.output, "runtime/package/host.mjs");
	await chmod(hostPath, 0o755);
	try
	{ await readVerifiedPhpWasmCopiedPackageSet(packageVictim.output); }
	finally
	{ await chmod(hostPath, 0o644); }
	const rawManifest = await readFile(join(relocatedRuntime, "runtime.json"));
	const reformattedManifest = Buffer.from(`${JSON.stringify(JSON.parse(rawManifest))}\n`);
	assert.notDeepEqual(rawManifest, reformattedManifest);
	await saveLakeFile(relocatedRuntime, "runtime.json", reformattedManifest);
	try
	{
		assert.equal((await readVerifiedPhpWasmCopiedRuntime(relocatedRuntime)).identity, runtime.identity);
		const reformatted = await buildPhpWasmCopiedPackages({
			componentRoot: components[0].root, runtimeRoot: relocatedRuntime, leanPrefix
			, outputRoot: join(working, "reformatted-runtime-packages")
			, npmSettings: packageVictim.report.npmSettings
			, composerSettings: packageVictim.report.composerSettings });
		const archive = reformatted.report.archives[0];
		assert.notEqual(archive.version, packageVictim.report.archives[0].version);
		assert.notEqual(archive.sha256, packageVictim.report.archives[0].sha256);
		assert.equal(reformatted.report.runtimeIdentity, runtime.identity);
		const basis = JSON.parse(await readFile(join(reformatted.output, "runtime/package/runtime-identity.json")));
		assert.deepEqual(basis.runtimeFiles["runtime.json"], { bytes: reformattedManifest.length, sha256: sha256(reformattedManifest) });
	} finally
	{ await saveLakeFile(relocatedRuntime, "runtime.json", rawManifest); }
	for(const path of ["component/package/index.mjs", "component/package/lazy-library.txt", "runtime/package/host.mjs", "runtime/package/runtime-identity.json", "composer/src/Api.php", `archives/${packageVictim.report.archives[0].archive}`])
	{
		const absolute = join(packageVictim.output, path), original = await readFile(absolute);
		const changed = Buffer.concat([original, Buffer.from("\n// substituted\n")]);
		await saveLakeFile(packageVictim.output, path, changed);
		const receipt = structuredClone(packageVictim.report);
		receipt.files[path] = { bytes: changed.length, sha256: sha256(changed) };
		await saveLakeFile(packageVictim.output, "php-wasm-package-set.json", canonicalJson(receipt));
		await assert.rejects(readVerifiedPhpWasmCopiedPackageSet(packageVictim.output), /drift|differs/);
		await saveLakeFile(packageVictim.output, path, original);
		await saveLakeFile(packageVictim.output, "php-wasm-package-set.json", canonicalJson(packageVictim.report));
	}
	await exerciseInstalledPhpWasmPackages({ working, releases, phpHost, probe: join(working, "probe.so"), t });
	const victim = components[0];
	await assert.rejects(readVerifiedPhpWasmCopiedComponent(victim.root, "0".repeat(64)), /differs/);
	for(const [label, changes, pattern] of [
		["extra-file", { "extra.txt": "unrecorded" }, /Unrecorded/]
		, ["changed-php", { "src/Api.php": "<?php // substituted wrapper" }, /Zend source drift/]
		, ["non-wasm", { [victim.receipt.library]: Buffer.from("7f454c4602010100", "hex") }, /expected magic word|WebAssembly/]
	]) {
		const damaged = join(working, `damaged-${label}`);
		await cp(victim.root, damaged, { recursive: true });
		const inventory = JSON.parse(await readFile(join(damaged, "artifacts.json")));
		for(const [path, value] of Object.entries(changes))
		{
			await saveLakeFile(damaged, path, value);
			if(label !== "extra-file") inventory.files[path] = { bytes: Buffer.byteLength(value), sha256: sha256(value) };
		}
		if(label === "non-wasm")
		{
			const receipt = { ...victim.receipt, wasmLibrary: inventory.files[victim.receipt.library] };
			const source = canonicalJson(receipt);
			await saveLakeFile(damaged, "php-wasm-component.json", source);
			inventory.files["php-wasm-component.json"] = { bytes: Buffer.byteLength(source), sha256: sha256(source) };
		}
		await saveLakeFile(damaged, "artifacts.json", canonicalJson(inventory));
		await assert.rejects(readVerifiedPhpWasmCopiedComponent(damaged, runtime.identity), pattern);
	}
	const originalRuntime = await readFile(join(relocatedRuntime, "runtime.json"));
	const badRuntime = JSON.parse(originalRuntime); badRuntime.pointerBits = 64;
	await saveLakeFile(relocatedRuntime, "runtime.json", canonicalJson(badRuntime));
	await assert.rejects(readVerifiedPhpWasmCopiedRuntime(relocatedRuntime), /Invalid PHP-Wasm/);
	await saveLakeFile(relocatedRuntime, "runtime.json", originalRuntime);
	const original = await readFile(join(victim.root, "model.json"));
	const forged = JSON.parse(original); forged.pointerBits = 64;
	await saveLakeFile(victim.root, "model.json", canonicalJson(forged));
	const inventory = JSON.parse(await readFile(join(victim.root, "artifacts.json")));
	inventory.files["model.json"] = { bytes: Buffer.byteLength(canonicalJson(forged)), sha256: sha256(canonicalJson(forged)) };
	await saveLakeFile(victim.root, "artifacts.json", canonicalJson(inventory));
	await assert.rejects(readVerifiedPhpWasmCopiedComponent(victim.root, runtime.identity), /differs/);
});
