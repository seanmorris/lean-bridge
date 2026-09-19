/**
 * Native PHP callable admission, generated syntax and lease-state regressions.
 *
 * @file
 */
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { generatePhpBindingPackage, compilePhpPackageModel, renderPhpPackageLayout } from "../src/backends/php/generate.mjs";
import { generateCopiedPhpZendAdapter } from "../src/backends/php/copied-zend.mjs";
import { phpCallableState } from "../src/backends/php/callables.mjs";
import { callableReviewedIr } from "./helpers/callable-fixture.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";
import { runCopied } from "./helpers/copied-fixture-install.mjs";

test("PHP callable generation keeps exact public PHPDoc and native layouts private", () => {
	const ir = callableReviewedIr(), files = generatePhpBindingPackage(ir);
	assert.deepEqual(files, renderPhpPackageLayout(compilePhpPackageModel(ir)));
	assert.deepEqual(files, generatePhpBindingPackage(structuredClone(ir)));
	assert.match(files["src/Api.php"], /final class LeanClosure/);
	assert.match(files["src/Api.php"], /@param callable\(\\Brick\\Math\\BigInteger\): \\Brick\\Math\\BigInteger/);
	assert.match(files["src/Api.php"], /function make_nat\(mixed \$value0\): LeanClosure/);
	assert.doesNotMatch(files["src/Api.php"], /FFI|CData|pointer/);
	assert.match(files["src/Internal/Native.php"], /private static array \$stubs = \[\]/);
	assert.match(files["src/Internal/Native.php"], /catch \(\\Throwable \$failure\)/);
});

for(const [label, change] of Object.entries({
	"retained callback": ir => { ir.declarations[0].parameters[1].lifetime.scope = "explicit"; }
	, "async callback": ir => { ir.types[0].callable.resultMode = "promise"; }
	, "compound callback": ir => { ir.types[0].callable.result.type = { kind: "apply", constructor: "array", arguments: [{ kind: "primitive", name: "uint8" }] }; }
	, "zero-argument callback": ir => { ir.types[0].callable.parameters = []; }
	, "seventeen-argument callback": ir => { ir.types[0].callable.parameters = Array.from({ length: 17 }, (_, i) => ({ ...ir.types[0].callable.parameters[0], name: `arg${i}` })); }
})) test(`PHP callable admission rejects ${label}`, () => {
	const ir = callableReviewedIr(); change(ir); assert.throws(() => compilePhpPackageModel(ir));
});

test("native FFI requires 64-bit PHP while Zend uses its separate checked-width adapter", () => {
	const ir = callableReviewedIr();
	assert.throws(() => compilePhpPackageModel(ir, { integerBits: 32 }), /PHP-Wasm/);
	for(const integerBits of [32, 64]) assert.ok(generateCopiedPhpZendAdapter(ir, { integerBits })["src/Api.php"].includes("final class LeanClosure"));
});

const php = process.env.LEAN_BRIDGE_PHP ?? "/usr/bin/php";
test("generated PHP syntax and the production lease enforce deferred close and fiber guards", { skip: !existsSync(php) }, async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-php-callable-contract-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	for(const [path, contents] of Object.entries(generatePhpBindingPackage(callableReviewedIr())))
	{
		await saveLakeFile(root, path, contents);
		if(path.endsWith(".php")) await runCopied(php, ["-n", "-l", path], root);
	}
	await saveLakeFile(root, "state.php", `<?php
declare(strict_types=1);
namespace LeanBridge\\CopiedNativeV1 { final class Runtime { public static bool $changed = false; public static function ensureProcess(): void { if (self::$changed) throw new \\LogicException('process changed'); } } }
namespace Contract {
${phpCallableState}
set_error_handler(static function (int $severity, string $message, string $file, int $line): never {
    throw new \\ErrorException($message, 0, $severity, $file, $line);
});
function check(bool $value): void { if (!$value) throw new \\RuntimeException('lease assertion'); }
function reject(callable $call): void { try { $call(); } catch (\\LogicException|\\ArgumentCountError $expected) { return; } throw new \\RuntimeException('missing rejection'); }
$released = 0; $lease = null; $ffi = \\FFI::cdef(''); $box = $ffi->new('uint64_t'); $box->cdata = 42;
$lease = new Lease(function ($token, $args) use (&$lease, &$released) { $lease->close(); check($released === 0); return $token->cdata + $args[0]; },
    function ($token) use (&$released) { if ($token->cdata !== 0) { ++$released; $token->cdata = 0; } }, $box, 1);
reject(fn() => $lease->invoke([])); reject(fn() => $lease->invoke(['named' => 1]));
check($lease->invoke([1]) === 43); check($released === 1 && $lease->isClosed());
$lease->close(); check($released === 1); reject(fn() => $lease->invoke([1]));
$fiber = new \\Fiber(fn() => reject(fn() => Lease::ensureCall())); $fiber->start();
\\LeanBridge\\CopiedNativeV1\\Runtime::$changed = true; reject(fn() => $lease->invoke([1])); reject(fn() => $lease->close());
\\LeanBridge\\CopiedNativeV1\\Runtime::$changed = false;
echo 'php-lease-contract-ok';
}
`);
	const result = await runCopied(php, ["-n", "-d", "extension=ffi", "-d", "ffi.enable=1", "-d", "error_reporting=-1", "state.php"], root);
	assert.equal(result.stdout, "php-lease-contract-ok");
	assert.equal(result.stderr, "");
});
