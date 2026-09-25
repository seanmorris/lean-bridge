/**
 * Zend callable syntax, admission and pointer-width lifetime contracts.
 *
 * @file
 */
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { generateCopiedPhpZendAdapter } from "../src/backends/php/copied-zend.mjs";
import { phpZendLease } from "../src/backends/php/zend-callables.mjs";
import { phpWasmCallbackBroker } from "../src/build/php-wasm-copied-component.mjs";
import { nativeCallbackHeader } from "../src/build/native-component.mjs";
import { generateNativeCallables } from "../src/backends/c/native-callables.mjs";
import { callableReviewedIr } from "./helpers/callable-fixture.mjs";
import { phpCallableSignatures } from "./helpers/php-callable-fixture.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";
import { runCopied } from "./helpers/copied-fixture-install.mjs";

test("Zend callable sources bind exact wasm32 values without exposing native layouts", () => {
	const ir = callableReviewedIr(phpCallableSignatures), files = generateCopiedPhpZendAdapter(ir);
	assert.deepEqual(files, generateCopiedPhpZendAdapter(structuredClone(ir)));
	assert.match(files["src/Api.php"], /function call_uint32\(mixed \$value0, mixed \$value1\): \\Brick\\Math\\BigInteger/u);
	assert.match(files["src/Api.php"], /@param callable\(\\Brick\\Math\\BigInteger\): \\Brick\\Math\\BigInteger/u);
	assert.match(files["src/Api.php"], /function make_int64\(mixed \$value0\): LeanClosure/u);
	assert.doesNotMatch(files["src/Api.php"], /FFI|CData|pointer|resource/u);
	const manifest = JSON.parse(files["copied-zend-manifest.json"]), c = files[`extension/${manifest.extension}.c`];
	assert.match(c, /zend_register_list_destructors_ex\(lb_owned_destroy/u);
	assert.match(c, /zend_catch \{ \*borrow->bailout = 1; \}/u);
	assert.match(c, /lb_cleanup_call0\(ctx\);\n {2}if \(bailout\) zend_bailout/u);
	assert.match(c, /if \(EG\(exception\)\).*RETURN_THROWS/u);
});

for(const [name, change] of Object.entries({
	retained: ir => { ir.declarations[0].parameters[1].lifetime.scope = "explicit"; }
	, async: ir => { ir.types[0].callable.resultMode = "promise"; }
	, zero: ir => { ir.types[0].callable.parameters = []; }
	, seventeen: ir => { ir.types[0].callable.parameters = Array.from({ length: 17 }, (_, i) => ({ ...ir.types[0].callable.parameters[0], name: `arg${i}` })); }
})) test(`Zend callable admission rejects ${name}`, () => {
	const ir = callableReviewedIr(); change(ir); assert.throws(() => generateCopiedPhpZendAdapter(ir));
});

test("Zend callable admission includes copied aggregate replies", () => {
	const ir = callableReviewedIr();
	ir.types[0].callable.result.type = { kind: "apply", constructor: "array", arguments: [{ kind: "primitive", name: "uint8" }] };
	assert.doesNotThrow(() => generateCopiedPhpZendAdapter(ir));
});

test("wasm32 callback generations retire without token truncation or reuse", { skip: !existsSync("/usr/bin/cc") }, async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-wasm-callback-registry-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	await saveLakeFile(root, "registry.c", `#include <stdint.h>\n#include <stddef.h>\n#include <pthread.h>\n#include <assert.h>\nstatic pthread_mutex_t runtime_mutex = PTHREAD_MUTEX_INITIALIZER;\nenum { LEAN_BRIDGE_RUNTIME_READY = 2 };\nstatic unsigned runtime_state = LEAN_BRIDGE_RUNTIME_READY;\n${nativeCallbackHeader}\n${phpWasmCallbackBroker}\nstatic void invoke(void) {}\nint main(void) {
  callback_slots[0].generation = (UINT32_MAX >> 12) - 1;
  uint64_t last = lb_native_callback_register(invoke, NULL);
  assert(last != 0 && last <= UINT32_MAX && (last & 4095) == 0);
  assert(lb_native_callback_lookup(last).invoke == invoke); lb_native_callback_release(last);
  uint64_t next = lb_native_callback_register(invoke, NULL);
  assert(next != 0 && next <= UINT32_MAX && (next & 4095) == 1);
  assert(lb_native_callback_lookup(last).invoke == NULL); assert(lb_native_callback_take_error());
  assert(lb_native_callback_lookup(next).invoke == invoke); lb_native_callback_release(next);
  for (unsigned i = 0; i < 4096; i++) callback_slots[i].generation = UINT32_MAX >> 12;
  assert(lb_native_callback_register(invoke, NULL) == 0); return 0;
}\n`);
	await runCopied("/usr/bin/cc", ["-std=c11", "-Wall", "-Wextra", "-Werror", "-pthread", "registry.c", "-o", "registry"], root, { PATH: "/usr/bin:/bin" });
	await runCopied(join(root, "registry"), [], root);
});

