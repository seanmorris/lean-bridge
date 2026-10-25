/**
	* Authenticate the Core repair without rewriting original receipt bytes.
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
	beforeCorePublicationRecursiveRepairSource
	, corePublicationRecursiveRepairAddedPaths
	, corePublicationRecursiveRepairChangedPaths
	, corePublicationRecursiveRepairCommits
	, corePublicationRecursiveRepairImplementationPaths
	, corePublicationRecursiveRepairHistoryPath
	, corePublicationRecursiveRepairImplementation
	, corePublicationRecursiveRepairIntegrationBase
	, corePublicationRecursiveRepairIntegrationPaths
	, corePublicationRecursiveRepairPredecessor
	, reverseCorePublicationRecursiveRepairUpdate
} from "./core-publication-recursive-repair-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";
import { authenticateSourceHistoryReverse, gitSourceBytes } from "./source-history-stream.mjs";

const git = arguments_ => execFileSync("git", arguments_
	, { encoding: "utf8", maxBuffer: 2 * 1024 * 1024 });
const read = async () => JSON.parse(await readFile(corePublicationRecursiveRepairHistoryPath, "utf8"));
const inventoryPath = "docs/type-surface.v1.json";
const evidenceDirectory = "docs/evidence/core-publication-recursive-repair-20261025";
const committed = path => git(["show", corePublicationRecursiveRepairImplementation + ":" + path]);
const acceptance = () => JSON.parse(committed(evidenceDirectory + "/acceptance.json"));

test("Core publication/recursive repair authenticates its wiring and lineage", async () => {
	const record = await read();
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone, "core-publication-recursive-repair-source-v1");
	assert.equal(record.predecessorCommit, corePublicationRecursiveRepairPredecessor);
	assert.equal(record.implementationCommit, corePublicationRecursiveRepairImplementation);
	assert.equal(record.integrationBaseCommit, corePublicationRecursiveRepairIntegrationBase);
	assert.deepEqual(record.implementationCommits, corePublicationRecursiveRepairCommits);
	assert.deepEqual(record.updates.map(item => item.path)
		, corePublicationRecursiveRepairChangedPaths);
	assert.deepEqual(record.integrationUpdates.map(item => item.path)
		, corePublicationRecursiveRepairIntegrationPaths);
	assert.deepEqual(record.additions.map(item => item.path)
		, corePublicationRecursiveRepairAddedPaths);
	assert.deepEqual(git(["rev-list", "--reverse"
		, corePublicationRecursiveRepairPredecessor + ".." + corePublicationRecursiveRepairImplementation]).trim().split("\n")
	, corePublicationRecursiveRepairCommits);
	for(const [index, revision] of corePublicationRecursiveRepairCommits.entries())
		assert.equal(git(["show", "-s", "--format=%P", revision]).trim()
			, index === 0 ? corePublicationRecursiveRepairPredecessor : corePublicationRecursiveRepairCommits[index - 1]);
	assert.deepEqual(git(["diff", "--name-only"
		, corePublicationRecursiveRepairPredecessor
		, corePublicationRecursiveRepairImplementation]).trim().split("\n")
	, [...corePublicationRecursiveRepairImplementationPaths].sort());
	const updates = [...record.updates.filter(item => item.path !== inventoryPath)
		, ...record.integrationUpdates];
	for(const update of updates)
	{
		const current = await sourceAtFinHistoryMilestone(update.path
			, update.currentSha256, beforeCorePublicationRecursiveRepairSource);
		const prior = record.integrationUpdates.includes(update)
			? corePublicationRecursiveRepairIntegrationBase : corePublicationRecursiveRepairPredecessor;
		const previous = git(["show", prior + ":" + update.path]);
		assert.equal(reverseCorePublicationRecursiveRepairUpdate(
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

test("Core publication/recursive repair preserves runtime, workflows and original receipts", () => {
	for(const path of ["src", "site", ".github"
		, ...["ruby", "rust", "python", "native"].map(language =>
			"docs/evidence/" + language + "-recursive-callable-integration-20260925.json")])
		assert.equal(git(["rev-parse", corePublicationRecursiveRepairPredecessor + ":" + path])
			, git(["rev-parse", corePublicationRecursiveRepairImplementation + ":" + path]), path);
	const receipt = acceptance();
	assert.deepEqual(receipt.pending, [
		"full-final-head-Core"
		, "complete-producer-input-reconciliation"
		, "recurring-default-branch-activation"
	]);
});

test("Core publication/recursive repair streams exactly twenty source-pin updates", async () => {
	const receipt = acceptance(), record = await read();
	assert.equal(receipt.baseCommit, corePublicationRecursiveRepairPredecessor);
	assert.deepEqual(receipt.sourcePins.filter(pin => pin.count).map(({ path, count }) => ({ path, count })), [
		{ path: "tests/callback-subtype-promotion.test.mjs", count: 8 }
		, { path: "tests/helpers/ruby-recursive-callable-evidence.mjs", count: 2 }
		, { path: "tests/helpers/rust-recursive-callable-evidence.mjs", count: 2 }
		, { path: "tests/helpers/python-recursive-callable-evidence.mjs", count: 2 }
		, { path: "tests/helpers/native-recursive-callable-evidence.mjs", count: 6 }
	]);
	const update = record.updates.find(item => item.path === inventoryPath); assert.ok(update);
	assert.equal(update.previousSha256, receipt.inventory.previous.sha256);
	assert.equal(update.currentSha256, receipt.inventory.current.sha256);
	assert.equal(receipt.inventory.current.bytes, receipt.inventory.previous.bytes);
	assert.equal(receipt.inventory.refreshedPins, 20); assert.equal(receipt.inventory.exactInverse, true);
	assert.equal(update.edits.length, 20);
	assert.equal(await authenticateSourceHistoryReverse(gitSourceBytes(
		corePublicationRecursiveRepairImplementation, inventoryPath), update), true);
	const edits = new Map(update.edits.map(edit => [edit.start, edit]));
	const pins = new Map(receipt.sourcePins.map(pin => [pin.path, { ...pin, seen: 0 }]));
	for(const pin of pins.values())
	{
		const source = record.updates.find(item => item.path === pin.path); assert.ok(source, pin.path);
		assert.equal(pin.previous, source.previousSha256); assert.equal(pin.current, source.currentSha256);
	}
	let files = false, offset = 0, bytes = 0, pending;
	const input = Readable.from(gitSourceBytes(corePublicationRecursiveRepairImplementation, inventoryPath));
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

test("Core publication/recursive repair retains original failures and all seventeen passing checks", () => {
	const receipt = acceptance(), { tests, inventoryAudit } = receipt.validation;
	for(const file of [...tests.map(item => item.file), inventoryAudit, receipt.diagnosis])
	{
		const bytes = committed(file.path);
		assert.equal(Buffer.byteLength(bytes), file.bytes); assert.equal(sha256(bytes), file.sha256);
	}
	assert.deepEqual(tests.map(item => item.count), [5, 5, 4, 3]);
	assert.equal(tests.reduce((sum, item) => sum + item.count, 0), 17);
	for(const { file, count } of tests)
	{
		const tap = committed(file.path);
		assert.match(tap, /^TAP version 13\n/u);
		for(const line of ["1.." + count, "# tests " + count, "# pass " + count
			, "# fail 0", "# skipped 0", "# cancelled 0"])
			assert.ok(tap.split("\n").includes(line), file.path + ": " + line);
		assert.doesNotMatch(tap, /^not ok |# SKIP|# TODO/mu);
	}
	const diagnosis = JSON.parse(committed(receipt.diagnosis.path));
	assert.equal(diagnosis.remote.run, 40160209518);
	assert.deepEqual(diagnosis.remote.logs.map(item => item.job), [121069998049, 121069998106]);
	for(const log of diagnosis.remote.logs)
		assert.ok(log.selectedLines.some(line => /runner has received a shutdown signal/u.test(line.text)));
	assert.equal(diagnosis.local[0].exitCode, 1);
	assert.match(diagnosis.local[0].assertion, /not widen any type-support cell/u);
	assert.equal(diagnosis.local[1].signal, "SIGABRT");
	assert.equal(diagnosis.local[2].signal, "SIGABRT");
	const reproductions = diagnosis.local[3].results;
	assert.equal(reproductions.length, 4);
	for(const item of reproductions)
	{
		assert.equal(item.withoutStop, "f8e255a8b7787aaa41c586ad5965068e1701e06887074113de680b71aeb0c72e");
		assert.notEqual(item.withoutStop, item.expected);
		assert.equal(item.withStop, item.expected);
	}
	assert.equal(receipt.validation.callSites, 16);
	assert.equal(receipt.validation.missingStopMutations, 20);
	assert.equal(receipt.validation.malformedTransitionControls, 24);
	assert.equal(receipt.validation.lintExitCode, 0);
	assert.equal(receipt.validation.typecheckExitCode, 0);
});

test("Core publication/recursive repair rejects unknown or forged transitions", async () => {
	const update = (await read()).integrationUpdates[0];
	const current = await sourceAtFinHistoryMilestone(update.path
		, update.currentSha256, beforeCorePublicationRecursiveRepairSource);
	assert.equal(beforeCorePublicationRecursiveRepairSource(
		update.path, current, update.currentSha256), current);
	const unknown = current + "\nunknown";
	assert.equal(beforeCorePublicationRecursiveRepairSource(
		update.path, unknown), unknown);
	for(const forged of [{ ...update, previousSha256: "0".repeat(64) }
		, { ...update, currentSha256: "0".repeat(64) }
		, { ...update, edits: [...update.edits, update.edits[0]] }
		, { ...update, edits: [] }, { ...update, path: "unrelated.mjs" }])
		assert.throws(() => reverseCorePublicationRecursiveRepairUpdate(current, forged));
	assert.equal(beforeCorePublicationRecursiveRepairSource(
		"unrelated.mjs", current), current);
});

test("Core publication/recursive repair writer refuses another checkout", async t => {
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
		"scripts/update-core-publication-recursive-repair-source-history.mjs")]
	, { cwd: root, env: environment, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /exact integration base/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
