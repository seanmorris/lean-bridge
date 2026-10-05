/**
 * Fresh Lean and generated recursive Zend callables on the actual wasm32 host.
 * This conversion probe uses independently stated IR, not an installed receipt.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { sha256 } from "../../src/capsule/node.mjs";
import { createNativeCallableGraphDescriptor } from "../../src/build/native-callable-graph.mjs";
import { generateCompiledPhpWasmLeanAdapters } from "../../src/build/php-wasm-graph-model.mjs";
import { generateCompiledPhpWasmGraph } from "../../src/build/php-wasm-graph-component.mjs";
import { buildPhpWasmCopiedRuntime } from "../../src/build/php-wasm-copied-component.mjs";
import { phpWasmCopiedPins as pins, readVerifiedPhpWasmCopiedRuntime, validatePhpWasmCopiedBinary } from "../../src/build/php-wasm-copied-artifacts.mjs";
import { processBuildRunner } from "../../src/build/process-runner.mjs";
import { bundledBrickMath } from "../../src/backends/php/brick-math.mjs";
import { structuredCallableReviewedIr } from "./structured-callable-fixture.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";
import { phpWasmRecursiveMalformedProbe } from "./php-wasm-recursive-callable-malformed.mjs";
import { phpWasmRecursiveOwnershipProbe } from "./php-wasm-recursive-callable-ownership.mjs";
import { phpWasmRecursiveReplyProbe } from "./php-wasm-recursive-callable-replies.mjs";

const instrumentation = `#include <php.h>
#include <stdlib.h>
#include <lean_bridge_native_runtime.h>
static size_t native_live, zend_live, closes, native_attempts, zend_attempts, native_fail, zend_fail;
static void *probe_malloc(size_t bytes) {
  if (++native_attempts == native_fail) return NULL;
  void *p = malloc(bytes); if (p) native_live++; return p;
}
static void probe_free(void *p) { if (p) { native_live--; free(p); } }
static void *probe_calloc(size_t n, size_t bytes) {
  if (++zend_attempts == zend_fail) return NULL;
  void *p = calloc(n, bytes); if (p) zend_live++; return p;
}
static void probe_zend_free(void *p) { if (p) { zend_live--; free(p); } }
#define LB_GRAPH_MALLOC probe_malloc
#define LB_GRAPH_FREE probe_free
#define LB_ZEND_CALLOC probe_calloc
#define LB_ZEND_FREE probe_zend_free
ZEND_BEGIN_ARG_INFO_EX(probe_args, 0, 0, 0)
ZEND_END_ARG_INFO()
static ZEND_FUNCTION(recursive_probe_stats) {
  lean_bridge_native_snapshot snapshot; lean_bridge_native_snapshot_read(&snapshot);
  array_init(return_value);
  add_assoc_long(return_value, "nativeLive", native_live); add_assoc_long(return_value, "zendLive", zend_live);
  add_assoc_long(return_value, "closes", closes); add_assoc_long(return_value, "identities", snapshot.live_identities);
  add_assoc_long(return_value, "nativeAttempts", native_attempts); add_assoc_long(return_value, "zendAttempts", zend_attempts);
}
ZEND_BEGIN_ARG_INFO_EX(probe_reset_args, 0, 0, 2)
  ZEND_ARG_INFO(0, phase)
  ZEND_ARG_INFO(0, point)
ZEND_END_ARG_INFO()
static ZEND_FUNCTION(recursive_probe_reset) {
  zend_long phase, point;
  ZEND_PARSE_PARAMETERS_START(2, 2) Z_PARAM_LONG(phase) Z_PARAM_LONG(point) ZEND_PARSE_PARAMETERS_END();
  if (native_live || zend_live || phase < 0 || phase > 2 || point < 0) { zend_value_error("Invalid allocator reset"); RETURN_THROWS(); }
  native_attempts = zend_attempts = 0;
  native_fail = phase == 1 ? (size_t)point : 0; zend_fail = phase == 2 ? (size_t)point : 0;
  RETURN_NULL();
}
`;

/**
 * Assemble the exact instrumented C compiled by the wasm32 acceptance probe.
 *
 * @param ir - Independently stated callable fixture IR.
 * @param generated - Original production graph sources and manifest.
 */
