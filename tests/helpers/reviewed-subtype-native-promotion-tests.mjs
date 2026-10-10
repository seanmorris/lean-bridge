/**
 * Keep native Subtype promotion tied to the twelve original installed runs.
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
import { reviewedSubtypeNativeProfiles, reviewedSubtypeNativeReferences, promoteReviewedSubtypeNative, reviewedSubtypeNativeLimit, reviewedSubtypeNativeConversion } from "./reviewed-subtype-native-promotion.mjs";
import { beforeReviewedSubtypeNativePromotionSource, reviewedSubtypeNativePromotionChangedPaths, reviewedSubtypeNativePromotionHistoryPath, reviewedSubtypeNativePromotionPredecessor, reverseReviewedSubtypeNativePromotionUpdate } from "./reviewed-subtype-native-promotion-history.mjs";
import "./fin-record-zero-ci-history-tests.mjs";
import { beforeReviewedSubtypeHostCiReportSource, reviewedSubtypeHostCiReportHistoryPath } from "./reviewed-subtype-host-ci-report-history.mjs";
import { reviewedSubtypeHostCiHistoryPath } from "./reviewed-subtype-host-ci-history.mjs";

const predecessor = async () => JSON.parse(beforeReviewedSubtypeNativePromotionSource("docs/type-surface.v1.json", await readFile("docs/type-surface.v1.json", "utf8")));

test("native Subtype promotion authenticates both Python floors, four Perl ABIs and every installed host", async () => {
	const references = await reviewedSubtypeNativeReferences();
	assert.deepEqual(references.map(item => item.group), ["3.11", "3.12", "ruby", "jvm", "rust", "dotnet", "php-native", "wit-wasi", "perl-5.36.3-threaded", "perl-5.36.3-unthreaded", "perl-5.38.2-threaded", "perl-5.38.2-unthreaded"]);
	assert.deepEqual(references.map(item => item.checks.map(([, checks]) => checks)), [[2025], [2025], [2024], [2024, 2023], [2026], [2024], [2024], [2031], [2025], [2025], [2025], [2025]]);
	assert.deepEqual([...new Set(references.flatMap(item => item.profiles))].sort(), [...reviewedSubtypeNativeProfiles].sort());
	const hashes = new Map();
	for(const reference of references)
	{
		assert.match(reference.id, /^[a-z][a-z0-9-]*$/u);
		assert.equal(reference.sourcePath, "reviewed-ir");
		assert.ok(reference.command.includes("tests/helpers/reviewed-subtype-host-installed-tests.mjs"));
		assert.ok(reference.command.includes("LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR='2.36'"));
		if(reference.profiles.includes("perl"))
		{
			assert.ok(reference.command.includes("LEAN_BRIDGE_PERL_TEST_GLIBC_FLOOR='2.36'"));
			assert.ok(reference.command.includes(`/perl/${reference.group.slice(5)}/bin/perl`));
		}
		assert.ok(reference.scope.includes(reviewedSubtypeNativeLimit));
		assert.ok(reference.files.every(file => file.path.startsWith("docs/evidence/")));
		for(const file of reference.files)
		{
			if(!hashes.has(file.path)) hashes.set(file.path, sha256(await readFile(file.path)));
			assert.equal(hashes.get(file.path), file.sha256, file.path);
		}
	}
	for(const [name, path] of [["python", "3.11/report.json"], ["ruby-jvm", "jvm/report.json"], ["remaining", "perl-5.38.2-unthreaded/report.json"]])
		for(const selected of ["index.json", path])
			await assert.rejects(() => reviewedSubtypeNativeReferences(async file => {
				const bytes = await readFile(file);
				return file === `docs/evidence/reviewed-subtype-${name}-hosts-20261010/${selected}` ? Buffer.concat([bytes, Buffer.from("\n")]) : bytes;
			}));
});

test("native Subtype promotion adds exactly eighteen cells and preserves every older observation", async () => {
	const current = await readTypeSurface(), previous = await predecessor();
	const proposed = await promoteReviewedSubtypeNative(previous, await reviewedSubtypeNativeReferences());
	validateTypeSurface(proposed, current);
	assert.equal(previous.evidence.length, 407); assert.equal(previous.observations.length, 509);
	assert.equal(proposed.evidence.length, 419); assert.equal(proposed.observations.length, 518);
	assert.deepEqual(proposed.evidence.slice(0, 407), previous.evidence);
	assert.deepEqual(proposed.observations.slice(0, 509), previous.observations);
	const before = typeSurfaceCells(previous, current), after = typeSurfaceCells(proposed, current), changed = [];
	for(const [index, cell] of after.entries())
	{
		if(JSON.stringify(cell) === JSON.stringify(before[index])) continue;
		assert.equal(cell.shape, "subtype"); assert.equal(cell.path, "reviewed-ir");
		assert.ok(reviewedSubtypeNativeProfiles.includes(cell.profile));
		assert.ok(["parameter", "result"].includes(cell.position));
		assert.equal(before[index].stages.installedExecution.state, "unreviewed");
		for(const stage of Object.values(cell.stages)) assert.equal(stage.state, "passed");
		assert.equal(cell.stages.installedExecution.evidence.length, cell.profile === "perl" ? 4 : cell.profile === "python" ? 2 : 1);
		changed.push(`${cell.profile}/${cell.position}`);
	}
	assert.deepEqual(changed.sort(), reviewedSubtypeNativeProfiles.flatMap(profile => [profile + "/parameter", profile + "/result"]).sort());
	for(const path of [reviewedSubtypeNativePromotionHistoryPath, reviewedSubtypeHostCiReportHistoryPath, reviewedSubtypeHostCiHistoryPath])
	{
		const history = JSON.parse(await readFile(path));
		for(const entry of proposed.evidence) for(const file of entry.files)
		{
			const update = history.updates.find(item => item.path === file.path && item.previousSha256 === file.sha256);
			if(update) file.sha256 = update.currentSha256;
		}
	}
	assert.deepEqual(current.document, proposed);
});

test("native Subtype promotion refuses altered references, overlaps and repeat promotion", async () => {
	const previous = await predecessor(), references = await reviewedSubtypeNativeReferences();
	for(const changed of [references.slice(1), [...references].reverse(), [...references, references[0]]])
		await assert.rejects(() => promoteReviewedSubtypeNative(previous, changed));
	for(const mutate of [item => { item.profiles = ["browser-react"]; }
		, item => { item.scope = "All shapes pass"; }
		, item => { item.sourcePath = "ordinary-source"; }
		, item => { item.revision = "0".repeat(40); }
		, item => { item.command = "node --test"; }
		, item => { item.artifacts.pop(); }
		, item => { item.files[0].sha256 = "0".repeat(64); }
		, item => { item.checks[0][1] = 0; }]) {
		const changed = structuredClone(references); mutate(changed.at(-1));
		await assert.rejects(() => promoteReviewedSubtypeNative(previous, changed));
		}
	const promoted = await promoteReviewedSubtypeNative(previous, references);
	await assert.rejects(() => promoteReviewedSubtypeNative(promoted, references), /Already promoted/u);
	const changed = structuredClone(previous), ordinary = changed.observations.find(item => item.id === "native-subtype-python-ordinary-source");
	changed.observations.push({ ...structuredClone(ordinary), id: "overlap", path: "reviewed-ir" });
	await assert.rejects(() => promoteReviewedSubtypeNative(changed, references), /Overlapping/u);
});

test("native Subtype guides document both routes and retain the tested boundary", async () => {
	for(const profile of reviewedSubtypeNativeProfiles)
	{
		const path = profile === "php-native" ? "docs/php.md" : `docs/consume/${profile}.md`;
		const source = await readFile(path, "utf8");
		assert.ok(source.includes("reviewed-subtype-native-promotion-20261010.md"), path);
		const row = source.split("\n").find(line => line.startsWith("| `Subtype /"));
		assert.ok(row.includes(reviewedSubtypeNativeConversion), path);
		assert.ok(row.includes("Reviewed IR: Installed checks passed (input, result)"), path);
		assert.ok(row.includes("Not audited (field, callback input, callback result)"), path);
		assert.doesNotMatch(source, /Reviewed-IR Subtype remains separate work/u);
	}
	const author = await readFile("docs/lean/existing-package.md", "utf8");
	assert.ok(author.includes("C/C++, Node, native hosts, CPAN and PHP-Wasm installed; reviewed browser pending"));
	assert.doesNotMatch(author, /other reviewed hosts remain pending|C\/C\+\+, Node and PHP-Wasm installed; other profiles pending/u);
});

test("native Subtype promotion history authenticates exact transitions and refuses unrecorded edits", async () => {
	const history = JSON.parse(await readFile(reviewedSubtypeNativePromotionHistoryPath));
	assert.equal(history.predecessorCommit, reviewedSubtypeNativePromotionPredecessor);
	assert.equal(history.milestone, "reviewed-subtype-native-promotion-v1");
	assert.deepEqual(history.updates.map(update => update.path), reviewedSubtypeNativePromotionChangedPaths);
	for(const update of history.updates)
	{
		const source = beforeReviewedSubtypeHostCiReportSource(update.path, await readFile(update.path, "utf8"));
		const previous = reverseReviewedSubtypeNativePromotionUpdate(source, update);
		assert.equal(beforeReviewedSubtypeNativePromotionSource(update.path, source), previous);
		assert.equal(beforeFinRefinementSource(update.path, source, update.currentSha256), source);
		assert.equal(beforeFinRefinementSource(update.path, source, update.previousSha256), previous);
		const unknown = source + "\n";
		assert.equal(beforeReviewedSubtypeNativePromotionSource(update.path, unknown), unknown);
		assert.throws(() => reverseReviewedSubtypeNativePromotionUpdate(unknown, update));
		for(const mutate of [item => { item.previousSha256 = "0".repeat(64); }
			, item => { item.path = "unknown"; }
			, item => { item.edits = []; }, item => { item.edits[0].start = -1; }
			, item => { item.edits[0].current += "unknown"; }]) {
			const corrupt = structuredClone(update); mutate(corrupt);
			assert.throws(() => reverseReviewedSubtypeNativePromotionUpdate(source, corrupt));
			}
	}
	assert.equal(sha256(await readFile("docs/evidence/fin-history-buffer-repair-source-history-20261010.json")), "8aaed5927ae7d934dd754822b3ef1c7941d446017433526fa2ad4c8a9da9d383");
});

test("native Subtype promotion writer refuses unrelated HEAD before writing", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-subtype-promotion-guard-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("GIT_")));
	const git = args => execFileSync("git", args, { cwd: root, env, stdio: "pipe" });
	git(["init", "--quiet"]);
	git(["-c", "user.name=Test", "-c", "user.email=test@example.invalid", "-c", "commit.gpgsign=false", "commit", "--allow-empty", "--quiet", "-m", "unrelated"]);
	const result = spawnSync(process.execPath, [resolve("scripts/update-reviewed-subtype-native-promotion-history.mjs")], { cwd: root, env, encoding: "utf8" });
	assert.equal(result.status, 1); assert.match(result.stderr, /draft-only/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
