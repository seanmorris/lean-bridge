/**
 * Keep the local installed C, C++ and Python Fin container edge run bound to its exact records and to consumers
 * and a Lean fixture rebuilt from its own producer sources (VO #1454).
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../src/capsule/node.mjs";
import { assertEdgeEvidenceArchive, assertEdgeSelection, composeEdgeEvidenceConsumer, composeEdgeEvidenceFixture, edgeEvidenceDirectory, edgeEvidencePaths, edgeEvidenceSnapshot, edgeSelections } from "./helpers/fin-container-edge-evidence.mjs";

const receiptSha256 = "34f274bb5c1be947e61b26b3f9839cdffd73304be84b157ffddc8929f45df39c";
const receipt = async () => {
	const bytes = await readFile(`${edgeEvidenceDirectory}/receipt.json`);
	assert.equal(sha256(bytes), receiptSha256);
	return JSON.parse(bytes);
};
const text = path => readFile(`${edgeEvidenceDirectory}/${path}`, "utf8");
const rebuilt = async () => {
	const files = new Map();
	for(const path of edgeEvidencePaths.filter(item => item.includes("/sources/"))) files.set(path, await readFile(path, "utf8"));
	const source = path => files.get(edgeEvidenceSnapshot(path));
	return { consumers: Object.fromEntries(["c", "cpp", "python"].map(profile => [profile, composeEdgeEvidenceConsumer(profile, source)])), fixture: composeEdgeEvidenceFixture(source) };
};
const records = async selection => ({ queue: JSON.parse(await text("queue.json"))
	, start: JSON.parse(await text(`${selection.name}/start.json`))
	, end: JSON.parse(await text(`${selection.name}/end.json`))
	, tap: await text(`${selection.name}/run.tap`)
	, report: JSON.parse(await text(selection.report)) });

test("the Fin edge archive binds three passing selections to exact originals, consumers and fixture", async () => {
	const value = await receipt();
	const { checks } = await assertEdgeEvidenceArchive(value);
	assert.deepEqual(checks, [["c", 14114], ["cpp", 14099], ["python", 14095], ["python", 14095]]);
	assert.deepEqual(value.artifacts.map(file => file.path), edgeEvidencePaths);
	const scope = value.scope;
	assert.deepEqual([scope.local, scope.hostedCi, scope.otherNativeHosts, scope.dispatchObserved, scope.supportPromotion, scope.localGlibc], [true, false, false, false, false, "2.36"]);
});

test("archive bytes refuse a changed, swapped or missing member", async () => {
	const value = await receipt(), bytesOnly = { currentSources: false };
	const report = `${edgeEvidenceDirectory}/edges-python311.json`, fragment = edgeEvidenceSnapshot("tests/fixtures/fin-container-edge-consumers/c.c");
	const swap = (path, change) => async name => name === path ? change(await readFile(name)) : readFile(name);
	for(const read of [
		swap(report, bytes => Buffer.concat([bytes, Buffer.from(" ")]))
		, swap(report, () => readFile(`${edgeEvidenceDirectory}/edges-python312.json`))
		, swap(fragment, bytes => Buffer.from(bytes.toString("utf8").replace("12072", "12071")))])
		await assert.rejects(assertEdgeEvidenceArchive(value, read, bytesOnly));
	const changes = [{ ...value, artifacts: value.artifacts.slice(1) }, { ...value, artifacts: [...value.artifacts, value.artifacts[0]] }, { ...value, scope: { ...value.scope, dispatchObserved: true } }, { ...value, revision: "0".repeat(40) }];
	for(const changed of changes) await assert.rejects(assertEdgeEvidenceArchive(changed, readFile, bytesOnly));
});

test("each selection refuses changed counts, consumers, fixtures, refinements, relocation and outcomes", async () => {
	const composed = await rebuilt();
	const c = item => item.report.reports[0], cpp = item => item.report.reports[1], python = item => item.report.reports[0];
	const cases = {
		"c-cpp": [
			value => { c(value).checks = 14113; }
			, value => { c(value).consumerSha256 = cpp(value).consumerSha256; }
			, value => { cpp(value).fixtureSha256 = "0".repeat(64); }
			, value => { c(value).relocatedInstallation = false; }
			, value => { cpp(value).installedFilesUnchanged = false; }
			, value => { c(value).runtimeSearchPath = "/tmp/fincontainers-1.0.0-c/lib"; }
			, value => { c(value).refinements["FinContainers.emptyArray"].parameters[0].arguments[0].bound = "1"; }
			, value => { cpp(value).refinements["FinContainers.optionalDigits"].result.arguments[0].kind = "array"; }
			, value => { c(value).dispatch.observed = true; }
			, value => { value.report.authorRoots = 1; }
			, value => { value.report.archives[c(value).packages[0].artifacts[0].path] = "0".repeat(64); }
			, value => { value.end.code = 1; }
			, value => { value.tap = value.tap.replace("# skipped 0", "# skipped 1"); }]
		, python311: [
			value => { python(value).python = "3.12.14"; }
			, value => { python(value).runtimeSearchPath = "$ORIGIN/lib"; }
			, value => { python(value).checks = 14094; }
			, value => { value.queue.selections[1].environment.LEAN_BRIDGE_PYTHON = "/usr/bin/python3"; }
			, value => { value.queue.selections[1].environment.LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR = "2.38"; }]
	};
	for(const selection of edgeSelections)
	{
		const original = await records(selection);
		assertEdgeSelection(selection, original, composed);
		for(const [index, mutate] of (cases[selection.name] ?? []).entries())
		{
			const value = structuredClone(original); mutate(value);
			assert.throws(() => assertEdgeSelection(selection, value, composed), assert.AssertionError, `${selection.name} mutation ${index}`);
		}
	}
	const python311 = await records(edgeSelections[1]);
	assert.throws(() => assertEdgeSelection(edgeSelections[1], python311, { ...composed, fixture: `${composed.fixture}\n` }), assert.AssertionError);
	assert.throws(() => assertEdgeSelection(edgeSelections[1], python311, { ...composed, consumers: { ...composed.consumers, python: `${composed.consumers.python}\n` } }), assert.AssertionError);
});
