/**
 * Execute original-owner PHP borrowed results against freshly compiled Lean.
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
import { ownedAggregateReviewedIr } from "./helpers/owned-aggregate-fixture.mjs";
import { ownedRustTransferReviewedIr } from "./helpers/owned-rust-transfer-fixture.mjs";
import { ownedRustBorrowReviewedIr, ownedRustBorrowConfiguration, ownedRustBorrowSource } from "./helpers/owned-rust-borrow-fixture.mjs";
import { compileOwnedPhpFixture } from "./helpers/owned-php-native.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";
import { runCopied } from "./helpers/copied-fixture-install.mjs";
import { rejectOwnedPhpBorrowMutants } from "./helpers/owned-php-borrow-mutants.mjs";
import { ownedBorrowConfiguration, ownedBorrowReviewedIr } from "./helpers/owned-borrow-fixture.mjs";

const options = { transferredInputs: true, anchoredResults: true };

test("PHP borrowed-result signatures preserve explicit anchors and unanchored APIs", () => {
	const ir = ownedRustBorrowReviewedIr(), before = structuredClone(ir);
	assert.throws(() => generateOwnedPhpCalls(ir, { transferredInputs: true }), /explicit output leases/u);
	const model = generateOwnedPhpCalls(ir, options);
	assert.deepEqual(ir, before);
	assert.equal(model.functions.filter(fn => fn.anchor !== undefined).length, 19);
	assert.equal(model.functions.filter(fn => fn.transfers?.length).length, 4);
	assert.match(model.files["src/Api.php"], /final class Value/u);
	assert.match(model.nativeSource, /_result \*a0_anchor/u);
	const bundle = model.functions.findIndex(fn => fn.name === "bundle");
	assert.equal(model.calls[bundle].anchor, 2);
	assert.equal(model.calls[bundle].parameters[2].anchor, true);
	for(const fixture of [ownedAggregateReviewedIr, ownedRustTransferReviewedIr])
	{
		const original = generateOwnedPhpCalls(fixture(), { transferredInputs: true });
		const enabled = generateOwnedPhpCalls(fixture(), options);
		assert.deepEqual(enabled.files, original.files);
		assert.equal(enabled.definitions, original.definitions);
		assert.equal(enabled.nativeSource, original.nativeSource);
	}
});

test("PHP borrowed-result sources parse and native callback signatures compile", {
	skip: process.env.LEAN_BRIDGE_OWNED_PHP_BORROW_TEST !== "1", timeout: 120000
}, async t => {
	const directory = await mkdtemp(join(tmpdir(), "lean-bridge-php-borrow-signatures-"));
	t.after(() => rm(directory, { recursive: true, force: true }));
	const model = generateOwnedPhpCalls(ownedRustBorrowReviewedIr(), options);
	for(const [path, source] of Object.entries(model.files))
	{
		await saveLakeFile(directory, path, source);
		await runCopied(process.env.LEAN_BRIDGE_PHP ?? "/usr/bin/php", ["-n", "-l", path], directory);
	}
	await saveLakeFile(directory, `${model.c.prefix}.h`, model.c.header);
	await saveLakeFile(directory, "borrow.c", model.nativeSource);
	await runCopied("/usr/bin/cc", ["-std=c11", "-Wall", "-Wextra", "-Werror", "-fsyntax-only", "-I", directory, "borrow.c"], directory);
});

for(const mode of ["ordinary", "reviewed"]) test(`PHP borrowed results follow the original whole owner (${mode})`, {
	skip: process.env.LEAN_BRIDGE_OWNED_PHP_BORROW_TEST !== "1", timeout: 600000
}, async t => {
	const compiled = await compileOwnedPhpFixture(t, {
		...(mode === "ordinary" ? { configuration: await ownedRustBorrowConfiguration() } : { reviewedIr: ownedRustBorrowReviewedIr() })
		, sourceSuffix: ownedRustBorrowSource
		, ...options
		, evidenceName: `php-borrows-${mode}-inputs.json`
	});
	const source = await readFile("tests/fixtures/structured-types/owned-php-borrows.php", "utf8");
	let observed;
	try
	{
		observed = await compiled.execute(source);
	}
	catch(error)
	{
		throw new Error(`${error.message}: ${JSON.stringify(error.details ?? {})}`, { cause: error });
	}
	assert.ok(observed.checks > 2300); assert.ok(observed.heldErrors > 300);
	assert.equal(observed.live, 0); assert.equal(observed.identities, 0);
	assert.deepEqual(observed.functions, compiled.model.functions.map(fn => fn.name).sort());
	for(const shape of ["borrow", "move", "mixed"])
		for(const domain of ["php", "native"])
		{
			assert.ok(observed.faults[shape][domain].before > 0, `${shape}/${domain}/before`);
			if(shape !== "borrow") assert.ok(observed.faults[shape][domain].after > 0, `${shape}/${domain}/after`);
		}
	t.diagnostic(JSON.stringify(observed));
	const mutants = await rejectOwnedPhpBorrowMutants(compiled, source);
	assert.equal(mutants.length, 5);
	await saveLakeFile("build/owned-php-borrows", `${mode}.json`, canonicalJson({ mode
		, actualLean: true, installedPackage: false, observed, mutants
		, input: {
			metadata: compiled.metadata
			, sourceIdentity: compiled.sourceIdentity
			, component: compiled.model.c.native.model.component }
		, generated: Object.fromEntries(Object.entries(compiled.model.files).map(([path, text]) => [path, sha256(text)]))
		, nativeSourceSha256: sha256(compiled.implementation)
		, publicHeaderSha256: sha256(compiled.model.c.header)
		, consumerSha256: sha256(source)
	}));
});

test("PHP borrow-only components need no consuming exports", {
	skip: process.env.LEAN_BRIDGE_OWNED_PHP_BORROW_TEST !== "1", timeout: 600000
}, async t => {
	const observations = [];
	for(const mode of ["ordinary", "reviewed"])
	{
		const compiled = await compileOwnedPhpFixture(t, {
			...(mode === "ordinary" ? { configuration: await ownedBorrowConfiguration() } : { reviewedIr: ownedBorrowReviewedIr() })
			, anchoredResults: true, evidenceName: `php-borrow-only-${mode}-inputs.json`
		});
		assert.ok(!compiled.model.functions.some(fn => fn.transfers?.length));
		const source = `<?php
declare(strict_types=1);
require __DIR__ . '/probe.php';
use LeanOwnedAggregates\\Internal\\Native;
use function LeanOwnedAggregates\\{copy_value, echo_array};
$root = copy_value([], resultOf: 'echo_array'); $alias = $root->share();
$view = echo_array($root); $child = echo_array($view); $kept = $child->retain();
$root->close(); check(!$view->closed(), 'shared empty root remains open');
$alias->close(); check($view->closed() && $child->closed(), 'empty descendants expire');
reject(fn() => $child->get(), 4); check($kept->get() === [], 'independent empty copy');
dispose([$root, $alias, $view, $child, $kept]); unset($root, $alias, $view, $child, $kept);
gc_collect_cycles(); Native::close();
check($ffi->owned_test_live() === 0); check($ffi->owned_test_identities() === 0);
echo json_encode(['checks' => $checks, 'live' => $ffi->owned_test_live(), 'identities' => $ffi->owned_test_identities()]);
`;
		const observed = await compiled.execute(source);
		assert.equal(observed.live, 0); assert.equal(observed.identities, 0); assert.ok(observed.checks >= 7);
		observations.push({ mode, observed, consumerSha256: sha256(source)
			, metadata: compiled.metadata, sourceIdentity: compiled.sourceIdentity
			, component: compiled.model.c.native.model.component
			, nativeSourceSha256: sha256(compiled.implementation)
			, publicHeaderSha256: sha256(compiled.model.c.header)
			, generated: Object.fromEntries(Object.entries(compiled.model.files).map(([path, text]) => [path, sha256(text)])) });
	}
	await saveLakeFile("build/owned-php-borrows", "borrow-only.json", canonicalJson({ actualLean: true, observations }));
});
