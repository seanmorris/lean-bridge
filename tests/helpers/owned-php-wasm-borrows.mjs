/**
 * Fresh owner-anchored Lean APIs executed inside the real wasm32 Zend runtime.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { generateOwnedNativeValueAdapters } from "../../src/backends/native/owned-value-adapters.mjs";
import { ownedAggregateTransferRuntime } from "../../src/backends/native/owned-aggregate-transfers.mjs";
import { ownedAggregateLeaseRuntime } from "../../src/backends/native/owned-aggregate-leases.mjs";
import { generateOwnedPhpZendExtension } from "../../src/backends/php/owned-zend-extension.mjs";
import { generateOwnedPhpZendPhp } from "../../src/backends/php/owned-zend-php.mjs";
import { bundledBrickMath } from "../../src/backends/php/brick-math.mjs";
import { validatePhpWasmCopiedBinary } from "../../src/build/php-wasm-copied-artifacts.mjs";
import { nativeAllocationGuardHeader } from "../../src/build/native-allocation-guard.mjs";
import { processBuildRunner } from "../../src/build/process-runner.mjs";
import { compileOwnedAggregateFixture } from "./owned-aggregate-native.mjs";
import { ownedRustBorrowConfiguration, ownedRustBorrowReviewedIr, ownedRustBorrowSource } from "./owned-rust-borrow-fixture.mjs";
import { ownedBorrowConfiguration, ownedBorrowReviewedIr } from "./owned-borrow-fixture.mjs";
import { ownedPhpWasmTransferProbe } from "./owned-php-wasm-transfer-probe.mjs";
import { prepareOwnedPhpWasmRuntime } from "./owned-php-wasm-runtime.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";
import { rejectOwnedPhpWasmBorrowMutants } from "./owned-php-wasm-borrow-mutants.mjs";
import { ownedRustReceiverConfiguration, ownedRustReceiverReviewedIr, ownedRustReceiverSource } from "./owned-rust-receiver-fixture.mjs";

/**
 * Recompile captured Lean for wasm32. No native fixture objects enter the VM.
 *
 * @param t - Test context owning temporary compilation and execution files.
 * @param mode - Ordinary-source or independently reviewed API.
 * @param options - Additional compiler fixture coverage.
 * @param options.borrowOnly - Require working borrowed results without transfers.
 * @param options.receiverExports - Exercise nominal members and receiver anchors.
 */
