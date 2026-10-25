/**
	* Authenticate the source supplement without rewriting original archive bytes.
	*
	* @file
	*/
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createInterface } from "node:readline";
import { Readable } from "node:stream";
import test from "node:test";
import { beforeFinRefinementSource, finRefinementNormalizationPaths } from "./fin-refinement-source-history.mjs";
import {
	beforePhpWasmEntrySourceSupplementSource
	, phpWasmEntrySourceSupplementAddedPaths
	, phpWasmEntrySourceSupplementChangedPaths
	, phpWasmEntrySourceSupplementCommits
	, phpWasmEntrySourceSupplementImplementationPaths
	, phpWasmEntrySourceSupplementHistoryPath
	, phpWasmEntrySourceSupplementImplementation
	, phpWasmEntrySourceSupplementIntegrationBase
	, phpWasmEntrySourceSupplementIntegrationPaths
	, phpWasmEntrySourceSupplementPredecessor
	, reversePhpWasmEntrySourceSupplementUpdate
} from "./php-wasm-entry-source-supplement-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";
import { authenticateSourceHistoryReverse, gitSourceBytes } from "./source-history-stream.mjs";
import { canonicalJson } from "../../src/capsule/node.mjs";

const git = arguments_ => execFileSync("git", arguments_
	, { encoding: "utf8", maxBuffer: 2 * 1024 * 1024 });
const read = async () => JSON.parse(await readFile(phpWasmEntrySourceSupplementHistoryPath, "utf8"));
const inventoryPath = "docs/type-surface.v1.json";
const evidenceDirectory = "docs/evidence/php-wasm-entry-source-supplement-acceptance-20261025";
const committed = path => git(["show", phpWasmEntrySourceSupplementImplementation + ":" + path]);
const acceptance = () => JSON.parse(committed(evidenceDirectory + "/acceptance.json"));

test("PHP-Wasm entry source supplement authenticates its wiring and lineage", async () => {
	const record = await read();
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone, "php-wasm-entry-source-supplement-source-v1");
	assert.equal(record.predecessorCommit, phpWasmEntrySourceSupplementPredecessor);
	assert.equal(record.implementationCommit, phpWasmEntrySourceSupplementImplementation);
	assert.equal(record.integrationBaseCommit, phpWasmEntrySourceSupplementIntegrationBase);
	assert.deepEqual(record.implementationCommits, phpWasmEntrySourceSupplementCommits);
	assert.deepEqual(record.updates.map(item => item.path)
		, phpWasmEntrySourceSupplementChangedPaths);
	assert.deepEqual(record.integrationUpdates.map(item => item.path)
		, phpWasmEntrySourceSupplementIntegrationPaths);
	assert.deepEqual(record.additions.map(item => item.path)
		, phpWasmEntrySourceSupplementAddedPaths);
	assert.deepEqual(git(["rev-list", "--reverse"
		, phpWasmEntrySourceSupplementPredecessor + ".." + phpWasmEntrySourceSupplementImplementation]).trim().split("\n")
	, phpWasmEntrySourceSupplementCommits);
	for(const [index, revision] of phpWasmEntrySourceSupplementCommits.entries())
		assert.equal(git(["show", "-s", "--format=%P", revision]).trim()
			, index === 0 ? phpWasmEntrySourceSupplementPredecessor : phpWasmEntrySourceSupplementCommits[index - 1]);
	assert.deepEqual(git(["diff", "--name-only"
		, phpWasmEntrySourceSupplementPredecessor
		, phpWasmEntrySourceSupplementImplementation]).trim().split("\n")
	, [...phpWasmEntrySourceSupplementImplementationPaths].sort());
	const updates = [...record.updates.filter(item => item.path !== inventoryPath)
		, ...record.integrationUpdates];
	for(const update of updates)
	{
		const current = await sourceAtFinHistoryMilestone(update.path
			, update.currentSha256, beforePhpWasmEntrySourceSupplementSource);
		const prior = record.integrationUpdates.includes(update)
			? phpWasmEntrySourceSupplementIntegrationBase : phpWasmEntrySourceSupplementPredecessor;
		const previous = git(["show", prior + ":" + update.path]);
		assert.equal(reversePhpWasmEntrySourceSupplementUpdate(
			current, update), previous);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous);
		assert.ok(finRefinementNormalizationPaths.includes(update.path));
	}
	assert.ok(finRefinementNormalizationPaths.includes(inventoryPath));
	for(const addition of record.additions)
		assert.equal(sha256(await sourceAtFinHistoryMilestone(
			addition.path, addition.currentSha256)), addition.currentSha256);
});

