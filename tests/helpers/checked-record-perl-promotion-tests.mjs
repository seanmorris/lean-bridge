/**
 * Require complete installed Perl evidence for exactly four checked-record cells.
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
import { checkedRecordPerlConversion, checkedRecordPerlLimit, checkedRecordPerlReferences, promoteCheckedRecordPerl } from "./checked-record-perl-promotion.mjs";
import { beforeCheckedRecordPerlPromotionSource, checkedRecordPerlPromotionChangedPaths, checkedRecordPerlPromotionHistoryPath, checkedRecordPerlPromotionPredecessor, reverseCheckedRecordPerlPromotionUpdate } from "./checked-record-perl-promotion-history.mjs";

const predecessor = async () => JSON.parse(beforeCheckedRecordPerlPromotionSource("docs/type-surface.v1.json", await readFile("docs/type-surface.v1.json", "utf8")));

test("Perl checked-record support authenticates four installed routes and every ABI/mode pair", async () => {
	const references = await checkedRecordPerlReferences();
	assert.deepEqual(references.map(item => item.route), ["ordinary-source", "reviewed-ir", "result-only-ordinary-source", "result-only-reviewed-ir"]);
	const configurations = ["5.36.3-threaded", "5.36.3-unthreaded", "5.38.2-threaded", "5.38.2-unthreaded"];
	const modes = ["prebuilt-only", "build-xs"], checked = new Map();
	for(const reference of references)
	{
		assert.deepEqual(reference.profiles, ["perl"]);
		assert.deepEqual(reference.positions, reference.resultOnly ? ["result"] : ["parameter", "result"]);
		assert.deepEqual(reference.configurations, configurations); assert.deepEqual(reference.modes, modes);
		assert.deepEqual(reference.checks, configurations.flatMap(configuration => modes.map(mode => [configuration, mode, reference.resultOnly ? 1002 : 9024])));
		assert.ok(reference.command.includes("tests/helpers/checked-record-perl-installed-tests.mjs"));
		assert.ok(reference.command.includes("LEAN_BRIDGE_PERL_TEST_GLIBC_FLOOR='2.36'"));
		assert.ok(reference.scope.includes(checkedRecordPerlLimit));
		for(const file of reference.files)
		{
			assert.ok(file.path.startsWith("docs/evidence/"));
			if(!checked.has(file.path)) checked.set(file.path, sha256(await readFile(file.path)));
			assert.equal(checked.get(file.path), file.sha256, file.path);
		}
	}
	for(const path of ["index.json", ...references.map(item => `${item.route}/report.json`)])
		await assert.rejects(() => checkedRecordPerlReferences(async file => {
			const bytes = await readFile(file);
			return file === `docs/evidence/checked-record-perl-installed-20261011/${path}` ? Buffer.concat([bytes, Buffer.from("\n")]) : bytes;
		}));
});

test("Perl checked-record promotion changes exactly four cells and retains every earlier claim", async () => {
	const current = await readTypeSurface(), previous = await predecessor();
	const proposed = await promoteCheckedRecordPerl(previous, await checkedRecordPerlReferences());
	validateTypeSurface(proposed, current);
	assert.equal(previous.evidence.length, 436); assert.equal(previous.observations.length, 551);
	assert.equal(proposed.evidence.length, 440); assert.equal(proposed.observations.length, 555);
	assert.deepEqual(proposed.evidence.slice(0, 436), previous.evidence);
	assert.deepEqual(proposed.observations.slice(0, 551), previous.observations);
	const before = typeSurfaceCells(previous, current), after = typeSurfaceCells(proposed, current), changed = [];
	for(const [index, cell] of after.entries())
	{
		if(JSON.stringify(cell) === JSON.stringify(before[index])) continue;
		assert.equal(cell.profile, "perl"); assert.equal(cell.shape, "checked-record");
		assert.ok(["ordinary-source", "reviewed-ir"].includes(cell.path));
		assert.ok(["parameter", "result"].includes(cell.position));
		assert.equal(before[index].stages.installedExecution.state, "unreviewed");
		for(const stage of Object.values(cell.stages))
		{
			assert.equal(stage.state, "passed");
			assert.deepEqual(stage.evidence, [cell.path, ...cell.position === "result" ? [`result-only-${cell.path}`] : []].map(route => `checked-record-perl-${route}-installed`));
		}
		changed.push(`${cell.path}/${cell.position}`);
	}
	assert.deepEqual(changed.sort(), ["ordinary-source", "reviewed-ir"].flatMap(path => ["parameter", "result"].map(position => `${path}/${position}`)).sort());
	const history = JSON.parse(await readFile(checkedRecordPerlPromotionHistoryPath));
	for(const entry of proposed.evidence) for(const file of entry.files)
	{
		const update = history.updates.find(item => item.path === file.path && item.previousSha256 === file.sha256);
		if(update) file.sha256 = update.currentSha256;
	}
	const inventoryPath = "docs/type-surface.v1.json";
	const recorded = history.updates.find(update => update.path === inventoryPath);
	const atPromotion = beforeCheckedRecordPerlPromotionSource(inventoryPath,
		await readFile(inventoryPath, "utf8"), recorded.currentSha256);
	assert.equal(sha256(atPromotion), recorded.currentSha256);
	const milestone = JSON.parse(atPromotion);
	// New references use today's validators; authenticate their exact promotion-era bytes.
	const authenticated = [];
	for(const entry of proposed.evidence.slice(previous.evidence.length))
		for(const file of entry.files.filter(item => !item.path.startsWith("docs/evidence/")))
		{
			const original = milestone.evidence.find(item => item.id === entry.id)?.files.find(item => item.path === file.path);
			assert.ok(original, file.path);
			const source = await readFile(file.path, "utf8");
			assert.equal(sha256(source), file.sha256, file.path);
			assert.equal(sha256(beforeCheckedRecordPerlPromotionSource(file.path, source, original.sha256)), original.sha256, file.path);
			authenticated.push([file, original.sha256]);
		}
	// Validator objects are shared by all four references. Mutate only after checking every one.
	for(const [file, digest] of authenticated) file.sha256 = digest;
	assert.deepEqual(proposed, milestone);
});

test("Perl checked-record promotion refuses narrowed matrices, forged references and overlapping claims", async () => {
	const previous = await predecessor(), references = await checkedRecordPerlReferences();
	for(const changed of [references.slice(1), [...references].reverse(), [...references, references[0]]])
		await assert.rejects(() => promoteCheckedRecordPerl(previous, changed));
	for(const mutate of [item => { item.profiles = ["php-wasm"]; }
		, item => { item.scope = "All dependent records pass"; }
		, item => { item.positions.push("field"); }
		, item => { item.resultOnly = false; }
		, item => { item.sourcePath = "ordinary-source"; }
		, item => { item.revision = "0".repeat(40); }
		, item => { item.command = "node --test"; }
		, item => { item.configurations.pop(); }, item => { item.modes.pop(); }
		, item => { item.artifacts.pop(); }
		, item => { item.files[0].sha256 = "0".repeat(64); }
		, item => { item.checks[0][2] = 0; }]) {
		const changed = structuredClone(references); mutate(changed.at(-1));
		await assert.rejects(() => promoteCheckedRecordPerl(previous, changed));
		}
	const promoted = await promoteCheckedRecordPerl(previous, references);
	await assert.rejects(() => promoteCheckedRecordPerl(promoted, references), /Already promoted/u);
	const overlap = structuredClone(previous);
	overlap.observations.push(structuredClone(promoted.observations.at(-1)));
	await assert.rejects(() => promoteCheckedRecordPerl(overlap, references), /Overlapping/u);
});

test("Perl consumer and author guides distinguish installed checked records from unfinished positions", async () => {
	const perl = await readFile("docs/consume/perl.md", "utf8");
	assert.ok(perl.includes("### Checked records\n"));
	assert.ok(perl.includes("checked-record-perl-installed-20261011.md"));
	assert.ok(perl.includes("LeanBridge::CheckedRecords::width($interval)->bstr"));
	assert.ok(perl.includes("creating the Perl object alone does not establish"));
	const row = perl.split("\n").find(line => line.startsWith("| `Checked records and closed Nat indices`"));
	assert.ok(row.includes(checkedRecordPerlConversion));
	for(const path of ["Ordinary source", "Reviewed IR"])
		assert.ok(row.includes(`${path}: Installed checks passed (input, result)`));
	assert.ok(row.includes("Not audited (field, callback input, callback result)"));
	const author = await readFile("docs/lean/existing-package.md", "utf8");
	assert.ok(author.includes("[Installed Perl checks](../evidence/checked-record-perl-installed-20261011.md)"));
	assert.ok(author.includes("[Installed browser checks](../evidence/checked-record-browser-promotion-20261011.md)"));
	assert.ok(author.includes("PHP-Wasm checked-record execution remains pending."));
	assert.ok(author.includes("callbacks and owned positions remain unsupported."));
	assert.ok(!author.includes("PHP-Wasm and browser checked-record execution remain pending."));
	assert.ok(!author.includes("Perl and PHP-Wasm checked-record adapters remain pending."));
	const decisions = await readFile("docs/lean/export-decisions.md", "utf8");
	assert.ok(!decisions.includes("Installed acceptance for this mapping is pending."));
	assert.ok(decisions.includes("Perl, native PHP and WIT/WASI"));
});

test("Perl checked-record promotion history authenticates exact transitions and rejects unknown edits", async () => {
	const history = JSON.parse(await readFile(checkedRecordPerlPromotionHistoryPath));
	assert.equal(history.schemaVersion, 1); assert.equal(history.milestone, "checked-record-perl-promotion-v1");
	assert.equal(history.predecessorCommit, checkedRecordPerlPromotionPredecessor);
	assert.deepEqual(history.updates.map(update => update.path), checkedRecordPerlPromotionChangedPaths);
	for(const update of history.updates)
	{
		const source = beforeCheckedRecordPerlPromotionSource(update.path,
			await readFile(update.path, "utf8"), update.currentSha256);
		const previous = reverseCheckedRecordPerlPromotionUpdate(source, update);
		assert.equal(beforeCheckedRecordPerlPromotionSource(update.path, source), previous);
		assert.equal(beforeFinRefinementSource(update.path, source, update.previousSha256), previous);
		const bytes = Buffer.from(source);
		assert.equal(beforeFinRefinementSource(update.path, bytes, update.currentSha256), bytes);
		assert.equal(beforeCheckedRecordPerlPromotionSource(update.path, source + "\nunknown"), source + "\nunknown");
		for(const mutate of [item => { item.currentSha256 = "0".repeat(64); }
			, item => { item.previousSha256 = "0".repeat(64); }
			, item => { item.path = "unknown"; }, item => { item.edits = []; }
			, item => { item.edits[0].start = -1; }
			, item => { item.edits[0].current += "forged"; }]) {
			const changed = structuredClone(update); mutate(changed);
			assert.throws(() => reverseCheckedRecordPerlPromotionUpdate(source, changed));
			}
	}
	assert.equal(sha256(await readFile("docs/evidence/checked-record-perl-ci-source-history-20261011.json")), "a20ab31a138f760c1a9c8f870764517fafbdcc2822ee24643b93c18d751677fb");
});

test("Perl checked-record promotion writer refuses unrelated HEAD before writing", async t => {
	const directory = await mkdtemp(join(tmpdir(), "lean-bridge-perl-checked-promotion-guard-"));
	t.after(() => rm(directory, { recursive: true, force: true }));
	const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("GIT_")));
	const git = args => execFileSync("git", args, { cwd: directory, env, stdio: "pipe" });
	git(["init", "--quiet"]);
	git(["-c", "user.name=Test", "-c", "user.email=test@example.invalid", "-c", "commit.gpgsign=false", "commit", "--allow-empty", "--quiet", "-m", "unrelated"]);
	const result = spawnSync(process.execPath, [resolve("scripts/update-checked-record-perl-promotion-history.mjs")], { cwd: directory, env, encoding: "utf8" });
	assert.equal(result.status, 1); assert.match(result.stderr, /draft-only/u);
	assert.deepEqual(await readdir(directory), [".git"]);
});
