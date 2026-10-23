/**
 * Keep the callback-refinement PHP-Wasm archiver bound to its exact source
 * roles and shared hosted-artifact byte contract.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import test from "node:test";
import {
	callbackRefinementsPhpWasmEvidenceSources
	, callbackRefinementsPhpWasmHostedOriginal
} from "./callback-refinements-php-wasm-hosted-evidence-sources.mjs";

const revision = execFileSync("git", ["rev-parse", "HEAD"], {
	encoding: "utf8"
}).trim();

test("callback-refinement PHP-Wasm evidence closes every source role", {
	timeout: 120_000
}, () => {
	const sources = callbackRefinementsPhpWasmEvidenceSources({
		producer: revision, consumer: revision, checker: revision
		, archiver: revision
	});
	assert.deepEqual([...new Set(sources.map(item => item.role))].sort()
		, ["archiver", "checker", "consumer", "producer"]);
	assert.equal(new Set(sources.map(item =>
		`${item.role}/${item.path}`)).size, sources.length);
	for(const source of sources)
	{
		assert.equal(source.revision, revision);
		assert.ok(callbackRefinementsPhpWasmHostedOriginal(
			source.revision, source.path).length > 0, source.path);
	}
	for(const [role, path] of [
		["producer", "tests/fixtures/onboarding/reviewed-callback-fin/ReviewedCallbacks.lean"]
		, ["producer", "tests/fixtures/onboarding/callback-checked-records/CallbackCheckedRecords.lean"]
		, ["producer", "src/backends/c/gmp.source.tar.xz"]
		, ["producer", "src/backends/php/brick-math.source.json"]
		, ["producer", "src/build/ResolveLakeWorkspace.lean"]
		, ["consumer", "tests/helpers/callback-fin-php-wasm-fixture.mjs"]
		, ["consumer", "tests/helpers/callback-checked-record-php-wasm-fixture.mjs"]
		, ["checker", ".github/actions/bounded-apt/action.yml"]
		, ["checker", ".github/workflows/callback-refinements-php-wasm.yml"]
		, ["checker", "scripts/check-callback-refinements-php-wasm-reports.mjs"]
		, ["checker", "scripts/bootstrap-php-wasm-ci.sh"]
		, ["checker", "scripts/build-lean-runtime.sh"]
		, ["archiver", "scripts/archive-callback-refinements-php-wasm-evidence.mjs"]
		, ["archiver", "tests/helpers/dependent-checked-record-hosted-archive.mjs"]
	]) assert.ok(sources.some(item => item.role === role
		&& item.path === path), `${role}/${path}`);
});

test("callback-refinement PHP-Wasm source selection rejects open revisions", () => {
	assert.throws(() => callbackRefinementsPhpWasmEvidenceSources({
		producer: revision, consumer: revision, checker: "HEAD"
		, archiver: revision
	}), assert.AssertionError);
});
