/**
 * Keep the local installed C, C++ and Python Array generic-record run bound to its exact records and to consumers
 * rebuilt from its own producer sources (VO #1439).
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../src/capsule/node.mjs";
import { arrayEvidenceDirectory, arrayEvidencePaths, arrayEvidenceSnapshot, arraySelections, assertArrayEvidenceArchive, assertArraySelection, composeArrayEvidenceConsumer } from "./helpers/generic-record-array-evidence.mjs";

const receiptSha256 = "a85b99bb05b235f603a22a44528f4d4d17518d6b91d7428000a574ee20074cc6";
const receipt = async () => {
	const bytes = await readFile(`${arrayEvidenceDirectory}/receipt.json`);
	assert.equal(sha256(bytes), receiptSha256);
	return JSON.parse(bytes);
};
const text = path => readFile(`${arrayEvidenceDirectory}/${path}`, "utf8");
const snapshots = async () => {
	const files = new Map();
	for(const path of arrayEvidencePaths.filter(item => item.includes("/sources/"))) files.set(path, await readFile(path, "utf8"));
	return path => files.get(arrayEvidenceSnapshot(path));
};
const consumers = async () => {
	const read = await snapshots();
	return Object.fromEntries(["c", "cpp", "python"].map(profile => [profile, composeArrayEvidenceConsumer(profile, read)]));
};
const records = async selection => ({ queue: JSON.parse(await text("queue.json"))
	, start: JSON.parse(await text(`${selection.name}/start.json`))
	, end: JSON.parse(await text(`${selection.name}/end.json`))
	, tap: await text(`${selection.name}/run.tap`)
	, report: JSON.parse(await text(selection.report)) });

test("the Array archive binds three passing selections to exact originals and rebuilt consumers", async () => {
	const value = await receipt();
	const { checks } = await assertArrayEvidenceArchive(value);
	assert.deepEqual(checks, [["c", 2078], ["cpp", 2058], ["python", 2144], ["python", 2144]]);
	assert.deepEqual(value.artifacts.map(file => file.path), arrayEvidencePaths);
	assert.deepEqual([value.scope.local, value.scope.hostedCi, value.scope.otherNativeHosts, value.scope.supportPromotion, value.scope.localGlibc], [true, false, false, false, "2.36"]);
	assert.deepEqual(value.selections, ["c-cpp", "python311", "python312"]);
});

test("archive bytes refuse a changed, swapped or missing member", async () => {
	const value = await receipt(), bytesOnly = { currentSources: false };
	const report = `${arrayEvidenceDirectory}/array-python.json`, fragment = arrayEvidenceSnapshot("tests/fixtures/generic-record-array-consumers/c.c");
	const swap = (path, change) => async name => name === path ? change(await readFile(name)) : readFile(name);
	for(const read of [
		swap(report, bytes => Buffer.concat([bytes, Buffer.from(" ")]))
		, swap(report, () => readFile(`${arrayEvidenceDirectory}/array-python312.json`))
		, swap(fragment, bytes => Buffer.from(bytes.toString("utf8").replace("checks += 1000;", "checks += 999;")))])
		await assert.rejects(assertArrayEvidenceArchive(value, read, bytesOnly));
	for(const changed of [{ ...value, artifacts: value.artifacts.slice(1) }, { ...value, artifacts: [...value.artifacts, value.artifacts[0]] }, { ...value, scope: { ...value.scope, hostedCi: true } }, { ...value, revision: "0".repeat(40) }])
		await assert.rejects(assertArrayEvidenceArchive(changed, readFile, bytesOnly));
});

test("each selection refuses changed counts, consumers, interpreters, origins, roots and outcomes", async () => {
	const composed = await consumers();
	const python = item => item.report.reports[0], c = item => item.report.reports[0], cpp = item => item.report.reports[1];
	const cases = {
		"c-cpp": [
			value => { c(value).checks = 2077; }
			, value => { cpp(value).expectedChecks = 2057; }
			, value => { c(value).consumerSha256 = cpp(value).consumerSha256; }
			, value => { c(value).instantiations["lean:GenericRecords.RowBox"].arguments[0].arguments[0].id = "lean:GenericRecords.NatBoxAgain"; }
			, value => { c(value).instantiations["lean:GenericRecords.ArrayBox"].arguments[0].constructor = "list"; }
			, value => { cpp(value).arrayExports.pop(); }
			, value => { cpp(value).sourceRemovedBeforeInstallation = false; }
			, value => { value.report.authorRoots = 1; }
			, value => { value.report.reports.reverse(); }
			, value => { value.report.archives[c(value).packages[0].artifacts[0].path] = "0".repeat(64); }
			, value => { c(value).python = { command: "/usr/bin/python3", version: "3.11.2" }; }
			, value => { value.end.code = 1; }
			, value => { value.end.minimumFreeMiB = 100; }
			, value => { value.tap = value.tap.replace("# skipped 0", "# skipped 1"); }
			, value => { value.start.pgid += 1; }]
		, python311: [
			value => { python(value).python.version = "3.12.14"; }
			, value => { python(value).python.command = "/app/.toolchains/python312/bin/python3"; }
			, value => { python(value).checks = 2143; }
			, value => { value.queue.selections[1].environment.LEAN_BRIDGE_PYTHON = "/usr/bin/python3"; }
			, value => { value.queue.selections[1].environment.LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR = "2.38"; }]
	};
	for(const selection of arraySelections)
	{
		const original = await records(selection);
		assertArraySelection(selection, original, composed);
		for(const [index, mutate] of (cases[selection.name] ?? []).entries())
		{
			const value = structuredClone(original); mutate(value);
			assert.throws(() => assertArraySelection(selection, value, composed), assert.AssertionError, `${selection.name} mutation ${index}`);
		}
	}
	// A consumer rebuilt from changed fragment text is not the one that ran.
	const changed = { ...composed, python: composed.python.replace("for round_index in range(1000):", "for round_index in range(999):") };
	const python311 = await records(arraySelections[1]);
	assert.throws(() => assertArraySelection(arraySelections[1], python311, changed), assert.AssertionError);
});
