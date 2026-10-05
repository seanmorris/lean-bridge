/**
 * Native PHP input transfers preserve validation and the real Lean handoff.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { generateOwnedPhpCalls } from "../src/backends/php/owned-calls.mjs";
import { ownedRustTransferConfiguration, ownedRustTransferReviewedIr, ownedRustTransferSource } from "./helpers/owned-rust-transfer-fixture.mjs";
import { ownedDotnetCallbacksReviewedIr } from "./helpers/owned-dotnet-callback-fixture.mjs";
import { compileOwnedPhpFixture } from "./helpers/owned-php-native.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";

test("PHP transfers require explicit capability and preserve borrowed APIs", () => {
	const ir = ownedRustTransferReviewedIr(), before = structuredClone(ir);
	assert.throws(() => generateOwnedPhpCalls(ir), /call-scoped input borrows/u);
	const generated = generateOwnedPhpCalls(ir, { transferredInputs: true });
	assert.deepEqual(ir, before);
	assert.equal(generated.functions.filter(fn => fn.transfers?.length).length, 20);
	assert.equal(generated.calls.filter(call => call.parameters.some(parameter => parameter.transfer)).length, 20);
	assert.match(generated.nativeSource, /_result \*\*a0_owner/u);
	assert.match(generated.files["src/Internal/OwnedRuntime.php"], /final class OwnedInputGroup/u);
	const borrowed = ownedDotnetCallbacksReviewedIr();
	const original = generateOwnedPhpCalls(borrowed), enabled = generateOwnedPhpCalls(borrowed, { transferredInputs: true });
	assert.deepEqual(enabled.files, original.files);
	assert.equal(enabled.nativeSource, original.nativeSource);
	assert.equal(enabled.definitions, original.definitions);
});

for(const mode of ["ordinary", "reviewed"]) test(`PHP aliases follow native Lean input transfers (${mode})`, {
	skip: process.env.LEAN_BRIDGE_OWNED_PHP_TRANSFER_TEST !== "1", timeout: 600000
}, async t => {
	const compiled = await compileOwnedPhpFixture(t, {
		...(mode === "ordinary" ? { configuration: await ownedRustTransferConfiguration() } : { reviewedIr: ownedRustTransferReviewedIr() })
		, sourceSuffix: ownedRustTransferSource, transferredInputs: true
		, evidenceName: `php-transfers-${mode}-inputs.json`
	});
	const source = await readFile("tests/fixtures/structured-types/owned-php-transfers.php", "utf8");
	let observed;
	try
	{ observed = await compiled.execute(source); }
	catch(error)
	{ throw new Error(`${error.message}: ${JSON.stringify(error.details ?? {})}`, { cause: error }); }
	assert.ok(observed.checks > 100); assert.ok(observed.heldErrors > 0);
	assert.equal(observed.live, 0); assert.equal(observed.identities, 0);
	assert.deepEqual(observed.functions, compiled.model.functions.map(fn => fn.name).sort());
	for(const shape of ["single", "multiple"])
		for(const domain of ["php", "native"])
			for(const phase of ["before", "after"])
				assert.ok(observed.faults[shape][domain][phase] > 0, `${shape}/${domain}/${phase}`);
	t.diagnostic(JSON.stringify(observed));
	await saveLakeFile("build/owned-php-transfers", `${mode}.json`, canonicalJson({ mode
		, compiledLean: true, installedPackage: false
		, observed
		, input: { metadata: compiled.metadata
			, sourceIdentity: compiled.sourceIdentity
			, component: compiled.model.c.native.model.component }
		, generated: Object.fromEntries(Object.entries(compiled.model.files).map(([path, text]) => [path, sha256(text)]))
		, nativeSourceSha256: sha256(compiled.implementation)
		, consumerSha256: sha256(source)
	}));
});
