/**
 * Keep the hosted Perl scalar promotion tied to its four actual ABIs and two source routes.
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
import { classifyRepositoryTest } from "../src/adoption/test-profiles.mjs";
import { readTypeSurface } from "../src/adoption/type-surface.mjs";
import { beforeFinRefinementSource } from "./helpers/fin-refinement-source-history.mjs";
import { assertPerlScalarPromotion, perlScalarEvidenceIds, perlScalarOrdinaryId, perlScalarReviewedId, promotePerlScalarInventory, promotePerlScalarObservations } from "./helpers/perl-scalar-promotion.mjs";
import { beforePerlScalarPromotionSource, perlScalarPromotionChangedPaths, perlScalarPromotionHistoryPath, perlScalarPromotionPredecessor, reversePerlScalarPromotionUpdate } from "./helpers/perl-scalar-promotion-source-history.mjs";
import { beforeWasmEntrySupplementSource, wasmEntrySupplementChangedPaths } from "./helpers/wasm-entry-supplement-source-history.mjs";
import { arrayRolloutChangedPaths } from "./helpers/generic-record-array-rollout-source-history.mjs";

const historicalRead = async path => {
	const bytes = await readFile(path);
	return [...wasmEntrySupplementChangedPaths, ...arrayRolloutChangedPaths].includes(path)
		? Buffer.from(beforeWasmEntrySupplementSource(path, bytes.toString("utf8"))) : bytes;
};

const snapshot = async () => {
	const path = "docs/type-surface.v1.json", source = (await historicalRead(path)).toString("utf8");
	return { current: JSON.parse(source), previous: JSON.parse(beforePerlScalarPromotionSource(path, source)), history: JSON.parse(await readFile(perlScalarPromotionHistoryPath)) };
};

test("Perl scalar promotion authenticates exact predecessors and rejects unknown edits", async () => {
	const history = JSON.parse(await readFile(perlScalarPromotionHistoryPath));
	assert.equal(history.schemaVersion, 1); assert.equal(history.milestone, "perl-scalar-promotion-v1");
	assert.equal(history.predecessorCommit, perlScalarPromotionPredecessor);
	assert.deepEqual(history.updates.map(update => update.path), perlScalarPromotionChangedPaths);
	for(const update of history.updates)
	{
		const current = (await historicalRead(update.path)).toString("utf8"), previous = reversePerlScalarPromotionUpdate(current, update);
		assert.equal(sha256(previous), update.previousSha256);
		assert.equal(beforePerlScalarPromotionSource(update.path, current), previous);
		assert.equal(beforeFinRefinementSource(update.path, current, update.previousSha256), previous);
		assert.equal(beforeFinRefinementSource(update.path, current, update.currentSha256), current);
		assert.equal(beforeFinRefinementSource(update.path, current), beforeFinRefinementSource(update.path, previous));
		const changed = current + "\n// unknown edit\n";
		assert.equal(beforePerlScalarPromotionSource(update.path, changed), changed);
		assert.throws(() => reversePerlScalarPromotionUpdate(changed, update));
		assert.throws(() => reversePerlScalarPromotionUpdate(current, { ...update, previousSha256: "0".repeat(64) }));
		assert.throws(() => reversePerlScalarPromotionUpdate(current, { ...update, path: "unknown.mjs" }));
		assert.throws(() => reversePerlScalarPromotionUpdate(current, { ...update, edits: [...update.edits, update.edits[0]] }));
	}
});

test("Perl scalar inventory reconciles ordinary coverage and supplements reviewed execution without overlapping cells", async () => {
	const { current, previous, history } = await snapshot();
	await assertPerlScalarPromotion(current, previous, history.updates, historicalRead);
	assert.equal(previous.observations.length, 499); assert.equal(current.observations.length, 499);
	assert.deepEqual((await readTypeSurface()).document, JSON.parse(await readFile("docs/type-surface.v1.json")));
	assert.equal(previous.evidence.length, 292); assert.equal(current.evidence.length, 294);
	assert.deepEqual(current.evidence.slice(previous.evidence.length).map(item => item.id), perlScalarEvidenceIds);
	for(const item of previous.observations)
		if(![perlScalarOrdinaryId, perlScalarReviewedId].includes(item.id)) assert.deepEqual(current.observations.find(now => now.id === item.id), item);
	const oldReviewed = previous.observations.find(item => item.id === perlScalarReviewedId);
	const reviewed = current.observations.find(item => item.id === perlScalarReviewedId);
	for(const [stage, data] of Object.entries(oldReviewed.stages))
	{
		assert.equal(reviewed.stages[stage].state, data.state);
		if(stage !== "installedExecution") assert.deepEqual(reviewed.stages[stage], data);
		else assert.deepEqual(reviewed.stages[stage].evidence, [...data.evidence, perlScalarEvidenceIds[1]]);
	}
	for(const key of ["profiles", "shapes", "positions", "path", "scope", "hostTypes", "conversionNotes"]) assert.deepEqual(reviewed[key], oldReviewed[key]);
	const ordinary = current.observations.find(item => item.id === perlScalarOrdinaryId);
	const oldOrdinary = previous.observations.find(item => item.id === perlScalarOrdinaryId);
	assert.deepEqual([ordinary.profiles, ordinary.shapes, ordinary.positions, ordinary.path], [["perl"], ["fin"], ["parameter", "result"], "ordinary-source"]);
	for(const [stage, data] of Object.entries(oldOrdinary.stages))
	{
		assert.deepEqual([ordinary.stages[stage].state, ordinary.stages[stage].evidence], [data.state, [...data.evidence, perlScalarEvidenceIds[0]]]);
		assert.ok(ordinary.stages[stage].note.startsWith(data.note + " Separate scalar evidence: "));
	}
	for(const key of ["id", "profiles", "shapes", "positions", "path", "hostTypes"]) assert.deepEqual(ordinary[key], oldOrdinary[key]);
	assert.deepEqual(ordinary.limitations.slice(1, oldOrdinary.limitations.length), oldOrdinary.limitations.slice(1));
	assert.ok(ordinary.conversionNotes.fin.startsWith(oldOrdinary.conversionNotes.fin));
	assert.throws(() => promotePerlScalarObservations(current.observations), /already recorded/u);
	assert.throws(() => promotePerlScalarObservations(previous.observations.filter(item => item.id !== perlScalarReviewedId)));
	for(const entry of current.evidence) for(const file of entry.files) assert.equal(sha256(await historicalRead(file.path)), file.sha256, file.path);
});

test("Perl scalar evidence binds both routes, four ABIs and original binary ZIP identities", async () => {
	const { current } = await snapshot();
	for(const [index, id] of perlScalarEvidenceIds.entries())
	{
		const entry = current.evidence.find(item => item.id === id);
		assert.equal(entry.kind, "installed"); assert.equal(entry.revision, "046ced089cd007d10ce91b66a69c461321c808ca");
		assert.equal(entry.command, "LEAN_BRIDGE_PERL_FIN_TEST=1 node --test tests/perl-fin.test.mjs");
		assert.equal(entry.artifacts.length, 8);
		assert.deepEqual([...new Set(entry.artifacts.map(file => file.path.split("/")[0]))], ["5.36.3-unthreaded", "5.36.3-threaded", "5.38.2-unthreaded", "5.38.2-threaded"]);
		assert.ok(entry.artifacts.every(file => file.path.split("/")[1] === (index ? "reviewed" : "ordinary")));
		assert.equal(entry.files.filter(file => file.path.endsWith(".zip")).length, 8);
		for(const text of ["2024 public checks", "1000 rejection/recovery cycles", "Four LD_PRELOAD controls", "do not count typed-adapter entries", "minimum-libc machine", "full build documents are absent"]) assert.ok(entry.scope.includes(text), text);
		for(const file of entry.files) assert.equal(sha256(await historicalRead(file.path)), file.sha256);
	}
	const consumer = await readFile("docs/consume/perl.md", "utf8");
	assert.ok(consumer.includes("perl-scalar-20261009.md"));
	assert.ok(consumer.includes("perl-refinements-20261009.md"));
	assert.ok(!consumer.includes("The separate top-level scalar relocation gate is not part of that evidence."));
	const author = await readFile("docs/lean/existing-package.md", "utf8");
	assert.ok(author.includes("[Separate scalar checks](../evidence/perl-scalar-20261009.md)"));
	assert.ok(!author.includes("This container evidence does not cover the separate top-level scalar relocation gate."));
	for(const root of ["perl-scalar-hosted-evidence", "perl-scalar-promotion", "fin-container-edge-evidence"]) assert.equal(classifyRepositoryTest(`tests/${root}.test.mjs`), "contract");
});

test("Perl scalar promotion refuses widened scope, misattribution and rewrites of older claims", async () => {
	const { current, previous, history } = await snapshot();
	const ordinary = value => value.observations.find(item => item.id === perlScalarOrdinaryId);
	const reviewed = value => value.observations.find(item => item.id === perlScalarReviewedId);
	const mutations = [
		value => { ordinary(value).profiles.push("ruby"); }
		, value => { ordinary(value).positions.push("field"); }
		, value => { ordinary(value).shapes.push("subtype"); }
		, value => { ordinary(value).path = "reviewed-ir"; }
		, value => { ordinary(value).stages.installedExecution.evidence = [perlScalarEvidenceIds[1]]; }
		, value => { reviewed(value).stages.installedExecution.evidence.pop(); }
		, value => { reviewed(value).stages.analysis.evidence.push(perlScalarEvidenceIds[1]); }
		, value => { value.evidence.at(-1).revision = "0".repeat(40); }
		, value => { value.evidence.at(-1).artifacts.pop(); }
		, value => { value.evidence.at(-1).files.pop(); }
		, value => { value.evidence[0].scope += " Historical claim rewritten."; }
		, value => { value.observations[0].scope += " Unrelated claim."; }
		, value => { value.observations.push(structuredClone(ordinary(value))); }
	];
	for(const mutate of mutations)
	{
		const copy = structuredClone(current); mutate(copy);
		await assert.rejects(assertPerlScalarPromotion(copy, previous, history.updates, historicalRead));
	}
	await assert.rejects(promotePerlScalarInventory(current, historicalRead), /Already recorded/u);
});

test("Perl scalar promotion updater refuses an unrelated HEAD before writing", async t => {
	const directory = await mkdtemp(join(tmpdir(), "lean-bridge-perl-scalar-promotion-guard-"));
	t.after(() => rm(directory, { recursive: true, force: true }));
	const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("GIT_")));
	const git = args => execFileSync("git", args, { cwd: directory, stdio: "pipe", env });
	git(["init", "--quiet"]);
	git(["-c", "user.name=Test", "-c", "user.email=test@example.invalid", "-c", "commit.gpgsign=false", "commit", "--allow-empty", "--quiet", "-m", "unrelated revision"]);
	const result = spawnSync(process.execPath, [resolve("scripts/update-perl-scalar-promotion-history.mjs")], { cwd: directory, encoding: "utf8", env });
	assert.equal(result.status, 1); assert.match(result.stderr, /Perl scalar promotion history is draft-only/u);
	assert.deepEqual(await readdir(directory), [".git"]);
});
