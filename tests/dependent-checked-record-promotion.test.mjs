/**
 * Keep dependent checked-record promotion exact and fail-closed before every
 * hosted lane has an archive verifier.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { access, readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../src/capsule/node.mjs";
import {
	typeSurfaceCells, validateTypeSurface
} from "../src/adoption/type-surface.mjs";
import {
	assertDependentCheckedRecordPromotionReferences
	, dependentCheckedRecordPromotionCurrentSourcePaths
	, dependentCheckedRecordPromotionLanes
	, dependentCheckedRecordPromotionLimit
	, dependentCheckedRecordPromotionPath
	, dependentCheckedRecordPromotionPinBaseline
	, dependentCheckedRecordPromotionProfiles
	, dependentCheckedRecordPromotionReferences
	, dependentCheckedRecordPromotionRoutes
	, loadDependentCheckedRecordVerifiers
	, promoteDependentCheckedRecords
	, reconcileDependentCheckedRecordSourcePins
	, renderDependentCheckedRecordPromotion
} from "./helpers/dependent-checked-record-promotion.mjs";

const readJson = async path => JSON.parse(await readFile(path, "utf8"));
const inventoryPath = "docs/type-surface.v1.json";
const resultOnly = route => route.startsWith("result-only-");
const root = lane => `docs/evidence/dependent-checked-record-${lane}-20261021`;
const verifier = lane => `tests/helpers/dependent-checked-record-${lane}-evidence.mjs`;
const hex = (lane, length) => sha256(lane).slice(0, length);

// Synthetic, test-only references in the exact shape a real replay derives.
const synthetic = () => dependentCheckedRecordPromotionLanes.flatMap((definition, lane) =>
	dependentCheckedRecordPromotionRoutes.map(route => ({
		id: `dependent-checked-record-${definition.lane}-${route}-hosted-installed`
		, lane: definition.lane, route
		, mode: resultOnly(route) ? "result-only" : "full"
		, sourcePath: route.replace(/^result-only-/u, "")
		, profiles: [...definition.profiles]
		, positions: resultOnly(route) ? ["result"] : ["parameter", "result"]
		, revision: hex(`${definition.lane}/producer`, 40)
		, consumerRevision: hex(`${definition.lane}/producer`, 40)
		, checkerRevision: hex(`${definition.lane}/producer`, 40)
		, archiverRevision: hex(`${definition.lane}/archiver`, 40)
		, hostedRun: 1000 + lane, job: 2000 + lane, artifact: 3000 + lane
		, command: `node --input-type=module -e "await (await import('./${verifier(definition.lane)}')).checkDependentCheckedRecord${definition.name}Evidence()"`
		, scope: `Test-only ${definition.lane} ${route} scope. ${dependentCheckedRecordPromotionLimit}`
		, files: [
			{ path: `${root(definition.lane)}/index.json`, sha256: hex(`${definition.lane}/index`, 64) }
			, { path: `${root(definition.lane)}/${route}/records/report.json`, sha256: hex(`${definition.lane}/${route}`, 64) }
			, { path: `${root(definition.lane)}/hosted/artifact.zip.part-000`, sha256: hex(`${definition.lane}/artifact`, 64) }
		]
		, artifacts: [{
			path: `${root(definition.lane)}/hosted/artifact.zip.part-000`
			, sha256: hex(`${definition.lane}/artifact`, 64)
		}]
	}))
);

const [document, irSchema, consumers] = await Promise.all([
	readJson(inventoryPath), readJson("schema/binding-ir.schema.json")
	, readJson("docs/consumer-support.v1.json")
]);
const contracts = { irSchema, consumers };
const target = new Set(dependentCheckedRecordPromotionProfiles.flatMap(profile =>
	["ordinary-source", "reviewed-ir"].flatMap(path =>
		["parameter", "result"].map(position =>
			`${profile}/checked-record/${path}/${position}`))));

test("dependent promotion names exactly eleven lanes, seventeen profiles and four routes", () => {
	assert.deepEqual(dependentCheckedRecordPromotionLanes.map(item => item.lane), [
		"browser", "native", "dotnet", "jvm", "php", "php-wasm"
		, "python", "ruby", "rust", "perl", "wit"
	]);
	assert.equal(dependentCheckedRecordPromotionProfiles.length, 17);
	assert.equal(new Set(dependentCheckedRecordPromotionProfiles).size, 17);
	assert.deepEqual(new Set(dependentCheckedRecordPromotionProfiles)
		, new Set(document.profiles.map(item => item.id)));
	assert.deepEqual(dependentCheckedRecordPromotionRoutes, [
		"ordinary-source", "reviewed-ir"
		, "result-only-ordinary-source", "result-only-reviewed-ir"
	]);
	assert.equal(target.size, 68);
	assertDependentCheckedRecordPromotionReferences(synthetic());
});

test("dependent promotion adds evidence to exactly 68 cells and changes nothing else", () => {
	const references = synthetic();
	const promoted = promoteDependentCheckedRecords(document, references);
	assert.equal(validateTypeSurface(promoted, contracts), true);
	assert.deepEqual(promoted.evidence.slice(-44).map(item => item.id)
		, references.map(item => item.id));
	const before = new Map(typeSurfaceCells(document, contracts).map(cell => [cell.id, cell]));
	let changed = 0;
	for(const cell of typeSurfaceCells(promoted, contracts))
	{
		const original = before.get(cell.id);
		if(!target.has(cell.id))
		{
			assert.deepEqual(cell, original, cell.id);
			continue;
		}
		changed++;
		const [profile, , path, position] = cell.id.split("/");
		const expected = references.filter(item => item.profiles.includes(profile)
			&& item.sourcePath === path && item.positions.includes(position))
			.map(item => item.id);
		assert.equal(expected.length, position === "result" ? 2 : 1, cell.id);
		for(const [name, stage] of Object.entries(cell.stages))
		{
			assert.equal(stage.state, "passed", cell.id);
			assert.deepEqual(stage.evidence, [...original.stages[name].evidence, ...expected]
				, cell.id);
		}
		assert.deepEqual(cell.limitations, [...original.limitations
			, dependentCheckedRecordPromotionLimit], cell.id);
		assert.ok(cell.scope.startsWith(original.scope), cell.id);
		assert.ok(cell.conversionNote.startsWith(original.conversionNote), cell.id);
	}
	assert.equal(changed, 68);
	assert.throws(() => promoteDependentCheckedRecords(promoted, references), /Already promoted/u);
});

test("dependent promotion reconciles only selected current-source pins", () => {
	const original = {
		marker: "unchanged"
		, evidence: [
			{ files: [
				{ path: "src/changed.mjs", sha256: "1".repeat(64) }
				, { path: "docs/evidence/archive.json", sha256: "2".repeat(64) }
			] }
			, { files: [
				{ path: "src/changed.mjs", sha256: "1".repeat(64) }
				, { path: "src/current.mjs", sha256: "3".repeat(64) }
			] }
		]
	};
	const digests = new Map([
		["src/changed.mjs", "4".repeat(64)]
		, ["src/current.mjs", "3".repeat(64)]
		, ["src/unreferenced.mjs", "5".repeat(64)]
	]);
	const result = reconcileDependentCheckedRecordSourcePins(original, digests);
	assert.equal(result.refreshed, 2);
	assert.equal(result.inventory.marker, "unchanged");
	assert.deepEqual(result.inventory.evidence.flatMap(item => item.files), [
		{ path: "src/changed.mjs", sha256: "4".repeat(64) }
		, { path: "docs/evidence/archive.json", sha256: "2".repeat(64) }
		, { path: "src/changed.mjs", sha256: "4".repeat(64) }
		, { path: "src/current.mjs", sha256: "3".repeat(64) }
	]);
	assert.equal(original.evidence[0].files[0].sha256, "1".repeat(64));
	assert.throws(() => reconcileDependentCheckedRecordSourcePins(original
		, new Map([["src/changed.mjs", "invalid"]])));
});

test("dependent promotion selects added and modified live pins but no archive"
	, () => {
	const inventory = { evidence: [{ files: [
		{ path: "src/modified.mjs", sha256: "1".repeat(64) }
		, { path: "tests/added.test.mjs", sha256: "2".repeat(64) }
		, { path: "docs/evidence/immutable/index.json"
			, sha256: "3".repeat(64) }
	] }] };
	assert.deepEqual(
		dependentCheckedRecordPromotionCurrentSourcePaths(inventory, [
			"src/modified.mjs", "tests/added.test.mjs"
			, "docs/evidence/immutable/index.json", "src/unpinned.mjs"
			, "src/modified.mjs"
		])
		, ["src/modified.mjs", "tests/added.test.mjs"]
	);
	assert.throws(() => dependentCheckedRecordPromotionCurrentSourcePaths(
		inventory, new Set()));
	}
);

test("dependent promotion baseline covers every stale live pin", async () => {
	const changed = execFileSync("git", [
		"diff", "--name-only", "--diff-filter=AM"
		, dependentCheckedRecordPromotionPinBaseline, "HEAD", "--"
	], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 })
		.trim().split("\n").filter(Boolean);
	const selected = dependentCheckedRecordPromotionCurrentSourcePaths(
		document, changed);
	assert.ok(!selected.some(path => path.startsWith("docs/evidence/")));
	const admitted = new Set(selected), pins = new Map();
	for(const evidence of document.evidence)
		for(const file of evidence.files)
		{
			if(file.path.startsWith("docs/evidence/")) continue;
			if(!pins.has(file.path)) pins.set(file.path, new Set());
			pins.get(file.path).add(file.sha256);
		}
	const missed = [];
	for(const [path, expected] of pins)
	{
		let bytes;
		try
		{ bytes = await readFile(path); }
		catch(error)
		{
			if(error?.code !== "ENOENT") throw error;
			bytes = execFileSync("git", ["show", `HEAD:${path}`], {
				maxBuffer: 512 * 1024 * 1024
			});
		}
		const actual = sha256(bytes);
		if([...expected].some(digest => digest !== actual)
			&& !admitted.has(path)) missed.push(path);
	}
	assert.deepEqual(missed, []);
});

test("dependent promotion refuses missing, reordered, duplicated and forged references", () => {
	const reject = (mutate, pattern = assert.AssertionError) => {
		const references = synthetic();
		mutate(references);
		assert.throws(() => promoteDependentCheckedRecords(document, references), pattern);
		assert.throws(() => renderDependentCheckedRecordPromotion(references), pattern);
	};
	reject(references => references.splice(20, 4));
	reject(references => references.splice(0, 4));
	reject(references => references.push(structuredClone(references[0])));
	reject(references => { [references[0], references[4]] = [references[4], references[0]]; });
	reject(references => { [references[0], references[1]] = [references[1], references[0]]; });
	reject(references => { references[5] = structuredClone(references[4]); });
	reject(references => { references[0].profiles = ["php-native"]; });
	reject(references => { references[20].profiles = ["php-native"]; });
	reject(references => { references[2].positions = ["parameter", "result"]; });
	reject(references => { references[0].positions = ["result"]; });
	reject(references => { references[0].mode = "result-only"; });
	reject(references => { references[0].sourcePath = "reviewed-ir"; });
	reject(references => { references[0].revision = "HEAD"; });
	reject(references => { references[1].hostedRun = 9999; });
	reject(references => { for(const item of references.slice(4, 8)) item.hostedRun = 1000; });
	reject(references => { for(const item of references.slice(4, 8)) item.artifacts = structuredClone(references[0].artifacts); });
	reject(references => {
		references[5].artifacts[0].sha256 = references[0].artifacts[0].sha256;
		const path = references[5].artifacts[0].path;
		references[5].files.find(file => file.path === path).sha256
			= references[0].artifacts[0].sha256;
	});
	reject(references => { references[0].files[1].path = "docs/evidence/other/report.json"; });
	reject(references => { references[0].files[1].path = `${root("browser")}/reviewed-ir/records/report.json`; });
	reject(references => { references[0].files.push({
		path: `${root("browser")}/reviewed-ir/records/extra.json`
		, sha256: hex("wrong-route", 64)
	}); });
	reject(references => { references[0].files.reverse(); });
	reject(references => { references[0].files.push(structuredClone(references[0].files[1])); });
	reject(references => { references[0].files[1].sha256 = "0"; });
	reject(references => { references[0].artifacts[0].path
		= `${root("browser")}/hosted/other.zip.part-000`; });
	reject(references => { references[0].artifacts = []; });
	// Artifacts are hosted parts only, even when the cited file is retained.
	reject(references => {
		for(const item of references.slice(0, 4))
			item.artifacts = [structuredClone(references[0].files[1])];
	}, /is not a hosted part/u);
	reject(references => {
		for(const item of references.slice(0, 4))
			item.artifacts = [{ path: `${root("browser")}/sources/producer/fixture.lean`, sha256: hex("source", 64) }];
	}, /is not a hosted part/u);
	// One part of another lane is refused alone, reordered or alongside new parts.
	const shareOnePart = (references, order) => {
		const own = { path: `${root("native")}/hosted/artifact.zip.part-001`, sha256: hex("native/extra", 64) };
		const borrowed = { path: `${root("native")}/hosted/artifact.zip.part-000`, sha256: references[0].artifacts[0].sha256 };
		const parts = order === "first" ? [borrowed, own] : [own, borrowed];
		for(const item of references.slice(4, 8))
		{
			item.artifacts = structuredClone(parts);
			item.files = [item.files[0], item.files[1]
				, ...structuredClone(parts).sort((left, right) => left.path.localeCompare(right.path))];
		}
	};
	reject(references => shareOnePart(references, "first"), /reuses another lane's artifact part/u);
	reject(references => shareOnePart(references, "last"), /reuses another lane's artifact part/u);
	reject(references => { references[0].scope = "Test-only scope."; });
	reject(references => { references[0].command = "true"; });
	reject(references => { references[0].extra = true; });
	reject(references => { delete references[0].job; });
});

test("dependent promotion renders the exact hosted boundary", () => {
	const references = synthetic();
	const summary = renderDependentCheckedRecordPromotion(references);
	assert.match(summary, /exactly 68 cells: seventeen profiles, two author paths and two positions/u);
	for(const definition of dependentCheckedRecordPromotionLanes)
	{
		const reference = references.find(item => item.lane === definition.lane);
		assert.ok(summary.includes(`| ${definition.lane} | ${definition.profiles.join(", ")} |`), definition.lane);
		assert.ok(summary.includes(`dependent-checked-record-${definition.lane}-20261021/index.json`), definition.lane);
		assert.ok(summary.includes(`| ${reference.hostedRun} | \`${reference.revision}\` |`), definition.lane);
	}
	assert.match(summary, /PHP-Wasm is the shared result tracked by #1461 and is not inferred from native PHP/u);
	assert.match(summary, /does not cover other dependent field kinds/u);
	assert.match(summary, /callbacks, owned positions/u);
});

test("dependent promotion loads every lane verifier or names each missing one", async () => {
	const modules = new Map(dependentCheckedRecordPromotionLanes.map(definition => [
		verifier(definition.lane), {
			[`checkDependentCheckedRecord${definition.name}Evidence`]: async () => ({})
			, [`dependentCheckedRecord${definition.name}Evidence`]: root(definition.lane)
			, [`dependentCheckedRecord${definition.name}EvidenceSha256`]: hex(definition.lane, 64)
		}
	]));
	const missing = path => Object.assign(new Error(`Cannot find module '/repo/${path}'`)
		, { code: "ERR_MODULE_NOT_FOUND"
			, url: new URL(`../${path}`, import.meta.url).href });
	const loader = (absent = [], override = {}) => async path => {
		if(absent.some(lane => path === verifier(lane))) throw missing(path);
		return { ...modules.get(path), ...override[path] };
	};
	assert.equal((await loadDependentCheckedRecordVerifiers(loader())).length, 11);
	await assert.rejects(loadDependentCheckedRecordVerifiers(loader(["native", "wit"]))
		, /refuses: no archive verifier for native, wit$/u);
	await assert.rejects(loadDependentCheckedRecordVerifiers(async path => {
		if(path === verifier("perl")) throw Object.assign(new Error("Cannot find module 'other'"), { code: "ERR_MODULE_NOT_FOUND" });
		return modules.get(path);
	}), /Cannot find module 'other'/u);
	await assert.rejects(loadDependentCheckedRecordVerifiers(async path => {
		if(path === verifier("perl")) throw Object.assign(new Error(
			`Cannot find module '/repo/missing.mjs' imported from /repo/${path}`
		), { code: "ERR_MODULE_NOT_FOUND"
			, url: new URL("../missing.mjs", import.meta.url).href });
		return modules.get(path);
	}), /Cannot find module '\/repo\/missing\.mjs'/u);
	await assert.rejects(loadDependentCheckedRecordVerifiers(loader([], {
		[verifier("jvm")]: { dependentCheckedRecordJvmEvidence: "docs/evidence/elsewhere" }
	})), assert.AssertionError);
	await assert.rejects(loadDependentCheckedRecordVerifiers(loader([], {
		[verifier("rust")]: { checkDependentCheckedRecordRustEvidence: undefined }
	})), /exports no archive verifier/u);
	// The real repository: refuse exactly while a verifier file is absent.
	const absent = [];
	for(const definition of dependentCheckedRecordPromotionLanes)
		await access(verifier(definition.lane)).catch(() => absent.push(definition.lane));
	if(absent.length)
		await assert.rejects(loadDependentCheckedRecordVerifiers()
			, new RegExp(`no archive verifier for ${absent.join(", ")}$`, "u"));
	else assert.equal((await loadDependentCheckedRecordVerifiers()).length, 11);
});

test("dependent promotion derives references only from authenticated archive indices", async () => {
	const indices = new Map(), verifiers = [];
	for(const [lane, definition] of dependentCheckedRecordPromotionLanes.entries())
	{
		const producer = hex(`${definition.lane}/producer`, 40);
		const files = [
			...dependentCheckedRecordPromotionRoutes.map(route => ({ path: `${route}/records/report.json`, bytes: 1, sha256: hex(`${definition.lane}/${route}`, 64) }))
			, { path: "hosted/artifact.zip.part-000", bytes: 1, sha256: hex(`${definition.lane}/artifact`, 64) }
			, { path: "sources/producer/fixture.lean", bytes: 1, sha256: hex(`${definition.lane}/source`, 64) }
		];
		const hostedRun = { runId: 1000 + lane, job: { id: 2000 + lane }
			, artifact: { id: 3000 + lane, parts: [{ path: "hosted/artifact.zip.part-000", sha256: hex(`${definition.lane}/artifact`, 64) }] } };
		const archiver = hex(`${definition.lane}/archiver`, 40);
		const runs = dependentCheckedRecordPromotionRoutes.map(route => ({ route }));
		const index = Buffer.from(JSON.stringify({
			producerCommit: producer, consumerCommit: producer
			, checkerCommit: producer, archiveCommit: archiver
			, runs, files, hostedRun
		}));
		indices.set(`${root(definition.lane)}/index.json`, index);
		verifiers.push({
			lane: definition.lane, evidence: root(definition.lane)
			, indexSha256: sha256(index)
			, check: async () => ({ producer, consumer: producer
				, checker: producer, archiver, files, hostedRun
				, supportPromoted: false, hostedAcceptance: true })
		});
	}
	const read = async path => indices.get(path);
	const references = await dependentCheckedRecordPromotionReferences(verifiers, read);
	assert.equal(references.length, 44);
	assert.deepEqual(references[2].positions, ["result"]);
	assert.deepEqual(references[2].files.map(item => item.path), [
		`${root("browser")}/index.json`
		, `${root("browser")}/result-only-ordinary-source/records/report.json`
		, `${root("browser")}/hosted/artifact.zip.part-000`
		, `${root("browser")}/sources/producer/fixture.lean`
	]);
	const refuse = async (mutate, pattern = assert.AssertionError) => {
		const copy = verifiers.map(item => ({ ...item }));
		await mutate(copy);
		await assert.rejects(dependentCheckedRecordPromotionReferences(copy, read), pattern);
	};
	await refuse(copy => copy.pop());
	await refuse(copy => copy.reverse());
	await refuse(copy => { copy[0].indexSha256 = "0".repeat(64); });
	const result = async (lane, change) => {
		const original = verifiers[lane].check;
		return async () => ({ ...await original(), ...change });
	};
	await refuse(async copy => { copy[3].check = await result(3, { supportPromoted: true }); });
	await refuse(async copy => { copy[3].check = await result(3, { hostedAcceptance: false }); });
	await refuse(async copy => { copy[4].check = await result(4, { producer: "f".repeat(40) }); });
	await refuse(async copy => { copy[5].check = await result(5, { files: [] }); });
	await refuse(async copy => { copy[6].check = await result(6, { hostedRun: { runId: 1 } }); });
	await refuse(async copy => { copy[7].check = async () => { throw new Error("archive replay failed"); }; }, /archive replay failed/u);
});

test("the promotion script refuses arguments and refuses to write while a verifier is missing", async () => {
	const absent = [];
	for(const definition of dependentCheckedRecordPromotionLanes)
		await access(verifier(definition.lane)).catch(() => absent.push(definition.lane));
	const before = sha256(await readFile(inventoryPath));
	const run = args => spawnSync(process.execPath
		, ["scripts/promote-dependent-checked-record-evidence.mjs", ...args], { encoding: "utf8" });
	const extra = run(["--force"]);
	assert.notEqual(extra.status, 0);
	assert.match(extra.stderr, /accepts no arguments/u);
	if(absent.length)
	{
		const refused = run([]);
		assert.notEqual(refused.status, 0);
		assert.match(refused.stderr, new RegExp(`no archive verifier for ${absent.join(", ")}`, "u"));
		await assert.rejects(access(dependentCheckedRecordPromotionPath), { code: "ENOENT" });
	}
	assert.equal(sha256(await readFile(inventoryPath)), before);
});
