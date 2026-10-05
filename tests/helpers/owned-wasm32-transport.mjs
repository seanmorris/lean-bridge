/**
 * Compile owned carriers into the actual pinned PHP-Wasm heap, without claiming
 * a public Zend ownership API or installed package support.
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
import { buildPhpWasmCopiedRuntime } from "../../src/build/php-wasm-copied-component.mjs";
import { phpWasmCopiedPins as pins, readVerifiedPhpWasmCopiedRuntime, validatePhpWasmCopiedBinary } from "../../src/build/php-wasm-copied-artifacts.mjs";
import { nativeAllocationGuardHeader } from "../../src/build/native-allocation-guard.mjs";
import { processBuildRunner } from "../../src/build/process-runner.mjs";
import { ownedWasm32Bindings, ownedWasm32Probe } from "./owned-wasm32-probes.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";

const replaceOnce = (source, before, after) => {
	assert.equal(source.split(before).length, 2, `Expected one authored fixture fragment: ${before}`);
	return source.replace(before, after);
};

/**
 * Execute independent scalar/recursive oracles and Wasm-only malformed values.
 *
 * @param directory - Fresh, test-owned directory.
 * @param fixture - Existing owned-scalars or owned-aggregates corpus.
 * @param diagnostic - Progress reporter.
 */