test("PHP-Wasm entry source supplement preserves original sources and archives", async () => {
	const receipt = acceptance();
	const supplement = JSON.parse(committed(receipt.sourceSupplement.path));
	assert.equal(sha256(canonicalJson(supplement)), receipt.sourceSupplement.sha256);
	assert.equal(supplement.snapshots.length, 3); assert.equal(supplement.files.length, 2);
	for(const revision of supplement.snapshots.map(item => item.revision))
		for(const file of supplement.files)
			assert.equal(git(["show", revision + ":" + file.path]), file.source);
	for(const path of ["src", "site", ".github"
		, "docs/evidence/php-wasm-entry-hosted-20261025"
		, "docs/evidence/php-wasm-entry-diagnostic-nominal-full-20261025"])
		assert.equal(git(["rev-parse", phpWasmEntrySourceSupplementPredecessor + ":" + path])
			, git(["rev-parse", phpWasmEntrySourceSupplementImplementation + ":" + path]), path);
	for(const file of supplement.archives)
		assert.equal(sha256(await readFile(file.path)), file.sha256);
	const documentation = committed("docs/contributing/testing.md");
	assert.ok(documentation.includes("../evidence/php-wasm-entry-source-supplement-20261025.json"));
	assert.match(documentation, /New snapshots must include both files directly/u);
});

test("PHP-Wasm entry source supplement streams exactly twelve source-pin updates", async () => {
	const receipt = acceptance(), record = await read();
	assert.equal(receipt.baseCommit, phpWasmEntrySourceSupplementPredecessor);
	assert.deepEqual(receipt.sourcePins.filter(pin => pin.count).map(({ path, count }) => ({ path, count })), [
		{ path: "tests/helpers/php-wasm-refinement-entry-hosted-replay.mjs", count: 1 }
		, { path: "docs/contributing/testing.md", count: 11 }
	]);
	const update = record.updates.find(item => item.path === inventoryPath); assert.ok(update);
	assert.equal(update.previousSha256, receipt.inventory.previous.sha256);
	assert.equal(update.currentSha256, receipt.inventory.current.sha256);
	assert.equal(receipt.inventory.current.bytes, receipt.inventory.previous.bytes);
	assert.equal(receipt.inventory.refreshedPins, 12); assert.equal(receipt.inventory.exactInverse, true);
	assert.equal(update.edits.length, 12);
	assert.equal(await authenticateSourceHistoryReverse(gitSourceBytes(
		phpWasmEntrySourceSupplementImplementation, inventoryPath), update), true);
	const edits = new Map(update.edits.map(edit => [edit.start, edit]));
	const pins = new Map(receipt.sourcePins.map(pin => [pin.path, { ...pin, seen: 0 }]));
	for(const pin of pins.values())
	{
		const source = record.updates.find(item => item.path === pin.path); assert.ok(source, pin.path);
		assert.equal(pin.previous, source.previousSha256); assert.equal(pin.current, source.currentSha256);
	}
	let files = false, offset = 0, bytes = 0, pending;
	const input = Readable.from(gitSourceBytes(phpWasmEntrySourceSupplementImplementation, inventoryPath));
	for await(const line of createInterface({ input, crlfDelay: Infinity }))
	{
		if(line === '      "files": [') files = true;
		if(line === "      ],") files = false;
		if(pending)
		{
			assert.ok(files); assert.equal(line, '          "sha256": "' + pending.current + '"');
			const edit = edits.get(offset); assert.ok(edit, pending.path);
			assert.equal(edit.current, line + "\n");
			assert.equal(edit.previous, '          "sha256": "' + pending.previous + '"\n');
			edits.delete(offset); pending.seen++;
		}
		const match = files && /^ {10}"path": "([^"]+)",$/u.exec(line);
		pending = match ? pins.get(match[1]) : undefined;
		offset += line.length + 1; bytes += Buffer.byteLength(line + "\n");
	}
	assert.equal(edits.size, 0); assert.equal(bytes, receipt.inventory.current.bytes);
	for(const pin of pins.values()) assert.equal(pin.seen, pin.count, pin.path);
});

