/**
 * Closed Composer source generation and private native-library loading policy.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { generateOwnedPhpPackage, auditOwnedPhpPackage } from "../src/backends/php/owned-package.mjs";
import { copiedPhpLoader } from "../src/backends/php/copied-assets.mjs";
import { ownedPhpLoader } from "../src/backends/php/owned-assets.mjs";
import { ownedDotnetCallbacksReviewedIr } from "./helpers/owned-dotnet-callback-fixture.mjs";
import { runCopied } from "./helpers/copied-fixture-install.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";

const evidenceFor = ir => {
	const model = generateOwnedPhpPackage(ir), library = `lib${model.c.prefix}_php.so`;
	const libraries = [library, "libleanshared.so", "liblean_bridge_native.so"
		, "libgmp-lean-bridge.so.10", "libowned_fixture.so"];
	return { componentId: ir.component.id, componentReceiptSha256: "a".repeat(64)
		, library, runtimeIdentity: "b".repeat(64), ownedValues: model.contract
		, libraries: Object.fromEntries(libraries.map(name => [name, sha256(name)])) };
};

test("owned PHP packages generate deterministic automatic bootstrap and closed sources", () => {
	const ir = ownedDotnetCallbacksReviewedIr(), before = structuredClone(ir), evidence = evidenceFor(ir);
	for(const input of [null, evidence])
	{
		const model = generateOwnedPhpPackage(ir, input);
		assert.deepEqual(model.files, generateOwnedPhpPackage(ir, input).files); assert.deepEqual(ir, before);
		assert.equal(auditOwnedPhpPackage(ir, model.files), true);
		assert.match(model.files["src/Api.php"], /OwnedBootstrap\.php/u);
		assert.match(model.files["src/Internal/OwnedBootstrap.php"], /Native::configure/u);
		assert.equal(model.contract.loadingPolicy, "linux-x64-deepbind-v1");
		assert.equal(model.contract.gmp, "libgmp-lean-bridge.so.10");
		assert.equal(model.exports.length, 100); assert.equal(model.files["src/Internal/Runtime.php"], copiedPhpLoader);
		for(const path of Object.keys(model.files))
		{
			assert.throws(() => auditOwnedPhpPackage(ir, { ...model.files, [path]: model.files[path] + "\n" }));
			const removed = { ...model.files }; delete removed[path]; assert.throws(() => auditOwnedPhpPackage(ir, removed));
		}
		assert.throws(() => auditOwnedPhpPackage(ir, { ...model.files, "src/Hidden.php": "<?php" }), /complete generated/u);
		const changed = { ...model.files, "src/Api.php": model.files["src/Api.php"] + "\nfunction unchecked() {}\n" };
		const manifest = JSON.parse(changed["binding-manifest.json"]);
		manifest.filesSha256["src/Api.php"] = sha256(changed["src/Api.php"]);
		changed["binding-manifest.json"] = canonicalJson(manifest);
		assert.throws(() => auditOwnedPhpPackage(ir, changed), /complete generated/u);
	}
});

test("owned PHP loading evidence rejects incomplete, conflicting and injected identities", () => {
	const ir = ownedDotnetCallbacksReviewedIr(), base = evidenceFor(ir);
	const edits = [value => { value.unrecorded = true; }
		, value => { value.componentId += "other"; }
		, value => { value.componentReceiptSha256 = "x".repeat(64); }
		, value => { value.runtimeIdentity = "short"; }
		, value => { value.runtimeIdentity = [value.runtimeIdentity]; }
		, value => { value.componentReceiptSha256 = [value.componentReceiptSha256]; }
		, value => { value.library = "../libescape.so"; }
		, value => { value.ownedValues.callbackLifetime = "forever"; }
		, value => { delete value.libraries["libgmp-lean-bridge.so.10"]; }
		, value => { value.libraries["libextra.so"] = "c".repeat(64); }
		, value => { value.libraries["libleanshared.so"] = "invalid"; }
		, value => { value.libraries["libleanshared.so"] = [value.libraries["libleanshared.so"]]; }
		, value => { value.libraries["../libescape.so"] = value.libraries["libowned_fixture.so"]; delete value.libraries["libowned_fixture.so"]; }];
	for(const edit of edits)
	{
		const value = structuredClone(base); edit(value);
		assert.throws(() => generateOwnedPhpPackage(ir, value), /Owned PHP/u);
	}
});

test("owned PHP automatic bootstrap stays cold without FFI or native artifacts", {
	skip: process.env.LEAN_BRIDGE_OWNED_NATIVE_TEST !== "1"
}, async t => {
	const directory = await mkdtemp(join(tmpdir(), "lean-bridge-owned-php-bootstrap-"));
	t.after(() => rm(directory, { recursive: true, force: true }));
	const model = generateOwnedPhpPackage(ownedDotnetCallbacksReviewedIr());
	for(const [path, source] of Object.entries(model.files)) await saveLakeFile(directory, path, source);
	const result = await runCopied(process.env.LEAN_BRIDGE_PHP ?? "/usr/bin/php", [
		"-n", "-r"
		, `require 'src/Api.php'; $checks = 0;
foreach ([fn() => LeanOwnedAggregates\\new_ticket(1, 'bad'),
    fn() => LeanOwnedAggregates\\via_bool(fn($a) => $a, 1)] as $call) {
    try { $call(); throw new RuntimeException('missing validation'); }
    catch (TypeError $error) { $checks++; }
}
try { LeanOwnedAggregates\\via_bool(fn($a) => $a, true); }
catch (RuntimeException $error) {
    if (!str_contains($error->getMessage(), 'Build a compiled native PHP release')) throw $error;
    $checks++;
}
if ($checks !== 3) throw new RuntimeException('bootstrap did not remain cold');
echo 'cold';`], directory);
	assert.equal(result.stdout, "cold"); assert.equal(result.stderr, "");
});

test("PHP loader isolates private GMP symbols and shares Lean in either package order", {
	skip: process.env.LEAN_BRIDGE_OWNED_NATIVE_TEST !== "1", timeout: 120000
}, async t => {
	const directory = await mkdtemp(join(tmpdir(), "lean-bridge-owned-php-loader-"));
	t.after(() => rm(directory, { recursive: true, force: true }));
	const sources = {
		"lean.c": "int lb_php_binding_probe(void) { return 11; }\nvoid lean_initialize_runtime_module(void) {}\n"
		, "runtime.c": "int lb_php_runtime_probe(void) { return 1; }\n"
		, "gmp.c": "int lb_php_binding_probe(void) { return 97; }\nint lb_php_private_dependency(void) { return lb_php_binding_probe(); }\n"
		, "component.c": "int lb_php_component_probe(void) { return 3; }\n"
		, "owned.c": "extern int lb_php_binding_probe(void);\nint owned_read(void) { return lb_php_binding_probe(); }\n"
		, "copied.c": "extern int lb_php_binding_probe(void);\nint copied_read(void) { return lb_php_binding_probe(); }\n"
	};
	for(const [path, source] of Object.entries(sources)) await saveLakeFile(directory, path, source);
	const libraries = ["libleanshared.so", "liblean_bridge_native.so"
		, "libgmp-lean-bridge.so.10", "libowned_fixture.so"
		, "libowned_fixture_php.so"
		, "libcopied_fixture.so"];
	for(const [index, path] of Object.keys(sources).entries())
	{
		const name = libraries[index];
		await runCopied("/usr/bin/cc", ["-shared", "-fPIC", "-Wall", "-Wextra"
			, "-Werror"
			, path, "-L", directory, "-Wl,-rpath,$ORIGIN", `-Wl,-soname,${name}`
			, ...index === 2 ? ["-Wl,-Bsymbolic"] : []
			, ...index === 4 ? ["-Wl,--no-as-needed", "-l:libgmp-lean-bridge.so.10"] : []
			, ...index === 5 ? ["-Wl,--no-as-needed", "-lleanshared"] : []
			, "-o", name], directory, { PATH: "/usr/bin:/bin" });
	}
	const hashes = {};
	for(const name of libraries) hashes[name] = sha256(await readFile(join(directory, name)));
	const make = (kind, names) => ({ componentId: kind
		, runtimeIdentity: "a".repeat(64), identity: sha256(kind)
		, libraries: Object.fromEntries(names.map(name => [name, hashes[name]]))
		, library: names.at(-1), loadOrder: names });
	const owned = { ...make("owned", libraries.slice(0, 5)), componentLibrary: libraries[3] };
	const copied = make("copied", [libraries[0], libraries[1], libraries[5]]);
	await saveLakeFile(directory, "loader.php", copiedPhpLoader);
	await saveLakeFile(directory, "owned-loader.php", ownedPhpLoader);
	await saveLakeFile(directory, "evidence.json", canonicalJson({ owned, copied }));
	await saveLakeFile(directory, "probe.php", `<?php
require __DIR__ . '/loader.php';
require __DIR__ . '/owned-loader.php';
use LeanBridge\\CopiedNativeV1\\Runtime;
use LeanBridge\\OwnedNativeV1\\Runtime as OwnedRuntime;
$data = json_decode(file_get_contents(__DIR__ . '/evidence.json'), true, 512, JSON_THROW_ON_ERROR);
$loaded = []; $checks = 0;
foreach ($argv[1] === 'owned-first' ? ['owned', 'copied'] : ['copied', 'owned'] as $kind) {
    $loader = $kind === 'owned' ? OwnedRuntime::class : Runtime::class;
    $loaded[$kind] = $loader::load(__DIR__, $data[$kind], 'int ' . $kind . '_read(void);');
}
if ($loaded['owned']->owned_read() !== 97 || $loaded['copied']->copied_read() !== 11)
    throw new RuntimeException('Private symbols interposed on the shared runtime');
$checks++;
for ($index = 0; $index < 5; $index++) {
    $bad = $data['owned'];
    if ($index === 0) unset($bad['libraries']['libgmp-lean-bridge.so.10']);
    elseif ($index === 1) $bad['componentLibrary'] = 'libleanshared.so';
    elseif ($index === 2) $bad['library'] = '../escape.so';
    elseif ($index === 3) $bad['libraries']['libgmp-lean-bridge.so.10'] = str_repeat('0', 64);
    else $bad['runtimeIdentity'] = str_repeat('b', 64);
    try { OwnedRuntime::load(__DIR__, $bad, 'int owned_read(void);'); throw new LogicException('invalid evidence accepted'); }
    catch (RuntimeException $error) { $checks++; }
}
if (OwnedRuntime::load(__DIR__, $data['owned'], 'int owned_read(void);') !== $loaded['owned']) throw new RuntimeException('component was loaded twice');
$checks++;
echo json_encode(['checks' => $checks, 'private' => $loaded['owned']->owned_read(), 'shared' => $loaded['copied']->copied_read()]);
`);
	for(const order of ["owned-first", "copied-first"])
	{
		const result = await runCopied(process.env.LEAN_BRIDGE_PHP ?? "/usr/bin/php", ["-d", "ffi.enable=1", "probe.php", order], directory);
		assert.equal(result.stderr, ""); assert.deepEqual(JSON.parse(result.stdout), { checks: 7, private: 97, shared: 11 });
	}
});
