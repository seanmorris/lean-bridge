/**
 * Authenticate fail-fast tool discovery without changing installed evidence.
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
	beforeConsumerToolLookupsSource
	, consumerToolLookupsAddedPaths
	, consumerToolLookupsChangedPaths
	, consumerToolLookupsCommits
	, consumerToolLookupsImplementationPaths
	, consumerToolLookupsHistoryPath
	, consumerToolLookupsImplementation
	, consumerToolLookupsIntegrationBase
	, consumerToolLookupsIntegrationPaths
	, consumerToolLookupsPredecessor
	, reverseConsumerToolLookupsUpdate
} from "./consumer-tool-lookups-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";
import { authenticateSourceHistoryReverse, gitSourceBytes } from "./source-history-stream.mjs";

const git = arguments_ => execFileSync("git", arguments_
	, { encoding: "utf8", maxBuffer: 2 * 1024 * 1024 });
const read = async () => JSON.parse(await readFile(consumerToolLookupsHistoryPath, "utf8"));
const inventoryPath = "docs/type-surface.v1.json";
const evidenceDirectory = "docs/evidence/consumer-tool-lookups-20261025";
const committed = path => git(["show", consumerToolLookupsImplementation + ":" + path]);
const acceptance = () => JSON.parse(committed(evidenceDirectory + "/acceptance.json"));

test("consumer tool lookup history authenticates its wiring and lineage", async () => {
	const record = await read();
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone, "consumer-tool-lookups-source-v1");
	assert.equal(record.predecessorCommit, consumerToolLookupsPredecessor);
	assert.equal(record.implementationCommit, consumerToolLookupsImplementation);
	assert.equal(record.integrationBaseCommit, consumerToolLookupsIntegrationBase);
	assert.deepEqual(record.implementationCommits, consumerToolLookupsCommits);
	assert.deepEqual(record.updates.map(item => item.path)
		, consumerToolLookupsChangedPaths);
	assert.deepEqual(record.integrationUpdates.map(item => item.path)
		, consumerToolLookupsIntegrationPaths);
	assert.deepEqual(record.additions.map(item => item.path)
		, consumerToolLookupsAddedPaths);
	assert.deepEqual(git(["rev-list", "--reverse"
		, consumerToolLookupsPredecessor + ".." + consumerToolLookupsImplementation]).trim().split("\n")
	, consumerToolLookupsCommits);
	for(const [index, revision] of consumerToolLookupsCommits.entries())
		assert.equal(git(["show", "-s", "--format=%P", revision]).trim()
			, index === 0 ? consumerToolLookupsPredecessor : consumerToolLookupsCommits[index - 1]);
	assert.deepEqual(git(["diff", "--name-only"
		, consumerToolLookupsPredecessor
		, consumerToolLookupsImplementation]).trim().split("\n")
	, [...consumerToolLookupsImplementationPaths].sort());
	const updates = [...record.updates.filter(item => item.path !== inventoryPath)
		, ...record.integrationUpdates];
	for(const update of updates)
	{
		const current = await sourceAtFinHistoryMilestone(update.path
			, update.currentSha256, beforeConsumerToolLookupsSource);
		const prior = record.integrationUpdates.includes(update)
			? consumerToolLookupsIntegrationBase : consumerToolLookupsPredecessor;
		const previous = git(["show", prior + ":" + update.path]);
		assert.equal(reverseConsumerToolLookupsUpdate(
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

test("consumer tool lookup history preserves all other workflow and runtime bytes", () => {
	const path = ".github/workflows/consumer-matrix.yml", receipt = acceptance();
	const previous = git(["show", consumerToolLookupsPredecessor + ":" + path]);
	const current = committed(path);
	let count = 0;
	const restored = current.replace(
		/^ {10}(LEAN_BRIDGE_[A-Z]+)="\$\(command -v ([a-z0-9]+)\)"\n {10}export \1$/gmu
		, (_match, name, command) => {
			count++;
			return "          export " + name + '="$(command -v ' + command + ')"';
		}
	);
	assert.equal(count, 41);
	assert.equal(restored, previous);
	assert.equal(receipt.workflow.exactInverse, true);
	assert.deepEqual(receipt.workflow.previous, { bytes: Buffer.byteLength(previous), sha256: sha256(previous) });
	assert.deepEqual(receipt.workflow.current, { bytes: Buffer.byteLength(current), sha256: sha256(current) });
	for(const path of ["src", "package.json", ".github/workflows/quality.yml"
		, ".github/workflows/php-wasm-refinement-entry-promotion.yml"
		, "docs/evidence/php-wasm-entry-hosted-20261025"
		, "docs/evidence/php-wasm-entry-hosted-acceptance-20261025"])
		assert.equal(git(["rev-parse", consumerToolLookupsPredecessor + ":" + path])
			, git(["rev-parse", consumerToolLookupsImplementation + ":" + path]), path);
	const perl = committed("tests/helpers/owned-perl-callback-result-ci.mjs");
	for(const name of ["MAVEN", "DOTNET", "RUBY", "GEM"])
		assert.ok(perl.includes('consumerToolExportLines("' + name + '", legacy)'));
});

test("consumer tool lookup history streams exactly 117 file-scoped source pins", async () => {
	const receipt = acceptance();
	assert.equal(receipt.baseCommit, consumerToolLookupsPredecessor);
	assert.deepEqual(receipt.sourcePins.filter(pin => pin.count).map(({ path, count }) => ({ path, count })), [
		{ path: ".github/workflows/consumer-matrix.yml", count: 92 }
		, { path: "tests/documentation.test.mjs", count: 25 }
	]);
	const record = await read();
	const update = record.updates.find(item => item.path === inventoryPath); assert.ok(update);
	assert.equal(update.previousSha256, receipt.inventory.previous.sha256);
	assert.equal(update.currentSha256, receipt.inventory.current.sha256);
	assert.equal(receipt.inventory.current.bytes, receipt.inventory.previous.bytes);
	assert.equal(receipt.inventory.refreshedPins, 117);
	assert.equal(receipt.inventory.exactInverse, true);
	assert.equal(update.edits.length, 117);
	assert.equal(await authenticateSourceHistoryReverse(gitSourceBytes(
		consumerToolLookupsImplementation, inventoryPath), update), true);
	const edits = new Map(update.edits.map(edit => [edit.start, edit]));
	const pins = new Map(receipt.sourcePins.map(pin => [pin.path, { ...pin, seen: 0 }]));
	for(const pin of pins.values())
	{
		const source = record.updates.find(item => item.path === pin.path); assert.ok(source, pin.path);
		assert.equal(pin.previous, source.previousSha256);
		assert.equal(pin.current, source.currentSha256);
	}
	let files = false, offset = 0, bytes = 0, pending;
	const input = Readable.from(gitSourceBytes(consumerToolLookupsImplementation, inventoryPath));
	for await(const line of createInterface({ input, crlfDelay: Infinity }))
	{
		if(line === '      "files": [') files = true;
		if(line === "      ],") files = false;
		if(pending)
		{
			assert.ok(files);
			assert.equal(line, '          "sha256": "' + pending.current + '"');
			const edit = edits.get(offset); assert.ok(edit, pending.path);
			assert.equal(edit.current, line + "\n");
			assert.equal(edit.previous, '          "sha256": "' + pending.previous + '"\n');
			edits.delete(offset); pending.seen++;
		}
		const match = files && /^ {10}"path": "([^"]+)",$/u.exec(line);
		pending = match ? pins.get(match[1]) : undefined;
		offset += line.length + 1;
		bytes += Buffer.byteLength(line + "\n");
	}
	assert.equal(edits.size, 0);
	assert.equal(bytes, receipt.inventory.current.bytes);
	for(const pin of pins.values()) assert.equal(pin.seen, pin.count, pin.path);
	assert.equal([...pins.values()].reduce((sum, pin) => sum + pin.seen, 0), 117);
});

test("consumer tool lookup history retains actual diagnostics and terminal TAP", () => {
	const receipt = acceptance();
	assert.equal(receipt.kind, "consumer-tool-lookups-acceptance-v1");
	const { tests, audit, actionlint, lint, typecheck } = receipt.validation;
	for(const file of [tests, audit, actionlint.before, actionlint.after])
	{
		const source = committed(file.path);
		assert.equal(Buffer.byteLength(source), file.bytes);
		assert.equal(sha256(source), file.sha256);
	}
	const tap = committed(tests.path);
	assert.match(tap, /^TAP version 13\n/u);
	assert.match(tap, /^1\.\.17$/mu);
	for(const line of ["# tests 17", "# pass 17", "# fail 0", "# cancelled 0", "# skipped 0"])
		assert.ok(tap.split("\n").includes(line), line);
	assert.equal(tests.total, 17); assert.equal(tests.passed, 17);
	assert.equal(tests.failed, 0); assert.equal(tests.skipped, 0);
	assert.equal(tests.workflowMutationRefusals, 246);
	assert.deepEqual(tests.bashControls, { successfulExports: 7, missingToolStops: 7, legacyMaskingReproductions: 7 });
	const before = committed(actionlint.before.path).trimEnd().split("\n");
	assert.equal(before.length, 41);
	assert.ok(before.every(line => line.includes("SC2155:warning:")));
	assert.equal(actionlint.before.exitCode, 1);
	assert.equal(actionlint.before.sc2155Warnings, 41);
	assert.equal(committed(actionlint.after.path), "");
	assert.equal(actionlint.after.exitCode, 0); assert.equal(actionlint.after.warnings, 0);
	assert.equal(lint.exitCode, 0); assert.equal(typecheck.exitCode, 0);
});

test("consumer tool lookup history rejects unknown or forged transitions", async () => {
	const update = (await read()).integrationUpdates[0];
	const current = await sourceAtFinHistoryMilestone(update.path
		, update.currentSha256, beforeConsumerToolLookupsSource);
	assert.equal(beforeConsumerToolLookupsSource(
		update.path, current, update.currentSha256), current);
	const unknown = current + "\nunknown";
	assert.equal(beforeConsumerToolLookupsSource(
		update.path, unknown), unknown);
	for(const forged of [{ ...update, previousSha256: "0".repeat(64) }
		, { ...update, currentSha256: "0".repeat(64) }
		, { ...update, edits: [...update.edits, update.edits[0]] }
		, { ...update, edits: [] }, { ...update, path: "unrelated.mjs" }])
		assert.throws(() => reverseConsumerToolLookupsUpdate(current, forged));
	assert.equal(beforeConsumerToolLookupsSource(
		"unrelated.mjs", current), current);
});

test("consumer tool lookup history writer refuses another checkout", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-consumer-lookup-history-guard-"));
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
		"scripts/update-consumer-tool-lookups-source-history.mjs")]
	, { cwd: root, env: environment, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /exact integration base/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
