/**
 * Synthetic wasm32 collection ownership faults, separate from real Lean acceptance.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { generateCopiedPhpZendAdapter } from "../src/backends/php/copied-zend.mjs";
import { compileCopiedPhpModel } from "../src/backends/php/copied-model.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";
import { runCopied } from "./helpers/copied-fixture-install.mjs";
import { zendAllocationHeader } from "./helpers/php-copied-zend.mjs";
import { zendCollectionFaultIr, zendCollectionFaultProvider } from "./helpers/php-wasm-collection-faults.mjs";
import { brickMathMountSource } from "./helpers/brick-math.mjs";

test("wasm32 Zend collections clear all selected owners on failures and request bailouts", { skip: process.env.LEAN_BRIDGE_PHP_WASM_COLLECTION_TEST !== "1", timeout: 240_000 }, async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-zend-collection-fault-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const ir = zendCollectionFaultIr(), files = generateCopiedPhpZendAdapter(ir);
	const manifest = JSON.parse(files["copied-zend-manifest.json"]), extension = `extension/${manifest.extension}.c`;
	const model = compileCopiedPhpModel(ir, { integerBits: 32 });
	const request = { functions: {} };
	for(const fn of model.surface.functions.filter(fn => fn.field.startsWith("echo_")))
	{
		const copy = model.surface.copy(fn.declaration.parameters[0].type);
		request.functions[fn.field] = { transport: manifest.exports.find(item => item.function.endsWith("\\" + fn.field)).transport, to: `to${copy.index}` };
	}
	for(const [path, source] of Object.entries(files)) await saveLakeFile(root, path, source);
	const hooks = '#undef ZVAL_STRINGL\n#define ZVAL_STRINGL(z, s, n) do { fixture_before_string(); ZVAL_NEW_STR((z), zend_string_init((s), (n), 0)); } while (0)';
	await saveLakeFile(root, extension, `${zendAllocationHeader}\n${files[extension].replace('#include <limits.h>', `#include <limits.h>\n${hooks}`)}`);
	const provider = zendCollectionFaultProvider(ir);
	await saveLakeFile(root, "provider.c", provider);
	const sdk = resolve(process.env.LEAN_BRIDGE_PHP_SOURCE ?? "build/php-wasm-sdk/php8.4-src");
	const emcc = resolve(process.env.LEAN_BRIDGE_PHP_EMCC ?? ".toolchains/emsdk-php-wasm/upstream/emscripten/emcc");
	await runCopied(emcc, ["-O2", "-g0", "-shared", "-fPIC", "-fvisibility=hidden"
		, "-sSIDE_MODULE=1", "-Wall", "-Wextra", "-Werror", "-Wno-unused-function"
		, "-Wno-unused-parameter", "-Wno-type-limits"
		, ...[sdk, ...["Zend", "main", "TSRM", "ext"].map(path => join(sdk, path)), join(root, "include")].flatMap(path => ["-I", path])
		, extension, "provider.c", "-o", "adapter.so"], root, process.env);
	const consumer = await readFile("tests/fixtures/collection-consumers/php-wasm-faults.php", "utf8");
	const host = resolve(process.env.LEAN_BRIDGE_PHP_WASM_HOST ?? "build/php-wasm-host/node_modules/php-wasm");
	await saveLakeFile(root, "host.mjs", `import {readFile} from 'node:fs/promises';
import {PhpNode} from ${JSON.stringify(pathToFileURL(join(host, "PhpNode.mjs")).href)};
process.setUncaughtExceptionCaptureCallback(error => {console.error(error.stack); process.exit(1);});
const php = new PhpNode({version:'8.4',autoTransaction:false,sharedLibs:[{name:'probe.so',url:new URL('./adapter.so',import.meta.url),ini:true}],ini:'memory_limit=512M'});
let stdout='',stderr='';
php.addEventListener('output',event=>{stdout+=event.detail.join('');}); php.addEventListener('error',event=>{stderr+=event.detail.join('');});
await php.binary;
${brickMathMountSource()}
await php.mkdir('/probe'); await php.mkdir('/probe/src'); await php.mkdir('/probe/src/Internal');
${Object.keys(files).filter(path => path.endsWith(".php")).map(path => `await php.writeFile('/probe/${path}',await readFile(${JSON.stringify(join(root, path))},'utf8'));`).join("\n")}
await php.writeFile('/probe.json',${JSON.stringify(canonicalJson(request))});
await php.writeFile('/consumer.php',${JSON.stringify(consumer)}.replace('declare(strict_types=0);','declare(strict_types='+process.argv[2]+');'));
const status=await php.run("<?php require '/consumer.php';");
if(status || stderr) throw new Error(JSON.stringify({status,stdout,stderr}));
const result=JSON.parse(stdout);
for(const mode of [7,8]) {
  stdout=''; stderr='';
  await php.run("<?php $beforeCalls=LeanCollectionProbe\\\\native_calls(); $beforeClears=LeanCollectionProbe\\\\output_clears(); LeanCollectionProbe\\\\configure("+mode+"); LeanCollectionProbe\\\\echo_string([['first','second']]);");
  const status=await php.run("<?php LeanCollectionProbe\\\\configure(0); echo LeanCollectionProbe\\\\live_allocations(), ':', LeanCollectionProbe\\\\native_calls()-$beforeCalls, ':', LeanCollectionProbe\\\\output_clears()-$beforeClears, ':', LeanCollectionProbe\\\\echo_uint32([[Brick\\\\Math\\\\BigInteger::of(42)]])[0][0];");
  if(status || stderr || stdout!=='0:1:1:42') throw new Error(JSON.stringify({status,stdout,stderr,mode}));
}
console.log(JSON.stringify({...result,bailoutRecovery:2}));
`);
	const executions = [];
	for(const mode of ["0", "1"])
	{
		const run = await runCopied(process.execPath, ["host.mjs", mode], root);
		assert.equal(run.stderr, ""); const result = JSON.parse(run.stdout);
		assert.equal(result.wordBits, 32); assert.ok(result.allocationFailures > 40);
		assert.equal(new Set(result.primitives).size, 19);
		assert.equal(result.malformedOutputs, 81); assert.equal(result.emptyPoisonPointers, 12);
		assert.equal(result.partialInputs, 32); assert.equal(result.wireRejections, 120); assert.equal(result.bailoutRecovery, 2);
		assert.equal(result.oneClearPerNativeEntry, true);
		executions.push({ mode: mode === "1" ? "strict" : "weak", ...result });
	}
	const report = resolve("build/collections/php-wasm-zend-faults.json");
	await saveLakeFile(dirname(report), report.split("/").at(-1), canonicalJson({ schemaVersion: 1
		, provider: "synthetic-not-Lean"
		, bindingIrSha256: manifest.bindingIrSha256
		, extensionSha256: sha256(files[extension])
		, instrumentedSha256: sha256(await readFile(join(root, extension)))
		, providerSha256: sha256(provider), consumerSha256: sha256(consumer)
		, requestSha256: sha256(canonicalJson(request))
		, wasmSha256: sha256(await readFile(join(root, "adapter.so")))
		, executions }));
});