test("PHP-Wasm entry source supplement retains the original refusal and real ZIP acceptance", () => {
	const receipt = acceptance(), { tests, inventoryAudit } = receipt.validation;
	for(const file of [tests, inventoryAudit, receipt.diagnosis.firstCheckoutCheck.log])
	{
		const bytes = committed(file.path);
		assert.equal(Buffer.byteLength(bytes), file.bytes); assert.equal(sha256(bytes), file.sha256);
	}
	const tap = committed(tests.path);
	assert.match(tap, /^TAP version 13\n/u);
	assert.match(tap, /^1\.\.14$/mu);
	for(const line of ["# tests 14", "# pass 14", "# fail 0", "# skipped 0", "# cancelled 0"])
		assert.ok(tap.split("\n").includes(line));
	assert.equal(receipt.diagnosis.firstCheckoutCheck.exitCode, 1);
	assert.match(committed(receipt.diagnosis.firstCheckoutCheck.log.path), /ENOENT.*site\/paths\.mjs/u);
	const positive = receipt.originalSourceAcceptance;
	assert.equal(positive.originalSnapshotCheck, true); assert.equal(positive.exactProducerCheckoutCheck, true);
	assert.equal(positive.archivedSourceFiles, 9647); assert.equal(positive.authenticatedCheckoutFiles, 9649);
	assert.equal(positive.supplementSha256, receipt.sourceSupplement.sha256);
	assert.equal(positive.originalZip.bytes, 26369339);
	assert.equal(positive.originalZip.sha256, "48add54f5f0790d004d80c723729ccd075b20b8f91df8c818bb20f96a3672143");
	assert.equal(receipt.validation.lintExitCode, 0); assert.equal(receipt.validation.typecheckExitCode, 0);
});

test("PHP-Wasm entry source supplement rejects unknown or forged transitions", async () => {
	const update = (await read()).integrationUpdates[0];
	const current = await sourceAtFinHistoryMilestone(update.path
		, update.currentSha256, beforePhpWasmEntrySourceSupplementSource);
	assert.equal(beforePhpWasmEntrySourceSupplementSource(
		update.path, current, update.currentSha256), current);
	const unknown = current + "\nunknown";
	assert.equal(beforePhpWasmEntrySourceSupplementSource(
		update.path, unknown), unknown);
	for(const forged of [{ ...update, previousSha256: "0".repeat(64) }
		, { ...update, currentSha256: "0".repeat(64) }
		, { ...update, edits: [...update.edits, update.edits[0]] }
		, { ...update, edits: [] }, { ...update, path: "unrelated.mjs" }])
		assert.throws(() => reversePhpWasmEntrySourceSupplementUpdate(current, forged));
	assert.equal(beforePhpWasmEntrySourceSupplementSource(
		"unrelated.mjs", current), current);
});

test("PHP-Wasm entry source supplement writer refuses another checkout", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-php-source-supplement-guard-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const environment = Object.fromEntries(Object.entries(process.env)
		.filter(([key]) => !key.startsWith("GIT_")));
	const run = arguments_ => execFileSync("git", arguments_
		, { cwd: root, env: environment, stdio: "pipe" });
	run(["init", "--quiet"]);
	run(["-c", "user.name=Test", "-c", "user.email=test@example.invalid"
		, "-c", "commit.gpgsign=false", "commit", "--allow-empty"
		, "--quiet", "-m", "unrelated"]);
	const result = spawnSync(process.execPath, [resolve(
		"scripts/update-php-wasm-entry-source-supplement-source-history.mjs")]
	, { cwd: root, env: environment, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /exact integration base/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
