/**
 * Fresh total Lean carriers and the width-aware C graph transport inside the
 * actual PHP-Wasm heap. The Zend entry point is a test probe, not a public API.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { createMetadataRequest, identifyLeanInterface, validateElaboratedMetadata } from "../../src/analyze/elaborated-metadata.mjs";
import { createElaboratedSemanticModel } from "../../src/analyze/semantic-model.mjs";
import { componentRecursiveLeanSource } from "../../src/build/component-recursive-lean.mjs";
import { generateNativeCopiedGraphAdapters } from "../../src/backends/c/native-graph-adapters.mjs";
import { processBuildRunner } from "../../src/build/process-runner.mjs";
import { readVerifiedPhpWasmCopiedRuntime, validatePhpWasmCopiedBinary } from "../../src/build/php-wasm-copied-artifacts.mjs";
import { buildPhpWasmCopiedRuntime } from "../../src/build/php-wasm-copied-component.mjs";
import { phpWasmCopiedPins as pins } from "../../src/build/php-wasm-copied-artifacts.mjs";
import { recursiveCarrierAbi } from "./recursive-carriers.mjs";
import { nativeRecursiveSource } from "./native-recursive-transport.mjs";
import { nativeRecursiveReviewedIr } from "./native-recursive-reviewed.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";

const names = { unit: "Unit", bool: "Bool", uint8: "UInt8", uint16: "UInt16"
	, uint32: "UInt32", uint64: "UInt64"
	, int8: "Int8", int16: "Int16", int32: "Int32", int64: "Int64"
	, nat: "Nat", int: "Int", char: "Char", usize: "USize", isize: "ISize"
	, float32: "Float32", float64: "Float", string: "String", bytes: "ByteArray" };
const leanType = type => {
	if(type.kind === "primitive") return `_root_.${names[type.name]}`;
	if(type.kind === "named") return `_root_.${type.id.slice(5)}`;
	const children = type.arguments.map(leanType);
	if(type.constructor === "result") return `(_root_.Except ${children[1]} ${children[0]})`;
	return `(_root_.${{ array: "Array", list: "List", option: "Option", tuple: "Prod" }[type.constructor]} ${children.join(" ")})`;
};

/**
 * Compile the original recursive corpus against the pinned 32-bit Lean runtime.
 *
 * @param directory - Test-owned fresh workspace.
 * @param diagnostic - Progress reporter.
 */
