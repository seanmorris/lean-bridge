/**
 * Ruby receiver CI must run ten tests and retain all eight reports.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { assertOwnedRubyReceiverCi, ownedRubyReceiverReports } from "./helpers/owned-ruby-receiver-ci.mjs";

test("Ruby receiver CI retains complete runtime and installed-gem acceptance", async () => {
	const workflow = await readFile(".github/workflows/consumer-matrix.yml", "utf8");
	const manifest = JSON.parse(await readFile("package.json", "utf8"));
	assertOwnedRubyReceiverCi(workflow, manifest);
	for(const line of [
		"          npm run test:owned-ruby-receivers > build/owned-ruby-receivers.log 2>&1"
		, "          cat build/owned-ruby-receivers.log"
		, ...["tests 10", "pass 10", "fail 0", "cancelled 0", "skipped 0"].map(value => `          rg '^# ${value}$' build/owned-ruby-receivers.log`)
		, ...ownedRubyReceiverReports.map(path => "          test -s " + path)
		, "            build/owned-ruby-receivers/"
		, "            build/owned-ruby-receivers.log"
		, '              consumer_command="$consumer_command && npm run test:owned-ruby-receivers"'
	]) {
		assert.ok(workflow.includes(line + "\n"));
		assert.throws(() => assertOwnedRubyReceiverCi(workflow.replace(line + "\n", ""), manifest));
	}
	assert.throws(() => assertOwnedRubyReceiverCi(workflow, { ...manifest, scripts: {
		...manifest.scripts, "test:owned-ruby-receivers": manifest.scripts["test:owned-ruby-receivers"].replace("=1", "=0") } }));
});
