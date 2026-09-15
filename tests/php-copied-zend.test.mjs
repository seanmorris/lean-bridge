/**
 * Test generated copied Zend sources inside the actual 32-bit PHP-Wasm host.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";
import { sha256 } from "../src/capsule/node.mjs";
import { generateCopiedPhpZendAdapter } from "../src/backends/php/copied-zend.mjs";
import { processBuildRunner } from "../src/build/process-runner.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";
import { copiedZendFixture, zendAllocationFixture, zendAllocationHeader, zendProviderFixture, zendConsumerFixture } from "./helpers/php-copied-zend.mjs";

const enabled = process.env.LEAN_BRIDGE_PHP_WASM_ZEND_TEST === "1";
const phpSource = process.env.LEAN_BRIDGE_PHP_SOURCE ?? join(process.cwd(), "build/php-wasm-sdk/php8.4-src");
const emcc = process.env.LEAN_BRIDGE_PHP_EMCC ?? join(process.cwd(), ".toolchains/emsdk-php-wasm/upstream/emscripten/emcc");
const phpHost = process.env.LEAN_BRIDGE_PHP_WASM_HOST ?? join(process.cwd(), "build/php-wasm-host/node_modules/php-wasm");
const run = (command, args, cwd) => processBuildRunner.capture({ command, args, cwd, env: process.env, timeoutMs: 180000 });

test("copied Zend sources bind arbitrary functions to a checked integer-width contract", () => {
	const ir = copiedZendFixture(), files = generateCopiedPhpZendAdapter(ir);
	assert.deepEqual(files, generateCopiedPhpZendAdapter(structuredClone(ir)));
	const manifest = JSON.parse(files["copied-zend-manifest.json"]);
	assert.equal(manifest.integerBits, 32);
	assert.equal(manifest.exports.length, ir.declarations.length);
	assert.match(files["src/Api.php"], /function echo_uint32\(mixed \$arg0\): BigInteger/);
	assert.match(files["src/Api.php"], /function echo_int64\(mixed \$arg0\): BigInteger/);
	assert.doesNotMatch(files["src/Api.php"], /Alpha|FFI|dispatch|pointer/);
	assert.doesNotMatch(files["src/Internal/Native.php"], /FFI|IntegerCodec/);
	const native = generateCopiedPhpZendAdapter(ir, { integerBits: 64 });
	assert.match(native["src/Api.php"], /function echo_uint32\(mixed \$arg0\): int/);
	assert.match(native["src/Api.php"], /function echo_int64\(mixed \$arg0\): int/);
	assert.throws(() => generateCopiedPhpZendAdapter(ir, { integerBits: 16 }), /integer width/);
	const effectful = structuredClone(ir); effectful.declarations[0].effects = ["nondeterministic"];
	assert.throws(() => generateCopiedPhpZendAdapter(effectful), /pure/);
	for(const [path, identity] of Object.entries(manifest.files)) assert.deepEqual(identity, { bytes: Buffer.byteLength(files[path]), sha256: sha256(files[path]) });
});

test("32-bit Zend copied boundary handles exact values, owners and failures in real PHP-Wasm", { skip: !enabled, timeout: 240000 }, async t => {
	const working = await mkdtemp(join(tmpdir(), "lean-bridge-copied-zend-"));
	t.after(() => rm(working, { recursive: true, force: true }));
	const libraries = [], packages = [];
	const compiler = await run(emcc, ["--version"], working);
	assert.match(compiler.stdout, /3\.1\.68 \(ceee49d2ecdab36a3feb85a684f8e5a453dde910\)/);
	for(const name of ["willow", "aspen"])
	{
		const ir = copiedZendFixture(name), files = generateCopiedPhpZendAdapter(ir);
		const manifest = JSON.parse(files["copied-zend-manifest.json"]);
		const root = join(working, name), extensionPath = `extension/${manifest.extension}.c`;
		for(const [path, source] of Object.entries(files)) await saveLakeFile(root, path, source);
		// Test-only providers deliberately contain no Lean implementation. They
		// isolate conversions, native owner cleanup, and malloc failure behavior.
		const isolate = source => source.replaceAll(/\bfixture_(\w+)/g, `${name}_fixture_$1`);
		const faultHooks = '#undef ZVAL_STRINGL\n#define ZVAL_STRINGL(z, s, n) do { fixture_before_string(); ZVAL_NEW_STR((z), zend_string_init((s), (n), 0)); } while (0)';
		await saveLakeFile(root, extensionPath, isolate(`${zendAllocationHeader}\n${files[extensionPath].replace('#include <limits.h>', `#include <limits.h>\n${faultHooks}`)}`));
		await saveLakeFile(root, "provider.c", isolate(`#include <php.h>\n#include "${name}.h"\n${zendAllocationFixture}\n${zendProviderFixture(ir)}`));
		const args = ["-O2", "-g0", "-shared", "-fPIC", "-fvisibility=hidden"
			, "-Wall", "-Wextra", "-Werror", "-Wno-unused-function"
			, "-Wno-unused-parameter", "-Wno-type-limits", "-sSIDE_MODULE=1"
			, ...[phpSource, ...["Zend", "main", "TSRM", "ext"].map(dir => join(phpSource, dir)), join(root, "include")].flatMap(dir => ["-I", dir])
			, extensionPath, "provider.c"];
		if(name === "willow")
		{
			const wrong = generateCopiedPhpZendAdapter(ir, { integerBits: 64 });
			await saveLakeFile(root, "wrong-width.c", wrong[extensionPath]);
			await assert.rejects(run(emcc, ["-fsyntax-only"
				, ...[phpSource, ...["Zend", "main", "TSRM", "ext"].map(dir => join(phpSource, dir)), join(root, "include")].flatMap(dir => ["-I", dir])
				, "wrong-width.c"], root), error => /PHP integer width differs/.test(error.details?.stderr ?? ""));
		}
		await run(emcc, [...args, "-o", "adapter.so"], root);
		const bytes = await readFile(join(root, "adapter.so"));
		const module = await WebAssembly.compile(bytes);
		assert.deepEqual(WebAssembly.Module.imports(module).filter(item => item.kind === "memory" || item.kind === "table").map(item => [item.module, item.name]).sort(), [["env", "__indirect_function_table"], ["env", "memory"]]);
		assert.equal(WebAssembly.Module.exports(module).some(item => ["memory", "table"].includes(item.kind)), false);
		await saveLakeFile(root, "consumer.php", zendConsumerFixture(name, manifest));
		libraries.push({ name: `${name}.so`, url: pathToFileURL(join(root, "adapter.so")), ini: true });
		packages.push({ root, name, files });
		const relocated = join(working, `${name}-relocated`);
		for(const path of [extensionPath, "provider.c", ...Object.keys(files).filter(path => path.endsWith(".h"))]) await saveLakeFile(relocated, path, await readFile(join(root, path)));
		await run(emcc, [...args.map(value => value === join(root, "include") ? join(relocated, "include") : value), "-o", "adapter.so"], relocated);
		assert.deepEqual(await readFile(join(relocated, "adapter.so")), bytes);
		t.diagnostic(`${name} Zend test adapter SHA-256 ${sha256(bytes)}`);
	}
	await saveLakeFile(working, "host.mjs", `import { readFile } from 'node:fs/promises';
import { PhpNode } from ${JSON.stringify(pathToFileURL(join(phpHost, "PhpNode.mjs")).href)};
const php = new PhpNode({version: '8.4', sharedLibs: ${JSON.stringify(libraries.map(lib => ({ ...lib, url: lib.url.href })))}.map(lib => ({...lib, url: new URL(lib.url)})), ini: 'memory_limit=512M'});
let stdout = '', stderr = '';
php.addEventListener('output', event => { for (const part of event.detail) stdout += part; });
php.addEventListener('error', event => { for (const part of event.detail) stderr += part; });
await php.binary;
${packages.map(({ name, root, files }) => `await php.mkdir('/${name}'); await php.mkdir('/${name}/src'); await php.mkdir('/${name}/src/Internal');
${Object.keys(files).filter(path => path.endsWith(".php")).concat("consumer.php").map(path => `await php.writeFile('/${name}/${path}', await readFile(${JSON.stringify(join(root, path))}, 'utf8'));`).join("\n")}`).join("\n")}
const status = await php.run("<?php require '/willow/consumer.php'; require '/aspen/consumer.php';");
if (status || stderr || stdout !== 'willow:ok\\\\naspen:ok\\\\n') throw new Error(JSON.stringify({status,stdout,stderr}));
stdout = ''; stderr = '';
await php.run("<?php require_once '/willow/src/Api.php'; LeanWillow\\\\native_bailout('owned across bailout');");
const recovered = await php.run("<?php require_once '/willow/src/Api.php'; echo LeanWillow\\\\live_allocations(), ':', LeanWillow\\\\echo_uint8(42);");
if (recovered || stderr || stdout !== '0:42') throw new Error(JSON.stringify({recovered,stdout,stderr}));
stdout = ''; stderr = '';
await php.run("<?php LeanWillow\\\\output_bailout('owned before PHP allocation');");
const outputRecovered = await php.run("<?php echo LeanWillow\\\\live_allocations(), ':', LeanWillow\\\\echo_uint8(42);");
if (outputRecovered || stderr || stdout !== '0:42') throw new Error(JSON.stringify({outputRecovered,stdout,stderr}));
console.log(JSON.stringify({status, packages: 2, integerBits: 32, values: 'passed', failures: 'passed'}));
`);
	const output = await run(process.execPath, ["host.mjs"], working);
	assert.deepEqual(JSON.parse(output.stdout.trim()), { status: 0, packages: 2, integerBits: 32, values: "passed", failures: "passed" });
});