export const phpWasmRecursiveProbeSource = (ir, generated) => {
	const malformed = phpWasmRecursiveMalformedProbe(ir, generated);
	const ownership = phpWasmRecursiveOwnershipProbe(ir);
	const original = generated.files[`extension/${generated.manifest.extension}.c`];
	const replies = phpWasmRecursiveReplyProbe(ir, original);
	assert.equal(original.split("uint64_t token = owner->token; owner->token = 0;").length, 2);
	assert.equal(original.split("  PHP_FE_END").length, 2);
	const extension = replies.source.replace("uint64_t token = owner->token; owner->token = 0;", "++closes; uint64_t token = owner->token; owner->token = 0;")
		.replaceAll("array_init(", "PROBE_ARRAY_INIT(").replaceAll("array_init_size(", "PROBE_ARRAY_INIT_SIZE(")
		.replaceAll("ZVAL_STRINGL(", "PROBE_STRING(")
		.replace("  PHP_FE_END", "  ZEND_FE(recursive_probe_stats, probe_args)\n  ZEND_FE(recursive_probe_reset, probe_reset_args)\n" + malformed.registration + ownership.registration + replies.registration + "  PHP_FE_END");
	return malformed.declarations + ownership.declarations + replies.declarations
		+ instrumentation.replace('  add_assoc_long(return_value, "nativeAttempts"', malformed.statistics + ownership.statistics + replies.statistics + '  add_assoc_long(return_value, "nativeAttempts"')
		+ malformed.transport + "\n" + malformed.lifecycle + "\n" + extension + ownership.definitions;
};

/**
 * Validate all public shapes, native/Zend allocation failures and recovery.
 *
 * @param directory - Test-owned scratch; the calling test removes it.
 * @param diagnostic - Progress reporter.
 */
