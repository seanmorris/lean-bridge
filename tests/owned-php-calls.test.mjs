/**
 * Generated public PHP calls, all scalar callback ABIs and scoped ownership.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { generateOwnedPhpCalls } from "../src/backends/php/owned-calls.mjs";
import { ownedDotnetCallbacksReviewedIr } from "./helpers/owned-dotnet-callback-fixture.mjs";
import { compileOwnedPhpFixture } from "./helpers/owned-php-native.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";
import { runCopied } from "./helpers/copied-fixture-install.mjs";

test("owned PHP call generation preserves all scalar and directional callback signatures", () => {
	const ir = ownedDotnetCallbacksReviewedIr(), before = structuredClone(ir), model = generateOwnedPhpCalls(ir);
	assert.deepEqual(ir, before); assert.deepEqual(model.files, generateOwnedPhpCalls(ir).files);
	assert.equal(Object.keys(model.callbacks).length, 27);
	assert.equal(model.types.filter(node => node.kind === "primitive").length, 19);
	assert.equal(Object.values(model.callbacks).filter(cb => cb.requiresRecovery).length, 2);
	for(const fn of model.functions) assert.match(model.files["src/Api.php"], new RegExp(`function ${fn.publicName}\\(`, "u"));
	assert.match(model.nativeSource, /_copy\(session, /u);
	assert.match(model.nativeSource, /host->native_status = status/u);
	assert.match(model.files["src/Internal/OwnedCalls.php"], /catch \(\\Throwable/u);
	assert.match(model.files["src/Internal/OwnedCalls.php"], /lean_bridge_native_runtime_retire/u);
});

test("owned PHP public calls reject private helper collisions before native compilation", () => {
	const reference = generateOwnedPhpCalls(ownedDotnetCallbacksReviewedIr());
	const wrapper = reference.calls.find(call => call.parameters.some(parameter => parameter.host));
	const callback = Object.values(reference.callbacks)[0];
	const names = ["with_recovery", "php_integer_new"
		, "php_integer_free", "php_integer_text"
		, wrapper.symbol.slice(reference.c.prefix.length + 1)
		, callback.ctype.slice(reference.c.prefix.length + 1)
		, callback.invoke.slice(reference.c.prefix.length + 1)];
	for(const name of names)
	{
		const ir = ownedDotnetCallbacksReviewedIr(); ir.declarations[0].name = name;
		assert.throws(() => generateOwnedPhpCalls(ir), /collides/u);
	}
});

test("public PHP functions reject invalid cold calls with FFI disabled", {
	skip: process.env.LEAN_BRIDGE_OWNED_NATIVE_TEST !== "1"
}, async t => {
	const directory = await mkdtemp(join(tmpdir(), "lean-bridge-owned-php-cold-"));
	t.after(() => rm(directory, { recursive: true, force: true }));
	const model = generateOwnedPhpCalls(ownedDotnetCallbacksReviewedIr());
	for(const [path, source] of Object.entries(model.files)) await saveLakeFile(directory, path, source);
	const result = await runCopied(process.env.LEAN_BRIDGE_PHP ?? "/usr/bin/php", [
		"-d", "ffi.enable=0", "-r"
		, `require 'src/Api.php'; $loads = 0;
LeanOwnedAggregates\\Internal\\Native::configure(static function() use (&$loads) { $loads++; throw new RuntimeException('loader'); });
$checks = 0;
foreach ([fn() => LeanOwnedAggregates\\new_ticket(1, 'bad'), fn() => LeanOwnedAggregates\\via_bool(fn($a) => $a, 1),
    fn() => LeanOwnedAggregates\\via_bool(static function(&$a) { return $a; }, true),
    fn() => LeanOwnedAggregates\\via_bool(static function($a) { yield $a; }, true),
    fn() => LeanOwnedAggregates\\via_bool(fn() => true, true),
    fn() => LeanOwnedAggregates\\factory(fn($unit) => null)] as $call) {
    try { $call(); throw new RuntimeException('missing rejection'); }
    catch (TypeError|ArgumentCountError $error) { $checks++; }
}
if ($loads !== 0 || $checks !== 6) throw new RuntimeException('cold validation failed');
echo 'cold';`], directory);
	assert.equal(result.stdout, "cold"); assert.equal(result.stderr, "");
});

for(const reviewed of [false, true]) test(`owned public PHP callbacks execute fresh Lean (${reviewed ? "reviewed" : "ordinary"})`, {
	skip: process.env.LEAN_BRIDGE_OWNED_NATIVE_TEST !== "1", timeout: 600000
}, async t => {
	const compiled = await compileOwnedPhpFixture(t, { fixture: "owned-dotnet-callables"
		, ...reviewed ? { reviewedIr: ownedDotnetCallbacksReviewedIr() } : {} });
	const source = await readFile("tests/fixtures/structured-types/owned-php-calls.php", "utf8");
	const observation = await compiled.execute(source);
	assert.equal(observation.primitives, 19); assert.equal(observation.scalarCalls, 19);
	assert.ok(observation.reentries > 1 && observation.reentries <= 64);
	assert.ok(observation.checks > 100); assert.ok(observation.phpFailures > 0); assert.ok(observation.nativeFailures > 0);
	assert.equal(observation.live, 0); assert.equal(observation.identities, 0);
	t.diagnostic(JSON.stringify(observation));
	const weakSource = source.replace("strict_types=1", "strict_types=0");
	const weak = await compiled.execute(weakSource);
	assert.deepEqual(weak, observation);
	const retirementSource = await readFile("tests/fixtures/structured-types/owned-php-calls-retirement.php", "utf8");
	const retirement = await compiled.execute(retirementSource);
	assert.ok(retirement.checks >= 8); assert.equal(retirement.live, 0); assert.equal(retirement.identities, 0);
	await saveLakeFile("build/owned-php-calls", `${reviewed ? "reviewed" : "ordinary"}.json`, canonicalJson({
		observation, weak, retirement, compiledLean: true
		, installedPackage: false, phpCallbacks: true
		, sourceIdentitySha256: compiled.sourceIdentitySha256
		, generated: Object.fromEntries(Object.entries(compiled.model.files).map(([path, source]) => [path, sha256(source)]))
		, nativeSha256: sha256(compiled.model.nativeSource)
		, probeSha256: sha256(source), helpersSha256: sha256(compiled.helpers)
		, weakProbeSha256: sha256(weakSource)
		, retirementSha256: sha256(retirementSource)
	}));
});
