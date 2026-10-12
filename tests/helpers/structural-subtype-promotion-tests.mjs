/**
 * Bind structural support to original installed selections without widening other positions.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../../src/capsule/node.mjs";
import { readTypeSurface, typeSurfaceCells, validateTypeSurface } from "../../src/adoption/type-surface.mjs";
import { structuralSubtypeArchives, structuralSubtypeProfiles, structuralSubtypeArchiveReferences, structuralSubtypeReferences, assertStructuralSubtypeOriginalTap, promoteStructuralSubtypes, structuralSubtypeConversion } from "./structural-subtype-promotion.mjs";
import { structuralSubtypeConfiguration } from "./structural-subtype-installed-fixture.mjs";

const predecessor = () => JSON.parse(execFileSync("git", ["show", "e844290c9bc4eb1052dcbce6e730f96e59165990:docs/type-surface.v1.json"], { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 }));

test("structural Subtype guides describe the installed scope and use the actual author fixture", async () => {
	const nominalFieldGuides = ["c", "cpp", "perl", "python", "ruby", "rust"].map(name => `docs/consume/${name}.md`);
	for(const path of [...["c", "cpp", "python", "rust", "ruby", "dotnet", "java", "kotlin", "perl", "wit-wasi"].map(name => `docs/consume/${name}.md`), "docs/javascript-typescript.md", "docs/php.md"])
	{
		const source = await readFile(path, "utf8");
		const row = source.split("\n").find(line => line.startsWith("| `Subtype /"));
		assert.ok(row.includes(structuralSubtypeConversion), path);
		if(path === "docs/javascript-typescript.md")
		{
			assert.ok(row.includes("Ordinary source: Node JavaScript / TypeScript: Installed checks passed (input, result, field)"));
			assert.ok(row.includes("Reviewed IR: Node JavaScript / TypeScript: Installed checks passed (input, result, field)"));
			assert.ok(row.includes("Browser / React / Worker: Installed checks passed (input, result)"));
		}
		else if(nominalFieldGuides.includes(path))
		{
			assert.ok(row.includes("Ordinary source: Installed checks passed (input, result, field)"), path);
			assert.ok(row.includes("Reviewed IR: Installed checks passed (input, result, field)"), path);
			assert.ok(row.includes("Not audited (callback input, callback result)"), path);
		}
		else
		{
			assert.ok(row.includes("Ordinary source: Installed checks passed (input, result)"), path);
			assert.ok(row.includes("Reviewed IR: Installed checks passed (input, result)"), path);
		}
		if(!nominalFieldGuides.includes(path))
			assert.ok(row.includes("Not audited (field, callback input, callback result)"), path);
		assert.ok(source.includes("### Subtypes inside containers\n"), path);
		assert.ok(source.includes("structural-subtype-promotion-20261011.md"), path);
		assert.ok(source.replace(/\s+/gu, " ").includes("hosted release-floor acceptance"), path);
		assert.doesNotMatch(source, /Only top-level parameters and results are supported|Nested and callback\nSubtype support remains separate|Subtypes nested in containers, record fields or callback signatures\nare not supported/u);
	}
	const author = await readFile("docs/lean/existing-package.md", "utf8");
	const row = author.split("\n").find(line => line.startsWith("| `Subtype` inside"));
	assert.equal((row.match(/Installed/gu) ?? []).length, 5);
	assert.ok(author.includes("Packages combining refinements with graph, owned or callable transports remain rejected."));
	assert.doesNotMatch(author, /Structural-container compiler and adapter checks are implemented; installed acceptance is still pending|Nested, nominal-field and callback Subtypes remain unsupported/u);
	const guide = await readFile("docs/lean/export-decisions.md", "utf8");
	const section = guide.split("### Select constructors inside containers\n")[1].split("## Check each consumer representation")[0];
	assert.ok(section.includes("`StructuralSubtypes.lean`"));
	assert.ok(section.includes("`lean-bridge.exports.json`"));
	const example = section.match(/```lean\n([\s\S]*?)\n```/u)[1];
	const fixture = await readFile("tests/fixtures/onboarding/structural-subtypes/StructuralSubtypes.lean", "utf8");
	for(const block of example.split("\n\n")) assert.ok(fixture.includes(block), block);
	const configuration = JSON.parse(section.match(/```json\n([\s\S]*?)\n```/u)[1]);
	const full = structuralSubtypeConfiguration("ordinary", ["npm"]);
	assert.deepEqual(configuration, { schemaVersion: full.schemaVersion
		, modules: full.modules
		, targets: full.targets
		, exports: ["StructuralSubtypes.arrays"]
		, contracts: { "StructuralSubtypes.arrays": full.contracts["StructuralSubtypes.arrays"] } });
});

test("structural promotion authenticates twenty-four original selections across seventeen consumer profiles", async () => {
	const references = await structuralSubtypeReferences();
	assert.equal(references.length, 24);
	assert.deepEqual([...structuralSubtypeProfiles].sort(), ["c", "cpp", "python", "rust", "ruby", "dotnet", "java", "kotlin", "php-native", "wit-wasi", "perl", "node-javascript", "node-typescript", "browser-javascript", "browser-react", "browser-worker", "php-wasm"].sort());
	for(const reference of references)
	{
		assert.match(reference.id, /^structural-subtype-[a-z0-9-]+-installed$/u);
		assert.ok(reference.command.includes("--test-concurrency=1"));
		assert.equal(reference.sourcePath, reference.route === "ordinary" ? "ordinary-source" : "reviewed-ir");
		assert.ok(reference.files.some(file => file.path.endsWith("/run.tap")));
		assert.ok(reference.files.some(file => file.path.includes("/sources/src/analyze/NativeExports.lean")));
		assert.ok(reference.artifacts.length > 0);
		for(const file of reference.files) assert.equal(sha256(await readFile(file.path)), file.sha256, file.path);
	}
	for(const route of ["ordinary", "reviewed"])
	{
		const refs = references.filter(item => item.route === route);
		assert.deepEqual(refs.filter(item => item.host === "python").map(item => item.counts.python), ["3.11.16", "3.12.14"]);
		assert.deepEqual(refs.find(item => item.host === "perl").counts.configurations, ["5.36.3-threaded", "5.36.3-unthreaded", "5.38.2-threaded", "5.38.2-unthreaded"]);
		assert.deepEqual(refs.find(item => item.host === "perl").counts.modes, ["prebuilt-only", "build-xs"]);
		assert.equal(refs.find(item => item.host === "perl").counts.executions, 16);
		assert.equal(refs.find(item => item.host === "php-wasm").counts.executions, 12);
		const browser = refs.find(item => item.host === "browser");
		assert.deepEqual(browser.counts.engines, ["chromium", "firefox", "webkit"]);
		assert.equal(browser.counts.nodeExecutions, 2); assert.equal(browser.counts.browserExecutions, 12);
		assert.equal(browser.counts.lifecycleObservations, 51);
		assert.ok(browser.scope.includes("one bad position, not all nine"));
	}
});

test("structural promotion refuses missing and corrupted original indexes, sources, runs and compiler records", async t => {
	let controls = 0;
	for(const { host } of structuralSubtypeArchives)
	{
		const root = `docs/evidence/structural-subtype-${host}-20261011`, bytes = await readFile(root + "/index.json"), index = JSON.parse(bytes);
		const files = new Map([[root + "/index.json", bytes]]);
		for(const file of index.files) files.set(root + "/" + file.path, await readFile(root + "/" + file.path));
		const targets = [root + "/index.json", root + "/runner.mjs", root + "/sources/src/analyze/NativeExports.lean"];
		for(const run of index.runs)
		{
			const label = run.label ?? run.route;
			targets.push(...["start.json", "end.json", "run.tap", "records/report.json"].map(file => `${root}/${label}/${file}`));
			const model = index.files.find(file => file.path.startsWith(label + "/records/build-0/") && /(?:model|binding-ir)\.json$/u.test(file.path));
			assert.ok(model); targets.push(root + "/" + model.path);
		}
		for(const target of targets) for(const missing of [true, false])
		{
			assert.ok(files.has(target));
			await assert.rejects(() => structuralSubtypeArchiveReferences(host, async path => {
				assert.ok(files.has(path), path);
				if(path !== target) return files.get(path);
				if(missing) throw new Error("Missing original " + path);
				return Buffer.concat([files.get(path), Buffer.from("changed")]);
			})); controls++;
		}
	}
	await assert.rejects(() => structuralSubtypeArchiveReferences("../native"));
	t.diagnostic(`${controls} missing/corrupt original controls rejected`);
});

test("structural promotion checks original three-test native TAP without substituting a synthetic one-test run", async () => {
	for(const [host, lane, count] of [["native", "c-cpp", 3], ["browser", "node-browser", 1]]) for(const route of ["ordinary", "reviewed"])
	{
		const tap = await readFile(`docs/evidence/structural-subtype-${host}-20261011/${route}/run.tap`, "utf8");
		assertStructuralSubtypeOriginalTap(tap, lane, route);
		for(const changed of [tap + tap
			, tap.replace("TAP version 13\n", "")
			, tap.replace(`1..${count}\n`, "1..0\n")
			, tap.replace("# skipped 0", "# skipped 1")
			, tap.replace("# fail 0", "# fail 1")
			, tap.replace("ok 1 -", "not ok 1 -"), tap + "Bail out! stopped\n"
			, tap.replace(/^(ok \d+ - .+)$/mu, "$1 # SKIP")
			, tap.replace(/^(ok \d+ - .+)$/mu, "$1 # TODO")
			, tap.replace(/^(ok \d+ - ).+$/mu, "$1unrelated test")]) {
			assert.notEqual(changed, tap); assert.throws(() => assertStructuralSubtypeOriginalTap(changed, lane, route));
			}
		assert.throws(() => assertStructuralSubtypeOriginalTap(tap, lane, route === "ordinary" ? "reviewed" : "ordinary"));
	}
});

test("structural promotion supplements exactly sixty-eight existing cells and preserves other claims", async () => {
	const original = predecessor(), contracts = await readTypeSurface();
	const proposed = await promoteStructuralSubtypes(original, await structuralSubtypeReferences());
	validateTypeSurface(proposed, contracts);
	assert.equal(original.evidence.length, 440); assert.equal(original.observations.length, 555);
	assert.equal(proposed.evidence.length, 464); assert.equal(proposed.observations.length, 555);
	assert.deepEqual(proposed.evidence.slice(0, 440), original.evidence);
	const before = typeSurfaceCells(original, contracts), after = typeSurfaceCells(proposed, contracts), changed = [];
	for(const [index, cell] of after.entries())
	{
		if(JSON.stringify(cell) === JSON.stringify(before[index])) continue;
		assert.equal(cell.shape, "subtype"); assert.ok(["parameter", "result"].includes(cell.position));
		assert.ok(structuralSubtypeProfiles.includes(cell.profile));
		for(const stage of Object.keys(cell.stages))
		{
			assert.equal(cell.stages[stage].state, "passed"); assert.equal(before[index].stages[stage].state, "passed");
			assert.ok(before[index].stages[stage].evidence.every(id => cell.stages[stage].evidence.includes(id)));
		}
		changed.push(`${cell.path}/${cell.profile}/${cell.position}`);
	}
	assert.deepEqual(changed.sort(), ["ordinary-source", "reviewed-ir"].flatMap(path => structuralSubtypeProfiles.flatMap(profile => ["parameter", "result"].map(position => `${path}/${profile}/${position}`))).sort());
	let observations = 0;
	for(const [index, observation] of proposed.observations.entries())
	{
		if(JSON.stringify(observation) === JSON.stringify(original.observations[index])) continue;
		assert.deepEqual(observation.shapes, ["subtype"]); assert.deepEqual(observation.positions, ["parameter", "result"]);
		assert.equal(observation.conversionNotes.subtype, structuralSubtypeConversion); observations++;
	}
	assert.equal(observations, 25);
});

test("structural promotion rejects missing selections, forged scope, reordered or repeated references and overlaps", async () => {
	const original = predecessor(), references = await structuralSubtypeReferences();
	for(const altered of [references.slice(1), [...references].reverse(), [...references, references[0]]])
		await assert.rejects(() => promoteStructuralSubtypes(original, altered));
	for(const change of [item => { item.profiles = ["php-wasm"]; }
		, item => { item.route = "reviewed"; }
		, item => { item.sourcePath = "reviewed-ir"; }
		, item => { item.scope = "All dependent types pass"; }
		, item => { item.revision = "0".repeat(40); }
		, item => { item.command = "node --test"; }
		, item => { item.files.pop(); }
		, item => { item.files[0].sha256 = "0".repeat(64); }
		, item => { item.artifacts.pop(); }, item => { item.counts.checks = 0; }]) {
		const altered = structuredClone(references); change(altered[0]);
		assert.notDeepEqual(altered, references); await assert.rejects(() => promoteStructuralSubtypes(original, altered));
		}
	const promoted = await promoteStructuralSubtypes(original, references);
	await assert.rejects(() => promoteStructuralSubtypes(promoted, references), /Already promoted/u);
	const duplicate = structuredClone(original), subtype = duplicate.observations.find(item => item.shapes.includes("subtype"));
	duplicate.observations.push({ ...structuredClone(subtype), id: "unreviewed-overlap" });
	await assert.rejects(() => promoteStructuralSubtypes(duplicate, references), /overlapping/u);
	const missing = structuredClone(original); missing.observations = missing.observations.filter(item => item.id !== subtype.id);
	await assert.rejects(() => promoteStructuralSubtypes(missing, references), /Missing/u);
});