export const checkPhpWasmRecursiveGenerated = async (directory, diagnostic = () => {}) => {
	const lean = resolve(process.env.LEAN_BRIDGE_LEAN_PREFIX ?? ".toolchains/elan/toolchains/leanprover--lean4---v4.32.2");
	const sdk = resolve(process.env.LEAN_BRIDGE_PHP_EMSDK ?? ".toolchains/emsdk-php-wasm");
	const php = resolve(process.env.LEAN_BRIDGE_PHP_SOURCE ?? "build/php-wasm-sdk/php8.4-src");
	const host = resolve(process.env.LEAN_BRIDGE_PHP_WASM_HOST ?? "build/php-wasm-host/node_modules/php-wasm");
	const emcc = join(sdk, "upstream/emscripten/emcc");
	const run = (command, args) => processBuildRunner.capture({
		command, args, cwd: directory, timeoutMs: 300000
		, env: { ...process.env, LEAN_PATH: directory, PATH: join(lean, "bin") + ":" + process.env.PATH, EM_CONFIG: join(sdk, ".emscripten"), EMSDK: sdk } })
		.catch(error => { throw new Error(JSON.stringify(error.details ?? error.message), { cause: error }); });
	diagnostic("Building a fresh wasm32 runtime for recursive Zend conversions");
	const runtimeRoot = join(directory, "runtime");
	const runtime = await buildPhpWasmCopiedRuntime({
		outputRoot: runtimeRoot, emsdkRoot: sdk
		, leanRuntimeRoot: resolve(process.env.LEAN_BRIDGE_PHP_LEAN_RUNTIME ?? `build/lean-runtime/${pins.leanCommit}-${pins.patchSetSha256}-browser-php-wasm-3.1.68`) });
	const ir = structuredCallableReviewedIr({ recursive: true }), descriptor = createNativeCallableGraphDescriptor(ir);
	const model = { schemaVersion: 4, profile: "php-wasm-copied-v1"
		, pointerBits: 32, byteOrder: "little"
		, bindingIr: ir, copiedGraph: descriptor, component: ir.component
		, exports: ir.declarations.map(item => ({ bindingId: item.id, name: item.source.declaration, module: "Structured" })) };
	const adapters = generateCompiledPhpWasmLeanAdapters(model), generated = generateCompiledPhpWasmGraph(model, adapters);
	const ownership = phpWasmRecursiveOwnershipProbe(ir);
	const probe = phpWasmRecursiveProbeSource(ir, generated);
	const source = await readFile("tests/fixtures/onboarding/structured-callables/Structured.lean", "utf8");
	const files = { ...generated.files, ...bundledBrickMath(), "Structured.lean": source
		, [adapters.module + ".lean"]: adapters.leanSource
		, "component.h": adapters.header, "probe.c": probe };
	for(const [name, text] of Object.entries(files)) await saveLakeFile(directory, name, text);
	for(const module of ["Structured", adapters.module]) await run(join(lean, "bin/lean"), ["-o", module + ".olean", "-c", module + ".c", module + ".lean"]);
	diagnostic("Compiling all generated callback signatures with strict C warnings");
	const flags = ["-O2", "-g0", "-fPIC"
		, "-fvisibility=hidden", "-ffp-contract=off"
		, "-fbracket-depth=4096", "-DLEAN_EMSCRIPTEN"
		, ...[directory, join(directory, "include"), join(runtimeRoot, "include"), php, ...["Zend", "main", "TSRM", "ext"].map(path => join(php, path))].flatMap(path => ["-I", path])];
	const objects = [];
	for(const name of ["Structured", adapters.module, "graph/callbacks", "probe"])
	{
		const warnings = ["graph/callbacks", "probe"].includes(name)
			? ["-Wall", "-Wextra", "-Werror", "-Wno-unused-parameter", "-Wno-unused-function"] : ["-Werror=date-time"];
		await run(emcc, [...flags, ...warnings, "-c", name + ".c", "-o", name + ".o"]); objects.push(name + ".o");
	}
	await run(emcc, [...flags, "-sSIDE_MODULE=2", "-sEXPORTED_FUNCTIONS=['_get_module']", "-Wl,--no-entry", ...objects, join(runtimeRoot, runtime.manifest.library), "-o", "probe.so"]);
	await validatePhpWasmCopiedBinary(await readFile(join(directory, "probe.so")), true);
	const common = await readFile("tests/fixtures/structured-callable-consumers/php-wasm-recursive-wrapper.php", "utf8");
	assert.equal(common.split("$tree = new TreeLeaf(Big::of(7));").length, 2);
	const base = common.split("$tree = new TreeLeaf(Big::of(7));")[0].replace("require __DIR__ . '/transport.php';\n", "")
		.replaceAll("$GLOBALS['closed']", "recursive_probe_stats()['closes']");
	const tail = await readFile("tests/fixtures/structured-callable-consumers/php-wasm-recursive-generated.php", "utf8"), consumer = base + tail;
	const libraries = [{ name: basename(runtime.manifest.library), url: pathToFileURL(join(runtimeRoot, runtime.manifest.library)).href, ini: false }
		, { name: "probe.so", url: pathToFileURL(join(directory, "probe.so")).href, ini: true }];
	const scripts = Object.keys(files).filter(path => path.endsWith(".php"));
	const runner = `import { PhpNode } from ${JSON.stringify(pathToFileURL(join(host, "PhpNode.mjs")).href)};
import { readFile } from 'node:fs/promises';
process.setUncaughtExceptionCaptureCallback(error => { console.error(error.stack); process.exit(1); });
const libraries=${JSON.stringify(libraries)};
if(process.argv[2]==='mutant')libraries[1].url=${JSON.stringify(pathToFileURL(join(directory, "probe-mutant.so")).href)};
if(process.argv[2]==='reply-mutant')libraries[1].url=${JSON.stringify(pathToFileURL(join(directory, "probe-reply-mutant.so")).href)};
const php = new PhpNode({version:'8.4',autoTransaction:false,sharedLibs:libraries.map(value=>({...value,url:new URL(value.url)})),ini:'memory_limit=512M'});
let stdout='',stderr='';
php.addEventListener('output',event=>stdout+=event.detail.join(''));php.addEventListener('error',event=>stderr+=event.detail.join(''));
await php.binary;
const directories=new Set();
for(const path of ${JSON.stringify([...scripts, "check.php"])}) {
  let current='';const parts=path.split('/');parts.pop();
  for(const part of parts) { current+='/'+part;if(!directories.has(current)){await php.mkdir(current);directories.add(current);} }
  await php.writeFile('/'+path,await readFile(path,'utf8'));
}
const status=await php.run("<?php require '/check.php';");
if(status||stderr)throw Error(JSON.stringify({status,stdout,stderr}));console.log(stdout);
`;
	await saveLakeFile(directory, "host.mjs", runner);
	const observations = [];
	for(const mode of [0, 1])
	{
		diagnostic(`Executing ${mode ? "strict" : "weak"} wasm32 PHP callbacks and allocation failures`);
		await saveLakeFile(directory, "check.php", consumer.replace("strict_types=0", "strict_types=" + mode));
		const output = await run(process.execPath, ["host.mjs"]); assert.equal(output.stderr, "");
		const observed = JSON.parse(output.stdout);
		assert.equal(observed.actualPhpBits, 32); assert.equal(observed.compiledLean, true); assert.equal(observed.installedPackage, false);
		assert.ok(observed.checks > 10000);
		for(const key of ["faults", "ownedFaults"])
		{
			assert.deepEqual(Object.keys(observed[key]), ["array", "list", "option", "result", "tuple", "record", "variant", "alias", "recursive"]);
			for(const [shape, faults] of Object.entries(observed[key]))
			{
				assert.ok(faults.zend > 0);
				assert.ok(faults.native > 0 || shape === "option" && faults.native === 0);
			}
		}
		assert.equal(observed.capacity, 4096); assert.equal(observed.recovered, 8192);
		for(const key of ["foreignResourceRejected", "closedResourceRejected", "wrongSignatureRejected"]) assert.equal(observed[key], true);
		for(const name of ["nativeLive", "zendLive", "identities"]) assert.equal(observed.stats[name], 0);
		assert.equal(observed.stats.retirements, 0); assert.equal(observed.stats.poisoned, 0);
		observations.push({ mode, ...observed }); diagnostic(JSON.stringify(observations.at(-1)));
	}
	const ownershipSource = base + (await readFile("tests/fixtures/structured-callable-consumers/php-wasm-recursive-ownership.php", "utf8"))
		.replaceAll("CALLBACK_COUNT", String(ownership.callbacks));
	const ownershipResults = [];
	for(const strict of [0, 1])
	{
		diagnostic(`Callback identities, uint64 generations, active close and context exhaustion in ${strict ? "strict" : "weak"} wasm32 PHP`);
		await saveLakeFile(directory, "check.php", ownershipSource.replace("strict_types=0", "strict_types=" + strict));
		const output = await run(process.execPath, ["host.mjs"]); assert.equal(output.stderr, "");
		const observed = JSON.parse(output.stdout);
		assert.equal(observed.actualPhpBits, 32);
		assert.equal(observed.contextChecks, 3 * ownership.callbacks + 9 * (2 * ownership.callbacks - 1));
		assert.equal(observed.staleGenerationChecks, 6); assert.equal(observed.tokenHighBitsPreserved, true);
		assert.equal(observed.activeClose, 2); assert.equal(observed.contextExhaustionRejections, 3);
		assert.equal(observed.stats.contextsExhausted, true);
		for(const name of ["nativeLive", "zendLive", "identities", "borrowedContexts", "callDepth"]) assert.equal(observed.stats[name], 0);
		ownershipResults.push({ strict, ...observed }); diagnostic(JSON.stringify(ownershipResults.at(-1)));
	}
	const bailoutSource = (await readFile("tests/fixtures/structured-callable-consumers/php-wasm-recursive-bailouts.php", "utf8"))
		.replaceAll("PRIVATE_ARRAY_CALL", JSON.stringify(ownership.privateArrayCall));
	const request = 'const status=await php.run("<?php require \'/check.php\';");\nif(status||stderr)throw Error(JSON.stringify({status,stdout,stderr}));console.log(stdout);';
	assert.equal(runner.split(request).length, 2);
	const bailoutRunner = runner.replace(request, `const observations=[];
const control=await php.run("<?php echo 'armed'; recursive_probe_bailout();");
if(control!==1||stderr||stdout!=='armed')throw Error(JSON.stringify({phase:'raw-bailout-control',status:control,stdout,stderr}));
await php.refresh();
for(let mode=0;mode<5;++mode) {
  stdout='';stderr='';
  const status=await php.run("<?php require '/check.php'; echo 'armed'; abortRecursiveRequest("+mode+");");
  const expectedStatus=mode===0||mode===4?0:control;
  if(status!==expectedStatus||stderr||stdout!=='armed')throw Error(JSON.stringify({mode,phase:'abort',status,stdout,stderr}));
  await php.refresh(); stdout='';stderr='';
  const recovery=await php.run("<?php require '/check.php'; "+
    "$before=recursive_probe_stats(); foreach(['nativeLive','zendLive','identities','borrowedContexts','callDepth'] as $key) "+
    "if($before[$key]!==0)throw new RuntimeException('abort_cleanup_'+$key); "+
    "$reply=LeanStructured\\\\call_array([new LeanStructured\\\\Some('recovered')],fn($value)=>$value); "+
    "if($reply[0]->value!=='recovered')throw new RuntimeException('abort_recovery_reply'); "+
    "$after=recursive_probe_stats(); foreach(['nativeLive','zendLive','identities','borrowedContexts','callDepth'] as $key) "+
    "if($after[$key]!==0)throw new RuntimeException('recovery_cleanup_'+$key); "+
    "echo json_encode(['before'=>$before,'after'=>$after],JSON_THROW_ON_ERROR);");
  if(recovery||stderr)throw Error(JSON.stringify({mode,phase:'recovery',status:recovery,stdout,stderr}));
  observations.push({mode,status,...JSON.parse(stdout)}); await php.refresh();
}
console.log(JSON.stringify(observations));`);
	await saveLakeFile(directory, "host-bailout.mjs", bailoutRunner);
	const bailoutResults = [];
	for(const strict of [0, 1])
	{
		diagnostic(`Zend longjmp, PHP exit and reply-destructor abort recovery in ${strict ? "strict" : "weak"} wasm32 PHP`);
		await saveLakeFile(directory, "check.php", bailoutSource.replace("strict_types=0", "strict_types=" + strict));
		const output = await run(process.execPath, ["host-bailout.mjs"]); assert.equal(output.stderr, "");
		const observed = JSON.parse(output.stdout); assert.equal(observed.length, 5);
		for(const [mode, observation] of observed.entries())
		{
			assert.equal(observation.mode, mode);
			for(const phase of ["before", "after"])
				for(const key of ["nativeLive", "zendLive", "identities", "borrowedContexts", "callDepth"])
					assert.equal(observation[phase][key], 0);
		}
		bailoutResults.push({ strict, observations: observed });
	}
	const constructionSource = base.split("$shapes =")[0]
		+ await readFile("tests/fixtures/structured-callable-consumers/php-wasm-recursive-construction.php", "utf8");
	const constructionRunner = runner.replace(request, `const observations=[];
async function execute(shape,owned,point) {
  stdout='';stderr='';
  const status=await php.run("<?php require '/check.php'; constructionProbe("+[shape,owned,point].join(',')+");");
  const output=stdout,errors=stderr; await php.refresh();
  if(point) {
    if(status!==1||errors||output!=='armed')throw Error(JSON.stringify({shape,owned,point,status,stdout:output,stderr:errors}));
    return null;
  }
  if(status||errors)throw Error(JSON.stringify({shape,owned,point,status,stdout:output,stderr:errors}));
  return JSON.parse(output);
}
for(let shape=0;shape<9;++shape)for(const owned of [false,true]) {
  const baseline=await execute(shape,owned,0);
  if(baseline.attempts<1)throw Error('No Zend construction checkpoints');
  let recovered;
  for(let point=1;point<=baseline.attempts;++point) {
    await execute(shape,owned,point); recovered=await execute(shape,owned,0);
    if(recovered.attempts!==baseline.attempts)throw Error('Construction recovery changed checkpoint count');
    if(recovered.before.constructionBailouts!==baseline.before.constructionBailouts+point)throw Error('Construction abort was not observed');
  }
  observations.push({shape:baseline.shape,owned,failures:baseline.attempts,recovered});
}
console.log(JSON.stringify(observations));`);
	await saveLakeFile(directory, "host-construction.mjs", constructionRunner);
	const constructionResults = [];
	for(const strict of [0, 1])
	{
		diagnostic(`Partial Zend string/array construction bailouts and same-runtime recovery in ${strict ? "strict" : "weak"} wasm32 PHP`);
		await saveLakeFile(directory, "check.php", constructionSource.replace("strict_types=0", "strict_types=" + strict));
		const output = await run(process.execPath, ["host-construction.mjs"]); assert.equal(output.stderr, "");
		const observed = JSON.parse(output.stdout); assert.equal(observed.length, 18);
		for(const item of observed)
		{
			assert.ok(item.failures > 0);
			for(const phase of ["before", "after"])
				for(const key of ["nativeLive", "zendLive", "identities", "borrowedContexts", "callDepth"])
					assert.equal(item.recovered[phase][key], 0);
		}
		constructionResults.push({ strict, failures: observed.reduce((sum, item) => sum + item.failures, 0), observations: observed });
		diagnostic(JSON.stringify({ strict, constructionBailouts: constructionResults.at(-1).failures }));
	}
	const replySource = base.split("$shapes =")[0]
		+ await readFile("tests/fixtures/structured-callable-consumers/php-wasm-recursive-replies.php", "utf8");
	const replyResults = [];
	for(const strict of [0, 1])
	{
		diagnostic(`Checking every nested callback reply owner before Lean copies it, ${strict ? "strict" : "weak"} caller`);
		await saveLakeFile(directory, "check.php", replySource.replace("strict_types=0", "strict_types=" + strict));
		const output = await run(process.execPath, ["host.mjs"]); assert.equal(output.stderr, "");
		const observed = JSON.parse(output.stdout);
		assert.equal(observed.stats.replyChecks, 18); assert.equal(observed.stats.replyFailures, 0);
		assert.equal(observed.actualPhpBits, 32); assert.equal(observed.checkedBeforeLeanCopy, true);
		replyResults.push({ strict, ...observed });
	}
	diagnostic("Requiring a premature Zend reply-release mutant to fail before Lean reads the payload");
	await run(emcc, [...flags, "-Wall", "-Wextra", "-Werror"
		, "-Wno-unused-parameter", "-Wno-unused-function"
		, "-DPROBE_RELEASE_REPLY", "-c", "probe.c", "-o", "probe-reply-mutant.o"]);
	await run(emcc, [...flags, "-sSIDE_MODULE=2"
		, "-sEXPORTED_FUNCTIONS=['_get_module']", "-Wl,--no-entry"
		, ...objects.slice(0, -1), "probe-reply-mutant.o"
		, join(runtimeRoot, runtime.manifest.library)
		, "-o", "probe-reply-mutant.so"]);
	let replyMutant;
	await assert.rejects(() => run(process.execPath, ["host.mjs", "reply-mutant"]), error => {
		const failure = JSON.parse(error.message);
		assert.equal(failure.stdout, ""); assert.match(failure.stderr, /callback_reply_storage_expired/);
		assert.match(failure.stderr, /"status":2/); assert.doesNotMatch(failure.stderr, /memory access out of bounds|RuntimeError:|unreachable/);
		replyMutant = { rejectedBeforeLeanCopy: true, stderr: failure.stderr.replaceAll(directory, "<probe>") };
		return true;
	});
	const malformedSource = await readFile("tests/fixtures/structured-callable-consumers/php-wasm-recursive-malformed.php", "utf8");
	const malformedResults = [];
	for(const strict of [0, 1])
	for(let mode = 1; mode <= 8; ++mode)
	{
		diagnostic(`Malformed wasm32 result ${mode}, ${strict ? "strict" : "weak"} caller`);
		await saveLakeFile(directory, "check.php", malformedSource.replace("strict_types=0", "strict_types=" + strict).replace("MALFORMED_MODE", String(mode)));
		const output = await run(process.execPath, ["host.mjs"]); assert.equal(output.stderr, "");
		const observed = JSON.parse(output.stdout);
		assert.equal(observed.mode, mode); assert.equal(observed.checks, 15); assert.equal(observed.actualPhpBits, 32);
		assert.equal(observed.stats.poisoned, 1); assert.equal(observed.stats.retirements, mode === 3 ? 0 : 1);
		assert.equal(observed.stats.closes, 1);
		for(const name of ["nativeLive", "zendLive", "identities"]) assert.equal(observed.stats[name], 0);
		malformedResults.push({ strict, ...observed });
	}
	diagnostic("Compiling an isolated missing-retirement mutant and requiring its specific rejection");
	await run(emcc, [...flags, "-Wall", "-Wextra", "-Werror"
		, "-Wno-unused-parameter", "-Wno-unused-function"
		, "-DPROBE_IGNORE_RETIREMENT", "-c", "probe.c", "-o", "probe-mutant.o"]);
	await run(emcc, [...flags, "-sSIDE_MODULE=2"
		, "-sEXPORTED_FUNCTIONS=['_get_module']", "-Wl,--no-entry"
		, ...objects.slice(0, -1), "probe-mutant.o"
		, join(runtimeRoot, runtime.manifest.library), "-o", "probe-mutant.so"]);
	await saveLakeFile(directory, "check.php", malformedSource.replace("MALFORMED_MODE", "1"));
	let mutant;
	await assert.rejects(() => run(process.execPath, ["host.mjs", "mutant"]), error => {
		const failure = JSON.parse(error.message);
		assert.equal(failure.stdout, ""); assert.match(failure.stderr, /malformed_output_retires_runtime/);
		assert.match(failure.stderr, /"status":2/); assert.doesNotMatch(failure.stderr, /memory access out of bounds|RuntimeError:|unreachable/);
		mutant = { rejected: true, stderr: failure.stderr.replaceAll(directory, "<probe>") };
		return true;
	});
	assert.equal((await readVerifiedPhpWasmCopiedRuntime(runtimeRoot)).identity, runtime.identity);
	return { schemaVersion: 1, compiledLean: true, installedPackage: false
		, independentIr: true
		, functions: ir.declarations.length, callbacks: descriptor.callbacks.length
		, runtimeIdentity: runtime.identity
		, layoutSha256: generated.manifest.layoutSha256
		, sourceSha256: sha256(source), consumerSha256: sha256(consumer)
		, probeSha256: sha256(probe)
		, ownership: { consumerSha256: sha256(ownershipSource), observations: ownershipResults }
		, bailouts: { consumerSha256: sha256(bailoutSource), hostSha256: sha256(bailoutRunner), observations: bailoutResults }
		, construction: { consumerSha256: sha256(constructionSource), hostSha256: sha256(constructionRunner), observations: constructionResults }
		, replies: { consumerSha256: sha256(replySource), observations: replyResults, mutant: replyMutant }
		, malformed: { consumerSha256: sha256(malformedSource), observations: malformedResults, mutant }
		, generatedFiles: generated.manifest.files, observations };
};
