/**
 * Execute the generated public PHP ownership API against fresh wasm32 Lean.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { generateOwnedNativeValueAdapters } from "../../src/backends/native/owned-value-adapters.mjs";
import { ownedAggregateLeaseSource } from "../../src/backends/native/owned-aggregate-leases.mjs";
import { generateOwnedPhpZendExtension } from "../../src/backends/php/owned-zend-extension.mjs";
import { generateOwnedPhpZendPhp } from "../../src/backends/php/owned-zend-php.mjs";
import { bundledBrickMath } from "../../src/backends/php/brick-math.mjs";
import { readVerifiedPhpWasmCopiedRuntime, validatePhpWasmCopiedBinary } from "../../src/build/php-wasm-copied-artifacts.mjs";
import { nativeAllocationGuardHeader } from "../../src/build/native-allocation-guard.mjs";
import { processBuildRunner } from "../../src/build/process-runner.mjs";
import { compileOwnedAggregateFixture } from "./owned-aggregate-native.mjs";
import { ownedDotnetCallbacksReviewedIr } from "./owned-dotnet-callback-fixture.mjs";
import { ownedZendGeneratedProbe } from "./owned-php-zend-generated-probe.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";

/**
 * Cover all primitive callbacks and mixed ownership graphs with public types.
 * Native fixture setup supplies fresh authenticated compiler outputs; only the
 * independently recompiled wasm32 objects are linked into this extension.
 *
 * @param t - Test context owning and removing the fresh compilation directory.
 * @param reviewed - Use an independently authored, compiler-checked contract.
 */