export const checkWasm32RecursiveTransport = async (directory, diagnostic = () => {}) => {
	const repository = process.cwd(), prefix = resolve(process.env.LEAN_BRIDGE_LEAN_PREFIX ?? ".toolchains/elan/toolchains/leanprover--lean4---v4.32.2");
	const lean = join(prefix, "bin/lean"), extractor = resolve("src/analyze/NativeExports.lean");
	const sdk = resolve(process.env.LEAN_BRIDGE_PHP_EMSDK ?? ".toolchains/emsdk-php-wasm");
	const emcc = join(sdk, "upstream/emscripten/emcc"), phpSource = resolve(process.env.LEAN_BRIDGE_PHP_SOURCE ?? "build/php-wasm-sdk/php8.4-src");
	const runtimeRoot = process.env.LEAN_BRIDGE_TEST_PHP_COPIED_RUNTIME === undefined
		? join(directory, "runtime") : resolve(process.env.LEAN_BRIDGE_TEST_PHP_COPIED_RUNTIME);
	if(process.env.LEAN_BRIDGE_TEST_PHP_COPIED_RUNTIME === undefined)
	{
		diagnostic("Building the pinned PHP-Wasm shared runtime in the test workspace");
		await buildPhpWasmCopiedRuntime({ outputRoot: runtimeRoot, emsdkRoot: sdk
			, leanRuntimeRoot: resolve(process.env.LEAN_BRIDGE_PHP_LEAN_RUNTIME ?? `build/lean-runtime/${pins.leanCommit}-${pins.patchSetSha256}-browser-php-wasm-3.1.68`) });
	}
	const runtime = await readVerifiedPhpWasmCopiedRuntime(runtimeRoot);
	const host = resolve(process.env.LEAN_BRIDGE_PHP_WASM_HOST ?? "build/php-wasm-host/node_modules/php-wasm");
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
	const original = (await nativeRecursiveSource())
		.replace("value == 18446744073709551615", "value == 4294967295")
		.replace("value == -9223372036854775808", "value == -2147483648");
	await saveLakeFile(directory, "Recursive.lean", original);
	diagnostic("Compiling fresh Lean source and extracting recursive declarations");
	await run(lean, ["-o", "Recursive.olean", "-c", "Recursive.c", "Recursive.lean"]);
	const selected = nativeRecursiveReviewedIr().declarations.map(item => item.source.declaration);
	const request = createMetadataRequest({ profile: "native-library-v1", modules: ["Recursive"], exportModules: ["Recursive"], exports: selected, resources: [], arities: [] }, {
		toolchain: "leanprover/lean4:v4.32.2"
		, modules: [{ name: "Recursive", sourcePath: "Recursive.lean", sourceSha256: sha256(original), interfaceSha256: (await identifyLeanInterface(join(directory, "Recursive.olean"))).interfaceSha256 }]
		, extractorSha256: sha256(await readFile(extractor))
		, leanCompilerSha256: sha256(await readFile(lean))
	});
	await saveLakeFile(directory, "request.json", canonicalJson(request));
	const metadata = JSON.parse((await run(lean, ["--run", extractor, "--metadata", "request.json"])).stdout);
	validateElaboratedMetadata(metadata, request); assert.deepEqual(metadata.diagnostics, []);
	const ir = createElaboratedSemanticModel({ metadata, request, component: { id: "recursive@1.0.0", name: "recursive", version: "1.0.0" }, elaborationSha256: sha256(canonicalJson(metadata)) }).document;
	const abi = recursiveCarrierAbi(ir), output = generateNativeCopiedGraphAdapters(ir, abi, { wordBits: 32 });
	assert.equal(abi.exports.length, 18); assert.equal(output.layout.wordBits, 32);
	const exports = ir.declarations.map((item, index) => ({ bindingId: item.id, symbol: abi.exports[index].symbol, wrapper: `export${index}`, sourceDeclaration: item.source.declaration }));
	const carriers = ["import Recursive", "set_option maxRecDepth 10000", "namespace Wasm32Carriers", ...componentRecursiveLeanSource(abi, exports, leanType), "end Wasm32Carriers", ""].join("\n");
	assert.doesNotMatch(carriers, /\b(?:unsafe|sorry|axiom|partial|unsafeCast)\b/u);
	await saveLakeFile(directory, "Wasm32Carriers.lean", carriers);
	await run(lean, ["-o", "Wasm32Carriers.olean", "-c", "Wasm32Carriers.c", "Wasm32Carriers.lean"]);
	await saveLakeFile(directory, "recursive-graph-types.h", output.typesHeader);
	await saveLakeFile(directory, "recursive-graph.h", output.header);
	const table = new Map(output.layout.nodes.map(node => [node.id, node]));
	const result = name => table.get(output.layout.roots.find(root => root.bindingId === `lean:Recursive.${name}`).result);
	const fixture = await readFile(join(repository, "tests/fixtures/structured-types/native-recursive-check.c"), "utf8");
	// php_config.h defines NDEBUG. Test assertions must execute even when the
	// extension and its dependency headers use release-mode C assertions.
	const harness = fixture.replace("#define CHECK(expression) do { ++checks; assert(expression); } while (0)", '#define CHECK(expression) do { ++checks; if (!(expression)) { fprintf(stderr, "Check failed at %s:%d: %s\\n", __FILE__, __LINE__, #expression); abort(); } } while (0)')
		.replace("uint64_t word = UINT64_MAX; int64_t signed_word = INT64_MIN;", "uint32_t word = UINT32_MAX; int32_t signed_word = INT32_MIN;")
		.replaceAll("UNIT_ARRAY_TYPE", result("units").name)
		.replaceAll("OUTCOME_TYPE", table.get(result("envelope").fields.find(field => field.sourceName === "outcome").type).name)
		.replaceAll("WIDE_FIELDS", Array.from({ length: 255 }, (_, i) => `wide[depth].cases.next.field${i} = (uint16_t)(depth + ${i});`).join("\n"))
		.replaceAll("WIDE_CHECKS", Array.from({ length: 255 }, (_, i) => `CHECK(current->cases.next.field${i} == depth + ${i});`).join("\n"));
	assert.notEqual(harness, fixture); assert.equal(harness.split("/* GENERATED_TRANSPORT */").length, 2);
	const boxed = new Set(["uint32", "int32", "char", "uint64", "int64", "usize", "isize", "float32", "float64"]);
	const extra = `
static uint32_t wasm32_boundary_checks(void) {
  uint32_t before = checks;
  uintptr_t end = (uintptr_t)__builtin_wasm_memory_size(0) * 65536;
  CHECK(!ng_pointer((void *)end, 1, 1));
  CHECK(!ng_pointer((void *)(end - 1), 2, 1));
  CHECK(!ng_pointer((void *)UINTPTR_MAX, 1, 1));
  CHECK(ng_pointer((void *)(end - 1), 1, 1));
  recursive_scalars_t bad = scalars_input(), out = {0};
  bad.bytes.data = (const uint8_t *)end; bad.bytes.length = 1; decodes = 0;
  CHECK(recursive_scalars_graph(&bad, &out) == NG_INVALID); CHECK(!decodes && !live);
  for (unsigned corruption = 0; corruption < 4; ++corruption) {
${output.layout.nodes.filter(node => node.kind === "primitive" && boxed.has(node.ref.name)).map(node => `    {
      lean_object *child;
      if (corruption == 0) child = lean_box(0);
      else if (corruption == 1) child = lean_alloc_array(0, 0);
      else if (corruption == 2) child = lean_alloc_ctor(1, 0, 8);
      else { child = lean_alloc_ctor(0, 1, 0); lean_ctor_set(child, 0, lean_box(0)); }
      lean_object *carrier = lean_alloc_array(1, 1); lean_array_set_core(carrier, 0, child);
      ng_budget budget = { .bytes = 16u * 1024u * 1024u, .nodes = 262144 };
      ng_arena arena = { .budget = &budget }; ${node.name} value = 0;
      CHECK(ng_${sha256(node.id).slice(0, 20)}_out(&value, carrier, 0, &arena) == NG_RESULT);
      CHECK(!arena.head && !live);
    }`).join("\n")}
  }
  return checks - before;
}
`;
	await saveLakeFile(directory, "check.c", harness.replace("/* GENERATED_TRANSPORT */", output.source) + extra);
	const probe = await readFile(join(repository, "tests/fixtures/structured-types/wasm32-recursive-probe.c"), "utf8");
	await saveLakeFile(directory, "probe.c", probe);
	const roots = [directory, join(runtimeRoot, "include"), phpSource, ...["Zend", "main", "TSRM", "ext"].map(path => join(phpSource, path))];
	const flags = ["-O2", "-g0", "-fPIC", "-fvisibility=hidden", "-ffp-contract=off", "-fbracket-depth=4096", "-DLEAN_EMSCRIPTEN", "-UNDEBUG", ...roots.flatMap(path => ["-I", path])];
	diagnostic("Compiling and executing the 32-bit transport in PHP-Wasm");
	const objects = [];
	for(const name of ["Recursive", "Wasm32Carriers", "probe"])
	{
		await run(emcc, [...flags, ...name === "probe" ? ["-Wall", "-Wextra", "-Werror", "-Wno-unused-parameter", "-Wno-unused-function"] : [], "-c", `${name}.c`, "-o", `${name}.o`]);
		objects.push(`${name}.o`);
	}
	await run(emcc, [...flags, "-sSIDE_MODULE=2", "-sEXPORTED_FUNCTIONS=['_get_module']", "-Wl,--no-entry", ...objects, join(runtimeRoot, runtime.manifest.library), "-o", "probe.so"]);
	const binary = await readFile(join(directory, "probe.so")); await validatePhpWasmCopiedBinary(binary, true);
	const libraries = [{ name: basename(runtime.manifest.library), url: pathToFileURL(join(runtimeRoot, runtime.manifest.library)).href, ini: false }
		, { name: "probe.so", url: pathToFileURL(join(directory, "probe.so")).href, ini: true }];
	await saveLakeFile(directory, "host.mjs", `import {PhpNode} from ${JSON.stringify(pathToFileURL(join(host, "PhpNode.mjs")).href)};
process.setUncaughtExceptionCaptureCallback(error => { console.error(error.stack); process.exit(1); });
const php = new PhpNode({version:'8.4',autoTransaction:false,sharedLibs:${JSON.stringify(libraries)}.map(lib=>({...lib,url:new URL(lib.url)})),ini:'memory_limit=512M'});
let stdout='',stderr='';
php.addEventListener('output',event=>{stdout+=event.detail.join('');}); php.addEventListener('error',event=>{stderr+=event.detail.join('');});
await php.binary;
const status=await php.run('<?php echo json_encode(lean_bridge_wasm32_recursive_probe(), JSON_THROW_ON_ERROR);');
if(status || stderr) throw new Error(JSON.stringify({status,stdout,stderr}));
console.log(stdout);
`);
	const executions = [];
	for(let index = 0; index < 2; index++)
	{
		const runResult = await run(process.execPath, ["host.mjs"]); assert.equal(runResult.stderr, "");
		const observed = JSON.parse(runResult.stdout);
		assert.equal(observed.wordBits, 32); assert.equal(observed.phpBits, 32); assert.equal(observed.phpVersion, "8.4.1");
		assert.ok(observed.checks > 160000); assert.equal(observed.boundaryChecks, 78);
		assert.equal(observed.live, 0); assert.equal(observed.runtimeInitializations, 1); assert.equal(observed.componentInitializations, 1);
		executions.push(observed);
	}
	assert.deepEqual(executions[0], executions[1]);
	assert.equal((await readVerifiedPhpWasmCopiedRuntime(runtimeRoot)).identity, runtime.identity);
	const files = {};
	for(const path of ["Recursive.lean", "Recursive.c", "Wasm32Carriers.lean", "Wasm32Carriers.c", "recursive-graph-types.h", "recursive-graph.h", "check.c", "probe.c", "host.mjs"])
		files[path] = sha256(await readFile(join(directory, path)));
	return { schemaVersion: 1, profile: "wasm32-copied-graph-transport"
		, installedPackage: false
		, runtimeIdentity: runtime.identity
		, runtimeManifest: runtime.manifest, compiler
		, request, metadata, bindingIr: ir, abi, files
		, sourceSha256: sha256(output.source)
		, layoutSha256: sha256(canonicalJson(output.layout))
		, wasmSha256: sha256(binary), fixtureSha256: sha256(fixture)
		, exports: abi.exports.length, executions };
};
