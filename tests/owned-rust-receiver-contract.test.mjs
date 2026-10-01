/**
 * Rust receiver CI must execute the full gate and retain all eight reports.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { assertOwnedRustReceiverCi, ownedRustReceiverReports } from "./helpers/owned-rust-receiver-ci.mjs";

test("Rust receiver CI requires all runtime, package and capability cases", async () => {
	const workflow = await readFile(".github/workflows/consumer-matrix.yml", "utf8");
	const manifest = JSON.parse(await readFile("package.json", "utf8"));
	assertOwnedRustReceiverCi(workflow, manifest);
	for(const line of [
		"          npm run test:owned-rust-receivers > build/owned-rust-receivers.log 2>&1"
		, ...["tests 10", "pass 10", "fail 0", "cancelled 0", "skipped 0"].map(value => `          rg '^# ${value}$' build/owned-rust-receivers.log`)
		, ...ownedRustReceiverReports.map(path => "          test -s " + path)
		, "            build/owned-rust-receivers/"
		, "            build/owned-rust-receivers.log"
		, '              consumer_command="$consumer_command && npm run test:owned-rust-receivers"'
	]) {
		assert.ok(workflow.includes(line + "\n"));
		assert.throws(() => assertOwnedRustReceiverCi(workflow.replace(line + "\n", ""), manifest));
	}
	assert.throws(() => assertOwnedRustReceiverCi(workflow, { ...manifest, scripts: {
		...manifest.scripts, "test:owned-rust-receivers": manifest.scripts["test:owned-rust-receivers"].replace("=1", "=0") } }));
});
