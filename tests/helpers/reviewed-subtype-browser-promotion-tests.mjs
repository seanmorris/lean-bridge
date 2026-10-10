/**
 * Bind reviewed browser Subtype support to the complete installed archive.
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
import { readTypeSurface, typeSurfaceCells, validateTypeSurface } from "../../src/adoption/type-surface.mjs";
import { beforeFinRefinementSource } from "./fin-refinement-source-history.mjs";
import { beforeCheckedRecordNativeHostSource } from "./checked-record-native-host-history.mjs";
import { browserSubtypeRoot, browserSubtypeIndex, browserSubtypeProfiles, browserSubtypeEvidenceId, browserSubtypeObservationId, browserSubtypeLimit, browserSubtypeConversion, browserSubtypeReference, promoteBrowserSubtype } from "./reviewed-subtype-browser-promotion.mjs";
import { beforeReviewedSubtypeBrowserPromotionSource, reviewedSubtypeBrowserPromotionChangedPaths, reviewedSubtypeBrowserPromotionHistoryPath, reviewedSubtypeBrowserPromotionPredecessor, reverseReviewedSubtypeBrowserPromotionUpdate } from "./reviewed-subtype-browser-promotion-history.mjs";

const predecessor = async () => JSON.parse(beforeReviewedSubtypeBrowserPromotionSource("docs/type-surface.v1.json", await readFile("docs/type-surface.v1.json", "utf8")));

test("reviewed browser promotion authenticates every original artifact and actual producer command", async () => {
	const reference = await browserSubtypeReference();
	assert.equal(reference.id, browserSubtypeEvidenceId);
	assert.equal(reference.revision, "f07c86d23f75b9b07ae66f6e9c7101c47b29b58e");
	assert.equal(reference.sourcePath, "reviewed-ir");
	assert.deepEqual(reference.profiles, browserSubtypeProfiles);
	assert.ok(Object.isFrozen(browserSubtypeProfiles));
	assert.throws(() => reference.profiles.push("node-javascript"), TypeError);
	assert.equal(reference.files.length, 115); assert.equal(reference.artifacts.length, 2);
	assert.equal(reference.files[0].sha256, browserSubtypeIndex);
	assert.ok(reference.command.includes("LEAN_BRIDGE_REVIEWED_SUBTYPE_BROWSER_TEST='1'"));
	assert.ok(reference.command.includes("LEAN_BRIDGE_TYPE_CORPUS_BROWSERS='chromium,firefox,webkit'"));
	assert.ok(reference.command.includes("source-free reviewed npm archives execute checked Subtype constructors"));
	assert.ok(reference.scope.includes(browserSubtypeLimit));
	for(const path of reference.files.map(file => file.path))
		await assert.rejects(() => browserSubtypeReference(async file => {
			const bytes = await readFile(file);
			return file === path ? Buffer.concat([bytes, Buffer.from("\n")]) : bytes;
		}), { code: "ERR_ASSERTION" }, path);
});

test("reviewed browser promotion adds exactly six cells and preserves every earlier claim", async () => {
	const current = await readTypeSurface(), previous = await predecessor();
	const proposed = await promoteBrowserSubtype(previous, await browserSubtypeReference());
	validateTypeSurface(proposed, current);
	assert.equal(previous.evidence.length, 419); assert.equal(previous.observations.length, 518);
	assert.equal(proposed.evidence.length, 420); assert.equal(proposed.observations.length, 519);
	assert.deepEqual(proposed.evidence.slice(0, 419), previous.evidence);
	assert.deepEqual(proposed.observations.slice(0, 518), previous.observations);
	const before = typeSurfaceCells(previous, current), after = typeSurfaceCells(proposed, current), changed = [];
	for(const [index, cell] of after.entries())
	{
		if(JSON.stringify(cell) === JSON.stringify(before[index])) continue;
		assert.equal(cell.shape, "subtype"); assert.equal(cell.path, "reviewed-ir");
		assert.ok(browserSubtypeProfiles.includes(cell.profile));
		assert.ok(["parameter", "result"].includes(cell.position));
		assert.equal(before[index].stages.installedExecution.state, "unreviewed");
		for(const stage of Object.values(cell.stages))
		{
			assert.equal(stage.state, "passed");
			assert.deepEqual(stage.evidence, [browserSubtypeEvidenceId]);
		}
		changed.push(`${cell.profile}/${cell.position}`);
	}
	assert.deepEqual(changed.sort(), browserSubtypeProfiles.flatMap(profile => [profile + "/parameter", profile + "/result"]).sort());
	for(const path of [reviewedSubtypeBrowserPromotionHistoryPath])
	{
		const history = JSON.parse(await readFile(path));
		for(const entry of proposed.evidence) for(const file of entry.files)
		{
			const update = history.updates.find(item => item.path === file.path && item.previousSha256 === file.sha256);
			if(update) file.sha256 = update.currentSha256;
		}
	}
	const ledger = JSON.parse(await readFile(reviewedSubtypeBrowserPromotionHistoryPath));
	const inventory = ledger.updates.find(item => item.path === "docs/type-surface.v1.json");
	const authenticated = beforeFinRefinementSource(inventory.path, await readFile(inventory.path), inventory.currentSha256);
	assert.equal(sha256(authenticated), inventory.currentSha256);
	const milestone = JSON.parse(authenticated);
	// The factories pin today's validators. Authenticate their exact milestone
	// bytes before comparing the complete historical promotion.
	for(const entry of proposed.evidence.slice(previous.evidence.length))
		for(const file of entry.files.filter(item => !item.path.startsWith("docs/evidence/")))
		{
			const original = milestone.evidence.find(item => item.id === entry.id)?.files.find(item => item.path === file.path);
			assert.ok(original, file.path);
			const bytes = beforeFinRefinementSource(file.path, await readFile(file.path), original.sha256);
			assert.equal(sha256(bytes), original.sha256, file.path);
			file.sha256 = original.sha256;
		}
	assert.deepEqual(milestone, proposed);
	assert.equal(proposed.observations.at(-1).id, browserSubtypeObservationId);
});

test("reviewed browser promotion refuses invented scope, omitted records, overlaps and repetition", async () => {
	const previous = await predecessor(), reference = await browserSubtypeReference();
	for(const mutate of [item => { item.profiles.push("node-javascript"); }
		, item => { item.profiles.pop(); }
		, item => { item.scope = "All nested and callback Subtypes pass"; }
		, item => { item.sourcePath = "ordinary-source"; }
		, item => { item.revision = "0".repeat(40); }
		, item => { item.command = "node --test"; }
		, item => { item.artifacts.pop(); }
		, item => { item.files.pop(); }
		, item => { item.files[0].sha256 = "0".repeat(64); }
		, item => { item.positions = ["field"]; }]) {
		const changed = structuredClone(reference); mutate(changed);
		await assert.rejects(() => promoteBrowserSubtype(previous, changed));
		}
	const promoted = await promoteBrowserSubtype(previous, reference);
	await assert.rejects(() => promoteBrowserSubtype(promoted, reference), /Already promoted/u);
	for(const profile of browserSubtypeProfiles) for(const position of ["parameter", "result"])
	{
		const changed = structuredClone(previous);
		changed.observations.push({ ...structuredClone(promoted.observations.at(-1))
			, id: "overlap", profiles: [profile], positions: [position] });
		await assert.rejects(() => promoteBrowserSubtype(changed, reference), /Overlapping/u);
	}
});

test("reviewed browser guides expose primitive inputs and retain unsupported positions", async () => {
	const consumer = await readFile("docs/javascript-typescript.md", "utf8");
	const row = consumer.split("\n").find(line => line.startsWith("| `Subtype /"));
	assert.ok(row.includes(browserSubtypeConversion));
	assert.ok(row.includes("Reviewed IR: Installed checks passed (input, result)"));
	assert.ok(row.includes("Not audited (field, callback input, callback result)"));
	assert.ok(consumer.includes("### Checked Subtypes\n"));
	assert.ok(consumer.includes("You pass the base value"));
	for(const path of ["docs/javascript-typescript.md", "docs/lean/existing-package.md", "docs/lean/export-decisions.md"])
	{
		const source = await readFile(path, "utf8");
		assert.ok(source.includes("reviewed-subtype-browser-promotion-20261010.md"), path);
		assert.doesNotMatch(source, /Other reviewed native hosts and npm browser profiles remain pending|PHP-Wasm installed; reviewed browser pending/u);
	}
	const note = await readFile("docs/evidence/reviewed-subtype-browser-promotion-20261010.md", "utf8");
	for(const text of ["six", "51", "2,036", "2,024", "nested", "hosted"])
		assert.ok(note.toLowerCase().includes(text), text);
	assert.ok(note.includes(browserSubtypeRoot.split("/").at(-1)));
});

test("reviewed browser promotion history authenticates exact transitions and rejects unrecorded edits", async () => {
	const history = JSON.parse(await readFile(reviewedSubtypeBrowserPromotionHistoryPath));
	assert.equal(history.schemaVersion, 1);
	assert.equal(history.milestone, "reviewed-subtype-browser-promotion-v1");
	assert.equal(history.predecessorCommit, reviewedSubtypeBrowserPromotionPredecessor);
	assert.deepEqual(history.updates.map(update => update.path), reviewedSubtypeBrowserPromotionChangedPaths);
	for(const update of history.updates)
	{
		const source = beforeCheckedRecordNativeHostSource(update.path, await readFile(update.path, "utf8"));
		const previous = reverseReviewedSubtypeBrowserPromotionUpdate(source, update);
		assert.equal(beforeReviewedSubtypeBrowserPromotionSource(update.path, source), previous);
		assert.equal(beforeFinRefinementSource(update.path, source, update.currentSha256), source);
		assert.equal(beforeFinRefinementSource(update.path, source, update.previousSha256), previous);
		const unknown = source + "\nunknown\n";
		assert.equal(beforeReviewedSubtypeBrowserPromotionSource(update.path, unknown), unknown);
		assert.throws(() => reverseReviewedSubtypeBrowserPromotionUpdate(unknown, update));
		for(const mutate of [item => { item.previousSha256 = "0".repeat(64); }
			, item => { item.currentSha256 = "0".repeat(64); }
			, item => { item.path = "unknown"; }, item => { item.edits = []; }
			, item => { item.edits[0].start = -1; }
			, item => { item.edits[0].current += "unknown"; }]) {
			const corrupt = structuredClone(update); mutate(corrupt);
			assert.throws(() => reverseReviewedSubtypeBrowserPromotionUpdate(source, corrupt));
			}
	}
	assert.equal(sha256(await readFile("docs/evidence/reviewed-subtype-browser-ci-source-history-20261010.json")), "4620e03038605119a5a1f0b33a73c327c195ae7d903cf189ae13debe0cc3ad76");
});

test("reviewed browser promotion writer refuses unrelated HEAD before writing", async t => {
	const directory = await mkdtemp(join(tmpdir(), "lean-bridge-browser-promotion-guard-"));
	t.after(() => rm(directory, { recursive: true, force: true }));
	const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("GIT_")));
	const git = args => execFileSync("git", args, { cwd: directory, env, stdio: "pipe" });
	git(["init", "--quiet"]);
	git(["-c", "user.name=Test", "-c", "user.email=test@example.invalid", "-c", "commit.gpgsign=false", "commit", "--allow-empty", "--quiet", "-m", "unrelated"]);
	const result = spawnSync(process.execPath, [resolve("scripts/update-reviewed-subtype-browser-promotion-history.mjs")], { cwd: directory, env, encoding: "utf8" });
	assert.equal(result.status, 1); assert.match(result.stderr, /draft-only/u);
	assert.deepEqual(await readdir(directory), [".git"]);
});
