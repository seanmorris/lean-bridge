/**
 * Keep PHP-Wasm nominal support tied to original installed selections and exact positions.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { readTypeSurface, typeSurfaceCells, validateTypeSurface } from "../../src/adoption/type-surface.mjs";
import { compileDocumentationPage } from "../../scripts/generate-site-content.mjs";
import { docPages } from "../../site/registry.mjs";
import { nominalSubtypePhpWasmArchive, nominalSubtypePhpWasmReferences, promoteNominalSubtypePhpWasm, nominalSubtypePhpWasmProfiles, nominalSubtypePhpWasmConversion, nominalSubtypePhpWasmLimit } from "./nominal-subtype-php-wasm-promotion.mjs";
import { nominalSubtypePhpWasmPromotionPredecessor } from "./nominal-subtype-php-wasm-promotion-history.mjs";

const predecessor = () => JSON.parse(execFileSync("git", ["show", `${nominalSubtypePhpWasmPromotionPredecessor}:docs/type-surface.v1.json`], { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 }));

test("nominal PHP-Wasm promotion authenticates four selections, twelve archives and 48 replayed contexts", async () => {
	const references = await nominalSubtypePhpWasmReferences();
	assert.deepEqual(references.map(item => [item.route, item.mode]), [["ordinary", "full"], ["ordinary", "result-only"], ["reviewed", "full"], ["reviewed", "result-only"]]);
	for(const reference of references)
	{
		assert.deepEqual(reference.profiles, ["php-wasm"]);
		assert.equal(reference.revision, "d121427862a7235b4e5e4a35a2355e56fc0f61f4");
		assert.equal(reference.sourcePath, reference.route === "ordinary" ? "ordinary-source" : "reviewed-ir");
		assert.equal(reference.counts.executions, 12);
		assert.deepEqual(reference.counts.packageFiles, { api: 18, component: 59, runtime: 22 });
		assert.deepEqual(reference.counts.counts, { checks: reference.mode === "full" ? 4254 : 2112
			, hostRejections: reference.mode === "full" ? 20 : 12, php: "8.4.1"
			, rejections: reference.mode === "full" ? 1032 : 0
			, snapshotControls: 8, word_bits: 32 });
		assert.deepEqual(reference.counts.runtime, { node: "v22.23.2", platform: "linux", arch: "x64" });
		assert.equal(reference.counts.browserVersion, "151.0.7922.34");
		assert.equal(reference.counts.dispatchObserved, false);
		assert.ok(reference.command.includes("--test-concurrency=1"));
		assert.ok(reference.command.includes("LEAN_BRIDGE_NOMINAL_SUBTYPE_PHP_WASM_TEST='1'"));
		assert.ok(reference.scope.includes(nominalSubtypePhpWasmLimit));
		assert.equal(reference.artifacts.length, 3);
		for(const suffix of ["/" + reference.route + "-" + reference.mode + "/run.tap"
			, "sources/src/analyze/NativeExports.lean"
			, "runner.mjs", "preflight.json", "independent-runtime.json"
			, "records/report.json"
			, "records/executions/11.json", "records/deployment/strict.php"
			, ...reference.artifacts.map(artifact => "records/handoff/" + artifact.path)]
		) assert.ok(reference.files.some(file => file.path.endsWith(suffix)), suffix);
	}
	assert.equal(references.reduce((sum, item) => sum + item.counts.executions, 0), 48);
	assert.equal(references.reduce((sum, item) => sum + item.counts.counts.checks * item.counts.executions, 0), 152784);
	assert.equal(references.reduce((sum, item) => sum + item.counts.counts.rejections * item.counts.executions, 0), 24768);
	assert.equal(references.reduce((sum, item) => sum + item.counts.counts.hostRejections * item.counts.executions, 0), 768);
	assert.equal(references.reduce((sum, item) => sum + item.counts.counts.snapshotControls * item.counts.executions, 0), 384);
});

test("nominal PHP-Wasm promotion refuses missing originals, invented scope and overlapping observations", async () => {
	const original = predecessor(), references = await nominalSubtypePhpWasmReferences();
	const targets = ["index.json", "runner.mjs"
		, "checkers/tests/helpers/nominal-subtype-php-wasm-report.mjs"
		, "sources/src/analyze/NativeExports.lean"
		, ...references.flatMap(item => ["start.json", "end.json", "run.tap"
			, "preflight.json", "independent-runtime.json"
			, "records/report.json", "records/executions/11.json"
			, "records/deployment/strict.php"
			, ...item.artifacts.map(artifact => "records/handoff/" + artifact.path)]
			.map(path => `${item.route}-${item.mode}/${path}`))];
	for(const target of targets)
	{
		await assert.rejects(nominalSubtypePhpWasmReferences(path => {
			if(path === `${nominalSubtypePhpWasmArchive}/${target}`) throw new Error("Missing original");
			return readFile(path);
		}));
		await assert.rejects(nominalSubtypePhpWasmReferences(async path => path === `${nominalSubtypePhpWasmArchive}/${target}` ? Buffer.from("changed") : readFile(path)));
	}
	for(const altered of [references.slice(1), references.slice().reverse(), [...references, references[0]]])
		await assert.rejects(promoteNominalSubtypePhpWasm(original, altered));
	const changes = [item => { item.profiles.pop(); }
		, item => { item.profiles.push("php-native"); }
		, item => { item.route = "reviewed"; }, item => { item.mode = "result-only"; }
		, item => { item.sourcePath = "reviewed-ir"; }
		, item => { item.revision = "0".repeat(40); }
		, item => { item.scope = "All Subtypes pass"; }
		, item => { item.command = "node --test"; }
		, item => { item.files.pop(); }
		, item => { item.files[0].sha256 = "0".repeat(64); }
		, item => { item.artifacts.pop(); }
		, item => { item.artifacts[0].sha256 = "0".repeat(64); }
		, item => { item.counts.dispatchObserved = true; }
		, item => { item.counts.runtime.node = "v0.0.0"; }
		, item => { item.counts.browserVersion = "0.0"; }
		, item => { item.counts.counts.checks = 1; }
		, item => { item.counts.executions = 1; }
		, item => { item.counts.counts.word_bits = 64; }];
	for(const change of changes)
	{
		const changed = structuredClone(references); change(changed[0]);
		await assert.rejects(promoteNominalSubtypePhpWasm(original, changed));
	}
	const promoted = await promoteNominalSubtypePhpWasm(original, references);
	await assert.rejects(promoteNominalSubtypePhpWasm(promoted, references), /Already promoted/u);
	const mutations = [item => { item.profiles.push("php-native"); }
		, item => { item.profiles.pop(); }
		, item => { item.positions.push("field"); }
		, item => { item.shapes.push("checked-record"); }
		, item => { item.stages.installedExecution.state = "unreviewed"; }];
	for(const id of ["php-wasm-subtype-ordinary", "php-wasm-subtype-reviewed"])
	{
		for(const mutate of mutations)
		{
			const changed = structuredClone(original); mutate(changed.observations.find(item => item.id === id));
			await assert.rejects(promoteNominalSubtypePhpWasm(changed, references));
		}
		const missing = structuredClone(original);
		missing.observations = missing.observations.filter(item => item.id !== id);
		await assert.rejects(promoteNominalSubtypePhpWasm(missing, references), /Missing/u);
		const overlap = structuredClone(original);
		overlap.observations.push({ ...structuredClone(original.observations.find(item => item.id === id)), id: "unreviewed-overlap" });
		await assert.rejects(promoteNominalSubtypePhpWasm(overlap, references), /overlapping/u);
	}
});

test("nominal PHP-Wasm promotion changes exactly six Subtype cells and adds two field cells", async () => {
	const original = predecessor(), references = await nominalSubtypePhpWasmReferences();
	const proposed = await promoteNominalSubtypePhpWasm(original, references), { document, ...contracts } = await readTypeSurface();
	validateTypeSurface(proposed, contracts);
	assert.equal(original.evidence.length, 516); assert.equal(proposed.evidence.length, 520);
	assert.equal(original.observations.length, 593); assert.equal(proposed.observations.length, 595);
	assert.deepEqual(proposed.evidence.slice(0, 516), original.evidence);
	assert.deepEqual(document.observations, proposed.observations);
	assert.deepEqual(document.evidence.slice(516), proposed.evidence.slice(516));
	const before = typeSurfaceCells(original, contracts), after = typeSurfaceCells(proposed, contracts);
	const changed = [], added = [];
	for(const [index, cell] of after.entries())
	{
		if(JSON.stringify(cell) === JSON.stringify(before[index])) continue;
		assert.equal(cell.shape, "subtype"); assert.ok(nominalSubtypePhpWasmProfiles.includes(cell.profile));
		assert.ok(["parameter", "result", "field"].includes(cell.position));
		const route = cell.path === "ordinary-source" ? "ordinary" : "reviewed";
		const ids = references.filter(item => item.route === route).map(item => item.id);
		for(const [name, stage] of Object.entries(cell.stages))
		{
			assert.equal(stage.state, "passed");
			assert.deepEqual(stage.evidence.filter(id => id.startsWith("nominal-subtype-php-wasm-")), ids);
			assert.ok(before[index].stages[name].evidence.every(id => stage.evidence.includes(id)));
			assert.equal(before[index].stages[name].state, cell.position === "field" ? "unreviewed" : "passed");
		}
		assert.ok(cell.conversionNote.includes(nominalSubtypePhpWasmConversion));
		assert.ok(cell.limitations.includes(nominalSubtypePhpWasmLimit));
		if(cell.position === "field") added.push(cell.id);
		changed.push(cell.id);
	}
	const expected = nominalSubtypePhpWasmProfiles.flatMap(profile => ["ordinary-source", "reviewed-ir"].flatMap(path => ["parameter", "result", "field"].map(position => `${profile}/subtype/${path}/${position}`)));
	assert.deepEqual(changed.sort(), expected.sort()); assert.equal(added.length, 2);
	assert.deepEqual(original, predecessor());
});

test("nominal PHP-Wasm guides describe installed Nat fields and keep other combinations pending", async () => {
	const source = await readFile("docs/php.md", "utf8");
	assert.ok(source.includes("### Subtypes in copied records\n"));
	for(const text of ["Native PHP and PHP-Wasm packages accept"
		, "Brick\\Math\\BigInteger"
		, "PHP 8.4.1", "Node 22.23.2", "Chromium 151.0.7922.34"
		, "startup and lazy", "weak and strict", "at runtime."])
		assert.ok(source.includes(text), text);
	const row = source.split("\n").find(line => line.startsWith("| `Subtype /"));
	for(const route of ["Ordinary source", "Reviewed IR"])
		assert.ok(row.includes(route + ": Installed checks passed (input, result, field)"));
	assert.ok(row.includes("Not audited (callback input, callback result)"));
	assert.ok(row.includes(nominalSubtypePhpWasmConversion));
	const author = await readFile("docs/lean/existing-package.md", "utf8");
	for(const prefix of ["| `Subtype` in acyclic", "| Lean-produced `Subtype` result without"])
	{
		const row = author.split("\n").find(line => line.startsWith(prefix));
		assert.ok(row.includes("Node and Chromium installed"));
		assert.equal((row.match(/Generated; pending/gu) ?? []).length, 0);
		assert.ok(row.includes("All four ABIs installed"));
		assert.ok(row.includes("All seventeen profiles ordinary/reviewed installed for the tested Nat"));
	}
	const fin = author.split("\n").find(line => line.startsWith("| `Fin n` in record"));
	assert.ok(fin.includes("Node installed; browser pending"));
	assert.ok(author.includes("Browser nominal Fin exports still need installed acceptance"));
	assert.ok(source.includes("Other primitive-base nominal fixtures"));
	assert.ok(source.includes("constructor/source entry counts"));
});

test("nominal PHP-Wasm consumer and author pages render the evidence links and remove stale support claims", async () => {
	for(const path of ["docs/php.md", "docs/lean/existing-package.md", "docs/lean/export-decisions.md", "docs/reference/types.md"])
	{
		const page = docPages.find(item => item.source === path), source = await readFile(path, "utf8");
		const compiled = await compileDocumentationPage(source, page, { revision: nominalSubtypePhpWasmPromotionPredecessor });
		assert.ok(compiled.links.some(link => link.endsWith("nominal-subtype-php-wasm-promotion-20261014.md")), path);
		assert.doesNotMatch(compiled.searchText, /PHP-Wasm nominal (?:acceptance|fields and results) (?:remains pending|still need)|PHP-Wasm installed acceptance for these nominal additions remains pending/u);
		if(path === "docs/php.md") assert.ok(compiled.searchText.includes("Brick\\Math\\BigInteger"));
	}
});
