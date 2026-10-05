/**
 * Fresh consuming Lean exports executed through the real PHP-Wasm Zend VM.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { generateOwnedNativeValueAdapters } from "../../src/backends/native/owned-value-adapters.mjs";
import { ownedAggregateTransferLeaseSource } from "../../src/backends/native/owned-aggregate-transfers.mjs";
import { generateOwnedPhpZendExtension } from "../../src/backends/php/owned-zend-extension.mjs";
import { generateOwnedPhpZendPhp } from "../../src/backends/php/owned-zend-php.mjs";
import { bundledBrickMath } from "../../src/backends/php/brick-math.mjs";
import { validatePhpWasmCopiedBinary } from "../../src/build/php-wasm-copied-artifacts.mjs";
import { nativeAllocationGuardHeader } from "../../src/build/native-allocation-guard.mjs";
import { processBuildRunner } from "../../src/build/process-runner.mjs";
import { compileOwnedAggregateFixture } from "./owned-aggregate-native.mjs";
import { ownedRustTransferConfiguration, ownedRustTransferReviewedIr, ownedRustTransferSource } from "./owned-rust-transfer-fixture.mjs";
import { ownedPhpWasmTransferProbe } from "./owned-php-wasm-transfer-probe.mjs";
import { prepareOwnedPhpWasmRuntime } from "./owned-php-wasm-runtime.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";

/**
 * Native fixture setup authenticates fresh source; only recompiled wasm32
 * objects are linked into the Zend extension used by the PHP interpreter.
 *
 * @param t - Test context owning fresh temporary compilation directories.
 * @param mode - Ordinary source configuration or independently reviewed IR.
 */
