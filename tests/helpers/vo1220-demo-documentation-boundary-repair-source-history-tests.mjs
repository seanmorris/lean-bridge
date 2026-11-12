/**
 * Authenticate the demo documentation boundary repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import test from "node:test";
import {
	beforeVo1220DemoDocumentationBoundaryRepairSource
	, reverseVo1220DemoDocumentationBoundaryRepairUpdate
	, vo1220DemoDocumentationBoundaryRepairAddedPaths
	, vo1220DemoDocumentationBoundaryRepairHistoryPath
	, vo1220DemoDocumentationBoundaryRepairImplementation
	, vo1220DemoDocumentationBoundaryRepairImplementationPaths
	, vo1220DemoDocumentationBoundaryRepairIntegrationPaths
	, vo1220DemoDocumentationBoundaryRepairNormalizationPaths
	, vo1220DemoDocumentationBoundaryRepairPredecessor
} from "./vo1220-demo-documentation-boundary-repair-source-history.mjs";
import {
	beforeFinRefinementSource, finRefinementNormalizationPaths
} from "./fin-refinement-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone }
	from "./source-at-fin-history-milestone.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024
});
const sourceAt = (commit, path) => git(["show", `${commit}:${path}`]);
const record = async () => JSON.parse(await readFile(
	vo1220DemoDocumentationBoundaryRepairHistoryPath, "utf8"));
const fullDocumentationFiles = Object.freeze([
	"documentation.test.mjs", "consumer-guide-docs.test.mjs"
	, "contributing-docs.test.mjs", "lean-author-documentation.test.mjs"
	, "component-consumer-docs.test.mjs"
	, "documentation-demo-api.test.mjs", "reference-documentation.test.mjs"
	, "type-surface-docs.test.mjs"
]);

test("demo documentation boundary binds the complete inventory", async () => {
	const history = await record();
	assert.equal(history.schemaVersion, 1);
	assert.equal(history.milestone
		, "vo1220-demo-documentation-boundary-repair-v1");
	assert.equal(history.predecessorCommit
		, vo1220DemoDocumentationBoundaryRepairPredecessor);
	assert.equal(history.implementationCommit
		, vo1220DemoDocumentationBoundaryRepairImplementation);
	assert.deepEqual(history.sourceInventory, {
		revision: vo1220DemoDocumentationBoundaryRepairPredecessor
		, evidence: 900, occurrences: 369393, paths: 123815
		, objects: 20975, bytes: 27250476050, mismatches: 0
	});
	assert.deepEqual(history.localValidation, {
		demoDocumentation: { passed: 78, failed: 0, skipped: 3 }
		, focusedCheckout: { passed: 2, failed: 0 }
		, scopedLint: "passed", checkedJavaScriptTypecheck: "passed"
	});
	assert.equal(history.refreshedPins, 50);
	assert.deepEqual(history.refreshedSourcePaths
		, ["package.json", "tests/documentation.test.mjs"]);
	assert.equal(history.remainingMismatches, 0);
	assert.deepEqual(history.updates.map(update => update.path)
		, vo1220DemoDocumentationBoundaryRepairImplementationPaths);
	assert.deepEqual(history.integrationUpdates.map(update => update.path)
		, vo1220DemoDocumentationBoundaryRepairIntegrationPaths);
});

test("demo checks current docs while authority lanes retain history", () => {
	const previous = sourceAt(vo1220DemoDocumentationBoundaryRepairPredecessor
		, ".github/workflows/demos-pages.yml");
	const current = sourceAt(vo1220DemoDocumentationBoundaryRepairImplementation
		, ".github/workflows/demos-pages.yml");
	assert.doesNotMatch(previous
		, /LEAN_BRIDGE_DOCUMENTATION_SPARSE_CHECKOUT/u);
	assert.match(previous, /run: npm run test:docs\n/u);
	assert.match(current
		, /Free hosted runner disk before bounded documentation checkout/u);
	assert.match(current
		, /fetch-depth: 1\n\s+filter: blob:none[\s\S]*?sparse-checkout-cone-mode: false/u);
	assert.match(current
		, /LEAN_BRIDGE_RETAINED_CONTRACTS: deferred\n\s+run: npm run test:docs:demo/u);
	const consumer = sourceAt(vo1220DemoDocumentationBoundaryRepairImplementation
		, ".github/workflows/consumer-matrix.yml");
	const manifest = source => /^ {2}LEAN_BRIDGE_DOCUMENTATION_SPARSE_CHECKOUT: \|\n(?<body>(?: {4}.*\n)+)/mu
		.exec(source)?.groups?.body;
	assert.ok(manifest(current));
	assert.equal(manifest(current), manifest(consumer));
	const packageDocument = JSON.parse(sourceAt(
		vo1220DemoDocumentationBoundaryRepairImplementation, "package.json"));
	for(const path of fullDocumentationFiles)
		assert.match(packageDocument.scripts["test:docs"]
			, new RegExp(`tests/${path.replaceAll(".", "\\.")}`, "u"), path);
	for(const path of fullDocumentationFiles.slice(0, -1))
		assert.match(packageDocument.scripts["test:docs:demo"]
			, new RegExp(`tests/${path.replaceAll(".", "\\.")}`, "u"), path);
	assert.doesNotMatch(packageDocument.scripts["test:docs:demo"]
		, /type-surface-docs\.test\.mjs/u);
	for(const [path, patterns] of new Map([
		["tests/documentation.test.mjs", [
			/registerRetainedContractTests/u, /retainedTest\("consumer CI history/u
		]]
		, ["tests/lean-author-documentation.test.mjs", [
			/registerRetainedContractTests/u
			, /retainedTest\("the checked-record author table/u
		]]
		, ["tests/reference-documentation.test.mjs", [
			/retainedContractScope/u, /retainedTest\('generated references/u
		]]
	])) {
		const source = sourceAt(
			vo1220DemoDocumentationBoundaryRepairImplementation, path);
		for(const pattern of patterns) assert.match(source, pattern, path);
	}
});

test("demo documentation boundary reverses every transition", async () => {
	const history = await record();
	for(const update of history.updates)
	{
		const current = sourceAt(
			vo1220DemoDocumentationBoundaryRepairImplementation, update.path);
		const previous = sourceAt(
			vo1220DemoDocumentationBoundaryRepairPredecessor, update.path);
		assert.equal(reverseVo1220DemoDocumentationBoundaryRepairUpdate(
			current, update), previous, update.path);
		assert.equal(beforeVo1220DemoDocumentationBoundaryRepairSource(
			update.path, current, update.previousSha256), previous, update.path);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous, update.path);
	}
	for(const update of history.integrationUpdates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256);
		const previous = sourceAt(
			vo1220DemoDocumentationBoundaryRepairImplementation, update.path);
		assert.equal(reverseVo1220DemoDocumentationBoundaryRepairUpdate(
			current, update), previous, update.path);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous, update.path);
	}
	for(const path of vo1220DemoDocumentationBoundaryRepairNormalizationPaths)
		assert.ok(finRefinementNormalizationPaths.includes(path), path);
});

test("demo documentation boundary history rejects forgeries and duplicate writers", async t => {
	const history = await record();
	assert.deepEqual(history.additions.map(addition => addition.path)
		, vo1220DemoDocumentationBoundaryRepairAddedPaths);
	for(const addition of history.additions)
		assert.equal(sha256(await sourceAtFinHistoryMilestone(
			addition.path, addition.sha256)), addition.sha256, addition.path);
	const update = history.updates[0];
	const current = sourceAt(
		vo1220DemoDocumentationBoundaryRepairImplementation, update.path);
	for(const forged of [
		{ ...update, currentSha256: "0".repeat(64) }
		, { ...update, previousSha256: "0".repeat(64) }
		, { ...update, path: "unknown.mjs" }, { ...update, edits: [] }
	]) assert.throws(() =>
		reverseVo1220DemoDocumentationBoundaryRepairUpdate(current, forged));
	const root = await mkdtemp(`${tmpdir()}/vo1220-demo-doc-boundary-`);
	t.after(() => rm(root, { recursive: true }));
	const duplicate = spawnSync(process.execPath, [resolve(
		"scripts/update-vo1220-demo-documentation-boundary-repair-source-history.mjs"
	)], { cwd: root, encoding: "utf8", timeout: 15_000 });
	assert.notEqual(duplicate.status, 0);
	assert.equal(duplicate.stdout, "");
	assert.deepEqual(await readdir(root), []);
});
