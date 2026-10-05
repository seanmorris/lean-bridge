/**
 * C++ receiver CI cannot silently become an unexecuted or partial gate.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { assertOwnedCppReceiverCi, ownedCppReceiverReports } from "./helpers/owned-cpp-receiver-ci.mjs";

test("C++ receiver CI requires both source paths, installed archives and all capability cases", async () => {
	const workflow = await readFile(".github/workflows/consumer-matrix.yml", "utf8");
	const manifest = JSON.parse(await readFile("package.json", "utf8"));
	assertOwnedCppReceiverCi(workflow, manifest);
	for(const line of [
		"          npm run test:owned-cpp-receivers > build/owned-cpp-receivers.log 2>&1"
		, "          rg '^# tests 10$' build/owned-cpp-receivers.log"
		, "          rg '^# pass 10$' build/owned-cpp-receivers.log"
		, "          rg '^# fail 0$' build/owned-cpp-receivers.log"
		, "          rg '^# cancelled 0$' build/owned-cpp-receivers.log"
		, "          rg '^# skipped 0$' build/owned-cpp-receivers.log"
		, ...ownedCppReceiverReports.map(path => "          test -s " + path)
		, "            build/owned-cpp-receivers/"
		, "            build/owned-cpp-receivers.log"
	]) {
		assert.ok(workflow.includes(line + "\n"));
		assert.throws(() => assertOwnedCppReceiverCi(workflow.replace(line + "\n", ""), manifest));
	}
	assert.throws(() => assertOwnedCppReceiverCi(workflow, { ...manifest, scripts: {
		...manifest.scripts, "test:owned-cpp-receivers": manifest.scripts["test:owned-cpp-receivers"].replace("=1", "=0") } }));
});
