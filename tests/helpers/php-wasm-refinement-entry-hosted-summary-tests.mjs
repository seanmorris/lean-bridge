/**
 * Adversarial controls for complete hosted PHP-Wasm entry promotion.
 * Synthetic artifacts test closure and binding; they are not measurements.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import {
	phpWasmRefinementEntryMatrix
	, phpWasmRefinementEntryMatrixLocation
} from "./php-wasm-refinement-entry-matrix.mjs";
import {
	checkPhpWasmRefinementEntryVerifier
	, phpWasmRefinementEntryArtifactLayouts
	, summarizePhpWasmRefinementEntryHostedArtifacts
} from "./php-wasm-refinement-entry-hosted-summary.mjs";

const producer = "a".repeat(40);
const cliSource = readFileSync(new URL(
	"../../scripts/summarize-php-wasm-refinement-entry-hosted.mjs", import.meta.url
), "utf8");
const tapName = item => item.kind === "callback"
	? "instrumented PHP-Wasm callbacks close and execute every selected entry"
	: item.kind === "owned"
		? `instrumented owned PHP-Wasm package closes ${item.family} ${item.route} dispatch and transfer order`
		: `instrumented PHP-Wasm copied package closes ${item.family} ${item.route} compiler entries`;
const tap = name => `TAP version 13\n# Subtest: ${name}\nok 1 - ${name}\n1..1\n`
	+ "# tests 1\n# suites 0\n# pass 1\n# fail 0\n# cancelled 0\n"
	+ "# skipped 0\n# todo 0\n# duration_ms 1\n";
const verification = checkPhpWasmRefinementEntryVerifier(producer, {
	verifierCommit: producer, modifiedSourcePaths: [], untrackedSourcePaths: []
	, verifierNodeVersion: "22.23.3"
});
const result = (selection, paths, callback) => callback ? {
	schemaVersion: 1, family: selection.family, route: selection.route
	, producerCommit: selection.producerCommit, records: paths.length
	, executions: 12, controls: 3
} : {
	schemaVersion: 1, family: selection.family, route: selection.route
	, producerCommit: selection.producerCommit, records: paths.length
	, executions: 12, calls: 2
	, counts: { validator: 1, constructor: 0, adapter: 2, source: 1 }
};
const fake = callback => async ({ paths, read }, selection) => {
	for(const path of paths) await read(path);
	return result(selection, paths, callback);
};
const checkers = { entry: fake(false), callback: fake(true) };

const artifactMaps = () => {
	const maps = new Map();
	for(const item of phpWasmRefinementEntryMatrix)
	{
		const location = phpWasmRefinementEntryMatrixLocation(item, producer);
		const files = maps.get(location.artifact) ?? new Map();
		maps.set(location.artifact, files);
		const layout = phpWasmRefinementEntryArtifactLayouts[item.kind];
		for(const support of layout.support)
			files.set(support, support.endsWith(".tap") ? tap(tapName(item)) : "retained\n");
		const prefix = `${layout.root}/${item.recordPath}/`;
		const report = canonicalJson({ family: item.family, route: item.route });
		files.set(prefix + "report.json", report);
		files.set(`${layout.root}/${item.recordPath}.check.json`, canonicalJson(
			result({ family: item.family, route: item.route, producerCommit: producer }
				, ["report.json"], item.checker === "callback")
		));
	}
	for(const [name, files] of maps)
	{
		const cells = phpWasmRefinementEntryMatrix.filter(item =>
			phpWasmRefinementEntryMatrixLocation(item, producer).artifact === name);
		if(cells[0].kind !== "callback") continue;
		const layout = phpWasmRefinementEntryArtifactLayouts.callback;
		files.set(`${layout.root}/index.json`, canonicalJson({
			schemaVersion: 1, kind: "php-wasm-callback-entry-installed-v1"
			, producerCommit: producer
			, reports: cells.map(item => {
				const report = files.get(`${layout.root}/${item.recordPath}/report.json`);
				return { family: item.family, route: item.route
					, reportSha256: sha256(Buffer.from(report))
					, executions: 12 };
			})
		}));
	}
	return maps;
};
const artifacts = maps => [...maps].map(([name, files]) => ({
	name, paths: [...files.keys()].sort()
	, read: async path => Buffer.from(files.get(path))
}));
const run = (maps = artifactMaps(), verifier = checkers) =>
	summarizePhpWasmRefinementEntryHostedArtifacts(
		producer, artifacts(maps), verification, verifier
	);

test("hosted PHP-Wasm entry promotion closes its source paths and verifier runtime", () => {
	assert.deepEqual(verification, {
		verifierCommit: producer, sourcePathsClean: true
		, sourcePaths: ["src", "tests", "scripts"]
		, sourcePathClosure: "tracked-and-untracked-nonignored"
		, verifierNodeVersion: "22.23.3", verifierNodeMajor: 22
	});
	for(const [change, pattern] of [
		[state => { state.verifierCommit = "b".repeat(40); }, /producer revision/u]
		, [state => { state.modifiedSourcePaths = ["src/changed.mjs"]; }, /unmodified/u]
		, [state => { state.untrackedSourcePaths = ["tests/forged.mjs"]; }, /untracked/u]
		, [state => { state.verifierNodeVersion = "24.0.0"; }, /Node 22/u]
	]) {
		const state = { verifierCommit: producer, modifiedSourcePaths: []
			, untrackedSourcePaths: [], verifierNodeVersion: "22.23.3" };
		change(state);
		assert.throws(() => checkPhpWasmRefinementEntryVerifier(producer, state), pattern);
	}
});

test("hosted PHP-Wasm entry promotion anchors Git observations to its repository", () => {
	assert.match(cliSource
		, /const repositoryRoot = resolve\(fileURLToPath\(new URL\("\.\."/u);
	assert.match(cliSource
		, /execFileSync\("git", args, \{\n\tcwd: repositoryRoot, encoding: "utf8"/u);
	assert.match(cliSource
		, /assert\.equal\(resolve\(git\(\["rev-parse", "--show-toplevel"\]\)\), repositoryRoot/u);
	assert.equal(cliSource.match(/execFileSync\("git"/gu)?.length, 1
		, "all Git observations use the repository-root wrapper");
});

test("hosted PHP-Wasm entry promotion rechecks the complete closed artifact matrix", async () => {
	const summary = await run();
	assert.equal(summary.kind, "php-wasm-refinement-entry-hosted-v1");
	assert.equal(summary.producerCommit, producer);
	assert.deepEqual(summary.verification, verification);
	assert.equal(summary.artifacts.length, 27);
	assert.equal(summary.artifacts.reduce((sum, item) => sum + item.cells, 0), 30);
	assert.ok(summary.artifacts.every(item => item.files > 0
		&& /^[a-f0-9]{64}$/u.test(item.tapSha256)));
	assert.deepEqual(summary.matrix, {
		schemaVersion: 1, scope: "separate-instrumented-probe"
		, producerCommit: producer, cells: 30, artifacts: 27, workflows: 4
		, records: 30, executions: 360, calls: 48, controls: 18
	});
});

test("hosted PHP-Wasm entry promotion rejects artifact identity and closure drift", async t => {
	let controls = 0;
	const refused = async (change, pattern, verifier = checkers) => {
		const maps = artifactMaps();
		await assert.rejects(change(maps, artifacts(maps), verifier), pattern);
		controls += 1;
	};
	await refused((maps, list) => summarizePhpWasmRefinementEntryHostedArtifacts(
		producer, list.slice(1), verification, checkers), /artifact order and identity/u);
	await refused((maps, list) => summarizePhpWasmRefinementEntryHostedArtifacts(
		producer, [list[1], list[0], ...list.slice(2)], verification, checkers)
	, /artifact order and identity/u);
	await refused((maps, list) => summarizePhpWasmRefinementEntryHostedArtifacts(
		producer, [...list, list[0]], verification, checkers), /artifact order and identity/u);
	await refused((maps, list) => {
		const changed = structuredClone(list.map(item => ({ name: item.name, paths: item.paths })));
		changed[0].read = list[0].read; changed[0].name = "forged";
		for(let index = 1; index < changed.length; ++index) changed[index].read = list[index].read;
		return summarizePhpWasmRefinementEntryHostedArtifacts(producer, changed, verification, checkers);
	}, /artifact order and identity/u);
	await refused(maps => {
		maps.values().next().value.set("stray.txt", "x"); return run(maps);
	}, /unexpected artifact path/u);
	await refused(maps => {
		maps.values().next().value.set("../escape", "x"); return run(maps);
	}, /closed and relative/u);
	await refused(maps => {
		const [name, files] = maps.entries().next().value;
		const item = phpWasmRefinementEntryMatrix.find(value =>
			phpWasmRefinementEntryMatrixLocation(value, producer).artifact === name);
		files.delete(phpWasmRefinementEntryArtifactLayouts[item.kind].support[1]);
		return run(maps);
	}, /missing/u);
	await refused(maps => {
		const [name, files] = maps.entries().next().value;
		const item = phpWasmRefinementEntryMatrix.find(value =>
			phpWasmRefinementEntryMatrixLocation(value, producer).artifact === name);
		files.set(phpWasmRefinementEntryArtifactLayouts[item.kind].support[1], "");
		return run(maps);
	}, /empty/u);
	await refused(maps => {
		const [name, files] = maps.entries().next().value;
		const item = phpWasmRefinementEntryMatrix.find(value =>
			phpWasmRefinementEntryMatrixLocation(value, producer).artifact === name);
		const path = phpWasmRefinementEntryArtifactLayouts[item.kind].support[0];
		files.set(path, files.get(path).replace("# fail 0", "# fail 1"));
		return run(maps);
	}, /terminal result/u);
	await refused(maps => {
		const [name, files] = maps.entries().next().value;
		const item = phpWasmRefinementEntryMatrix.find(value =>
			phpWasmRefinementEntryMatrixLocation(value, producer).artifact === name);
		const path = phpWasmRefinementEntryArtifactLayouts[item.kind].support[0];
		files.set(path, files.get(path).replace(`ok 1 - ${tapName(item)}`
			, "ok 1 - different passing cell"));
		return run(maps);
	}, /selected test/u);
	await refused(maps => {
		const [name, files] = maps.entries().next().value;
		const item = phpWasmRefinementEntryMatrix.find(value =>
			phpWasmRefinementEntryMatrixLocation(value, producer).artifact === name);
		const root = phpWasmRefinementEntryArtifactLayouts[item.kind].root;
		files.delete(`${root}/${item.recordPath}/report.json`); return run(maps);
	}, /missing records/u);
	await refused(maps => {
		const [name, files] = maps.entries().next().value;
		const item = phpWasmRefinementEntryMatrix.find(value =>
			phpWasmRefinementEntryMatrixLocation(value, producer).artifact === name);
		const root = phpWasmRefinementEntryArtifactLayouts[item.kind].root;
		files.set(`${root}/${item.recordPath}.check.json`, "{}\n"); return run(maps);
	}, /retained check output/u);
	await refused(maps => {
		const [name, files] = [...maps].find(([artifact]) => artifact.includes("callback"));
		const item = phpWasmRefinementEntryMatrix.find(value =>
			phpWasmRefinementEntryMatrixLocation(value, producer).artifact === name);
		const root = phpWasmRefinementEntryArtifactLayouts[item.kind].root;
		files.set(`${root}/index.json`, "{}\n"); return run(maps);
	}, /callback index/u);
	const escaping = async ({ read }, selection) => {
		await read("../report.json"); return result(selection, ["report.json"], false);
	};
	await refused(maps => run(maps, { ...checkers, entry: escaping })
		, /unlisted record/u);
	assert.equal(controls, 14);
	t.diagnostic(`${controls} artifact identity, closure and output-binding controls`);
});

test("hosted PHP-Wasm entry promotion defaults to the real route verifiers", async () => {
	const maps = artifactMaps();
	await assert.rejects(summarizePhpWasmRefinementEntryHostedArtifacts(
		producer, artifacts(maps), verification
	));
});
