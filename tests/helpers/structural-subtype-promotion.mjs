/**
 * Authenticate original structural runs before supplementing existing Subtype support.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { sha256 } from "../../src/capsule/node.mjs";
import { structuralSubtypeCiTestName } from "./structural-subtype-ci-report.mjs";

export const structuralSubtypeArchives = Object.freeze([
	["native", "Native", "d67872f878db83b7ba1c6992b7d014a31738505b32ae6edd1d32675f5bd6c292", ["c", "cpp"]]
	, ["python", "Python", "bb5b20b3a8abe1e475f1526b83e36841e0f4bfe2a482a3edc08d5e38d63fd5d3", ["python"]]
	, ["rust", "Rust", "32ba0d3e41e974f9d44adb6c5dbdbe57d00b04cf89e2c1d3f84d5044d5779aa4", ["rust"]]
	, ["ruby", "Ruby", "cdddc0ea047c0bc4f58e77f2d5074143690be9fa22330223944d6d15f8d0725a", ["ruby"]]
	, ["dotnet", "Dotnet", "ae5a5dad4552ce42e7b1003e22f6821ee89aabd37e406f0ede10d269d27b11fb", ["dotnet"]]
	, ["jvm", "Jvm", "3efb5151e5c195ab2154a470e69a067ee1166eb0a6a879e2b6f83c700bb702c6", ["java", "kotlin"]]
	, ["php", "Php", "a745724cce2e53f0064c352d346d42ce2413221aa4406c22e4bfa067b0aa05cd", ["php-native"]]
	, ["wit", "Wit", "c630598ad8ecedce13f1bc7b469dc416ff615d53cd8c82486c5c98b15280ba9f", ["wit-wasi"]]
	, ["perl", "Perl", "5809c2236f123b9bebb1a4ab8d7cc28b5ecdbbca2eb5be9c9706cc2848238030", ["perl"]]
	, ["browser", "Browser", "0b1cabff5ddeb23ea47252a796975901ce65c6d9bcc82867bf043adc28a383e1", ["node-javascript", "node-typescript", "browser-javascript", "browser-react", "browser-worker"]]
	, ["php-wasm", "PhpWasm", "da25a7fe6aae70c6f5c23713f7e65e0195fdccb59e5d7b27672007afaa825c5c", ["php-wasm"]]
].map(([host, name, indexSha256, profiles]) => Object.freeze({ host, name, indexSha256, profiles: Object.freeze(profiles) })));
export const structuralSubtypeProfiles = Object.freeze(structuralSubtypeArchives.flatMap(item => item.profiles));
export const structuralSubtypeConversion = "Pass the primitive base value, including inside Array, List, Option, Prod and Except containers using their generated host representations. Each present Subtype leaf uses the selected checked Lean constructor; accepted normalization reaches the export. A rejected leaf fails the call without changing the input; later valid calls still work. Results expose the proof-backed base values. Transparent aliases and the tested closed List specialization keep their constructor choices.";
export const structuralSubtypeLimit = "The structural fixtures cover Nat, String and UInt8 Subtype leaves, mixed Fin, transparent aliases and one closed List specialization. They do not add nominal-field, refined callback-signature, owned-value, recursive or general dependent/generic support. These are local installed runs, not hosted release-floor results. Dispatch and memory are unmeasured in these unmodified packages; the separate annotated C probe is not evidence for other hosts. Archives retain package digests and selected producer sources, not package binaries or a complete toolchain closure.";
const quote = value => "'" + String(value).replaceAll("'", "'\\''") + "'";
const safePath = value => {
	assert.equal(typeof value, "string");
	assert.ok(value.length && !/[\\:\0]/u.test(value) && value.split("/").every(part => part && part !== "." && part !== ".."), value);
};

/**
 * Keep the original test selection: C/C++ ran three tests; other hosts ran one.
 *
 * @param tap - Original complete TAP bytes.
 * @param lane - Selected installed host lane.
 * @param route - Original author route.
 */