export const checkOwnedPhpWasmTransfers = async (t, mode) => {
	const compiled = await compileOwnedAggregateFixture(t, { hostCallbacks: true
		, sourceSuffix: ownedRustTransferSource
		, configuration: await ownedRustTransferConfiguration()
		, ...mode === "reviewed" ? { reviewedIr: ownedRustTransferReviewedIr() } : {} });
	const directory = compiled.directory;
	const input = { metadata: compiled.metadata, sourceIdentity: compiled.sourceIdentity, component: compiled.model.component };
	const native = generateOwnedNativeValueAdapters({ ...input, wordBits: 32, hostCallbacks: true, transferredInputs: true });
	assert.equal(native.carriers.leanSource, compiled.leanSource);
	const extension = generateOwnedPhpZendExtension(native), { model } = extension;
	const php = generateOwnedPhpZendPhp(model);
	assert.equal(model.functions.length, 26);
	assert.equal(model.functions.filter(fn => fn.transfers?.length).length, 20);
	const sdk = resolve(process.env.LEAN_BRIDGE_PHP_EMSDK ?? ".toolchains/emsdk-php-wasm");
	const emcc = join(sdk, "upstream/emscripten/emcc");
	const phpSource = resolve(process.env.LEAN_BRIDGE_PHP_SOURCE ?? "build/php-wasm-sdk/php8.4-src");
	const host = resolve(process.env.LEAN_BRIDGE_PHP_WASM_HOST ?? "build/php-wasm-host/node_modules/php-wasm");
	const runtime = await prepareOwnedPhpWasmRuntime(directory);
	const run = (command, args) => processBuildRunner.capture({ command, args
		, cwd: directory, timeoutMs: 300000
		, env: { ...process.env, EM_CONFIG: join(sdk, ".emscripten"), EMSDK: sdk }
	}).catch(error => { throw new Error(JSON.stringify(error.details ?? error.message), { cause: error }); });
	assert.equal((await run(emcc, ["--version"])).stdout.split("\n")[0], runtime.manifest.compiler.version);
	assert.equal((await run("git", ["-C", sdk, "rev-parse", "HEAD"])).stdout.trim(), runtime.manifest.pins.emsdkCommit);
	for(const [path, entry] of Object.entries(runtime.manifest.compiler.files)) assert.equal(sha256(await readFile(join(sdk, path))), entry.sha256);
	const files = { ...php, ...bundledBrickMath()
		, "owned-values.h": native.typesHeader, "owned-values-codec.h": native.source
		, "owned-leases.h": ownedAggregateTransferLeaseSource
		, "allocation-guard.h": nativeAllocationGuardHeader
		, "extension.c": ownedPhpWasmTransferProbe(extension.source)
		, "check.php": await readFile("tests/fixtures/structured-types/owned-php-wasm-transfers.php", "utf8")
		, "probe.php": (await readFile("tests/fixtures/structured-types/owned-php-zend-generated-probe.php", "utf8"))
			.replace("global $model;", "global $model, $functions; $functions[$name] = true;")
		, "bailouts.php": (await readFile("tests/fixtures/structured-types/owned-php-zend-generated-bailouts.php", "utf8"))
			.replaceAll("owned_generated_", "owned_transfer_")
			.replace("if ($mode === 3) return callback_record($value,", "if ($mode === 3) return callback_record(new Bundle($value->primary->retain(), null, [], [], $value->payload),")
		, "recovery.php": (await readFile("tests/fixtures/structured-types/owned-php-zend-generated-recovery.php", "utf8"))
			.replaceAll("owned_generated_", "owned_transfer_")
		, "probe-model.json": canonicalJson({ transport: model.transport, functions: Object.fromEntries(model.functions.map(fn => [fn.name, fn.publicName])) }) };
	for(const [path, source] of Object.entries(files)) await saveLakeFile(directory, path, source);
	const roots = [directory, join(runtime.root, "include"), phpSource, ...["Zend", "main", "TSRM", "ext"].map(path => join(phpSource, path))];
	const flags = ["-O2", "-g0", "-fPIC", "-fvisibility=hidden", "-ffp-contract=off", "-fbracket-depth=4096", "-DLEAN_EMSCRIPTEN", ...roots.flatMap(path => ["-I", path])];
	t.diagnostic(`${mode}: compiling 26 fresh Lean exports and consuming Zend calls for wasm32`);
	const objects = [];
	for(const name of ["Owned", "Carriers", "Callbacks", "extension"])
	{
		const guards = ["Callbacks", "extension"].includes(name)
			? ["-Wall", "-Wextra", "-Werror", "-Wno-unused-parameter", "-Wno-unused-function"]
			: ["-include", "allocation-guard.h", ...name === "Carriers" ? ["-include", "carriers.h"] : []];
		await run(emcc, [...flags, ...guards, "-c", name + ".c", "-o", name + ".wasm.o"]); objects.push(name + ".wasm.o");
	}
	await run(emcc, [...flags, "-sSIDE_MODULE=2", "-sEXPORTED_FUNCTIONS=['_get_module']", "-Wl,--no-entry", ...objects, join(runtime.root, runtime.manifest.library), "-o", "extension.so"]);
	const binary = await readFile(join(directory, "extension.so")); await validatePhpWasmCopiedBinary(binary, true);
	const libraries = [{ name: basename(runtime.manifest.library), url: pathToFileURL(join(runtime.root, runtime.manifest.library)).href, ini: false }
		, { name: "extension.so", url: pathToFileURL(join(directory, "extension.so")).href, ini: true }];
	const scripts = Object.keys(files).filter(path => path.endsWith(".php") || path.endsWith(".json"));
	await saveLakeFile(directory, "host.mjs", `import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PhpNode} from ${JSON.stringify(pathToFileURL(join(host, "PhpNode.mjs")).href)};
let stdout='',stderr='';
process.setUncaughtExceptionCaptureCallback(error=>{console.error(JSON.stringify({stdout,stderr,error:error.stack}));process.exit(1);});
const php=new PhpNode({version:'8.4',autoTransaction:false,sharedLibs:${JSON.stringify(libraries)}.map(lib=>({...lib,url:new URL(lib.url)})),ini:'memory_limit=512M'});
php.addEventListener('output',event=>{stdout+=event.detail.join('');});php.addEventListener('error',event=>{stderr+=event.detail.join('');});
await php.binary;
const directories=new Set();
for(const path of ${JSON.stringify(scripts)}) {
  let current='';const parts=path.split('/');parts.pop();
  for(const part of parts){current+='/'+part;if(!directories.has(current)){await php.mkdir(current);directories.add(current);}}
  await php.writeFile('/'+path,await readFile(path,'utf8'));
}
const observations=[];
for(const strict of [0,1]) {
  await php.writeFile('/check.php',(await readFile('check.php','utf8')).replace('strict_types=1','strict_types='+strict));
  stdout='';stderr='';const status=await php.run("<?php require '/check.php';");
  if(status||stderr)throw Error(JSON.stringify({strict,status,stdout,stderr,observations}));
  observations.push({strict,...JSON.parse(stdout)});await php.refresh();
}
const empty=stats=>{
  for(const key of ['live','nativeLive','identities','scopes','depth'])assert.equal(stats[key],0,key+': '+JSON.stringify(stats));
  assert.equal(stats.current,false);assert.equal(stats.runtimeState,2);
};
const bailouts=[];
for(const strict of [0,1]) {
  await php.writeFile('/bailouts.php',(await readFile('bailouts.php','utf8')).replace('strict_types=1','strict_types='+strict));
  for(let mode=0;mode<8;++mode) {
    stdout='';stderr='';const expected=[0,1,5].includes(mode)?0:1;
    const status=await php.run("<?php require '/bailouts.php'; echo 'armed'; abortGeneratedRequest("+mode+");");
    if(status!==expected||stdout!=='armed'||stderr)throw Error(JSON.stringify({strict,mode,status,expected,stdout,stderr}));
    await php.refresh();
    stdout='';stderr='';const recovered=await php.run("<?php require '/recovery.php';");
    if(recovered||stderr)throw Error(JSON.stringify({strict,mode,recovered,stdout,stderr}));
    const result=JSON.parse(stdout);empty(result.before);empty(result.after);
    bailouts.push({strict,mode,status,...result});await php.refresh();
  }
}
console.log(JSON.stringify({observations,bailouts}));
`);
	const result = await run(process.execPath, ["host.mjs"]); assert.equal(result.stderr, "");
	const observed = JSON.parse(result.stdout);
	assert.equal(observed.bailouts.length, 16);
	for(const item of observed.observations)
	{
		assert.equal(item.phpBits, 32); assert.ok(item.checks > 100);
		assert.equal(item.live, 0); assert.equal(item.identities, 0);
		assert.deepEqual(item.functions, model.functions.map(fn => fn.name).sort());
	}
	const hashes = {};
	for(const path of [...Object.keys(files), "Owned.lean", "Owned.c", "Carriers.c", "Callbacks.c", native.carriers.module + ".lean", "host.mjs"])
		hashes[path] = sha256(await readFile(join(directory, path)));
	const report = { schemaVersion: 1, profile: "owned-php-wasm-input-transfers"
		, mode, installedPackage: false, compiledLean: true
		, runtimeIdentity: runtime.identity
		, input, sourceSha256: sha256(extension.source), binarySha256: sha256(binary)
		, files: hashes, ...observed };
	t.diagnostic(JSON.stringify({ observations: observed.observations, bailoutRecoveryCases: observed.bailouts.length }));
	await saveLakeFile("build/owned-php-wasm-transfers", `${mode}.json`, canonicalJson(report));
	return report;
};