const php = process.env.LEAN_BRIDGE_PHP ?? "/usr/bin/php";
test("wasm32 owned leases retain full broker identities and never reuse local tokens", { skip: !existsSync("/usr/bin/cc") }, async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-wasm-owned-registry-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const surface = { prefix: "test", callbacks: new Map([["present", {}]]), functions: [] };
	const generate = pointerBits => generateNativeCallables({ pointerBits, types: [] }, surface).source;
	const native = generate(64), wasm = generate(32);
	assert.doesNotMatch(native, /lb_next_lease|uint64_t identity/u);
	assert.match(native, /lean_bridge_native_identity_release\(token, kind, slot\)/u);
	// Execute the production registry with explicit 32-bit tokens on the test host.
	const registry = wasm.slice(wasm.indexOf("typedef struct { uintptr_t token;"))
		.replaceAll("uintptr_t", "uint32_t").replaceAll("UINTPTR_MAX", "UINT32_MAX");
	await saveLakeFile(root, "leases.c", `#include <stdint.h>\n#include <stddef.h>\n#include <pthread.h>\n#include <unistd.h>\n#include <string.h>\n#include <assert.h>
typedef struct { unsigned refs; } lean_object;
static void lean_mark_mt(lean_object *value) { (void)value; }
static void lean_inc(lean_object *value) { ++value->refs; }
static void lean_dec(lean_object *value) { assert(value->refs); --value->refs; }
static uint64_t identity; static unsigned acquired, released;
static uint64_t lean_bridge_native_identity_acquire(const char *kind, void *slot) {
  assert(kind && slot); ++acquired; return identity = (UINT64_C(1) << 32) + acquired;
}
static int lean_bridge_native_identity_release(uint64_t token, const char *kind, void *slot) {
  assert(token == identity && token > UINT32_MAX && kind && slot); ++released; return 1;
}
${registry}
int main(void) {
  lean_object value = {1}; uint32_t first = lb_lease_store(&value, "closure");
  assert(first == 1 && acquired == 1); assert(lb_lease_borrow(first, "wrong") == NULL);
  assert(lb_lease_borrow(first, "closure") == &value && value.refs == 2);
  lb_lease_drop(first, "closure"); assert(released == 1 && value.refs == 1);
  assert(lb_lease_borrow(first, "closure") == NULL); lean_dec(&value);
  value.refs = 1; uint32_t second = lb_lease_store(&value, "closure");
  assert(second != first); lb_lease_drop(first, "closure"); assert(released == 1);
  lb_lease_drop(second, "closure"); assert(released == 2 && value.refs == 0);
  value.refs = 1; lb_next_lease = UINT32_MAX - 1;
  uint32_t last = lb_lease_store(&value, "closure"); assert(last == UINT32_MAX);
  lb_lease_drop(last, "closure"); assert(released == 3 && value.refs == 0);
  value.refs = 1; assert(lb_lease_store(&value, "closure") == 0 && acquired == 3);
  assert(value.refs == 1); lean_dec(&value); return 0;
}\n`);
	await runCopied("/usr/bin/cc", ["-std=c11", "-Wall", "-Wextra", "-Werror", "-pthread", "leases.c", "-o", "leases"], root, { PATH: "/usr/bin:/bin" });
	await runCopied(join(root, "leases"), [], root);
});

test("Zend PHP syntax and production lease defer active close and reject Fiber calls", { skip: !existsSync(php) }, async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-php-wasm-callable-syntax-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const files = generateCopiedPhpZendAdapter(callableReviewedIr(phpCallableSignatures));
	for(const [path, contents] of Object.entries(files))
	{
		await saveLakeFile(root, path, contents);
		if(path.endsWith(".php")) await runCopied(php, ["-n", "-l", path], root);
	}
	await saveLakeFile(root, "lease.php", `<?php\n${phpZendLease}
function check($value) { if (!$value) throw new RuntimeException('Lease assertion'); }
$lease = null; $calls = 0; $token = fopen('php://memory', 'r+');
$lease = new Lease(function ($token, $args) use (&$lease, &$calls) { $lease->close(); check($calls === 0); return $args[0]; },
  function ($token) use (&$calls) { if (is_resource($token)) { ++$calls; fclose($token); } }, $token, 1);
check($lease->invoke([42]) === 42 && $calls === 1 && $lease->isClosed()); $lease->close(); check($calls === 1);
$fiber = new Fiber(function () { try { Lease::ensureCall(); } catch (LogicException $expected) { return; } throw new RuntimeException('Fiber accepted'); });
$fiber->start(); echo 'lease-ok';
`);
	assert.equal((await runCopied(php, ["-n", "lease.php"], root)).stdout, "lease-ok");
	const emcc = resolve(".toolchains/emsdk-php-wasm/upstream/emscripten/emcc"), sdk = resolve("build/php-wasm-sdk/php8.4-src");
	if(existsSync(emcc) && existsSync(sdk))
	{
		const manifest = JSON.parse(files["copied-zend-manifest.json"]);
		await runCopied(emcc, ["-fsyntax-only"
			, "-Wall", "-Wextra", "-Werror"
			, "-Wno-unused-function", "-Wno-unused-parameter", "-Wno-type-limits"
			, ...[sdk, ...["Zend", "main", "TSRM", "ext"].map(path => join(sdk, path)), join(root, "include")].flatMap(path => ["-I", path])
			, `extension/${manifest.extension}.c`], root, process.env);
	}
});
