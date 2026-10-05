/**
 * Real wasm32 Zend allocation, nested-buffer ownership and bailout probes.
 * Synthetic providers are separate from installed Lean execution evidence.
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
import { brickMathMountSource } from "./helpers/brick-math.mjs";
import { phpWasmStructuredCallableConsumer } from "./helpers/php-wasm-structured-callable-fixture.mjs";
import { zendStructuredAllocationHeader, zendStructuredCallableFaultIr, zendStructuredCallableFaultProvider } from "./helpers/php-wasm-structured-callable-faults.mjs";

test("wasm32 structured callback buffers survive Zend teardown and all C allocation failures", { skip: process.env.LEAN_BRIDGE_PHP_WASM_STRUCTURED_CALLABLE_TEST !== "1", timeout: 240_000 }, async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-php-wasm-structured-fault-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const ir = zendStructuredCallableFaultIr(), files = generateCopiedPhpZendAdapter(ir);
	const manifest = JSON.parse(files["copied-zend-manifest.json"]), extension = `extension/${manifest.extension}.c`;
	const model = compileCopiedPhpModel(ir, { integerBits: 32, structuredCallables: true, lists: true, variants: true });
	const request = model.surface.functions.filter(fn => fn.field.startsWith("call_")).map(fn => ({
		name: fn.field
		, transport: manifest.exports.find(item => item.function.endsWith("\\" + fn.field)).transport
		, to: `to${model.surface.copy(fn.declaration.parameters[0].type).index}`
	}));
	assert.equal(request.length, 8);
	for(const [path, source] of Object.entries(files)) await saveLakeFile(root, path, source);
	const instrumented = `${zendStructuredAllocationHeader}\n${files[extension]}`;
	await saveLakeFile(root, extension, instrumented);
	const provider = zendStructuredCallableFaultProvider(ir);
	await saveLakeFile(root, "provider.c", provider);
	const sdk = resolve(process.env.LEAN_BRIDGE_PHP_SOURCE ?? "build/php-wasm-sdk/php8.4-src");
	const emcc = resolve(process.env.LEAN_BRIDGE_PHP_EMCC ?? ".toolchains/emsdk-php-wasm/upstream/emscripten/emcc");
	const flags = ["-O2", "-g0", "-shared", "-fPIC"
		, "-fvisibility=hidden", "-UNDEBUG", "-sSIDE_MODULE=1"
		, "-Wall", "-Wextra", "-Werror", "-Wno-unused-function"
		, "-Wno-unused-parameter", "-Wno-type-limits"
		, ...[sdk, ...["Zend", "main", "TSRM", "ext"].map(path => join(sdk, path)), join(root, "include")].flatMap(path => ["-I", path])];
	await runCopied(emcc, [...flags, extension, "provider.c", "-o", "adapter.so"], root, process.env);
	const base = await phpWasmStructuredCallableConsumer("reviewed-ir");
	const setup = base.slice(0, base.indexOf("foreach ($cases as $shape => $values)"));
	assert.ok(setup.includes("$cases = ["));
	const consumer = setup.replace("require 'vendor/autoload.php';", "require '/probe/src/Api.php';") + String.raw`
$failures = 0; $paths = []; $wireRejections = 0;
function clean(int $expected = 0): void {
    $actual = LeanStructured\live_allocations();
    if ($actual !== $expected) throw new RuntimeException(json_encode(['live' => $actual, 'expected' => $expected, 'shape' => $GLOBALS['shape'] ?? null, 'path' => $GLOBALS['name'] ?? null, 'limit' => $GLOBALS['limit'] ?? null]));
    check(true);
}
function withClosure(callable $make, mixed $value, bool $invoke): mixed {
    $closure = $make($value);
    try { return $invoke ? $closure(true, $value) : null; }
    finally { $closure->close(); }
}
foreach ($cases as $shape => $values) {
    $call = 'LeanStructured\\call_' . $shape; $twice = 'LeanStructured\\twice_' . $shape; $make = 'LeanStructured\\make_' . $shape;
    foreach ($values as $value) { independent($call($value, fn($item) => $item), $value); clean(); }
    $value = $values[count($values) - 1]; $held = $make($value); $baseline = LeanStructured\live_allocations();
    $actions = [
        'callback' => fn() => $call($value, fn($item) => $item),
        'twice' => fn() => $twice($value, fn($item) => $item),
        'create' => fn() => withClosure($make, $value, false),
        'create-call' => fn() => withClosure($make, $value, true),
        'held-call' => fn() => $held(true, $value)
    ];
    foreach ($actions as $name => $action) {
        $succeeded = false; $before = $failures;
        for ($limit = 0; $limit < 4000; ++$limit) {
            LeanStructured\fail_after($limit);
            try { $action(); $succeeded = true; } catch (Throwable $error) { ++$failures; }
            try { LeanStructured\fail_after(-1); } catch (Throwable $error) { LeanStructured\fail_after(-1); }
            // Exception traces may retain an explicitly closed PHP lease wrapper.
            unset($error); gc_collect_cycles();
            clean($baseline);
            same($call($value, fn($item) => $item), $value); clean($baseline);
            if ($succeeded) break;
        }
        check($succeeded && $failures > $before);
        $paths[] = [$shape, $name, $failures - $before];
    }
    $held->close(); unset($held, $actions, $action); clean();
}
foreach (json_decode(file_get_contents('/probe.json'), true, flags: JSON_THROW_ON_ERROR) as $entry) {
    $value = $cases[substr($entry['name'], 5)][0];
    $wire = (new ReflectionMethod(LeanStructured\Internal\Native::class, $entry['to']))->invoke(null, $value);
    rejects(Throwable::class, fn() => $entry['transport']($wire, fn($value) => false));
    clean(); ++$wireRejections;
}
check(PHP_INT_SIZE === 4); clean();
echo json_encode(['wordBits' => 32, 'checks' => $checks, 'allocationFailures' => $failures,
    'paths' => $paths, 'wireRejections' => $wireRejections,
    'ownedBuffers' => (int) (string) LeanStructured\owned_buffers()], JSON_THROW_ON_ERROR);
`;
	const host = resolve(process.env.LEAN_BRIDGE_PHP_WASM_HOST ?? "build/php-wasm-host/node_modules/php-wasm");
	await saveLakeFile(root, "host.mjs", `import {readFile} from 'node:fs/promises';
import {PhpNode} from ${JSON.stringify(pathToFileURL(join(host, "PhpNode.mjs")).href)};
process.setUncaughtExceptionCaptureCallback(error => {console.error(error.stack); process.exit(1);});
const php=new PhpNode({version:'8.4',autoTransaction:false,sharedLibs:[{name:'probe.so',url:new URL(process.argv[3] ? './unowned.so' : './adapter.so',import.meta.url),ini:true}],ini:'memory_limit=512M'});
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
for(const source of [
  "LeanStructured\\\\call_array([new LeanStructured\\\\Some('owned at bailout')], fn($value)=>exit(0));",
  ${JSON.stringify(`${request[0].transport}([['owned at teardown']], fn($value)=>new class { public function __destruct() { exit(0); } });`)}
]) {
  stdout=''; stderr=''; await php.run('<?php '+source);
  await php.refresh();
  const status=await php.run("<?php require '/probe/src/Api.php'; echo LeanStructured\\\\live_allocations(), ':', LeanStructured\\\\call_array([new LeanStructured\\\\Some('recovered')], fn($value)=>$value)[0]->value;");
  if(status || stderr || stdout!=='0:recovered') throw new Error(JSON.stringify({status,stdout,stderr,source,result}));
}
console.log(JSON.stringify({...result,bailoutRecovery:2}));
`);
	const executions = [];
	for(const mode of ["0", "1"])
	{
		const run = await runCopied(process.execPath, ["host.mjs", mode], root);
		assert.equal(run.stderr, ""); const result = JSON.parse(run.stdout);
		assert.equal(result.wordBits, 32); assert.ok(result.allocationFailures > 100);
		assert.equal(result.paths.length, 40); assert.ok(result.paths.every(path => path[2] > 0));
		assert.equal(result.wireRejections, 8); assert.ok(result.ownedBuffers > 100); assert.equal(result.bailoutRecovery, 2);
		executions.push({ mode: mode === "1" ? "strict" : "weak", ...result });
	}
	const unowned = instrumented.replaceAll("s->copy_buffers = 1;", "s->copy_buffers = 0;");
	assert.notEqual(unowned, instrumented);
	await saveLakeFile(root, "unowned.c", unowned);
	await runCopied(emcc, [...flags, "unowned.c", "provider.c", "-o", "unowned.so"], root, process.env);
	await assert.rejects(runCopied(process.execPath, ["host.mjs", "0", "unowned"], root), /Callback buffer is not owned by the C scope/u);
	const report = resolve("build/structured-callables/php-wasm-zend-faults.json");
	await saveLakeFile(dirname(report), report.split("/").at(-1), canonicalJson({ schemaVersion: 1
		, provider: "synthetic-not-Lean"
		, bindingIrSha256: manifest.bindingIrSha256
		, extensionSha256: sha256(files[extension])
		, instrumentedSha256: sha256(instrumented), providerSha256: sha256(provider)
		, consumerSha256: sha256(consumer)
		, requestSha256: sha256(canonicalJson(request))
		, wasmSha256: sha256(await readFile(join(root, "adapter.so"))), executions
		, unownedReplyRejected: true, unownedSourceSha256: sha256(unowned) }));
});
