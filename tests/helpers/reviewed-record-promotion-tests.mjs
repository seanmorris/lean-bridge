/**
 * Limit reviewed record reconciliation to its eight observed signatures and exact installed evidence.
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
import { beforeReviewedRecordPromotionSource, reviewedRecordPromotionChangedPaths, reviewedRecordPromotionHistoryPath, reviewedRecordPromotionPredecessor, reverseReviewedRecordPromotionUpdate } from "./reviewed-record-promotion-source-history.mjs";
import { reconcileReviewedRecordObservations, reviewedRecordEvidence, reviewedRecordHosts, reviewedRecordReceiptPath } from "./reviewed-record-promotion.mjs";
import { browserGenericCommandQualification, browserGenericEvidence, browserGenericEvidenceId } from "./browser-generic-promotion.mjs";
import { assertReviewedInstantiationArchive } from "./reviewed-instantiation-evidence.mjs";

test("reviewed record promotion authenticates predecessors and refuses unknown source edits", async () => {
	const history = JSON.parse(await readFile(reviewedRecordPromotionHistoryPath, "utf8"));
	assert.equal(history.predecessorCommit, reviewedRecordPromotionPredecessor);
	assert.deepEqual(history.updates.map(update => update.path), reviewedRecordPromotionChangedPaths);
	for(const update of history.updates)
	{
		const source = await readFile(update.path, "utf8"), previous = reverseReviewedRecordPromotionUpdate(source, update);
		assert.equal(sha256(previous), update.previousSha256);
		assert.equal(beforeReviewedRecordPromotionSource(update.path, source), previous);
		assert.equal(beforeFinRefinementSource(update.path, source, update.previousSha256), previous);
		assert.equal(beforeReviewedRecordPromotionSource(update.path, source, update.currentSha256), source);
		const changed = source + "\n// unrecorded edit\n";
		assert.equal(beforeReviewedRecordPromotionSource(update.path, changed), changed);
		assert.throws(() => reverseReviewedRecordPromotionUpdate(changed, update));
		assert.throws(() => reverseReviewedRecordPromotionUpdate(source, { ...update, previousSha256: "0".repeat(64) }));
		assert.throws(() => reverseReviewedRecordPromotionUpdate(source, { ...update, edits: [...update.edits, update.edits[0]] }));
	}
});

test("reviewed record reconciliation extends eight signatures and leaves every instance and browser cell intact", async () => {
	const { document, ...contracts } = await readTypeSurface();
	const path = "docs/type-surface.v1.json";
	const previous = JSON.parse(beforeReviewedRecordPromotionSource(path, await readFile(path, "utf8")));
	assert.deepEqual(document.observations, reconcileReviewedRecordObservations(previous.observations));
	const before = typeSurfaceCells(previous, contracts), after = typeSurfaceCells(document, contracts);
	const expected = ["c", "cpp", "node-javascript", "node-typescript"].flatMap(profile =>
		["generic", "implicit"].map(shape => `${profile}/${shape}/reviewed-ir/signature`));
	const changed = [];
	assert.equal(before.length, after.length);
	for(const [index, cell] of after.entries())
	{
		const prior = before[index];
		assert.equal(cell.id, prior.id);
		if(!expected.includes(cell.id))
{ assert.deepEqual(cell, prior, cell.id); continue; }
		changed.push(cell.id);
		const ids = ["c", "cpp"].includes(cell.profile) ? reviewedRecordHosts.native : reviewedRecordHosts.npm;
		assert.equal(cell.observation, ids.observation);
		assert.ok(cell.scope.startsWith(prior.scope));
		assert.match(cell.scope, /nine specializations of echo/u);
		for(const [stage, value] of Object.entries(cell.stages))
		{
			assert.equal(value.state, prior.stages[stage].state);
			assert.equal(value.state, "passed");
			assert.deepEqual(value.evidence, [...prior.stages[stage].evidence, ids.evidence]);
		}
		assert.match(cell.limitations.join(" "), /no instance dictionary/u);
		assert.match(cell.limitations.join(" "), /No hosted CI/u);
	}
	assert.deepEqual(changed.sort(), expected.sort());
	const history = JSON.parse(await readFile(reviewedRecordPromotionHistoryPath, "utf8"));
	const updates = new Map(history.updates.map(update => [update.path, update]));
	for(const entry of previous.evidence) for(const file of entry.files)
	{
		const update = updates.get(file.path);
		if(update && file.sha256 === update.previousSha256) file.sha256 = update.currentSha256;
	}
	previous.evidence.find(entry => entry.id === browserGenericEvidenceId).scope += browserGenericCommandQualification;
	assert.deepEqual(document.evidence.slice(0, previous.evidence.length), previous.evidence);
	assert.deepEqual(document.evidence.slice(previous.evidence.length), await reviewedRecordEvidence());
	for(const key of Object.keys(previous).filter(key => !["observations", "evidence"].includes(key)))
		assert.deepEqual(document[key], previous[key]);
	assert.equal(document.observations.length, previous.observations.length + 2);
	assert.equal(document.evidence.length, previous.evidence.length + 2);
});

test("reviewed record evidence retains exact artifacts, source attribution limits and reproducible selectors", async () => {
	const receiptBytes = await readFile(reviewedRecordReceiptPath), receipt = JSON.parse(receiptBytes);
	assert.equal(sha256(receiptBytes), "3cc7ab64f600c37c5c85705a24f64c41ebe1569f20470ec27173f56495b811e9");
	await assertReviewedInstantiationArchive(receipt);
	const { document } = await readTypeSurface();
	const testSource = await readFile("tests/reviewed-instantiations.test.mjs", "utf8");
	const testNames = [...testSource.matchAll(/^test\("([^"]+)"/gmu)].map(match => match[1]);
	for(const [host, ids] of Object.entries(reviewedRecordHosts))
	{
		const entry = document.evidence.find(item => item.id === ids.evidence);
		assert.equal(entry.revision, receipt.producers[host].revision);
		assert.match(entry.scope, /fresh-Lean log has no original queue or revision record/u);
		assert.match(entry.scope, /\/app\/build\/lean-link-spike\/lazy and build\/lean-runtime/u);
		assert.match(entry.scope, /No new instance-dictionary, reviewed-browser, hosted CI/u);
		assert.equal(entry.artifacts.length, 4);
		for(const kind of ["direct", "composed"])
		{
			const name = `${host}-${kind}.json`, report = JSON.parse(await readFile(`docs/evidence/reviewed-instantiations-20261008/${name}`));
			const hashes = host === "native" ? Object.values(report.archives) : [report.archiveSha256, report.runtimeArchiveSha256];
			assert.deepEqual(entry.artifacts.filter(file => file.path.includes(`/${kind}/`)).map(file => file.sha256), hashes);
		}
		const pattern = /--test-name-pattern='([^']+)'/u.exec(entry.command);
		assert.ok(pattern);
		const selected = testNames.filter(name => new RegExp(pattern[1], "u").test(name));
		assert.equal(selected.length, 2);
		assert.ok(selected.every(name => host === "npm" ? name.includes("npm") : name.includes("C and C++")));
		assert.ok(new RegExp(pattern[1], "u").test(selected[0]));
		assert.ok(!new RegExp(pattern[1], "u").test(selected[0] + " extra"));
		assert.match(entry.command, host === "native" ? /LEAN_BRIDGE_REVIEWED_INSTANTIATION_PROFILES=c,cpp/u : /LEAN_BRIDGE_REVIEWED_INSTANTIATION_NPM_TEST=1/u);
	}
	const browser = document.evidence.find(entry => entry.id === browserGenericEvidenceId);
	assert.deepEqual(browser, await browserGenericEvidence());
	assert.ok(browser.scope.endsWith(browserGenericCommandQualification));
	for(const path of ["docs/javascript-typescript.md", "docs/consume/c.md", "docs/consume/cpp.md"])
		assert.ok((await readFile(path, "utf8")).includes("evidence/reviewed-instantiations-20261008/receipt.json"), path);
});

test("reviewed record promotion refuses duplicate, redirected or broadened baseline observations", async () => {
	const path = "docs/type-surface.v1.json", previous = JSON.parse(beforeReviewedRecordPromotionSource(path, await readFile(path, "utf8")));
	for(const mutate of [
		values => { values.find(item => item.id === reviewedRecordHosts.native.original).shapes = ["generic", "implicit"]; }
		, values => { values.find(item => item.id === reviewedRecordHosts.native.original).profiles.push("ruby"); }
		, values => { values.find(item => item.id === reviewedRecordHosts.native.original).path = "ordinary-source"; }
		, values => { values.push({ id: reviewedRecordHosts.native.observation }); }
	]){
		const changed = structuredClone(previous.observations);
		mutate(changed);
		assert.throws(() => reconcileReviewedRecordObservations(changed));
	}
});

test("the reviewed record promotion updater refuses another HEAD before writing", async t => {
	const directory = await mkdtemp(join(tmpdir(), "lean-bridge-reviewed-record-promotion-guard-"));
	t.after(() => rm(directory, { recursive: true, force: true }));
	const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("GIT_")));
	const git = args => execFileSync("git", args, { cwd: directory, stdio: "pipe", env });
	git(["init", "--quiet"]);
	git(["-c", "user.name=Test", "-c", "user.email=test@example.invalid", "-c", "commit.gpgsign=false", "commit", "--allow-empty", "--quiet", "-m", "unrelated revision"]);
	const result = spawnSync(process.execPath, [resolve("scripts/update-reviewed-record-promotion-history.mjs")], { cwd: directory, encoding: "utf8", env });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /Reviewed record promotion history is draft-only at its exact predecessor/u);
	assert.deepEqual(await readdir(directory), [".git"]);
});
