/**
 * Authenticate complete PHP-Wasm mixed-coverage sources without changing support claims.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createInterface } from "node:readline";
import { Readable } from "node:stream";
import test from "node:test";
import { beforeFinRefinementSource, finRefinementNormalizationPaths } from "./fin-refinement-source-history.mjs";
import {
	beforeOwnedCheckedPhpWasmMixedCoverageSource
	, ownedCheckedPhpWasmMixedCoverageAddedPaths
	, ownedCheckedPhpWasmMixedCoverageChangedPaths
	, ownedCheckedPhpWasmMixedCoverageImplementationPaths
	, ownedCheckedPhpWasmMixedCoveragePins
	, ownedCheckedPhpWasmMixedCoverageHistoryPath
	, ownedCheckedPhpWasmMixedCoverageImplementation
	, ownedCheckedPhpWasmMixedCoverageIntegrationPaths
	, ownedCheckedPhpWasmMixedCoveragePredecessor
	, reverseOwnedCheckedPhpWasmMixedCoverageUpdate
} from "./owned-checked-php-wasm-mixed-coverage-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { authenticateSourceHistoryReverse, gitSourceBytes } from "./source-history-stream.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const git = arguments_ => execFileSync("git", arguments_
	, { encoding: "utf8", maxBuffer: 2 * 1024 ** 2 });
const read = async () => JSON.parse(await readFile(ownedCheckedPhpWasmMixedCoverageHistoryPath));
const predecessor = ownedCheckedPhpWasmMixedCoveragePredecessor;
const implementation = ownedCheckedPhpWasmMixedCoverageImplementation;

test("Owned checked PHP-Wasm mixed coverage records its exact implementation and integration", async () => {
	const record = await read();
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone, "owned-checked-php-wasm-mixed-coverage-source-v1");
	assert.equal(record.predecessorCommit, predecessor);
	assert.equal(record.implementationCommit, implementation);
	assert.equal(record.integrationBaseCommit, implementation);
	assert.deepEqual(record.implementationCommits, [implementation]);
	assert.equal(git(["show", "-s", "--format=%P", implementation]).trim(), predecessor);
	assert.deepEqual(git(["diff", "--name-only", predecessor, implementation]).trim().split("\n")
		, [...ownedCheckedPhpWasmMixedCoverageImplementationPaths].sort());
	assert.deepEqual(record.updates.map(update => update.path), ownedCheckedPhpWasmMixedCoverageChangedPaths);
	assert.deepEqual(record.integrationUpdates.map(update => update.path), ownedCheckedPhpWasmMixedCoverageIntegrationPaths);
	assert.deepEqual(record.additions.map(addition => addition.path), ownedCheckedPhpWasmMixedCoverageAddedPaths);
});

test("Owned checked PHP-Wasm mixed coverage reverses all nine source transitions", async () => {
	const record = await read();
	assert.equal(record.updates.length + record.integrationUpdates.length, 9);
	const inventory = record.updates.find(update => update.path === "docs/type-surface.v1.json");
	assert.ok(inventory);
	assert.equal(await authenticateSourceHistoryReverse(gitSourceBytes(implementation, inventory.path), inventory), true);
	const updates = [...record.updates.filter(update => update !== inventory), ...record.integrationUpdates];
	for(const update of updates)
	{
		const current = await sourceAtFinHistoryMilestone(update.path, update.currentSha256);
		const prior = record.integrationUpdates.includes(update) ? implementation : predecessor;
		const original = git(["show", `${prior}:${update.path}`]);
		assert.equal(reverseOwnedCheckedPhpWasmMixedCoverageUpdate(current, update), original);
		assert.equal(beforeOwnedCheckedPhpWasmMixedCoverageSource(update.path, current, update.currentSha256), current);
		assert.equal(beforeFinRefinementSource(update.path, current, update.previousSha256), original);
		assert.ok(finRefinementNormalizationPaths.includes(update.path));
	}
	for(const addition of record.additions)
		assert.equal(sha256(await sourceAtFinHistoryMilestone(addition.path, addition.currentSha256))
			, addition.currentSha256);
});

test("Owned checked PHP-Wasm mixed coverage preserves runtime and original evidence", () => {
	for(const path of ["src", "docs/reference", "docs/consume", "docs/lean"
		, "site", "package.json", "package-lock.json", "lean-toolchain"])
		assert.equal(git(["rev-parse", `${predecessor}:${path}`])
			, git(["rev-parse", `${implementation}:${path}`]), path);
	assert.equal(git(["diff", "--name-only", "--diff-filter=MDRCT"
		, predecessor, implementation, "--", "docs/evidence"]), "");
});

test("Owned checked PHP-Wasm mixed coverage changes exactly thirty-seven live test-source pins", async () => {
	const pins = new Map(ownedCheckedPhpWasmMixedCoveragePins.map(pin => [pin.path, pin]));
	const input = Readable.from(gitSourceBytes(implementation, "docs/type-surface.v1.json"));
	const current = createHash("sha256"), previous = createHash("sha256");
	const counts = new Map();
	let bytes = 0, mode, pending;
	input.on("data", chunk => { current.update(chunk); bytes += chunk.length; });
	for await(const line of createInterface({ input, crlfDelay: Infinity }))
	{
		if(line === '      "files": [') mode = "files";
		if(line === '      "artifacts": [') mode = "artifacts";
		if(line === "      ]," || line === "      ]") mode = undefined;
		let restored = line;
		if(pending)
		{
			assert.equal(mode, "files");
			assert.equal(line, '          "sha256": "' + pending.currentSha256 + '"');
			restored = '          "sha256": "' + pending.previousSha256 + '"';
			counts.set(pending.path, (counts.get(pending.path) ?? 0) + 1);
		}
		const match = /^ {10}"path": "([^"]+)",$/u.exec(line);
		pending = mode === "files" && match ? pins.get(match[1]) : undefined;
		previous.update(restored + "\n");
	}
	assert.equal(bytes, 102579190);
	assert.equal(current.digest("hex"), "745526bc0d4c5ec213274f12c269766fa31155344fae9cc02009aaae8353a605");
	assert.equal(previous.digest("hex"), "603f565ced92597ae077e66b735f57b7148346fcbd9ac13339b2752a9d2ecf66");
	assert.equal([...counts.values()].reduce((sum, count) => sum + count, 0), 37);
	for(const pin of pins.values())
	{
		assert.equal(counts.get(pin.path) ?? 0, pin.count);
		assert.equal(sha256(git(["show", `${predecessor}:${pin.path}`])), pin.previousSha256);
		assert.equal(sha256(git(["show", `${implementation}:${pin.path}`])), pin.currentSha256);
	}
});

test("Owned checked PHP-Wasm mixed coverage refuses unknown and altered transitions", async () => {
	const update = (await read()).updates.find(item => item.path !== "docs/type-surface.v1.json");
	const current = await sourceAtFinHistoryMilestone(update.path, update.currentSha256);
	for(const forged of [{ ...update, previousSha256: "0".repeat(64) }
		, { ...update, currentSha256: "0".repeat(64) }
		, { ...update, path: "unrelated.mjs" }, { ...update, edits: [] }
		, { ...update, edits: [...update.edits, update.edits[0]] }])
		assert.throws(() => reverseOwnedCheckedPhpWasmMixedCoverageUpdate(current, forged));
	assert.equal(beforeOwnedCheckedPhpWasmMixedCoverageSource(update.path, current + "unknown"), current + "unknown");
	assert.equal(beforeOwnedCheckedPhpWasmMixedCoverageSource("unrelated.mjs", current), current);
});

test("Owned checked PHP-Wasm mixed coverage writer refuses an unrelated checkout", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-owned-checked-php-wasm-mixed-coverage-history-guard-"));
	t.after(() => rm(root, { recursive: true }));
	const child = spawnSync(process.execPath, [resolve("scripts/update-owned-checked-php-wasm-mixed-coverage-source-history.mjs")]
		, { cwd: root, encoding: "utf8", timeout: 15_000 });
	assert.notEqual(child.status, 0);
	assert.equal(child.stdout, "");
	assert.deepEqual(await readdir(root), []);
});

test("Owned checked PHP-Wasm mixed coverage binds source qualification without claiming installed execution", async () => {
	const path = "docs/evidence/owned-checked-php-wasm-mixed-coverage-20261025.json";
	const evidence = JSON.parse(git(["show", `${implementation}:${path}`]));
	assert.equal(evidence.profile, "owned-checked-php-wasm-mixed-source-qualification");
	assert.equal(evidence.predecessorCommit, predecessor);
	assert.equal(evidence.sourceIdentity.kind, "pre-implementation-working-tree-bytes");
	assert.equal(evidence.sourceIdentity.files.length, 7);
	for(const item of evidence.sourceIdentity.files)
	{
		const source = git(["show", `${implementation}:${item.path}`]);
		assert.equal(Buffer.byteLength(source), item.bytes, item.path);
		assert.equal(sha256(source), item.sha256, item.path);
	}
	assert.equal(evidence.validation.focusedGeneratorsAndBoundary.pass, 4);
	assert.equal(evidence.validation.callerCompilation.resultOnlySelectionsUnchanged, 2);
	assert.equal(evidence.validation.acceptedRuntimeRuns, 0);
	assert.equal(evidence.validation.liveInventoryAudit.stalePins, 0);
	assert.equal(evidence.inventory.supportObservationsChanged, false);
	assert.equal(evidence.inventory.originalArchivesChanged, false);
	assert.equal(evidence.pending.length, 4);
	assert.match(evidence.scope, /not installed runtime or lifetime acceptance/u);
});

test("Owned checked PHP-Wasm mixed coverage preserves every result-only caller and shared Lean fixture", () => {
	const paths = ["tests/fixtures/onboarding/owned-checked-records"
		, "tests/helpers/owned-checked-record-mixed-fixture.mjs"
		, "tests/helpers/owned-checked-record-javascript-fixture.mjs"
		, "tests/fixtures/structured-types/owned-checked-record-result-only-php-wasm.php"];
	for(const path of paths)
		assert.equal(git(["rev-parse", `${predecessor}:${path}`])
			, git(["rev-parse", `${implementation}:${path}`]), path);
});

test("Owned checked PHP-Wasm mixed coverage writer cannot overwrite retained evidence", async () => {
	const before = await readFile(ownedCheckedPhpWasmMixedCoverageHistoryPath);
	const result = spawnSync(process.execPath, ["--max-old-space-size=512"
		, "scripts/update-owned-checked-php-wasm-mixed-coverage-source-history.mjs"]
	, { encoding: "utf8", timeout: 15_000 });
	assert.notEqual(result.status, 0);
	assert.deepEqual(await readFile(ownedCheckedPhpWasmMixedCoverageHistoryPath), before);
});
