/**
 * Fresh Lean carriers connected to generated recursive PHP/Zend converters.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { generateCopiedPhpGraphZendAdapter } from "../../src/backends/php/copied-graph-zend.mjs";
import { generateNativeCopiedGraphAdapters } from "../../src/backends/c/native-graph-adapters.mjs";
import { bundledBrickMath } from "../../src/backends/php/brick-math.mjs";
import { readVerifiedPhpWasmCopiedRuntime } from "../../src/build/php-wasm-copied-artifacts.mjs";
import { checkWasm32RecursiveTransport } from "./wasm32-recursive-transport.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";
import { runCopied } from "./copied-fixture-install.mjs";

const instrumentation = `#include <php.h>
#include <stdlib.h>
#include <lean/lean.h>
#include <lean_bridge_native_runtime.h>
static size_t native_live, native_attempts, native_fail, zend_live, zend_attempts, zend_fail, decodes;
static unsigned corrupt;
static void *tracked_malloc(size_t bytes) {
  native_attempts++; if (native_fail && native_attempts == native_fail) return NULL;
  void *value = malloc(bytes); if (value) native_live++; return value;
}
static void tracked_free(void *value) { if (value) { native_live--; free(value); } }
static void *tracked_calloc(size_t count, size_t width) {
  zend_attempts++; if (zend_fail && zend_attempts == zend_fail) return NULL;
  void *value = calloc(count, width); if (value) zend_live++; return value;
}
static void tracked_zend_free(void *value) { if (value) { zend_live--; free(value); } }
static lean_object *tracked_encode(lean_object *value) {
  if (corrupt) { lean_dec(value); return lean_box(0); } return value;
}
#define LB_GRAPH_MALLOC tracked_malloc
#define LB_GRAPH_FREE tracked_free
#define LB_GRAPH_DECODE() (decodes++)
#define LB_GRAPH_ENCODE(value) tracked_encode(value)
#define LB_ZEND_CALLOC tracked_calloc
#define LB_ZEND_FREE tracked_zend_free
#include "graph-transport.c"
extern lean_object *initialize_Wasm32Carriers(uint8_t);
static void *graph_initializer(uint8_t builtin) { return initialize_Wasm32Carriers(builtin); }
uint32_t recursive_graph_initialize(void) { return lean_bridge_native_component_initialize("recursive@1.0.0", graph_initializer) ? 0 : 5; }
int recursive_graph_ready(void) { return lean_bridge_native_component_ready("recursive@1.0.0"); }
void recursive_graph_retire(void) { lean_bridge_native_runtime_retire(); }
ZEND_BEGIN_ARG_INFO_EX(graph_stats_args, 0, 0, 0)
ZEND_END_ARG_INFO()
ZEND_BEGIN_ARG_INFO_EX(graph_reset_args, 0, 0, 3)
  ZEND_ARG_INFO(0, zendFailure)
  ZEND_ARG_INFO(0, nativeFailure)
  ZEND_ARG_INFO(0, corrupt)
ZEND_END_ARG_INFO()
static ZEND_FUNCTION(lean_graph_reset) {
  zend_long a, b, c;
  if (zend_parse_parameters(ZEND_NUM_ARGS(), "lll", &a, &b, &c) == FAILURE) RETURN_THROWS();
  if (a < 0 || b < 0 || c < 0 || zend_live || native_live) { zend_throw_error(NULL, "Invalid reset or leaked call allocation"); RETURN_THROWS(); }
  zend_fail = (size_t)a; native_fail = (size_t)b; corrupt = (unsigned)c; zend_attempts = native_attempts = 0; RETURN_NULL();
}
static ZEND_FUNCTION(lean_graph_stats) {
  lean_bridge_native_snapshot snapshot; lean_bridge_native_snapshot_read(&snapshot);
  array_init(return_value);
  add_assoc_long(return_value, "nativeLive", native_live); add_assoc_long(return_value, "nativeAttempts", native_attempts);
  add_assoc_long(return_value, "zendLive", zend_live); add_assoc_long(return_value, "zendAttempts", zend_attempts);
  add_assoc_long(return_value, "decodes", decodes);
  add_assoc_long(return_value, "runtimeInitializations", snapshot.runtime_init_runs);
  add_assoc_long(return_value, "componentInitializations", snapshot.component_init_runs);
}
`;

/**
 * Build fresh Lean and run weak/strict PHP consumers without prepared packages.
 *
 * @param root - Fresh test-owned workspace, automatically removed by the caller.
 * @param diagnostic - Test progress reporter.
 */