export const checkOwnedWasm32Transport = async (directory, fixture, diagnostic = () => {}) => {
	assert.ok(["owned-scalars", "owned-aggregates"].includes(fixture));
	const scalars = fixture === "owned-scalars", repository = process.cwd();
	const prefix = resolve(process.env.LEAN_BRIDGE_LEAN_PREFIX ?? ".toolchains/elan/toolchains/leanprover--lean4---v4.32.2");
	const lean = join(prefix, "bin/lean"), extractor = resolve("src/analyze/NativeExports.lean");
	const sdk = resolve(process.env.LEAN_BRIDGE_PHP_EMSDK ?? ".toolchains/emsdk-php-wasm");
	const emcc = join(sdk, "upstream/emscripten/emcc");
	const phpSource = resolve(process.env.LEAN_BRIDGE_PHP_SOURCE ?? "build/php-wasm-sdk/php8.4-src");
	const host = resolve(process.env.LEAN_BRIDGE_PHP_WASM_HOST ?? "build/php-wasm-host/node_modules/php-wasm");
	const runtimeRoot = process.env.LEAN_BRIDGE_TEST_PHP_COPIED_RUNTIME === undefined
		? join(directory, "runtime") : resolve(process.env.LEAN_BRIDGE_TEST_PHP_COPIED_RUNTIME);
	if(process.env.LEAN_BRIDGE_TEST_PHP_COPIED_RUNTIME === undefined)
	{
		diagnostic("Building the pinned PHP-Wasm shared runtime");
		await buildPhpWasmCopiedRuntime({ outputRoot: runtimeRoot, emsdkRoot: sdk
			, leanRuntimeRoot: resolve(process.env.LEAN_BRIDGE_PHP_LEAN_RUNTIME ?? `build/lean-runtime/${pins.leanCommit}-${pins.patchSetSha256}-browser-php-wasm-3.1.68`) });
	}
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
	const original = await readFile(join(repository, "tests/fixtures/onboarding", fixture, "Owned.lean"), "utf8");
	let source = original;
	if(scalars)
	{
		source = replaceOnce(source, "word := 18446744073709551615, signedWord := -9223372036854775808", "word := 4294967295, signedWord := -2147483648");
		source = replaceOnce(source, "p.word.toUInt64 == 18446744073709551615 && p.signedWord.toInt == -9223372036854775808", "p.word.toUInt64 == 4294967295 && p.signedWord.toInt == -2147483648");
	}
	const config = JSON.parse(await readFile(join(repository, "tests/fixtures/onboarding", fixture, "lean-bridge.exports.json"), "utf8"));
	await saveLakeFile(directory, "Owned.lean", source);
	diagnostic(`Compiling fresh ${fixture} Lean source and typed carriers`);
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
	const component = { id: "owned-wasm32@1.0.0", name: "owned-wasm32", version: "1.0.0" };
	const inputs = { metadata, sourceIdentity, component, wordBits: 32 };
	const generated = generateOwnedNativeValueAdapters(inputs), { carriers, layout } = generated;
	assert.equal(layout.wordBits, 32);
	assert.doesNotMatch(carriers.leanSource, /\b(?:unsafe|sorry|axiom|partial|unsafeCast)\b/u);
	await saveLakeFile(directory, `${carriers.module}.lean`, carriers.leanSource);
	await run(lean, ["-o", `${carriers.module}.olean`, "-c", "Carriers.c", `${carriers.module}.lean`]);
	await saveLakeFile(directory, "Witness.lean", scalars ? "import Owned\n" : `import Owned
@[export owned_test_record_identity]
def recordIdentity (_ : Unit) : Array (Owned.Bundle → Owned.Bundle) := #[fun value => value]
@[export owned_test_tree_identity]
def treeIdentity (_ : Unit) : Array (Owned.Tree → Owned.Tree) := #[fun value => value]
`);
	await run(lean, ["-o", "Witness.olean", "-c", "Witness.c", "Witness.lean"]);
	const probePath = `tests/fixtures/structured-types/owned-native-${scalars ? "scalars" : "values"}.c`;
	const originalProbe = await readFile(join(repository, probePath), "utf8");
	let probe = originalProbe;
	if(scalars)
	{
		probe = replaceOnce(probe, ".S_word = UINT64_MAX, .S_signedWord = INT64_MIN", ".S_word = UINT32_MAX, .S_signedWord = INT32_MIN");
		probe = replaceOnce(probe, "p->S_word == UINT64_MAX && p->S_signedWord == INT64_MIN", "p->S_word == UINT32_MAX && p->S_signedWord == INT32_MIN");
	}
	const files = { "carriers.h": carriers.header
		, "owned-values.h": generated.typesHeader
		, "owned-leases.h": ownedAggregateLeaseSource
		, "owned-values-codec.h": generated.source
		, "allocation-guard.h": nativeAllocationGuardHeader
		, [`${scalars ? "scalar" : "value"}-bindings.h`]: ownedWasm32Bindings(generated, scalars)
		, "check.c": probe, "probe.c": ownedWasm32Probe(generated, scalars) };
	for(const [path, source] of Object.entries(files)) await saveLakeFile(directory, path, source);
	const roots = [directory, join(runtimeRoot, "include"), phpSource, ...["Zend", "main", "TSRM", "ext"].map(path => join(phpSource, path))];
	const flags = ["-O2", "-g0", "-fPIC", "-fvisibility=hidden", "-ffp-contract=off", "-fbracket-depth=4096", "-DLEAN_EMSCRIPTEN", ...roots.flatMap(path => ["-I", path])];
	diagnostic(`Compiling ${fixture} for the real 32-bit PHP-Wasm runtime`);
	const objects = [];
	for(const name of ["Owned", "Carriers", "Witness", "probe"])
	{
		const guards = name === "probe"
			? ["-Wall", "-Wextra", "-Werror", "-Wno-unused-parameter", "-Wno-unused-function"]
			: ["-include", "allocation-guard.h", ...name === "Carriers" ? ["-include", "carriers.h"] : []];
		await run(emcc, [...flags, ...guards
			, "-c", `${name}.c`, "-o", `${name}.o`]);
		objects.push(`${name}.o`);
	}
	await run(emcc, [...flags, "-sSIDE_MODULE=2", "-sEXPORTED_FUNCTIONS=['_get_module']", "-Wl,--no-entry", ...objects, join(runtimeRoot, runtime.manifest.library), "-o", "probe.so"]);
	const binary = await readFile(join(directory, "probe.so")); await validatePhpWasmCopiedBinary(binary, true);
	const libraries = [{ name: basename(runtime.manifest.library), url: pathToFileURL(join(runtimeRoot, runtime.manifest.library)).href, ini: false }
		, { name: "probe.so", url: pathToFileURL(join(directory, "probe.so")).href, ini: true }];
	await saveLakeFile(directory, "host.mjs", `import {PhpNode} from ${JSON.stringify(pathToFileURL(join(host, "PhpNode.mjs")).href)};
let stdout='',stderr='';
process.setUncaughtExceptionCaptureCallback(error => { console.error(JSON.stringify({stdout,stderr,error:error.stack})); process.exit(1); });
const php = new PhpNode({version:'8.4',autoTransaction:false,sharedLibs:${JSON.stringify(libraries)}.map(lib=>({...lib,url:new URL(lib.url)})),ini:'memory_limit=512M'});
php.addEventListener('output',event=>{stdout+=event.detail.join('');}); php.addEventListener('error',event=>{stderr+=event.detail.join('');});
await php.binary;
const status=await php.run('<?php echo json_encode(lean_bridge_owned_wasm32_probe(), JSON_THROW_ON_ERROR);');
if(status || stderr) throw new Error(JSON.stringify({status,stdout,stderr}));
console.log(stdout);
`);
	const executions = [];
	for(let index = 0; index < 2; index++)
	{
		diagnostic(`Executing ${fixture} in fresh PHP-Wasm interpreter ${index + 1}`);
		const result = await run(process.execPath, ["host.mjs"]); assert.equal(result.stderr, "");
		const observed = JSON.parse(result.stdout);
		diagnostic(JSON.stringify(observed));
		assert.equal(observed.wordBits, 32); assert.equal(observed.phpBits, 32); assert.equal(observed.phpVersion, "8.4.1");
		assert.ok(observed.checks > (scalars ? 100 : 1000));
		assert.equal(observed.boundaryChecks, scalars ? 165 : 18);
		assert.ok(observed.failures > (scalars ? 5 : 20));
		assert.equal(observed.live, 0); assert.equal(observed.identities, 0);
		assert.equal(observed.runtimeInitializations, 1); assert.equal(observed.componentInitializations, 1);
		assert.equal(observed.retired, scalars);
		executions.push(observed);
	}
	assert.deepEqual(executions[0], executions[1]);
	assert.equal((await readVerifiedPhpWasmCopiedRuntime(runtimeRoot)).identity, runtime.identity);
	const hashes = {};
	for(const path of [...Object.keys(files), "Owned.lean", "Owned.c", "Carriers.c", `${carriers.module}.lean`, "Witness.lean", "Witness.c", "host.mjs"])
		hashes[path] = sha256(await readFile(join(directory, path)));
	return { schemaVersion: 1, profile: "wasm32-owned-value-transport"
		, installedPackage: false
		, fixture, inputs, runtimeIdentity: runtime.identity
		, runtimeManifest: runtime.manifest, compiler
		, originalLeanSha256: sha256(original)
		, originalProbeSha256: sha256(originalProbe)
		, files: hashes, adapterSha256: sha256(generated.source)
		, layoutSha256: sha256(canonicalJson(layout))
		, wasmSha256: sha256(binary), exports: layout.functions.length
		, callbacks: layout.callbacks.length, executions };
};
