/**
 * Keep browser generic promotion limited to the six observed signature cells.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { sha256 } from "../../src/capsule/node.mjs";
import { readTypeSurface, typeSurfaceCells } from "../../src/adoption/type-surface.mjs";
import { beforeFinRefinementSource } from "./fin-refinement-source-history.mjs";
import { beforeReviewedInstantiationArchiveSource } from "./reviewed-instantiation-archive-source-history.mjs";
import { beforeBrowserGenericPromotionSource, browserGenericPromotionChangedPaths, browserGenericPromotionHistoryPath, browserGenericPromotionPredecessor, reverseBrowserGenericPromotionUpdate } from "./browser-generic-promotion-source-history.mjs";
import { browserGenericCommandQualification, browserGenericEvidence, browserGenericEvidenceId, browserGenericObservation, browserGenericObservationId, browserGenericReceiptPath } from "./browser-generic-promotion.mjs";

test("browser generic promotion authenticates every source predecessor and rejects unknown edits", async () => {
	const record = JSON.parse(await readFile(browserGenericPromotionHistoryPath, "utf8"));
	assert.equal(record.predecessorCommit, browserGenericPromotionPredecessor);
	assert.deepEqual(record.updates.map(update => update.path), browserGenericPromotionChangedPaths);
	for(const update of record.updates)
	{
		const source = beforeReviewedInstantiationArchiveSource(update.path, await readFile(update.path, "utf8"));
		const restored = reverseBrowserGenericPromotionUpdate(source, update);
		assert.equal(sha256(restored), update.previousSha256);
		assert.equal(beforeBrowserGenericPromotionSource(update.path, source), restored);
		assert.equal(beforeBrowserGenericPromotionSource(update.path, source, update.currentSha256), source);
		assert.equal(beforeFinRefinementSource(update.path, source, update.previousSha256), restored);
		const changed = source + "\n// unrecorded change\n";
		assert.equal(beforeBrowserGenericPromotionSource(update.path, changed), changed);
		assert.throws(() => reverseBrowserGenericPromotionUpdate(changed, update));
		assert.throws(() => reverseBrowserGenericPromotionUpdate(source, { ...update, previousSha256: "0".repeat(64) }));
		assert.throws(() => reverseBrowserGenericPromotionUpdate(source, { ...update, edits: [...update.edits, update.edits[0]] }));
	}
});

test("browser generic promotion changes exactly six ordinary signature cells and no earlier claim", async () => {
	const path = "docs/type-surface.v1.json", source = beforeReviewedInstantiationArchiveSource(path, await readFile(path, "utf8"));
	const previous = JSON.parse(beforeBrowserGenericPromotionSource(path, source));
	const { document: live, ...contracts } = await readTypeSurface();
	const document = JSON.parse(source);
	assert.ok(live.observations.length >= document.observations.length);
	assert.deepEqual(document.observations.slice(0, previous.observations.length), previous.observations);
	assert.deepEqual(document.observations.slice(previous.observations.length), [browserGenericObservation()]);
	assert.equal(document.observations.at(-1).id, browserGenericObservationId);
	const evidence = await browserGenericEvidence();
	// The current factory qualifies its reproduction command; this test preserves the older wording.
	assert.ok(evidence.scope.endsWith(browserGenericCommandQualification));
	evidence.scope = evidence.scope.slice(0, -browserGenericCommandQualification.length);
	for(const file of evidence.files)
		file.sha256 = sha256(beforeReviewedInstantiationArchiveSource(file.path, await readFile(file.path, "utf8")));
	assert.deepEqual(document.evidence.slice(previous.evidence.length), [evidence]);
	const before = typeSurfaceCells(previous, contracts), after = typeSurfaceCells(document, contracts);
	assert.equal(before.length, after.length);
	const expected = ["browser-javascript", "browser-react", "browser-worker"].flatMap(profile =>
		["generic", "implicit"].map(shape => `${profile}/${shape}/ordinary-source/signature`));
	const changed = [];
	for(const [index, cell] of after.entries())
	{
		assert.equal(cell.id, before[index].id);
		if(!expected.includes(cell.id))
		{ assert.deepEqual(cell, before[index], cell.id); continue; }
		changed.push(cell.id);
		assert.equal(before[index].stages.installedExecution.state, "unreviewed");
		assert.equal(cell.observation, browserGenericObservationId);
		for(const stage of Object.values(cell.stages))
		{
			assert.equal(stage.state, "passed");
			assert.deepEqual(stage.evidence, [browserGenericEvidenceId]);
		}
	}
	assert.deepEqual(changed.sort(), expected.sort());
	const record = JSON.parse(await readFile(browserGenericPromotionHistoryPath, "utf8"));
	const updates = new Map(record.updates.map(update => [update.path, update]));
	let pins = 0;
	for(const entry of previous.evidence) for(const file of entry.files)
	{
		const update = updates.get(file.path);
		if(update && file.sha256 === update.previousSha256)
		{
			assert.equal(sha256(beforeReviewedInstantiationArchiveSource(file.path, await readFile(file.path, "utf8"))), update.currentSha256);
			file.sha256 = update.currentSha256; pins++;
		}
	}
	assert.equal(pins, 0);
	assert.deepEqual(document.evidence.slice(0, previous.evidence.length), previous.evidence);
	for(const key of Object.keys(previous).filter(key => !["evidence", "observations"].includes(key)))
		assert.deepEqual(document[key], previous[key], key);
});

test("browser generic support cites the executed ordinary archive without instance or reviewed claims", async () => {
	const { document } = await readTypeSurface();
	const evidence = document.evidence.find(entry => entry.id === browserGenericEvidenceId);
	const receiptBytes = await readFile(browserGenericReceiptPath), receipt = JSON.parse(receiptBytes);
	assert.equal(sha256(receiptBytes), "f2eff03b171e1ece40124a3bf59b66812ea3956ee3f1687e6c290e2ee3722279");
	assert.equal(evidence.revision, "a412a5a035c7569dd8e581364ba4deedd5a70c3d");
	assert.equal(receipt.producerEngine, "local");
	assert.match(evidence.command, /env -u LEAN_BRIDGE_LAKE_ENGINE LEAN_BRIDGE_GENERIC_RECORD_BROWSER_TEST=1/u);
	assert.equal(receipt.scope.executions, 12);
	assert.equal(receipt.scope.finiteFunctionSpecializations, 9);
	assert.deepEqual(evidence.artifacts.map(file => file.sha256).sort(), Object.values(receipt.identities.archives).sort());
	for(const record of [receipt.report, receipt.log, receipt.earlierFailure.log])
		assert.ok(evidence.files.some(file => file.path === record.path && file.sha256 === record.sha256));
	for(const file of receipt.sourceFiles)
		assert.equal(sha256(beforeFinRefinementSource(file.path, await readFile(file.path), file.sha256)), file.sha256, file.path);
	const fixture = await readFile("tests/fixtures/generic-record-specializations.lean", "utf8");
	assert.match(fixture, /def echo \{α : Type u\} \(value : α\) : α := value/u);
	const observation = document.observations.find(item => item.id === browserGenericObservationId);
	assert.deepEqual(observation.profiles, receipt.scope.profiles);
	assert.deepEqual(observation.shapes, ["generic", "implicit"]);
	assert.deepEqual(observation.positions, ["signature"]);
	assert.equal(observation.path, "ordinary-source");
	assert.match(observation.limitations.join(" "), /no instance dictionary/u);
	const guide = await readFile("docs/javascript-typescript.md", "utf8");
	assert.match(guide, /### Named generic specializations/u);
	assert.ok(guide.includes("evidence/generic-record-browser-20261008/receipt.json"));
	assert.doesNotMatch(guide, /Generic, inherited and dependent records are not supported/u);
});

test("the browser generic promotion updater refuses another HEAD before any write", async t => {
	const directory = await mkdtemp(join(tmpdir(), "lean-bridge-browser-generic-promotion-guard-"));
	t.after(() => rm(directory, { recursive: true, force: true }));
	const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("GIT_")));
	const git = args => execFileSync("git", args, { cwd: directory, stdio: "pipe", env });
	git(["init", "--quiet"]);
	git(["-c", "user.name=Test", "-c", "user.email=test@example.invalid", "-c", "commit.gpgsign=false", "commit", "--allow-empty", "--quiet", "-m", "unrelated revision"]);
	const result = spawnSync(process.execPath, [resolve("scripts/update-browser-generic-promotion-history.mjs")], { cwd: directory, encoding: "utf8", env });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /Browser generic promotion history is draft-only at its exact predecessor/u);
	assert.deepEqual(await readdir(directory), [".git"]);
});