export const assertStructuralSubtypeOriginalTap = (tap, lane, route) => {
	const source = tap.toString(), count = lane === "c-cpp" ? 3 : 1;
	assert.ok(source.startsWith("TAP version 13\n"));
	assert.doesNotMatch(source, /^(?:not ok|Bail out!)|# (?:SKIP|TODO)/mu);
	for(const [field, expected] of Object.entries({ tests: count, suites: 0, pass: count, fail: 0, cancelled: 0, skipped: 0, todo: 0 }))
		assert.deepEqual([...source.matchAll(new RegExp(`^# ${field} (\\d+)$`, "gmu"))].map(match => Number(match[1])), [expected]);
	assert.deepEqual([...source.matchAll(/^1\.\.(\d+)$/gmu)].map(match => Number(match[1])), [count]);
	const expectedNames = [...lane === "c-cpp" ? ["independent structural Subtype review matches ordinary choices without erasing mixed Fin", "independent C and C++ structural Subtype callers compile against their public APIs"] : [], structuralSubtypeCiTestName(lane, route)];
	assert.deepEqual([...source.matchAll(/^ok (\d+) - (.+)$/gmu)].map(match => [Number(match[1]), match[2]]), expectedNames.map((name, index) => [index + 1, name]));
};

/**
 * Validate one entire immutable archive and its complete host-specific reports.
 * Historical absolute paths are provenance only; readers open repository-relative files.
 *
 * @param host - Archive host name, selected from the closed catalog.
 * @param read - Byte reader, injectable for missing/corrupted-original controls.
 */
export const structuralSubtypeArchiveReferences = async (host, read = readFile) => {
	const spec = structuralSubtypeArchives.find(item => item.host === host); assert.ok(spec, "Unknown structural archive");
	const root = `docs/evidence/structural-subtype-${host}-20261011`;
	const bytes = await read(`${root}/index.json`); assert.equal(sha256(bytes), spec.indexSha256);
	const index = JSON.parse(bytes), files = new Map();
	assert.equal(index.schemaVersion, 1); assert.equal(index.kind, `structural-subtype-${host}-installed-v1`);
	assert.match(index.producerCommit, /^[a-f0-9]{40}$/u);
	for(const entry of index.files)
	{
		safePath(entry.path); assert.ok(!files.has(entry.path));
		const value = await read(`${root}/${entry.path}`);
		assert.equal(value.length, entry.bytes, entry.path); assert.equal(sha256(value), entry.sha256, entry.path);
		files.set(entry.path, value);
	}
	for(const source of index.selectedSources)
	{
		safePath(source);
		assert.deepEqual(files.get(`sources/${source}`), execFileSync("git", ["show", `${index.producerCommit}:${source}`], { maxBuffer: 16 * 1024 * 1024 }), source);
	}
	const expectedRuns = host === "python" ? [["3.11", "ordinary"], ["3.11", "reviewed"], ["3.12", "ordinary"], ["3.12", "reviewed"]] : [[null, "ordinary"], [null, "reviewed"]];
	assert.deepEqual(index.runs.map(run => [run.minor ?? null, run.route]), expectedRuns);
	const checker = (await import(`./structural-subtype-${host}-report.mjs`))[`checkStructuralSubtype${spec.name}Report`];
	const references = [];
	for(const run of index.runs)
	{
		const label = run.label ?? run.route; safePath(label);
		const original = path => { assert.ok(files.has(path), `Missing original ${path}`); return files.get(path); };
		const start = JSON.parse(original(`${label}/start.json`)), end = JSON.parse(original(`${label}/end.json`)), tap = original(`${label}/run.tap`);
		assert.equal(run.producerCommit, index.producerCommit); assert.equal(start.revision, run.producerCommit); assert.equal(start.route, run.route);
		if(host === "python") assert.equal(start.minor, run.minor);
		assert.equal(start.runnerSha256, sha256(original("runner.mjs")));
		assert.equal(run.tapSha256, sha256(tap)); assert.equal(end.tapSha256, run.tapSha256);
		assert.deepEqual([end.code, end.signal, end.diskStop], [0, null, false]);
		assert.ok(start.minimumMiB >= 2048 && end.minimumMiB >= 768);
		assert.ok(Date.parse(end.finished) > Date.parse(start.started));
		const lane = ({ native: "c-cpp", php: "php-native", wit: "wit-wasi", browser: "node-browser" })[host] ?? (host === "python" ? "python" + run.minor.replace(".", "") : host);
		assertStructuralSubtypeOriginalTap(tap, lane, run.route);
		const records = async path => { safePath(path); return original(`${label}/records/${path}`); };
		const reportBytes = await records("report.json"), report = JSON.parse(reportBytes);
		assert.equal(sha256(reportBytes), run.reportSha256);
		const checked = await checker(records, run);
		assert.deepEqual(checked, Object.fromEntries(Object.entries(run).filter(([key]) => !["label", "reportSha256", "tapSha256"].includes(key))));
		const command = [...Object.entries(start.environment).map(([key, value]) => {
			assert.match(key, /^[A-Z_][A-Z0-9_]*$/u); assert.equal(typeof value, "string");
			return key + "=" + quote(value);
		})
		, quote(start.command), ...start.args.map(quote)].join(" ");
		const archives = host === "browser" ? [report.receipt.package, report.receipt.runtime].map(item => ({ path: item.archive, sha256: item.sha256 }))
			: Object.entries(report.builds[0].archives).map(([path, sha256]) => ({ path, sha256 }));
		assert.ok(archives.length > 0);
		for(const item of archives)
		{
			safePath(item.path); assert.match(item.sha256, /^[a-f0-9]{64}$/u);
		}
		const special = host === "python" ? `Python ${checked.python}, ` : host === "perl" ? "Four pinned Perl ABIs in both prebuilt-only and build-XS modes, "
			: host === "browser" ? "Node and strict TypeScript, plus pages, React and workers in Chromium, Firefox and WebKit, "
				: host === "php-wasm" ? "Twelve Node/Chromium distribution, loading and strictness contexts, " : "";
		references.push({ id: `structural-subtype-${lane}-${run.route}-installed`
			, host
			, lane
			, route: run.route
			, sourcePath: run.route === "ordinary" ? "ordinary-source" : "reviewed-ir"
			, profiles: [...spec.profiles]
			, revision: run.producerCommit, command, counts: checked
			, scope: `${special}two independently reproduced author builds, source-free offline installation, complete caller-input preservation and repeated rejection/recovery. ${host === "browser" ? "The installed Node tree relocates and unchanged Node callers replay." : "Installed trees relocate and unchanged callers replay."} Structural Array/List/Option/Prod/Except compositions, transparent aliases, distinct per-site constructors, mixed Fin and a closed List specialization. `
				+ (host === "browser" ? "Browser bundles execute source-free with external networking blocked; the JS mixed nested case checks one bad position, not all nine. " : "")
				+ structuralSubtypeLimit
			, files: [{ path: `${root}/index.json`, sha256: spec.indexSha256 }, ...index.files.map(item => ({ path: `${root}/${item.path}`, sha256: item.sha256 }))]
			, artifacts: archives });
	}
	return references;
};

/**
 * Require all twenty-four selections and both source routes in every consumer profile.
 *
 * @param read - Byte reader used for the original evidence, never a reconstructed report.
 */
export const structuralSubtypeReferences = async (read = readFile) => {
	const references = [];
	for(const { host } of structuralSubtypeArchives) references.push(...await structuralSubtypeArchiveReferences(host, read));
	assert.equal(references.length, 24); assert.equal(new Set(references.map(item => item.id)).size, 24);
	assert.equal(structuralSubtypeProfiles.length, 17); assert.equal(new Set(structuralSubtypeProfiles).size, 17);
	for(const profile of structuralSubtypeProfiles) for(const route of ["ordinary", "reviewed"])
		assert.equal(references.filter(item => item.profiles.includes(profile) && item.route === route).length, profile === "python" ? 2 : 1);
	return references;
};

/**
 * Supplement the existing parameter/result observations without claiming a new position.
 *
 * @param original - Exact inventory before this milestone.
 * @param references - Complete, independently reauthenticated original selections.
 */
export const promoteStructuralSubtypes = async (original, references) => {
	assert.deepEqual(references, await structuralSubtypeReferences());
	const inventory = structuredClone(original);
	const paths = ["tests/helpers/structural-subtype-promotion.mjs", "tests/helpers/structural-subtype-promotion-tests.mjs", ...structuralSubtypeArchives.map(item => `tests/helpers/structural-subtype-${item.host}-report.mjs`)];
	const validators = await Promise.all(paths.map(async path => ({ path, sha256: sha256(await readFile(path)) })));
	for(const reference of references)
	{
		assert.ok(!inventory.evidence.some(entry => entry.id === reference.id), "Already promoted: " + reference.id);
		inventory.evidence.push({ id: reference.id
			, kind: "installed"
			, revision: reference.revision
			, command: reference.command
			, scope: reference.scope
			, files: [...validators, ...reference.files]
			, artifacts: reference.artifacts.map(item => ({ ...item, path: reference.id + "/" + item.path })) });
	}
	const selected = new Set();
	for(const profile of structuralSubtypeProfiles) for(const path of ["ordinary-source", "reviewed-ir"])
	{
		const matches = inventory.observations.filter(item => item.profiles.includes(profile) && item.path === path && item.shapes.includes("subtype") && item.positions.some(position => ["parameter", "result"].includes(position)));
		assert.equal(matches.length, 1, `Missing or overlapping Subtype cell ${path}/${profile}`);
		const observation = matches[0];
		assert.deepEqual(observation.shapes, ["subtype"]); assert.deepEqual(observation.positions, ["parameter", "result"]);
		selected.add(observation.id);
	}
	assert.equal(selected.size, 25);
	for(const observation of inventory.observations.filter(item => selected.has(item.id)))
	{
		const matched = references.filter(item => item.sourcePath === observation.path && item.profiles.some(profile => observation.profiles.includes(profile)));
		assert.ok(matched.length);
		observation.scope = "Existing primitive-base Subtype acceptance supplemented by installed Array/List/Option/Prod/Except compositions, transparent aliases, mixed Fin and the tested closed List specialization. " + matched.map(item => item.scope).join(" ");
		observation.conversionNotes.subtype = structuralSubtypeConversion;
		observation.limitations = [structuralSubtypeLimit];
		for(const position of ["parameter", "result"])
			observation.hostTypes.subtype[position] += "; also in generated structural containers";
		const notes = { analysis: "Fresh Lean reconciles the exact source types and per-site checked constructor choices."
			, generation: "Primitive bases and structural containers keep their generated host representations and selected constructor identities."
			, compilation: "Compiled Lean constructs each present Subtype leaf before source execution and projects proof-backed results. Dispatch measurements are separate."
			, packaging: "Independent author roots reproduce archives before source removal, offline installation and relocated replay."
			, installedExecution: observation.scope };
		assert.deepEqual(Object.keys(notes), inventory.stages);
		for(const [name, stage] of Object.entries(observation.stages))
		{
			assert.equal(stage.state, "passed", "Do not replace a previously unreviewed cell");
			stage.evidence.push(...matched.map(item => item.id)); assert.equal(new Set(stage.evidence).size, stage.evidence.length);
			stage.note = notes[name];
		}
	}
	return inventory;
};
