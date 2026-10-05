/**
 * Fresh Lean tickets and the production Zend lifetime layer on actual wasm32.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { compilerExportSelection } from "../../src/analyze/export-configuration.mjs";
import { createMetadataRequest, identifyLeanInterface, validateElaboratedMetadata } from "../../src/analyze/elaborated-metadata.mjs";
import { generateOwnedNativeValueAdapters } from "../../src/backends/native/owned-value-adapters.mjs";
import { ownedAggregateLeaseSource } from "../../src/backends/native/owned-aggregate-leases.mjs";
import { compileOwnedPhpZendModel } from "../../src/backends/php/owned-zend-model.mjs";
import { buildPhpWasmCopiedRuntime } from "../../src/build/php-wasm-copied-component.mjs";
import { phpWasmCopiedPins as pins, readVerifiedPhpWasmCopiedRuntime, validatePhpWasmCopiedBinary } from "../../src/build/php-wasm-copied-artifacts.mjs";
import { nativeAllocationGuardHeader } from "../../src/build/native-allocation-guard.mjs";
import { processBuildRunner } from "../../src/build/process-runner.mjs";
import { ownedPhpZendOwnershipProbe } from "./owned-php-zend-ownership-probe.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";

/**
 * Compile real resource carriers and validate Zend lifetime and abort behavior.
 *
 * @param directory - Fresh, test-owned scratch directory.
 * @param diagnostic - Progress reporter.
 */
