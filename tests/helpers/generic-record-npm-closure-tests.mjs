/**
 * Bound hosted npm closure to the original record slice and preserve every unrelated observation.
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
import { beforePerlRefinementHostedSource } from "./perl-refinement-hosted-source-history.mjs";
import { beforeGenericNpmClosureSource, genericNpmClosureChangedPaths, genericNpmClosureHistoryPath, genericNpmClosurePredecessor, reverseGenericNpmClosureUpdate } from "./generic-record-npm-closure-source-history.mjs";
import { genericNpmClosureCells, genericNpmClosureEvidence, genericNpmEvidenceId, reconcileGenericNpmEarlierEvidence, reconcileGenericNpmObservations } from "./generic-record-npm-closure.mjs";

test("hosted npm closure retains exact predecessors and refuses unknown edits", async () => {
	const history = JSON.parse(await readFile(genericNpmClosureHistoryPath));
	assert.equal(history.schemaVersion, 1); assert.equal(history.milestone, "generic-record-npm-closure-v1");
	assert.equal(history.predecessorCommit, genericNpmClosurePredecessor);
	assert.deepEqual(history.updates.map(update => update.path), genericNpmClosureChangedPaths);
	for(const update of history.updates)
	{
		const source = beforePerlRefinementHostedSource(update.path, await readFile(update.path, "utf8")), previous = reverseGenericNpmClosureUpdate(source, update);
		assert.equal(sha256(previous), update.previousSha256);
		assert.equal(beforeGenericNpmClosureSource(update.path, source), previous);
		assert.equal(beforeFinRefinementSource(update.path, source, update.previousSha256), previous);
		assert.equal(beforeGenericNpmClosureSource(update.path, source, update.currentSha256), source);
		assert.equal(beforeFinRefinementSource(update.path, source), beforeFinRefinementSource(update.path, previous));
		const changed = source + "\n// unrecorded change\n";
		assert.equal(beforeGenericNpmClosureSource(update.path, changed), changed);
		assert.throws(() => reverseGenericNpmClosureUpdate(changed, update));
		assert.throws(() => reverseGenericNpmClosureUpdate(source, { ...update, previousSha256: "0".repeat(64) }));
		assert.throws(() => reverseGenericNpmClosureUpdate(source, { ...update, path: "unknown.mjs" }));
		assert.throws(() => reverseGenericNpmClosureUpdate(source, { ...update, edits: [...update.edits, update.edits[0]] }));
	}
});

test("hosted npm reconciliation changes exactly twelve ordinary Node scopes and no stage states", async () => {
	const contracts = await readTypeSurface();
	const path = "docs/type-surface.v1.json";
	const document = JSON.parse(beforePerlRefinementHostedSource(path, await readFile(path, "utf8")));
	const previous = JSON.parse(beforeGenericNpmClosureSource(path, await readFile(path, "utf8")));
	assert.deepEqual(document.observations, reconcileGenericNpmObservations(previous.observations));
	const before = typeSurfaceCells(previous, contracts), after = typeSurfaceCells(document, contracts), changed = [];
	assert.equal(after.length, 6732); assert.equal(before.length, after.length);
	for(const [index, cell] of after.entries())
	{
		const prior = before[index];
		assert.equal(cell.id, prior.id);
		if(!genericNpmClosureCells.includes(cell.id))
		{ assert.deepEqual(cell, prior, cell.id); continue; }
		changed.push(cell.id);
		assert.deepEqual(cell.hostType, prior.hostType);
		for(const [stage, value] of Object.entries(cell.stages))
		{
			assert.equal(value.state, prior.stages[stage].state); assert.equal(value.state, "passed");
			if(cell.shape === "instance") assert.deepEqual(value.evidence, ["npm-finite-specializations-installed"]);
			else assert.ok(value.evidence.includes(genericNpmEvidenceId));
		}
	}
	assert.deepEqual(changed.sort(), [...genericNpmClosureCells].sort());
	assert.equal(changed.length, 12);
	const history = JSON.parse(await readFile(genericNpmClosureHistoryPath));
	const expected = structuredClone(previous.evidence);
	for(const entry of expected) for(const file of entry.files)
	{
		const update = history.updates.find(item => item.path === file.path && item.previousSha256 === file.sha256);
		if(update) file.sha256 = update.currentSha256;
	}
	const hosted = await genericNpmClosureEvidence();
	for(const file of hosted.files)
		file.sha256 = sha256(beforePerlRefinementHostedSource(file.path, await readFile(file.path, "utf8")));
	assert.deepEqual(document.evidence, [...reconcileGenericNpmEarlierEvidence(expected), hosted]);
	for(const key of Object.keys(previous).filter(key => !["observations", "evidence"].includes(key)))
		assert.deepEqual(document[key], previous[key]);
	assert.equal(document.observations.length, previous.observations.length + 1);
	assert.equal(document.evidence.length, previous.evidence.length + 1);
});

test("the hosted generic record echo has no instance binder and cannot replace instance evidence", async () => {
	const { document } = await readTypeSurface();
	const instances = document.observations.find(item => item.id === "npm-finite-specializations-ordinary-source");
	const records = document.observations.find(item => item.id === "npm-record-specializations-ordinary-source");
	assert.deepEqual(instances.shapes, ["instance"]); assert.deepEqual(records.shapes, ["generic", "implicit"]);
	for(const value of Object.values(instances.stages)) assert.deepEqual(value.evidence, ["npm-finite-specializations-installed"]);
	const source = await readFile("tests/fixtures/generic-record-specializations.lean", "utf8");
	assert.match(source, /def echo \{α : Type u\} \(value : α\) : α := value/u);
	assert.doesNotMatch(source, /def echo[^\n]*\[/u);
	assert.match(records.scope, /contains no instance binder/u);
	const evidence = document.evidence.find(item => item.id === genericNpmEvidenceId);
	assert.equal(evidence.revision, "f9d5ce96eb04ec800209c6a6863092b3bdea6e85");
	assert.equal(evidence.artifacts.length, 4);
	assert.match(evidence.scope, /not a complete dependency closure/u);
	assert.match(evidence.scope, /does not establish the whole workflow, browser or reviewed-IR acceptance, instance dictionaries/u);
});

test("earlier npm originals remain exact while current isolation claims distinguish retained inputs", async () => {
	const { document } = await readTypeSurface();
	for(const id of ["npm-generic-records-installed", "generic-record-specialized-npm-installed"])
	{
		const entry = document.evidence.find(item => item.id === id);
		assert.match(entry.scope, /not deletion-before-install or compiler-free evidence/u);
		assert.match(entry.scope, /Original archived bytes remain unchanged/u);
	}
	assert.equal(sha256(await readFile("docs/evidence/generic-record-specializations-20261007/specialized-npm.json")), "6823785a955b34446c8ad254afb6113cdbcbfc8c1da2c7c6d7ca3c48394a0c07");
	assert.equal(sha256(await readFile("docs/evidence/generic-record-specializations-20261007/specialized-c-cpp-python.json")), "7d5fc9f6329a8890c286cc44a391ebc141ec4f6cd273c480414ad256232a3f9e");
	const native = JSON.parse(await readFile("docs/evidence/generic-record-specializations-20261007/specialized-c-cpp-python.json"));
	assert.equal(native.reproducible, true);
	for(const [profile, checks] of [["c", 1029], ["cpp", 1024]])
	{
		const report = native.reports.find(item => item.profile === profile);
		assert.equal(report.checks, checks); assert.equal(report.specializations.length, 9);
		for(const flag of ["sourceRemovedBeforeInstallation", "offlineInstall", "compilerFreePath"]) assert.equal(report[flag], true);
	}
});

test("hosted npm reconciliation refuses duplicate, redirected and unpassed baselines", async () => {
	const path = "docs/type-surface.v1.json", previous = JSON.parse(beforeGenericNpmClosureSource(path, await readFile(path, "utf8")));
	for(const mutate of [
		values => { values.push({ id: "npm-record-specializations-ordinary-source" }); }
		, values => { values.find(item => item.id === "npm-finite-specializations-ordinary-source").profiles.push("browser-javascript"); }
		, values => { values.find(item => item.id === "npm-finite-specializations-ordinary-source").shapes.push("fin"); }
		, values => { values.find(item => item.id === "npm-records-ordinary-source-inherited").path = "reviewed-ir"; }
		, values => { values.find(item => item.id === "npm-records-ordinary-source-inherited").stages.installedExecution.state = "not-run"; }
	]) {
		const changed = structuredClone(previous.observations); mutate(changed);
		assert.throws(() => reconcileGenericNpmObservations(changed), assert.AssertionError);
	}
});

test("consumer and author docs cite the hosted ordinary npm archive and its exact isolation", async () => {
	for(const path of ["docs/javascript-typescript.md", "docs/lean/existing-package.md"])
	{
		const source = await readFile(path, "utf8");
		assert.match(source, /generic-record-npm-hosted-20261008\/receipt\.json/u);
		assert.match(source, /Node-only|without compilers on its PATH/u);
		assert.match(source, /1010[\s\S]*1019/u);
		assert.match(source, /instance dictionary/u);
	}
});

test("the hosted npm closure updater refuses a different HEAD before writing", async t => {
	const directory = await mkdtemp(join(tmpdir(), "lean-bridge-npm-closure-guard-"));
	t.after(() => rm(directory, { recursive: true, force: true }));
	const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("GIT_")));
	const git = args => execFileSync("git", args, { cwd: directory, stdio: "pipe", env });
	git(["init", "--quiet"]);
	git(["-c", "user.name=Test", "-c", "user.email=test@example.invalid", "-c", "commit.gpgsign=false", "commit", "--allow-empty", "--quiet", "-m", "unrelated revision"]);
	const result = spawnSync(process.execPath, [resolve("scripts/update-generic-record-npm-closure-history.mjs")], { cwd: directory, encoding: "utf8", env });
	assert.equal(result.status, 1); assert.match(result.stderr, /Hosted npm closure history is draft-only/u);
	assert.deepEqual(await readdir(directory), [".git"]);
});