export const checkOwnedPhpZendGenerated = async (t, reviewed = false) => {
	const compiled = await compileOwnedAggregateFixture(t, { fixture: "owned-dotnet-callables"
		, hostCallbacks: true
		, ...reviewed ? { reviewedIr: ownedDotnetCallbacksReviewedIr() } : {} });
	const directory = compiled.directory;
	const native = generateOwnedNativeValueAdapters({ metadata: compiled.metadata
		, sourceIdentity: compiled.sourceIdentity
		, component: compiled.model.component, wordBits: 32, hostCallbacks: true });
	assert.equal(native.carriers.leanSource, compiled.leanSource);
	const extension = generateOwnedPhpZendExtension(native), { model } = extension;
	const php = generateOwnedPhpZendPhp(model);
	const sdk = resolve(process.env.LEAN_BRIDGE_PHP_EMSDK ?? ".toolchains/emsdk-php-wasm");
	const emcc = join(sdk, "upstream/emscripten/emcc");
	const phpSource = resolve(process.env.LEAN_BRIDGE_PHP_SOURCE ?? "build/php-wasm-sdk/php8.4-src");
	const host = resolve(process.env.LEAN_BRIDGE_PHP_WASM_HOST ?? "build/php-wasm-host/node_modules/php-wasm");
	const runtimeRoot = resolve(process.env.LEAN_BRIDGE_TEST_PHP_COPIED_RUNTIME ?? "build/owned-wasm32-runtime");
	const runtime = await readVerifiedPhpWasmCopiedRuntime(runtimeRoot);
	const run = (command, args) => processBuildRunner.capture({ command, args
		, cwd: directory, timeoutMs: 240000
		, env: { ...process.env, EM_CONFIG: join(sdk, ".emscripten"), EMSDK: sdk }
	}).catch(error => { throw new Error(JSON.stringify(error.details ?? error.message), { cause: error }); });
	assert.equal((await run(emcc, ["--version"])).stdout.split("\n")[0], runtime.manifest.compiler.version);
	assert.equal((await run("git", ["-C", sdk, "rev-parse", "HEAD"])).stdout.trim(), runtime.manifest.pins.emsdkCommit);
	for(const [path, entry] of Object.entries(runtime.manifest.compiler.files)) assert.equal(sha256(await readFile(join(sdk, path))), entry.sha256);
	const files = { ...php, ...bundledBrickMath()
		, "owned-values.h": native.typesHeader, "owned-values-codec.h": native.source
		, "owned-leases.h": ownedAggregateLeaseSource
		, "allocation-guard.h": nativeAllocationGuardHeader
		, "extension.c": ownedZendGeneratedProbe(extension.source, model)
		, "check.php": await readFile("tests/fixtures/structured-types/owned-php-zend-generated.php", "utf8")
		, "probe.php": await readFile("tests/fixtures/structured-types/owned-php-zend-generated-probe.php", "utf8")
		, "bailouts.php": await readFile("tests/fixtures/structured-types/owned-php-zend-generated-bailouts.php", "utf8")
		, "recovery.php": await readFile("tests/fixtures/structured-types/owned-php-zend-generated-recovery.php", "utf8")
		, "malformed.php": await readFile("tests/fixtures/structured-types/owned-php-zend-generated-malformed.php", "utf8")
		, "probe-model.json": canonicalJson({ transport: model.transport, functions: Object.fromEntries(model.functions.map(fn => [fn.name, fn.publicName])) }) };
	for(const [path, source] of Object.entries(files)) await saveLakeFile(directory, path, source);
	const roots = [directory, join(runtimeRoot, "include"), phpSource, ...["Zend", "main", "TSRM", "ext"].map(path => join(phpSource, path))];
	const flags = ["-O2", "-g0", "-fPIC", "-fvisibility=hidden", "-ffp-contract=off", "-fbracket-depth=4096", "-DLEAN_EMSCRIPTEN", ...roots.flatMap(path => ["-I", path])];
	t.diagnostic(`Compiling fresh wasm32 Lean, ${model.functions.length} exports and ${model.callbacks.length} typed Zend callbacks`);
	const objects = [];
	for(const name of ["Owned", "Carriers", "Callbacks", "extension"])
	{
		const guards = ["Callbacks", "extension"].includes(name)
			? ["-Wall", "-Wextra", "-Werror", "-Wno-unused-parameter", "-Wno-unused-function"]
			: ["-include", "allocation-guard.h", ...name === "Carriers" ? ["-include", "carriers.h"] : []];
		await run(emcc, [...flags, ...guards, "-c", name + ".c", "-o", name + ".wasm.o"]); objects.push(name + ".wasm.o");
	}
	await run(emcc, [...flags, "-sSIDE_MODULE=2", "-sEXPORTED_FUNCTIONS=['_get_module']", "-Wl,--no-entry", ...objects, join(runtimeRoot, runtime.manifest.library), "-o", "extension.so"]);
	const binary = await readFile(join(directory, "extension.so")); await validatePhpWasmCopiedBinary(binary, true);
	const libraries = [{ name: basename(runtime.manifest.library), url: pathToFileURL(join(runtimeRoot, runtime.manifest.library)).href, ini: false }
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
const malformed=Number(process.argv[2]??0);
if(malformed) {
  stdout='';stderr='';const status=await php.run("<?php const OUTPUT_MODE="+malformed+"; require '/malformed.php';");
  if(status||stderr)throw Error(JSON.stringify({malformed,status,stdout,stderr}));
  console.log(stdout);process.exit(0);
}
const observations=[];
for(const strict of [0,1]) {
  await php.writeFile('/check.php',(await readFile('check.php','utf8')).replace('strict_types=1','strict_types='+strict));
  stdout='';stderr='';const status=await php.run("<?php require '/check.php';");
  if(status||stderr)throw Error(JSON.stringify({strict,status,stdout,stderr,observations}));
  observations.push({strict,...JSON.parse(stdout)});await php.refresh();
}
const empty=stats=>{
  for(const key of ['live','identities','scopes','depth'])assert.equal(stats[key],0,key+': '+JSON.stringify(stats));
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
	t.diagnostic("Executing generated PHP value classes, typed host callbacks, retained closures and failure paths in actual PHP-Wasm");
	const result = await run(process.execPath, ["host.mjs"]); assert.equal(result.stderr, "");
	const observed = JSON.parse(result.stdout);
	assert.equal(observed.observations[0].initialState, 0);
	for(const observation of observed.observations)
	{
		assert.equal(observation.phpBits, 32); assert.equal(observation.scalarCalls, 19);
		assert.equal(observation.structuredCalls, 24);
		assert.ok(observation.checks > 100); assert.equal(observation.live, 0); assert.equal(observation.identities, 0);
	}
	assert.equal(observed.bailouts.length, 16);
	observed.malformed = [];
	for(let mode = 1; mode <= 9; mode++)
	{
		const result = await run(process.execPath, ["host.mjs", String(mode)]);
		assert.equal(result.stderr, "");
		const rejected = JSON.parse(result.stdout);
		assert.equal(rejected.mode, mode); assert.ok(rejected.checks >= 7);
		assert.equal(rejected.after.live, 0); assert.equal(rejected.after.identities, 0);
		observed.malformed.push(rejected);
	}
	assert.equal((await readVerifiedPhpWasmCopiedRuntime(runtimeRoot)).identity, runtime.identity);
	const hashes = {};
	for(const path of [...Object.keys(files), "Owned.lean", "Owned.c", "Carriers.c", "Callbacks.c", native.carriers.module + ".lean", "host.mjs"])
		hashes[path] = sha256(await readFile(join(directory, path)));
	const report = { profile: "generated-php-wasm-owned-values"
		, installedPackage: false
		, compiledLean: true, runtimeIdentity: runtime.identity
		, reviewed
		, sourceIdentitySha256: sha256(canonicalJson(compiled.sourceIdentity))
		, inputs: { metadata: compiled.metadata
			, sourceIdentity: compiled.sourceIdentity
			, component: compiled.model.component, wordBits: 32, hostCallbacks: true }
		, sourceSha256: sha256(extension.source), binarySha256: sha256(binary)
		, files: hashes
		, ...observed };
	t.diagnostic(JSON.stringify({ observations: observed.observations
		, bailoutRecoveryCases: observed.bailouts.length
		, malformedOutputCases: observed.malformed.length }));
	await saveLakeFile("build/owned-php-zend", reviewed ? "generated-reviewed.json" : "generated.json", canonicalJson(report));
	return report;
};
