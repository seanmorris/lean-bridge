/**
 * Callback lifetime execution and receipts cannot silently leave CI.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { assertOwnedRustCallbackResultCi, ownedRustCallbackResultReports } from "./helpers/owned-rust-callback-result-ci.mjs";
import { runCopied } from "./helpers/copied-fixture-install.mjs";

test("Rust callback compile checks require opt-in and fail when enabled without Cargo", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-rust-callback-gate-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const environment = { PATH: "/usr/bin:/bin"
		, LEAN_BRIDGE_CARGO: join(root, "missing-cargo")
		, LEAN_BRIDGE_RUSTC: join(root, "missing-rustc") };
	const args = ["--test", "tests/owned-rust-callback-results.test.mjs"];
	const disabled = await runCopied(process.execPath, args, process.cwd(), environment);
	assert.match(disabled.stdout, /^# pass 1$/mu);
	assert.match(disabled.stdout, /^# fail 0$/mu);
	assert.match(disabled.stdout, /^# skipped 1$/mu);
	await assert.rejects(runCopied(process.execPath, args, process.cwd(), {
		...environment, LEAN_BRIDGE_OWNED_RUST_CALLBACK_RESULT_TEST: "1"
	}), error => {
		assert.equal(error.code, "build-command-failed");
		assert.match(error.details.stdout, /^# fail 1$/mu);
		assert.match(error.details.stdout, /^# skipped 0$/mu);
		assert.ok(error.details.stdout.includes(environment.LEAN_BRIDGE_CARGO + " ENOENT"));
		return true;
	});
});

test("CI requires both Rust callback source paths, installed archives and every runtime report", async () => {
	const workflow = await readFile(".github/workflows/consumer-matrix.yml", "utf8");
	const manifest = JSON.parse(await readFile("package.json", "utf8"));
	assert.deepEqual(assertOwnedRustCallbackResultCi(workflow, manifest), {
		tests: 13, testFiles: 4, reports: 12, failurePropagated: true
	});
	const missingRust = workflow.replace(/( {2}owned-rust-callback-results:\n[\s\S]*?) {10}bash scripts\/bootstrap-rust-ci\.sh\n/u, "$1");
	assert.notEqual(missingRust, workflow);
	assert.throws(() => assertOwnedRustCallbackResultCi(missingRust, manifest));
	for(const line of [
		"          npm run test:owned-rust-callback-results 2>&1 | tee build/owned-rust-callback-results.log"
		, ...["tests 13", "pass 13", "fail 0", "cancelled 0", "skipped 0"].map(value => `          rg '^# ${value}$' build/owned-rust-callback-results.log`)
		, ...ownedRustCallbackResultReports.map(path => "          test -s " + path)
		, "            build/owned-rust-callback-results/"
		, "            build/owned-rust-callback-results.log"
		, "            build/owned-rust-callback-result-runtime.log"
		, "      - owned-rust-callback-results"
	]) {
		assert.equal(workflow.split(line + "\n").length, 2, line);
		assert.throws(() => assertOwnedRustCallbackResultCi(workflow.replace(line + "\n", ""), manifest), undefined, line);
	}
	for(const [before, after] of [
		["      - name: Verify Rust callback-result lifetimes\n", "      - name: Verify Rust callback-result lifetimes\n        if: false\n"]
		, ["  owned-rust-callback-results:\n", "  owned-rust-callback-results:\n    continue-on-error: true\n"]
		, ["        if: needs.owned-rust-callback-results.result != 'success'\n        run: exit 1\n", "        run: true\n"]
	]) {
		assert.equal(workflow.split(before).length, 2);
		assert.throws(() => assertOwnedRustCallbackResultCi(workflow.replace(before, after), manifest));
	}
	const disabled = structuredClone(manifest);
	disabled.scripts["test:owned-rust-callback-results"] = disabled.scripts["test:owned-rust-callback-results"].replace("_TEST=1", "_TEST=0");
	assert.throws(() => assertOwnedRustCallbackResultCi(workflow, disabled));
});
