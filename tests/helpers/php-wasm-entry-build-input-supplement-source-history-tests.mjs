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
import { gunzipSync } from "node:zlib";
import { beforeFinRefinementSource, finRefinementNormalizationPaths } from "./fin-refinement-source-history.mjs";
import {
	beforePhpWasmEntryBuildInputSupplementSource
	, phpWasmEntryBuildInputSupplementAddedPaths
	, phpWasmEntryBuildInputSupplementChangedPaths
	, phpWasmEntryBuildInputSupplementCommits
	, phpWasmEntryBuildInputSupplementImplementationPaths
	, phpWasmEntryBuildInputSupplementHistoryPath
	, phpWasmEntryBuildInputSupplementImplementation
	, phpWasmEntryBuildInputSupplementIntegrationBase
	, phpWasmEntryBuildInputSupplementIntegrationPaths
	, phpWasmEntryBuildInputSupplementPredecessor
	, reversePhpWasmEntryBuildInputSupplementUpdate
} from "./php-wasm-entry-build-input-supplement-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";
import { authenticateSourceHistoryReverse, gitSourceBytes } from "./source-history-stream.mjs";
import { canonicalJson } from "../../src/capsule/node.mjs";

const git = arguments_ => execFileSync("git", arguments_
	, { encoding: "utf8", maxBuffer: 8 * 1024 * 1024 });
const read = async () => JSON.parse(await readFile(phpWasmEntryBuildInputSupplementHistoryPath, "utf8"));
const inventoryPath = "docs/type-surface.v1.json";
const evidenceDirectory = "docs/evidence/php-wasm-entry-build-input-supplement-acceptance-20261025";
const committed = path => git(["show", phpWasmEntryBuildInputSupplementImplementation + ":" + path]);
const acceptance = () => JSON.parse(committed(evidenceDirectory + "/acceptance.json"));

