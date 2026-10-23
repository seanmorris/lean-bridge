/**
 * Bind native checked-record claims to exact installed routes and original bytes.
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
import { beforeCheckedRecordHostCiSource, checkedRecordHostCiHistoryPath } from "./checked-record-host-ci-history.mjs";
import { checkedRecordNativeProfiles, checkedRecordNativeReferences, promoteCheckedRecordNative, checkedRecordNativeLimit, checkedRecordNativeConversion } from "./checked-record-native-promotion.mjs";
import { beforeCheckedRecordNativePromotionSource, checkedRecordNativePromotionChangedPaths, checkedRecordNativePromotionHistoryPath, checkedRecordNativePromotionPredecessor, reverseCheckedRecordNativePromotionUpdate } from "./checked-record-native-promotion-history.mjs";
import { sourceAtHistoryMilestone } from "./source-history-test-source.mjs";

const predecessor = async () => {
	const path = "docs/type-surface.v1.json";
	return JSON.parse(beforeCheckedRecordNativePromotionSource(
		path, sourceAtHistoryMilestone(checkedRecordNativePromotionHistoryPath, path)
	));
};

test("native checked-record promotion authenticates all sixteen run groups and both Python floors", async () => {
	const references = await checkedRecordNativeReferences();
	assert.equal(references.length, 16);
	assert.deepEqual([...new Set(references.flatMap(item => item.profiles))].sort(), [...checkedRecordNativeProfiles].sort());
	assert.equal(references.filter(item => item.resultOnly).length, 8);
	for(const profile of checkedRecordNativeProfiles) for(const route of ["ordinary-source", "reviewed-ir"])
		for(const resultOnly of [false, true])
		{
			const matches = references.filter(item => item.profiles.includes(profile) && item.sourcePath === route && item.resultOnly === resultOnly);
			assert.equal(matches.length, profile === "python" ? 2 : 1);
			if(profile === "python") assert.deepEqual(matches.map(item => item.group.split("/")[0]), ["3.11", "3.12"]);
		}
	const hashes = new Map();
	for(const reference of references)
	{
		assert.match(reference.id, /^[a-z][a-z0-9-]*$/u);
		assert.deepEqual(reference.positions, reference.resultOnly ? ["result"] : ["parameter", "result"]);
		assert.deepEqual(reference.checks, reference.profiles.map(profile => [profile, reference.resultOnly ? 1002 : 9024]));
		assert.ok(reference.command.includes("tests/helpers/checked-record-native-installed-tests.mjs"));
		assert.ok(reference.command.includes("LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR='2.36'"));
		assert.ok(reference.scope.includes(checkedRecordNativeLimit));
		assert.ok(reference.files.every(file => file.path.startsWith("docs/evidence/")));
		assert.ok(!reference.files.some(file => file.path.includes("/failed-php-tool/")));
		for(const file of reference.files)
		{
			if(!hashes.has(file.path)) hashes.set(file.path, sha256(await readFile(file.path)));
			assert.equal(hashes.get(file.path), file.sha256, file.path);
		}
	}
	for(const [group, path] of [["python-hosts", "3.12/result-only-reviewed-ir/report.json"], ["ruby-jvm", "reviewed-ir/report.json"], ["remaining-hosts", "ordinary-source/report.json"]])
		for(const selected of ["index.json", path])
			await assert.rejects(() => checkedRecordNativeReferences(async file => {
				const bytes = await readFile(file);
				return file === `docs/evidence/checked-record-${group}-20261010/${selected}` ? Buffer.concat([bytes, Buffer.from("\n")]) : bytes;
			}));
});

test("native checked-record promotion changes exactly thirty-two cells without broadening other positions", async () => {
	const current = await readTypeSurface(), previous = await predecessor();
	const proposed = await promoteCheckedRecordNative(previous, await checkedRecordNativeReferences());
	validateTypeSurface(proposed, current);
	assert.equal(previous.evidence.length, 420); assert.equal(previous.observations.length, 519);
	assert.equal(proposed.evidence.length, 436); assert.equal(proposed.observations.length, 551);
	assert.deepEqual(proposed.evidence.slice(0, 420), previous.evidence);
	assert.deepEqual(proposed.observations.slice(0, 519), previous.observations);
	const before = typeSurfaceCells(previous, current), after = typeSurfaceCells(proposed, current), changed = [];
	for(const [index, cell] of after.entries())
	{
		if(JSON.stringify(cell) === JSON.stringify(before[index])) continue;
		assert.equal(cell.shape, "checked-record");
		assert.ok(checkedRecordNativeProfiles.includes(cell.profile));
		assert.ok(["ordinary-source", "reviewed-ir"].includes(cell.path));
		assert.ok(["parameter", "result"].includes(cell.position));
		assert.equal(before[index].stages.installedExecution.state, "unreviewed");
		const multiplier = cell.profile === "python" ? 2 : 1;
		for(const stage of Object.values(cell.stages))
		{
			assert.equal(stage.state, "passed");
			assert.equal(stage.evidence.length, multiplier * (cell.position === "result" ? 2 : 1));
			assert.equal(stage.evidence.filter(id => id.includes("result-only")).length, cell.position === "result" ? multiplier : 0);
		}
		changed.push(`${cell.profile}/${cell.path}/${cell.position}`);
	}
	assert.deepEqual(changed.sort(), checkedRecordNativeProfiles.flatMap(profile => ["ordinary-source", "reviewed-ir"].flatMap(path => ["parameter", "result"].map(position => `${profile}/${path}/${position}`))).sort());
	assert.equal(after.filter(cell => cell.shape === "checked-record" && cell.stages.installedExecution.state === "passed").length, 48);
	const history = JSON.parse(await readFile(checkedRecordNativePromotionHistoryPath));
	for(const entry of proposed.evidence) for(const file of entry.files)
	{
		const update = history.updates.find(item => item.path === file.path && item.previousSha256 === file.sha256);
		if(update) file.sha256 = update.currentSha256;
	}
	const path = "docs/type-surface.v1.json";
	const milestone = JSON.parse(beforeCheckedRecordHostCiSource(
		path, sourceAtHistoryMilestone(checkedRecordHostCiHistoryPath, path)
	));
	// Authenticate the validators at this promotion, even after later CI integration.
	for(const entry of proposed.evidence.slice(previous.evidence.length))
		for(const file of entry.files.filter(item => !item.path.startsWith("docs/evidence/")))
		{
			const original = milestone.evidence.find(item => item.id === entry.id)?.files.find(item => item.path === file.path);
			assert.ok(original, file.path);
			assert.equal(sha256(beforeFinRefinementSource(file.path, await readFile(file.path), original.sha256)), original.sha256, file.path);
			file.sha256 = original.sha256;
		}
	assert.deepEqual(milestone, proposed);
});

test("native checked-record promotion refuses forged references, overlaps and repeated promotion", async () => {
	const previous = await predecessor(), references = await checkedRecordNativeReferences();
	for(const changed of [references.slice(1), [...references].reverse(), [...references, references[0]]])
		await assert.rejects(() => promoteCheckedRecordNative(previous, changed));
	for(const mutate of [item => { item.profiles = ["perl"]; }
		, item => { item.scope = "All dependent records pass"; }
		, item => { item.positions.push("parameter"); }
		, item => { item.resultOnly = false; }
		, item => { item.sourcePath = "ordinary-source"; }
		, item => { item.revision = "0".repeat(40); }
		, item => { item.command = "node --test"; }
		, item => { item.artifacts.pop(); }
		, item => { item.files[0].sha256 = "0".repeat(64); }
		, item => { item.checks[0][1] = 0; }]) {
		const changed = structuredClone(references); mutate(changed.at(-1));
		await assert.rejects(() => promoteCheckedRecordNative(previous, changed));
		}
	const promoted = await promoteCheckedRecordNative(previous, references);
	await assert.rejects(() => promoteCheckedRecordNative(promoted, references), /Already promoted/u);
	const changed = structuredClone(previous);
	changed.observations.push(structuredClone(promoted.observations.at(-1)));
	await assert.rejects(() => promoteCheckedRecordNative(changed, references), /Overlapping/u);
});

test("native checked-record consumer guides match the promoted routes and retain unsupported positions", async () => {
	for(const profile of checkedRecordNativeProfiles)
	{
		const path = profile === "php-native" ? "docs/php.md" : `docs/consume/${profile}.md`;
		const source = sourceAtHistoryMilestone(
			checkedRecordNativePromotionHistoryPath, path
		);
		assert.ok(source.includes("checked-record-native-promotion-20261011.md"), path);
		const row = source.split("\n").find(line => line.startsWith("| `Checked records and closed Nat indices`"));
		assert.ok(row, path);
		assert.ok(row.includes(checkedRecordNativeConversion), path);
		assert.ok(row.includes("Installed checks passed (input, result)"), path);
		assert.ok(row.includes(
			"Not audited (field, callback input, callback result)"), path);
		if(profile === "php-native")
		{
			assert.ok(source.includes("These results apply to native PHP, not PHP-Wasm."));
			assert.ok(row.includes("PHP-Wasm: Not audited"));
		}
		else assert.ok(row.includes(
			"Reviewed IR: Installed checks passed (input, result)"), path);
	}
});

test("native checked-record promotion history authenticates exact transitions and refuses unknown edits", async () => {
	const history = JSON.parse(await readFile(checkedRecordNativePromotionHistoryPath));
	assert.equal(history.schemaVersion, 1);
	assert.equal(history.milestone, "checked-record-native-promotion-v1");
	assert.equal(history.predecessorCommit, checkedRecordNativePromotionPredecessor);
	assert.deepEqual(history.updates.map(update => update.path), checkedRecordNativePromotionChangedPaths);
	for(const update of history.updates)
	{
		const source = sourceAtHistoryMilestone(
			checkedRecordNativePromotionHistoryPath, update.path
		);
		const previous = reverseCheckedRecordNativePromotionUpdate(source, update);
		assert.equal(beforeCheckedRecordNativePromotionSource(update.path, source), previous);
		const bytes = Buffer.from(source);
		assert.equal(beforeFinRefinementSource(update.path, bytes, update.currentSha256), bytes);
		assert.equal(beforeFinRefinementSource(update.path, bytes, update.previousSha256), previous);
		assert.equal(beforeCheckedRecordNativePromotionSource(update.path, source + "\nunknown"), source + "\nunknown");
		assert.throws(() => reverseCheckedRecordNativePromotionUpdate(source + "\n", update));
		for(const mutate of [item => { item.currentSha256 = "0".repeat(64); }
			, item => { item.previousSha256 = "0".repeat(64); }
			, item => { item.path = "unrecorded"; }
			, item => { item.edits = []; }
			, item => { item.edits[0].start = -1; }
			, item => { item.edits[0].current += "forged"; }]) {
			const changed = structuredClone(update); mutate(changed);
			assert.throws(() => reverseCheckedRecordNativePromotionUpdate(source, changed));
			}
	}
	assert.equal(sha256(await readFile("docs/evidence/checked-record-remaining-hosts-source-history-20261010.json")), "f98ed2ca68fb8ef8d538e615509d7670ea08f4981c83ee19cc7a65ee44ab0287");
});

test("native checked-record promotion writer refuses unrelated HEAD before writing", async t => {
	const directory = await mkdtemp(join(tmpdir(), "lean-bridge-checked-record-native-promotion-guard-"));
	t.after(() => rm(directory, { recursive: true, force: true }));
	const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("GIT_")));
	const git = args => execFileSync("git", args, { cwd: directory, env, stdio: "pipe" });
	git(["init", "--quiet"]);
	git(["-c", "user.name=Test", "-c", "user.email=test@example.invalid", "-c", "commit.gpgsign=false", "commit", "--allow-empty", "--quiet", "-m", "unrelated"]);
	const result = spawnSync(process.execPath, [resolve("scripts/update-checked-record-native-promotion-history.mjs")], { cwd: directory, env, encoding: "utf8" });
	assert.equal(result.status, 1); assert.match(result.stderr, /draft-only/u);
	assert.deepEqual(await readdir(directory), [".git"]);
});
