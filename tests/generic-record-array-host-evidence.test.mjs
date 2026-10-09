/**
 * Authenticate the remaining native Array reports without turning failures or local floors into acceptance.
 *
 * @file
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { sha256 } from "../src/capsule/node.mjs";
import { arrayHostAttempts, arrayHostDirectory, assertArrayHostArchive, assertArrayHostReport, collectArrayHostEvidence, composeArrayHostConsumer } from "./helpers/generic-record-array-host-evidence.mjs";
import { writeArrayEvidenceArtifact } from "./helpers/generic-record-array-evidence.mjs";

const receiptHash = "5b11315bfe2ddcd2c05f35bbd020c7d8e502ec1aac348801526bf502b8ed6c67";
const load = async () => {
	const bytes = await readFile(`${arrayHostDirectory}/receipt.json`); assert.equal(sha256(bytes), receiptHash);
	return JSON.parse(bytes);
};

test("Array host evidence preserves ten passes, one failure, three unstarted selections and both abandoned runners", async () => {
	const receipt = await load();
	assert.deepEqual(await assertArrayHostArchive(receipt), receipt);
	assert.equal(receipt.artifacts.length, 120);
	assert.equal(receipt.artifacts.filter(item => item.path.includes("/sources/")).length, 69);
	assert.equal(receipt.artifacts.filter(item => item.path.includes("/unlaunched/")).length, 2);
	assert.deepEqual(["passed", "failed", "not-run"].map(outcome => receipt.attempts.filter(item => item.outcome === outcome).length), [10, 1, 3]);
	assert.deepEqual(receipt.attempts.flatMap(item => item.checks ?? []), [["rust", 2034], ["ruby", 2141], ["dotnet", 2088], ["java", 2105], ["kotlin", 2067], ["php-native", 2124], ["wit-wasi", 2091], ...Array.from({ length: 4 }, () => ["perl", 2145])]);
	assert.deepEqual([receipt.scope.local, receipt.scope.hostedCi, receipt.scope.supportPromotion, receipt.scope.localGlibc], [true, false, false, "2.36"]);
	assert.match(receipt.scope.retained, /package archives are identified by report-carried digests only/u);
});

test("Array host archive rejects changed originals, source snapshots and misleading receipt claims", async () => {
	const receipt = await load();
	for(const suffix of ["queue.json", "runner-output.txt", "runner.mjs.txt", "rust/start.json", "rust/end.json", "rust/run.tap", "array-rust.json", "perl-5.36.3-threaded/run.tap", "sources/tests/helpers/generic-record-arrays.mjs.txt"])
	{
		const target = `${arrayHostDirectory}/hosts-c92090f/${suffix}`;
		await assert.rejects(assertArrayHostArchive(receipt, async path => {
			const bytes = await readFile(path);
			return path === target ? Buffer.concat([bytes, Buffer.from("changed")]) : bytes;
		}));
	}
	for(const mutate of [
		value => { value.artifacts.pop(); }
		, value => { value.artifacts.push(value.artifacts[0]); }
		, value => { value.scope.hostedCi = true; }
		, value => { value.scope.localGlibc = "2.35"; }
		, value => { value.attempts.find(item => item.outcome === "failed").outcome = "passed"; }
		, value => { value.attempts.find(item => item.outcome === "not-run").outcome = "passed"; }
		, value => { value.attempts[0].checks[0][1]--; }
	]) {
		const changed = structuredClone(receipt); mutate(changed);
		await assert.rejects(assertArrayHostArchive(changed), assert.AssertionError);
	}
	const target = receipt.artifacts.find(item => item.path.includes("/unlaunched/")).path;
	await assert.rejects(collectArrayHostEvidence(async path => path === target ? Buffer.from("invented success") : readFile(path)), assert.AssertionError);
});

test("Array host semantics require the full source-free consumer, exact instantiations and nine specializations", async () => {
	for(const attempt of arrayHostAttempts)
	{
		const root = `${arrayHostDirectory}/${attempt.id}`, queue = JSON.parse(await readFile(`${root}/queue.json`));
		const sources = Object.fromEntries(await Promise.all(Object.keys(queue.sources).map(async path => [path, await readFile(`${root}/sources/${path}.txt`, "utf8")])));
		const text = path => sources[path];
		for(const selection of queue.selections.filter(item => attempt.passed.includes(item.name)))
		{
			const original = JSON.parse(await readFile(`${root}/${selection.report}`));
			assertArrayHostReport(original, selection, queue, text);
			for(const mutate of [
				value => { value.authorRoots = 1; }
				, value => { value.reproducible = false; }
				, value => { value.reports[0].checks--; }
				, value => { value.reports[0].expectedChecks--; }
				, value => { value.reports[0].baseConsumer.sha256 = "0".repeat(64); }
				, value => { value.reports[0].consumerSha256 = "0".repeat(64); }
				, value => { value.reports[0].instantiations["lean:GenericRecords.RowBox"].arguments[0].constructor = "list"; }
				, value => { value.reports[0].specializations.pop(); }
				, value => { value.reports[0].specializations[0].types = ["GenericRecords.NatBoxAgain"]; }
				, value => { value.reports[0].cases.pop(); }
				, value => { value.reports[0].cases[0] = "invented case"; }
				, value => { value.reports[0].arrayExports.pop(); }
				, value => { value.reports[0].sourceRemovedBeforeInstallation = false; }
				, value => { value.reports[0].offlineInstall = false; }
				, value => { value.reports[0].compilerFreePath = false; }
				, value => { value.reports[0].path = "reviewed-ir"; }
				, value => { value.reports[0].modelSha256 = "missing"; }
				, value => { delete value.archives[Object.keys(value.archives)[0]]; }
			]) {
				const changed = structuredClone(original); mutate(changed);
				assert.throws(() => assertArrayHostReport(changed, selection, queue, text));
			}
		}
		for(const profile of Object.keys(queue.expected))
		{
			const { source } = composeArrayHostConsumer(profile, text);
			assert.equal(sha256(source), queue.expected[profile].consumerSha256);
		}
		assert.throws(() => composeArrayHostConsumer("unknown", text));
		assert.throws(() => composeArrayHostConsumer(attempt.id.startsWith("perl") ? "perl" : "rust", () => "missing insertion marker"));
	}
});

test("Array host writer preserves existing bytes and rejects unsupported options before writing", async t => {
	const directory = await mkdtemp(join(tmpdir(), "lean-bridge-array-host-archive-"));
	t.after(() => rm(directory, { recursive: true, force: true }));
	const path = join(directory, "preserved.json"), bytes = Buffer.from("original\n");
	await writeArrayEvidenceArtifact(path, bytes); await writeArrayEvidenceArtifact(path, bytes);
	await assert.rejects(writeArrayEvidenceArtifact(path, Buffer.from("replacement\n")), /Refusing to replace/u);
	assert.deepEqual(await readFile(path), bytes);
	const command = resolve("scripts/archive-generic-record-array-host-evidence.mjs");
	const run = spawnSync(process.execPath, [command, "--replace"], { cwd: directory, encoding: "utf8" });
	assert.equal(run.status, 1); assert.match(run.stderr, /AssertionError/u);
	assert.deepEqual(await readdir(directory), ["preserved.json"]);
});
