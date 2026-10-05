/**
 * Python receiver CI must run eleven tests and retain all nine reports.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { assertOwnedPythonReceiverCi, ownedPythonReceiverReports } from "./helpers/owned-python-receiver-ci.mjs";

test("Python receiver CI retains complete runtime, wheel and typing acceptance", async () => {
	const workflow = await readFile(".github/workflows/consumer-matrix.yml", "utf8");
	const manifest = JSON.parse(await readFile("package.json", "utf8"));
	assertOwnedPythonReceiverCi(workflow, manifest);
	for(const line of [
		"          npm run test:owned-python-receivers > build/owned-python-receivers.log 2>&1"
		, "          cat build/owned-python-receivers.log"
		, ...["tests 11", "pass 11", "fail 0", "cancelled 0", "skipped 0"].map(value => `          rg '^# ${value}$' build/owned-python-receivers.log`)
		, ...ownedPythonReceiverReports.map(path => "          test -s " + path)
		, "            build/owned-python-receivers/"
		, "            build/owned-python-receivers.log"
		, '              consumer_command="$consumer_command && npm run test:owned-python-receivers"'
	]) {
		assert.ok(workflow.includes(line + "\n"));
		assert.throws(() => assertOwnedPythonReceiverCi(workflow.replace(line + "\n", ""), manifest));
	}
	assert.throws(() => assertOwnedPythonReceiverCi(workflow, { ...manifest, scripts: {
		...manifest.scripts, "test:owned-python-receivers": manifest.scripts["test:owned-python-receivers"].replace("=1", "=0") } }));
});