test("PHP-Wasm entry build-input supplement authenticates its wiring and lineage", async () => {
	const record = await read();
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone, "php-wasm-entry-build-input-supplement-source-v1");
	assert.equal(record.predecessorCommit, phpWasmEntryBuildInputSupplementPredecessor);
	assert.equal(record.implementationCommit, phpWasmEntryBuildInputSupplementImplementation);
	assert.equal(record.integrationBaseCommit, phpWasmEntryBuildInputSupplementIntegrationBase);
	assert.deepEqual(record.implementationCommits, phpWasmEntryBuildInputSupplementCommits);
	assert.deepEqual(record.updates.map(item => item.path)
		, phpWasmEntryBuildInputSupplementChangedPaths);
	assert.deepEqual(record.integrationUpdates.map(item => item.path)
		, phpWasmEntryBuildInputSupplementIntegrationPaths);
	assert.deepEqual(record.additions.map(item => item.path)
		, phpWasmEntryBuildInputSupplementAddedPaths);
	assert.deepEqual(git(["rev-list", "--reverse"
		, phpWasmEntryBuildInputSupplementPredecessor + ".." + phpWasmEntryBuildInputSupplementImplementation]).trim().split("\n")
	, phpWasmEntryBuildInputSupplementCommits);
	for(const [index, revision] of phpWasmEntryBuildInputSupplementCommits.entries())
		assert.equal(git(["show", "-s", "--format=%P", revision]).trim()
			, index === 0 ? phpWasmEntryBuildInputSupplementPredecessor : phpWasmEntryBuildInputSupplementCommits[index - 1]);
	assert.deepEqual(git(["diff", "--name-only"
		, phpWasmEntryBuildInputSupplementPredecessor
		, phpWasmEntryBuildInputSupplementImplementation]).trim().split("\n")
	, [...phpWasmEntryBuildInputSupplementImplementationPaths].sort());
	const updates = [...record.updates.filter(item => item.path !== inventoryPath)
		, ...record.integrationUpdates];
	for(const update of updates)
	{
		const current = await sourceAtFinHistoryMilestone(update.path
			, update.currentSha256, beforePhpWasmEntryBuildInputSupplementSource);
		const prior = record.integrationUpdates.includes(update)
			? phpWasmEntryBuildInputSupplementIntegrationBase : phpWasmEntryBuildInputSupplementPredecessor;
		const previous = git(["show", prior + ":" + update.path]);
		assert.equal(reversePhpWasmEntryBuildInputSupplementUpdate(
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

test("PHP-Wasm entry build-input supplement preserves original sources and archives", async () => {
	const receipt = acceptance();
	const supplement = JSON.parse(committed(receipt.sourceSupplement.path));
	assert.equal(sha256(canonicalJson(supplement)), receipt.sourceSupplement.sha256);
	assert.equal(supplement.snapshots.length, 3); assert.equal(supplement.files.length, 17);
	for(const revision of supplement.snapshots.map(item => item.revision))
	{
		for(const file of supplement.files)
		{
			const original = git(["show", revision + ":" + file.path]);
			assert.equal(Buffer.byteLength(original), file.bytes);
			assert.equal(sha256(original), file.sha256);
			assert.equal(gunzipSync(Buffer.from(file.gzipBase64, "base64")
				, { maxOutputLength: file.bytes }).toString(), original);
		}
	}
	for(const path of ["src", "site", ".github"
		, "docs/evidence/php-wasm-entry-hosted-20261025"
		, "docs/evidence/php-wasm-entry-diagnostic-nominal-full-20261025"])
		assert.equal(git(["rev-parse", phpWasmEntryBuildInputSupplementPredecessor + ":" + path])
			, git(["rev-parse", phpWasmEntryBuildInputSupplementImplementation + ":" + path]), path);
	for(const file of supplement.archives)
		assert.equal(sha256(await readFile(file.path)), file.sha256);
	const documentation = committed("docs/contributing/testing.md");
	assert.ok(documentation.includes("../evidence/php-wasm-entry-build-input-supplement-20261025.json"));
	assert.match(documentation, /New snapshots must include every input directly/u);
});

test("PHP-Wasm entry build-input supplement streams exactly twelve source-pin updates", async () => {
	const receipt = acceptance(), record = await read();
	assert.equal(receipt.baseCommit, phpWasmEntryBuildInputSupplementPredecessor);
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
		phpWasmEntryBuildInputSupplementImplementation, inventoryPath), update), true);
	const edits = new Map(update.edits.map(edit => [edit.start, edit]));
	const pins = new Map(receipt.sourcePins.map(pin => [pin.path, { ...pin, seen: 0 }]));
	for(const pin of pins.values())
	{
		const source = record.updates.find(item => item.path === pin.path); assert.ok(source, pin.path);
		assert.equal(pin.previous, source.previousSha256); assert.equal(pin.current, source.currentSha256);
	}
	let files = false, offset = 0, bytes = 0, pending;
	const input = Readable.from(gitSourceBytes(phpWasmEntryBuildInputSupplementImplementation, inventoryPath));
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

test("PHP-Wasm entry build-input supplement retains original refusals and real ZIP acceptance", () => {
	const receipt = acceptance(), { tests, inventoryAudit } = receipt.validation;
	const originals = receipt.diagnosis.originalFailures;
	const retained = [tests, inventoryAudit
		, receipt.diagnosis.firstCheckoutCheck.log, ...originals
		, receipt.originalSourceAcceptance, receipt.originalSourceAcceptance.script];
	for(const file of retained)
	{
		const bytes = committed(file.path);
		assert.equal(Buffer.byteLength(bytes), file.bytes);
		assert.equal(sha256(bytes), file.sha256);
	}
	const tap = committed(tests.path);
	assert.match(tap, /^TAP version 13\n/u);
	assert.match(tap, /^1\.\.17$/mu);
	for(const line of ["# tests 17", "# pass 17", "# fail 0", "# skipped 0", "# cancelled 0"])
		assert.ok(tap.split("\n").includes(line));
	for(const file of originals)
	{
		assert.equal(file.exitCode, 1);
		assert.match(committed(file.path), /^not ok /mu);
		assert.match(committed(file.path), /^# fail 1$/mu);
	}
	assert.match(committed(originals[0].path), /LICENSE/u);
	assert.match(committed(originals[1].path), /notices\/php-wasm\.txt/u);
	assert.equal(receipt.diagnosis.firstCheckoutCheck.exitCode, 1);
	assert.match(committed(receipt.diagnosis.firstCheckoutCheck.log.path), /ENOENT.*LICENSE/u);
	const positive = receipt.originalSourceAcceptance;
	assert.equal(positive.producerCheckoutFiles, 9666);
	assert.equal(positive.producerCheckoutBytes, 71199920);
	assert.equal(positive.reachableModules, 620);
	assert.equal(positive.entryRoots.length, 30);
	assert.equal(positive.buildInputFiles, 17);
	assert.equal(positive.snapshots.length, 3);
	assert.ok(positive.snapshots.every(item => item.reconstructedAndExtracted));
	assert.equal(positive.snapshots[0].archiveFiles, 9647);
	assert.equal(positive.snapshots[0].zip.bytes, 26369339);
	assert.equal(positive.snapshots[0].zip.sha256, "48add54f5f0790d004d80c723729ccd075b20b8f91df8c818bb20f96a3672143");
	assert.equal(receipt.validation.lintExitCode, 0);
	assert.equal(receipt.validation.typecheckExitCode, 0);
	assert.deepEqual(receipt.validation.negativeControls, {
		compressedInputs: 204, hiddenMissingSymlinkInputs: 51
		, mandatorySupplementalPathsInNewSnapshots: 19
	});
});

test("PHP-Wasm entry build-input supplement retains the fresh thirty-route replay", async () => {
	const history = await read();
	const path = evidenceDirectory + "/hosted-replay.json";
	const identity = history.additions.find(file => file.path === path);
	assert.ok(identity);
	const bytes = await sourceAtFinHistoryMilestone(path, identity.currentSha256);
	const replay = JSON.parse(bytes);
	assert.equal(replay.kind, "php-wasm-entry-hosted-archive-acceptance-v1");
	assert.equal(replay.checkerCommit, phpWasmEntryBuildInputSupplementImplementation);
	assert.equal(replay.producerCommit, "a003269808c43a2a3a509a23c8a8ab8def07b610");
	assert.equal(replay.runId, 40144947516);
	assert.equal(replay.runAttempt, 1);
	assert.equal(replay.replayedRoutes, 30);
	assert.equal(replay.files, 1371);
	assert.equal(replay.producerArtifacts, 27);
	assert.equal(replay.aggregateArtifacts, 1);
	assert.deepEqual(replay.matrix, {
		artifacts: 27, calls: 180, cells: 30, controls: 72, executions: 360
		, producerCommit: replay.producerCommit, records: 1111, schemaVersion: 1
		, scope: "separate-instrumented-probe", workflows: 4
	});
	assert.equal(replay.summaryComparison.recordedNodeVersion, "22.23.3");
	assert.equal(replay.summaryComparison.replayNodeVersion, "22.23.2");
});

test("PHP-Wasm entry build-input supplement rejects unknown or forged transitions", async () => {
	const update = (await read()).integrationUpdates[0];
	const current = await sourceAtFinHistoryMilestone(update.path
		, update.currentSha256, beforePhpWasmEntryBuildInputSupplementSource);
	assert.equal(beforePhpWasmEntryBuildInputSupplementSource(
		update.path, current, update.currentSha256), current);
	const unknown = current + "\nunknown";
	assert.equal(beforePhpWasmEntryBuildInputSupplementSource(
		update.path, unknown), unknown);
	for(const forged of [{ ...update, previousSha256: "0".repeat(64) }
		, { ...update, currentSha256: "0".repeat(64) }
		, { ...update, edits: [...update.edits, update.edits[0]] }
		, { ...update, edits: [] }, { ...update, path: "unrelated.mjs" }])
		assert.throws(() => reversePhpWasmEntryBuildInputSupplementUpdate(current, forged));
	assert.equal(beforePhpWasmEntryBuildInputSupplementSource(
		"unrelated.mjs", current), current);
});

test("PHP-Wasm entry build-input supplement writer refuses another checkout", async t => {
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
		"scripts/update-php-wasm-entry-build-input-supplement-source-history.mjs")]
	, { cwd: root, env: environment, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /exact integration base/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