export const checkOwnedPhpWasmBorrows = async (t, mode, { borrowOnly = false, receiverExports = false } = {}) => {
	assert.ok(!borrowOnly || !receiverExports);
	const compiled = await compileOwnedAggregateFixture(t, { hostCallbacks: true
		, sourceSuffix: receiverExports ? ownedRustReceiverSource : borrowOnly ? "" : ownedRustBorrowSource
		, configuration: receiverExports ? await ownedRustReceiverConfiguration() : borrowOnly ? await ownedBorrowConfiguration() : await ownedRustBorrowConfiguration()
		, ...mode === "reviewed" ? { reviewedIr: receiverExports ? ownedRustReceiverReviewedIr() : borrowOnly ? ownedBorrowReviewedIr() : ownedRustBorrowReviewedIr() } : {} });
	const directory = compiled.directory;
	const input = { metadata: compiled.metadata, sourceIdentity: compiled.sourceIdentity, component: compiled.model.component };
	const native = generateOwnedNativeValueAdapters({ ...input, wordBits: 32
		, hostCallbacks: true, transferredInputs: true
		, anchoredResults: true, receiverExports });
	assert.equal(native.carriers.leanSource, compiled.leanSource);
	const extension = generateOwnedPhpZendExtension(native), { model } = extension;
	assert.equal(model.functions.some(fn => fn.transfers?.length), !borrowOnly);
	if(receiverExports)
	{
		assert.equal(model.functions.filter(fn => fn.receiver === 0).length, 16);
		assert.equal(model.functions.find(fn => fn.name === "chooseTicket").anchor, 1);
		assert.equal(model.functions.find(fn => fn.name === "retainTicket").anchor, 0);
	}
	const php = generateOwnedPhpZendPhp(model);
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
		, "owned-leases.h": (borrowOnly ? ownedAggregateLeaseRuntime : ownedAggregateTransferRuntime)({ anchoredResults: true })
		, "allocation-guard.h": nativeAllocationGuardHeader
		, "extension.c": ownedPhpWasmTransferProbe(extension.source, { consume: "static void lgo_whole_consume(void *opaque) {" })
		, "check.php": await readFile(`tests/fixtures/structured-types/owned-php-wasm-${borrowOnly ? "borrow-only" : "borrows"}.php`, "utf8")
		, "checkpoints.php": await readFile("tests/fixtures/structured-types/owned-php-wasm-borrow-checkpoints.php", "utf8")
		, "bailouts.php": await readFile("tests/fixtures/structured-types/owned-php-wasm-borrow-bailouts.php", "utf8")
		, "recovery.php": await readFile("tests/fixtures/structured-types/owned-php-wasm-borrow-recovery.php", "utf8")
		, "probe.php": (await readFile("tests/fixtures/structured-types/owned-php-zend-generated-probe.php", "utf8"))
			.replace("$checks = 0;", "$checks = 0; require __DIR__ . '/checkpoints.php';")
			.replace("global $model;", "global $model, $functions; $functions[$name] = true;")
			.replace("$item instanceof Resource", "$item instanceof Resource || $item instanceof \\LeanOwnedAggregates\\Value")
		, "probe-model.json": canonicalJson({ transport: model.transport, functions: Object.fromEntries(model.functions.map(fn => [fn.name, fn.publicName])) }) };
	if(receiverExports)
	{
		const members = (await readFile("tests/fixtures/structured-types/owned-php-wasm-receivers.php", "utf8")).replace("<?php\n", "");
		const first = "$root = ticket(); $alias = $root->share(); $view = owned_call('retainTicket', [$root]);";
		assert.equal(files["check.php"].split(first).length, 2);
		files["check.php"] = files["check.php"].replace(first, members + "\nreceiver_members(); balanced();\n\n" + first);
	}
	const checkpoint = "private static function checkpoint(): void {}";
	assert.equal(files["src/Internal/Wire.php"].split(checkpoint).length, 2);
	files["src/Internal/Wire.php"] = files["src/Internal/Wire.php"].replace(checkpoint,
		"private static function checkpoint(): void { \\owned_php_checkpoint(); }");
	const firstFrame = "        $stack = [new GraphWireFrame($type, $value, 0)];";
	assert.equal(files["src/Internal/Wire.php"].split(firstFrame).length, 2);
	files["src/Internal/Wire.php"] = files["src/Internal/Wire.php"].replace(firstFrame, "        self::checkpoint();\n" + firstFrame);
	const wrap = "        Native::owner('check', $type, $owner);";
	assert.equal(files["src/Internal/Values.php"].split(wrap).length, 2);
	files["src/Internal/Values.php"] = files["src/Internal/Values.php"].replace(wrap, "        \\owned_php_checkpoint('owner');\n" + wrap);
	for(const [path, source] of Object.entries(files)) await saveLakeFile(directory, path, source);
	const roots = [directory, join(runtime.root, "include"), phpSource, ...["Zend", "main", "TSRM", "ext"].map(path => join(phpSource, path))];
	const flags = ["-O2", "-g0", "-fPIC", "-fvisibility=hidden", "-ffp-contract=off", "-fbracket-depth=4096", "-DLEAN_EMSCRIPTEN", ...roots.flatMap(path => ["-I", path])];
	t.diagnostic(`${mode}: compile ${model.functions.length} Lean exports with ${model.functions.filter(fn => fn.anchor !== undefined).length} original-owner result anchors`);
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
const php=new PhpNode({version:'8.4',autoTransaction:false,sharedLibs:${JSON.stringify(libraries)}.map(lib=>({...lib,url:new URL(lib.url)})),ini:'memory_limit=512M\\nzend.exception_ignore_args=0'});
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
if(!${borrowOnly})for(const strict of [0,1]) {
  await php.writeFile('/bailouts.php',(await readFile('bailouts.php','utf8')).replace('strict_types=1','strict_types='+strict));
  for(const consume of [false,true])for(let mode=0;mode<9;++mode) {
    stdout='';stderr='';const expected=[0,1,5].includes(mode)?0:1;
    const status=await php.run("<?php require '/bailouts.php'; echo 'armed'; abortBorrowRequest("+mode+","+(consume?'true':'false')+");");
    if(status!==expected||stdout!=='armed'||stderr)throw Error(JSON.stringify({strict,consume,mode,status,expected,stdout,stderr}));
    await php.refresh();stdout='';stderr='';const recovered=await php.run("<?php require '/recovery.php';");
    if(recovered||stderr)throw Error(JSON.stringify({strict,consume,mode,recovered,stdout,stderr}));
    const result=JSON.parse(stdout);empty(result.before);empty(result.after);
    bailouts.push({strict,consume,mode,status,...result});await php.refresh();
  }
}
console.log(JSON.stringify({observations,bailouts}));
`);
	const result = await run(process.execPath, ["host.mjs"]); assert.equal(result.stderr, "");
	const observed = JSON.parse(result.stdout);
	assert.equal(observed.bailouts.length, borrowOnly ? 0 : 36);
	for(const item of observed.observations)
	{
		assert.equal(item.phpBits, 32); assert.ok(item.checks > (borrowOnly ? 20 : 1600));
		if(!borrowOnly) assert.ok(item.heldErrors > 260);
		if(!borrowOnly) for(const shape of ["borrow", "move", "mixed", "copy"]) for(const domain of ["zend", "php"])
		{
			assert.ok(item.faults[shape][domain].before > 0);
			if(["move", "mixed"].includes(shape)) assert.ok(item.faults[shape][domain].after > 0);
		}
		assert.equal(item.live, 0); assert.equal(item.identities, 0);
		assert.deepEqual(item.functions, borrowOnly ? ["echoArray", "echoList", "echoNested", "echoOption"] : model.functions.map(fn => fn.name).sort());
	}
	const hashes = {};
	for(const path of [...Object.keys(files), "Owned.lean", "Owned.c", "Carriers.c", "Callbacks.c", native.carriers.module + ".lean", "host.mjs"])
		hashes[path] = sha256(await readFile(join(directory, path)));
	const compileMutant = async () => {
		await run(emcc, [...flags, "-Wall", "-Wextra", "-Werror", "-Wno-unused-parameter", "-Wno-unused-function", "-c", "extension.c", "-o", "extension.wasm.o"]);
		await run(emcc, [...flags, "-sSIDE_MODULE=2", "-sEXPORTED_FUNCTIONS=['_get_module']", "-Wl,--no-entry", ...objects, join(runtime.root, runtime.manifest.library), "-o", "extension.so"]);
	};
	const mutants = borrowOnly ? [] : await rejectOwnedPhpWasmBorrowMutants({ directory, files, run, compile: compileMutant, receiverExports });
	assert.equal(mutants.length, borrowOnly ? 0 : receiverExports ? 8 : 6);
	if(receiverExports)
	{
		const restored = await run(process.execPath, ["host.mjs"]);
		assert.equal(restored.stderr, ""); assert.deepEqual(JSON.parse(restored.stdout), observed);
	}
	const report = { schemaVersion: 1
		, mode
		, ...receiverExports ? { receiverExports: true, restoredAfterMutations: true } : {}
		, installedPackage: false
		, compiledLean: true
		, borrowOnly
		, runtimeIdentity: runtime.identity
		, input
		, mutants
		, sourceSha256: sha256(extension.source)
		, binarySha256: sha256(binary), files: hashes, ...observed };
	t.diagnostic(JSON.stringify({ observations: observed.observations, bailoutRecoveryCases: observed.bailouts.length }));
	await saveLakeFile(receiverExports ? "build/owned-php-wasm-receivers" : "build/owned-php-wasm-borrows", `${mode}${borrowOnly ? "-borrow-only" : ""}.json`, canonicalJson(report));
	return report;
};
