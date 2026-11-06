/**
 * Retain the first installed C/C++ Fin diagnostic observation.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../../src/capsule/node.mjs";
import {
	finRecordDispatchColumns, finRecordDispatchExpected
} from "./fin-record-dispatch.mjs";

test("the first installed Fin diagnostic report retains exact original bytes and only its measured C/C++ scope", async () => {
	const directory = "docs/evidence/native-fin-diagnostics-20261010";
	const reportBytes = await readFile(`${directory}/ordinary-c-cpp.json`);
	const tap = await readFile(`${directory}/ordinary-c-cpp.tap`, "utf8");
	assert.equal(sha256(reportBytes), "31b27a9cc5b78f4bfd979ede83ce9bf0d70e9e2ebd0dcb00a0b2cf46859d6387");
	assert.equal(sha256(tap), "e824c012d8a90820c942e690186e845642f7aa261873090cd9d2e26902095738");
	assert.match(tap, /# tests 1\n# suites 0\n# pass 1\n# fail 0\n# cancelled 0\n# skipped 0\n/u);
	const report = JSON.parse(reportBytes);
	assert.equal(report.reproducible, true);
	assert.deepEqual(report.reports.map(item => [item.profile, item.checks]), [["c", 2064], ["cpp", 2053]]);
	for(const entry of report.reports)
	{
		assert.equal(entry.path, "ordinary-source");
		for(const fact of ["sourceRemovedBeforeInstallation", "offlineInstall", "compilerFreePath"]) assert.equal(entry[fact], true, fact);
		assert.equal(entry.packages.length, 1);
		assert.equal(entry.packages[0].target, entry.profile);
		for(const archive of entry.packages[0].artifacts) assert.equal(report.archives[archive.path], archive.sha256);
	}
	assert.deepEqual(report.reports[0].dispatch.columns, finRecordDispatchColumns);
	assert.deepEqual(report.reports[0].dispatch.observed, finRecordDispatchExpected);
	assert.equal(Object.hasOwn(report.reports[1], "dispatch"), false);
});