export const checkPhpGraphZendLean = async (root, diagnostic = () => {}) => {
	// This existing independent gate builds a fresh pinned runtime and freshly
	// extracted Lean metadata. Reuse its actual compiled objects, not a fake API.
	const transport = await checkWasm32RecursiveTransport(root, diagnostic);
	const runtimeRoot = process.env.LEAN_BRIDGE_TEST_PHP_COPIED_RUNTIME === undefined ? join(root, "runtime") : resolve(process.env.LEAN_BRIDGE_TEST_PHP_COPIED_RUNTIME);
	const runtime = await readVerifiedPhpWasmCopiedRuntime(runtimeRoot);
	const runtimeHeader = await readFile(join(runtimeRoot, "include/lean_bridge_native_runtime.h"), "utf8");
	assert.match(runtimeHeader, /LEAN_BRIDGE_NATIVE_RUNTIME_RETIREMENT_VERSION 1/);
	const files = generateCopiedPhpGraphZendAdapter(transport.bindingIr), manifest = JSON.parse(files["graph-zend-manifest.json"]);
	const graph = generateNativeCopiedGraphAdapters(transport.bindingIr, transport.abi, { wordBits: 32 });
	assert.equal(files["include/recursive-graph-types.h"], graph.typesHeader);
	await saveLakeFile(root, "graph-transport.c", graph.source);
	const source = instrumentation + files[`extension/${manifest.extension}.c`].replace("  PHP_FE_END", "  ZEND_FE(lean_graph_reset, graph_reset_args)\n  ZEND_FE(lean_graph_stats, graph_stats_args)\n  PHP_FE_END");
	await saveLakeFile(root, "zend-lean.c", source);
	for(const [path, source] of Object.entries({ ...files, ...bundledBrickMath() })) await saveLakeFile(root, path, source);
	const sdk = resolve(process.env.LEAN_BRIDGE_PHP_EMSDK ?? ".toolchains/emsdk-php-wasm");
	const phpSource = resolve(process.env.LEAN_BRIDGE_PHP_SOURCE ?? "build/php-wasm-sdk/php8.4-src");
	const host = resolve(process.env.LEAN_BRIDGE_PHP_WASM_HOST ?? "build/php-wasm-host/node_modules/php-wasm");
	const includes = [join(root, "include"), root, join(runtimeRoot, "include"), phpSource, ...["Zend", "main", "TSRM", "ext"].map(path => join(phpSource, path))];
	const flags = ["-O2", "-g0", "-fPIC", "-fvisibility=hidden"
		, "-fbracket-depth=4096"
		, "-ffp-contract=off", "-DLEAN_EMSCRIPTEN", "-Wall", "-Wextra", "-Werror"
		, "-Wno-unused-parameter", "-Wno-unused-function"
		, ...includes.flatMap(path => ["-I", path])];
	diagnostic("Connecting the generated PHP/Zend conversion to the fresh Lean transport");
	await runCopied(join(sdk, "upstream/emscripten/emcc"), [...flags
		, "-sSIDE_MODULE=2", "-sEXPORTED_FUNCTIONS=['_get_module']", "-Wl,--no-entry"
		, "zend-lean.c", "Recursive.o", "Wasm32Carriers.o"
		, join(runtimeRoot, runtime.manifest.library), "-o", "zend-lean.so"], root
	, { ...process.env, EM_CONFIG: join(sdk, ".emscripten"), EMSDK: sdk });
	const scripts = Object.keys({ ...files, ...bundledBrickMath() }).filter(path => path.endsWith(".php"));
	const libraries = [{ name: basename(runtime.manifest.library), url: pathToFileURL(join(runtimeRoot, runtime.manifest.library)).href, ini: false }
		, { name: "zend-lean.so", url: pathToFileURL(join(root, "zend-lean.so")).href, ini: true }];
	const hostSource = `import {readFile} from 'node:fs/promises';
import {PhpNode} from ${JSON.stringify(pathToFileURL(join(host, "PhpNode.mjs")).href)};
process.setUncaughtExceptionCaptureCallback(error=>{console.error(error.stack);process.exit(1);});
const php=new PhpNode({version:'8.4',autoTransaction:false,ini:'memory_limit=256M',sharedLibs:${JSON.stringify(libraries)}.map(lib=>({...lib,url:new URL(lib.url)}))});
let stdout='',stderr='';
php.addEventListener('output',event=>{stdout+=event.detail.join('');});php.addEventListener('error',event=>{stderr+=event.detail.join('');});
await php.binary;
const directories=new Set();
for(const path of ${JSON.stringify([...scripts, "consumer.php"])}) {
  let current=''; const parts=path.split('/'); parts.pop();
  for(const part of parts){current+='/'+part;if(!directories.has(current)){await php.mkdir(current);directories.add(current);}}
  await php.writeFile('/'+path,await readFile(path,'utf8'));
}
const status=await php.run("<?php require '/consumer.php';");
if(status||stderr)throw new Error(JSON.stringify({status,stdout,stderr}));
console.log(stdout);
`;
	await saveLakeFile(root, "zend-host.mjs", hostSource);
	const fixture = await readFile("tests/fixtures/structured-types/recursive-php-wasm-lean.php", "utf8");
	const base = (await readFile("tests/fixtures/structured-types/recursive-php-values.php", "utf8"))
		.replace("INTEGER_BITS = 64", "INTEGER_BITS = 32").replace("WORD_BITS = 64", "WORD_BITS = 32")
		.replace("// EXTRA_VALUES", fixture)
		.replace("'nativeCalls' => 0", "'compiledLean' => true, 'installedPackage' => false, 'faults' => $faults, 'stats' => lean_graph_stats()");
	const observations = [];
	for(const mode of ["weak", "strict"])
	{
		const consumer = base.replace("strict_types=0", `strict_types=${mode === "strict" ? 1 : 0}`);
		await saveLakeFile(root, "consumer.php", consumer);
		diagnostic(`Executing fresh compiled Lean from the ${mode} PHP caller`);
		const result = await runCopied(process.execPath, ["zend-host.mjs"], root, process.env);
		assert.equal(result.stderr, ""); const observed = JSON.parse(result.stdout);
		assert.equal(observed.compiledLean, true); assert.equal(observed.installedPackage, false); assert.equal(observed.actualPhpBits, 32);
		assert.equal(observed.stats.nativeLive, 0); assert.equal(observed.stats.zendLive, 0);
		assert.equal(observed.stats.runtimeInitializations, 1); assert.equal(observed.stats.componentInitializations, 1);
		assert.ok(observed.checks > 1000); assert.ok(observed.rejections > 100);
		observations.push({ mode, observed, sourceSha256: sha256(consumer) });
	}
	return { schemaVersion: 1, compiledLean: true, installedPackage: false
		, exports: manifest.exports.length
		, observations, transport, runtimeIdentity: runtime.identity
		, generatedSources: Object.fromEntries(Object.entries(files).map(([path, source]) => [path, sha256(source)]))
		, sourceSha256: sha256(source), hostSha256: sha256(hostSource)
		, binarySha256: sha256(await readFile(join(root, "zend-lean.so")))
		, layoutSha256: sha256(canonicalJson(graph.layout)) };
};
