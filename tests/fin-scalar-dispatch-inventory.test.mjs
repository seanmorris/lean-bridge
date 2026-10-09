/**
 * Keep scalar counter evidence attached only to its measured callers and source routes.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { sha256 } from "../src/capsule/node.mjs";
import { readTypeSurface, typeSurfaceCells } from "../src/adoption/type-surface.mjs";
import { classifyRepositoryTest } from "../src/adoption/test-profiles.mjs";
import { beforeFinRefinementSource } from "./helpers/fin-refinement-source-history.mjs";
import { finDispatchReferences, finDispatchSelectionIds } from "./helpers/fin-dispatch-references.mjs";
import { assertFinScalarDispatchInventory, scalarDispatchObservationIds, supplementFinScalarDispatchInventory } from "./helpers/fin-scalar-dispatch-inventory.mjs";
import { beforeFinScalarDispatchInventorySource, finScalarDispatchInventoryChangedPaths, finScalarDispatchInventoryHistoryPath, finScalarDispatchInventoryPredecessor, reverseFinScalarDispatchInventoryUpdate } from "./helpers/fin-scalar-dispatch-inventory-source-history.mjs";

const snapshot = async () => {
	const current = JSON.parse(await readFile("docs/type-surface.v1.json", "utf8"));
	const previous = JSON.parse(beforeFinScalarDispatchInventorySource("docs/type-surface.v1.json", JSON.stringify(current, null, 2) + "\n"));
	const history = JSON.parse(await readFile(finScalarDispatchInventoryHistoryPath));
	const references = await finDispatchReferences();
	const expected = await supplementFinScalarDispatchInventory(previous, references);
	let pins = 0;
	for(const entry of expected.evidence.slice(0, previous.evidence.length)) for(const file of entry.files)
	{
		const update = history.updates.find(update => update.path === file.path && update.previousSha256 === file.sha256);
		if(update)
		{ file.sha256 = update.currentSha256; pins++; }
	}
	return { current, previous, history, references, expected, pins };
};

test("scalar dispatch inventory authenticates every complete predecessor and refuses unknown changes", async () => {
	const record = JSON.parse(await readFile(finScalarDispatchInventoryHistoryPath));
	assert.equal(record.schemaVersion, 1); assert.equal(record.milestone, "fin-scalar-dispatch-inventory-v1");
	assert.equal(record.predecessorCommit, finScalarDispatchInventoryPredecessor);
	assert.deepEqual(record.updates.map(update => update.path), finScalarDispatchInventoryChangedPaths);
	for(const update of record.updates)
	{
		const source = await readFile(update.path, "utf8"), previous = reverseFinScalarDispatchInventoryUpdate(source, update);
		assert.equal(sha256(previous), update.previousSha256);
		assert.equal(beforeFinScalarDispatchInventorySource(update.path, source), previous);
		assert.equal(beforeFinRefinementSource(update.path, source, update.previousSha256), previous);
		assert.equal(beforeFinScalarDispatchInventorySource(update.path, source, update.currentSha256), source);
		assert.equal(beforeFinRefinementSource(update.path, source), beforeFinRefinementSource(update.path, previous));
		const changed = source + "\n// unknown edit\n";
		assert.equal(beforeFinScalarDispatchInventorySource(update.path, changed), changed);
		assert.throws(() => reverseFinScalarDispatchInventoryUpdate(changed, update));
		assert.throws(() => reverseFinScalarDispatchInventoryUpdate(source, { ...update, previousSha256: "0".repeat(64) }));
		assert.throws(() => reverseFinScalarDispatchInventoryUpdate(source, { ...update, path: "unknown.mjs" }));
		assert.throws(() => reverseFinScalarDispatchInventoryUpdate(source, { ...update, edits: [...update.edits, update.edits[0]] }));
	}
});

test("twelve scalar entries supplement exactly eleven observations without changing older evidence claims", async () => {
	const { current, previous, expected, references, pins } = await snapshot();
	assert.deepEqual(current, expected);
	assert.equal(previous.evidence.length, 272); assert.equal(current.evidence.length, 284);
	assert.equal(previous.observations.length, 497); assert.equal(current.observations.length, 497);
	assert.equal(pins, 129);
	assert.deepEqual(current.evidence.slice(272).map(entry => entry.id), finDispatchSelectionIds);
	const changed = [];
	for(const [index, old] of previous.observations.entries())
	{
		const now = current.observations[index];
		if(!scalarDispatchObservationIds.includes(old.id))
		{ assert.deepEqual(now, old); continue; }
		changed.push(now.id);
		for(const key of ["id", "profiles", "shapes", "positions", "path", "hostTypes", "conversionNotes"]) assert.deepEqual(now[key], old[key]);
		for(const [name, stage] of Object.entries(now.stages))
		{
			assert.equal(stage.state, old.stages[name].state);
			if(name !== "installedExecution") assert.deepEqual(stage.evidence, old.stages[name].evidence);
			else
			{
				const selected = references.filter(ref => now.profiles.includes(ref.caller) && now.path === ref.sourcePath);
				assert.deepEqual(stage.evidence, [...old.stages[name].evidence, ...selected.map(ref => ref.id)]);
			}
		}
		assert.ok(now.limitations.some(note => note.includes("These measurements do not cover containers")));
		assert.ok(!now.limitations.some(note => /^(Dispatch is not counted|Ordinary Ruby dispatch is not counted)/u.test(note)));
	}
	assert.deepEqual(changed.sort(), [...scalarDispatchObservationIds].sort());
	const { document: unused, ...contracts } = await readTypeSurface();
	void unused;
	const states = inventory => typeSurfaceCells(inventory, contracts).map(cell => [cell.id, Object.fromEntries(Object.entries(cell.stages).map(([key, value]) => [key, value.state]))]);
	assert.deepEqual(states(current), states(previous), "no promoted support cells");
});

test("each inventory selection retains its original report, caller, command, environment and measured scope", async () => {
	const { current, references } = await snapshot();
	for(const reference of references)
	{
		const entry = current.evidence.find(entry => entry.id === reference.id);
		assert.equal(entry.kind, "installed"); assert.equal(entry.revision, reference.revision); assert.equal(entry.command, reference.command);
		for(const claim of [reference.scope, reference.environment, reference.instrument, `${reference.checks} public checks`, reference.consumerSha256, reference.probeSha256]) assert.ok(entry.scope.includes(claim));
		for(const file of [reference.receipt, reference.report]) assert.ok(entry.files.some(pin => pin.path === file.path && pin.sha256 === file.sha256));
		for(const file of entry.files) assert.equal(sha256(await readFile(file.path)), file.sha256, file.path);
		const report = JSON.parse(await readFile(reference.report.path));
		assert.deepEqual(entry.artifacts, Object.entries(report.archives).map(([path, sha256]) => ({ path: `${reference.id}/${path}`, sha256 })));
	}
	for(const root of ["fin-dispatch-references", "fin-scalar-dispatch-inventory"]) assert.equal(classifyRepositoryTest(`tests/${root}.test.mjs`), "contract");
});

test("the exact supplement refuses widened, relabeled or historical inventory claims", async () => {
	const { current, previous, history, references } = await snapshot();
	const target = value => value.observations.find(item => item.id === "native-fin-jvm-ordinary-source");
	const mutations = [
		value => { value.evidence.at(-1).scope += " Hosted CI passed."; }
		, value => { value.evidence.at(-1).command = "node invented.mjs"; }
		, value => { value.evidence.at(-1).files[0].sha256 = "0".repeat(64); }
		, value => { value.evidence[0].scope += " Changed historical claim."; }
		, value => { value.evidence.pop(); }
		, value => { value.evidence.push(structuredClone(value.evidence.at(-1))); }
		, value => { target(value).positions.push("field"); }
		, value => { target(value).profiles.push("perl"); }
		, value => { target(value).stages.installedExecution.state = "limited"; }
		, value => { target(value).stages.installedExecution.evidence.reverse(); }
		, value => { target(value).stages.analysis.evidence.push(value.evidence.at(-1).id); }
		, value => { value.observations.push(structuredClone(target(value))); }
		, value => { value.observations[0].scope += " Unrelated edit."; }
	];
	for(const mutate of mutations)
	{
		const copy = structuredClone(current); mutate(copy);
		await assert.rejects(() => assertFinScalarDispatchInventory(copy, previous, references, history.updates));
	}
	assert.equal(previous.evidence.length, 272);
});

test("both scalar inventory updaters refuse another HEAD before writing", async t => {
	const directory = await mkdtemp(join(tmpdir(), "lean-bridge-scalar-dispatch-inventory-guard-"));
	t.after(() => rm(directory, { recursive: true, force: true }));
	const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("GIT_")));
	const git = args => execFileSync("git", args, { cwd: directory, stdio: "pipe", env });
	git(["init", "--quiet"]);
	git(["-c", "user.name=Test", "-c", "user.email=test@example.invalid", "-c", "commit.gpgsign=false", "commit", "--allow-empty", "--quiet", "-m", "unrelated revision"]);
	for(const script of ["supplement-fin-scalar-dispatch-evidence", "update-fin-scalar-dispatch-inventory-history"])
	{
		const result = spawnSync(process.execPath, [resolve(`scripts/${script}.mjs`)], { cwd: directory, encoding: "utf8", env });
		assert.equal(result.status, 1); assert.match(result.stderr, /[Ss]calar dispatch inventory.*draft-only/u);
		assert.deepEqual(await readdir(directory), [".git"]);
	}
});