export const checkOwnedPhpZendOwnership = async (directory, diagnostic = () => {}) => {
	const repository = process.cwd();
	const prefix = resolve(process.env.LEAN_BRIDGE_LEAN_PREFIX ?? ".toolchains/elan/toolchains/leanprover--lean4---v4.32.2");
	const lean = join(prefix, "bin/lean"), extractor = resolve("src/analyze/NativeExports.lean");
	const sdk = resolve(process.env.LEAN_BRIDGE_PHP_EMSDK ?? ".toolchains/emsdk-php-wasm");
	const emcc = join(sdk, "upstream/emscripten/emcc");
	const phpSource = resolve(process.env.LEAN_BRIDGE_PHP_SOURCE ?? "build/php-wasm-sdk/php8.4-src");
	const host = resolve(process.env.LEAN_BRIDGE_PHP_WASM_HOST ?? "build/php-wasm-host/node_modules/php-wasm");
	const runtimeRoot = process.env.LEAN_BRIDGE_TEST_PHP_COPIED_RUNTIME === undefined
		? join(directory, "runtime") : resolve(process.env.LEAN_BRIDGE_TEST_PHP_COPIED_RUNTIME);
	if(process.env.LEAN_BRIDGE_TEST_PHP_COPIED_RUNTIME === undefined)
		await buildPhpWasmCopiedRuntime({ outputRoot: runtimeRoot, emsdkRoot: sdk
			, leanRuntimeRoot: resolve(process.env.LEAN_BRIDGE_PHP_LEAN_RUNTIME ?? `build/lean-runtime/${pins.leanCommit}-${pins.patchSetSha256}-browser-php-wasm-3.1.68`) });
	const runtime = await readVerifiedPhpWasmCopiedRuntime(runtimeRoot);
	const run = (command, args) => processBuildRunner.capture({ command, args
		, cwd: directory, timeoutMs: 240000
		, env: { ...process.env, LEAN_PATH: directory
			, PATH: `${join(prefix, "bin")}:${process.env.PATH}`
			, EM_CONFIG: join(sdk, ".emscripten"), EMSDK: sdk }
	}).catch(error => { throw new Error(JSON.stringify({ message: error.message, details: error.details }), { cause: error }); });
	const compiler = (await run(emcc, ["--version"])).stdout.split("\n")[0];
	assert.equal(compiler, runtime.manifest.compiler.version);
	assert.equal((await run("git", ["-C", sdk, "rev-parse", "HEAD"])).stdout.trim(), runtime.manifest.pins.emsdkCommit);
	for(const [path, entry] of Object.entries(runtime.manifest.compiler.files)) assert.equal(sha256(await readFile(join(sdk, path))), entry.sha256);
	const source = await readFile(join(repository, "tests/fixtures/onboarding/owned-aggregates/Owned.lean"), "utf8");
	const config = JSON.parse(await readFile(join(repository, "tests/fixtures/onboarding/owned-aggregates/lean-bridge.exports.json"), "utf8"));
	await saveLakeFile(directory, "Owned.lean", source);
	diagnostic("Compiling fresh Lean tickets and compiler-authenticated ownership carriers");
	await run(lean, ["-o", "Owned.olean", "-c", "Owned.c", "Owned.lean"]);
	const identity = await identifyLeanInterface(join(directory, "Owned.olean"));
	const context = { toolchain: "leanprover/lean4:v4.32.2"
		, extractorSha256: sha256(await readFile(extractor))
		, leanCompilerSha256: sha256(await readFile(lean))
		, modules: [{ name: "Owned", sourcePath: "Owned.lean", sourceSha256: sha256(source), interfaceSha256: identity.interfaceSha256 }] };
	const request = createMetadataRequest({ profile: "native-library-v1"
		, modules: ["Owned"], exportModules: ["Owned"]
		, exports: config.exports, resources: config.resources
		, arities: Object.entries(config.arities)
		, ...compilerExportSelection(config) }, context);
	await saveLakeFile(directory, "request.json", canonicalJson(request));
	const metadata = JSON.parse((await run(lean, ["--run", extractor, "--metadata", "request.json"])).stdout);
	validateElaboratedMetadata(metadata, request); assert.deepEqual(metadata.diagnostics, []);
	const sourceIdentity = { request, leanVersion: "4.32.2"
		, leanCommit: (await run(lean, ["--githash"])).stdout.trim()
		, leanCompilerSha256: context.leanCompilerSha256
		, extractorSha256: context.extractorSha256, sourceTreeSha256: sha256(source)
		, modules: [{ module: "Owned"
			, source: { path: "Owned.lean", sha256: sha256(source) }
			, interface: { sha256: identity.oleanSha256, interfaceSha256: identity.interfaceSha256 } }] };
	const inputs = { metadata, sourceIdentity, component: { id: "owned-zend@1.0.0", name: "owned-zend", version: "1.0.0" }, wordBits: 32 };
	const generated = generateOwnedNativeValueAdapters(inputs), { carriers } = generated;
	const model = compileOwnedPhpZendModel(carriers.model.bindingIr);
	assert.deepEqual(model.layout, generated.layout);
	assert.doesNotMatch(carriers.leanSource, /\b(?:unsafe|sorry|axiom|partial|unsafeCast)\b/u);
	await saveLakeFile(directory, `${carriers.module}.lean`, carriers.leanSource);
	await run(lean, ["-o", `${carriers.module}.olean`, "-c", "Carriers.c", `${carriers.module}.lean`]);
	const consumer = await readFile("tests/fixtures/structured-types/owned-php-zend-ownership.php", "utf8");
	const files = { "carriers.h": carriers.header
		, "owned-values.h": generated.typesHeader
		, "owned-leases.h": ownedAggregateLeaseSource
		, "owned-values-codec.h": generated.source
		, "allocation-guard.h": nativeAllocationGuardHeader
		, "probe.c": ownedPhpZendOwnershipProbe(model, generated)
		, "check.php": consumer
		, "bailouts.php": await readFile("tests/fixtures/structured-types/owned-php-zend-bailouts.php", "utf8") };
	for(const [path, source] of Object.entries(files)) await saveLakeFile(directory, path, source);
	const roots = [directory, join(runtimeRoot, "include"), phpSource, ...["Zend", "main", "TSRM", "ext"].map(path => join(phpSource, path))];
	const flags = ["-O2", "-g0", "-fPIC", "-fvisibility=hidden", "-ffp-contract=off", "-fbracket-depth=4096", "-DLEAN_EMSCRIPTEN", ...roots.flatMap(path => ["-I", path])];
	diagnostic("Compiling the generated Zend lifetime layer with strict wasm32 C warnings");
	const objects = [];
	for(const name of ["Owned", "Carriers", "probe"])
	{
		const guards = name === "probe" ? ["-Wall", "-Wextra", "-Werror", "-Wno-unused-parameter", "-Wno-unused-function"]
			: ["-include", "allocation-guard.h", ...name === "Carriers" ? ["-include", "carriers.h"] : []];
		await run(emcc, [...flags, ...guards, "-c", `${name}.c`, "-o", `${name}.o`]); objects.push(`${name}.o`);
	}
	await run(emcc, [...flags, "-sSIDE_MODULE=2", "-sEXPORTED_FUNCTIONS=['_get_module']", "-Wl,--no-entry", ...objects, join(runtimeRoot, runtime.manifest.library), "-o", "probe.so"]);
	const binary = await readFile(join(directory, "probe.so")); await validatePhpWasmCopiedBinary(binary, true);
	const libraries = [{ name: basename(runtime.manifest.library), url: pathToFileURL(join(runtimeRoot, runtime.manifest.library)).href, ini: false }
		, { name: "probe.so", url: pathToFileURL(join(directory, "probe.so")).href, ini: true }];
	await saveLakeFile(directory, "host.mjs", `import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PhpNode} from ${JSON.stringify(pathToFileURL(join(host, "PhpNode.mjs")).href)};
let stdout='',stderr='';
process.setUncaughtExceptionCaptureCallback(error=>{console.error(JSON.stringify({stdout,stderr,error:error.stack}));process.exit(1);});
const php=new PhpNode({version:'8.4',autoTransaction:false,sharedLibs:${JSON.stringify(libraries)}.map(lib=>({...lib,url:new URL(lib.url)})),ini:'memory_limit=512M'});
php.addEventListener('output',event=>{stdout+=event.detail.join('');});php.addEventListener('error',event=>{stderr+=event.detail.join('');});
await php.binary;
const invoke=async(source,expected=0)=>{
  stdout='';stderr='';const status=await php.run(source);
  if(status!==expected||stderr)throw Error(JSON.stringify({status,expected,stdout,stderr}));return stdout;
};
const checkEmpty=stats=>{
  for(const key of ['live','leases','pending','identities','scopes'])assert.equal(stats[key],0,key);
  assert.equal(stats.current,false);assert.equal(stats.retired,false);
};
const observations=[];
for(const strict of [0,1]) {
  await php.writeFile('/check.php',(await readFile('check.php','utf8')).replace('strict_types=0','strict_types='+strict));
  const result=JSON.parse(await invoke("<?php const OWNED_EXPECTED_BITS=32; require '/check.php';"));
  checkEmpty(result.stats);observations.push({strict,...result});await php.refresh();
  checkEmpty(JSON.parse(await invoke('<?php echo json_encode(owned_probe_stats(),JSON_THROW_ON_ERROR);')));await php.refresh();
}
assert.equal(await invoke("<?php echo 'armed'; owned_probe_bailout();",1),'armed');await php.refresh();
const bailouts=[];
for(const strict of [0,1]) {
  await php.writeFile('/bailouts.php',(await readFile('bailouts.php','utf8')).replace('strict_types=0','strict_types='+strict));
  for(let mode=0;mode<7;++mode) {
    const expected=[0,1,5].includes(mode)?0:1;
    assert.equal(await invoke("<?php require '/bailouts.php'; echo 'armed'; abortOwnedRequest("+mode+");",expected),'armed');
    await php.refresh();
    const result=JSON.parse(await invoke("<?php $before=owned_probe_stats(); $owner=owned_probe_new(); "+
      "if(!owned_probe_check($owner))throw new RuntimeException('recovery_failed'); unset($owner); owned_probe_shutdown(); "+
      "echo json_encode(['before'=>$before,'after'=>owned_probe_stats()],JSON_THROW_ON_ERROR);"));
    checkEmpty(result.before);checkEmpty(result.after);bailouts.push({strict,mode,status:expected,...result});await php.refresh();
  }
}
console.log(JSON.stringify({observations,bailouts}));
`);
	diagnostic("Executing owned and borrowed Zend resources and allocation failures in real PHP-Wasm (the pinned host cannot start Fibers)");
	const result = await run(process.execPath, ["host.mjs"]); assert.equal(result.stderr, "");
	const observed = JSON.parse(result.stdout);
	for(const observation of observed.observations)
	{
		assert.ok(observation.checks > 100);
		assert.equal(observation.fiberExecution, false);
		assert.equal(observation.stats.phpBits, 32);
		assert.deepEqual(Object.keys(observation.faults), ["coldNew", "new", "view", "retain", "borrow", "borrowRetain", "check"]);
		assert.ok(Object.values(observation.faults).every(count => count > 0));
	}
	assert.equal(observed.bailouts.length, 14);
	diagnostic(JSON.stringify(observed));
	assert.equal((await readVerifiedPhpWasmCopiedRuntime(runtimeRoot)).identity, runtime.identity);
	const hashes = {};
	for(const path of [...Object.keys(files), "Owned.lean", "Owned.c", "Carriers.c", `${carriers.module}.lean`, "host.mjs"])
		hashes[path] = sha256(await readFile(join(directory, path)));
	return { schemaVersion: 1, profile: "php-wasm-owned-zend-lifetime"
		, installedPackage: false
		, inputs, runtimeIdentity: runtime.identity, compiler
		, files: hashes, wasmSha256: sha256(binary), ...observed };
};
