/**
 * Tie C/C++ nominal support to the four original installed package selections.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { checkNominalSubtypeNativeReport, nominalSubtypeNativeRecordPaths } from "./nominal-subtype-native-report.mjs";

export const nominalSubtypeNativeArchive = "docs/evidence/nominal-subtype-native-20261011";
export const nominalSubtypeNativeIndexSha256 = "ce84736ea4a7e580e66eeacf49412aba3c6291e301a730a603d342ec7b57d992";
export const nominalSubtypeNativeProfiles = ["c", "cpp"];
export const nominalSubtypeNativeHostSuffix = "; also in tested acyclic records and variants";
export const nominalSubtypeNativeConversion = "In C/C++, the tested acyclic records and variants carry Nat Subtype payloads as GMP integers or boost::multiprecision::cpp_int. Each input site keeps its selected constructor, including distinct normalizing choices for the same record. Copied results project existing Lean values without selecting or running an input constructor. Callers supply no proof fields.";
export const nominalSubtypeNativeLimit = "Nominal acceptance covers the tested Nat Subtype records, variants, aliases and copied constructor-free results in C11/GMP and C++20 on Linux x64/glibc 2.36 with GCC 12.2. Other primitive-base nominal fixtures and other native hosts need their own acceptance. Refined callbacks, owned, recursive, dependent and broader generic Subtypes remain pending. Constructor/source entry counts and memory are unmeasured; this is not hosted release-floor acceptance. Package binaries and full toolchain closures are not retained; receipts, installed-file hashes and selected source snapshots are retained.";
const selections = [["ordinary", "full"], ["reviewed", "full"], ["ordinary", "result-only"], ["reviewed", "result-only"]];
const quote = value => "'" + String(value).replaceAll("'", "'\\''") + "'";

/**
 * Authenticate original records, producer sources and retained package identities.
 *
 * @param read - Reader of repository-relative original archive files.
 */
export const nominalSubtypeNativeReferences = async (read = readFile) => {
	const bytes = await read(`${nominalSubtypeNativeArchive}/index.json`);
	assert.equal(sha256(bytes), nominalSubtypeNativeIndexSha256);
	const index = JSON.parse(bytes), files = new Map();
	assert.equal(bytes.toString(), canonicalJson(index));
	assert.equal(index.schemaVersion, 1); assert.equal(index.kind, "nominal-subtype-native-installed-v1");
	assert.deepEqual(index.runs.map(run => [run.route, run.mode]), selections);
	for(const entry of index.files)
	{
		assert.ok(!files.has(entry.path));
		const value = await read(`${nominalSubtypeNativeArchive}/${entry.path}`);
		assert.equal(value.length, entry.bytes); assert.equal(sha256(value), entry.sha256);
		files.set(entry.path, value);
	}
	for(const source of index.selectedSources)
		assert.deepEqual(files.get(`sources/${source}`), execFileSync("git", ["show", `${index.producerCommit}:${source}`], { maxBuffer: 16 * 1024 * 1024 }));
	const references = [];
	for(const run of index.runs)
	{
		assert.equal(run.producerCommit, index.producerCommit);
		assert.equal(run.label, `${run.route}-${run.mode}`);
		assert.deepEqual(run.runtime, { platform: "linux", arch: "x64", glibc: "2.36" });
		assert.deepEqual(run.counts, run.mode === "full" ? { c: 4149, cpp: 4122 } : { c: 2042, cpp: 2042 });
		const prefix = `${run.label}/records/`, records = async path => files.get(prefix + path);
		assert.deepEqual([...files.keys()].filter(path => path.startsWith(prefix)).map(path => path.slice(prefix.length)).sort(), [...nominalSubtypeNativeRecordPaths].sort());
		const counts = await checkNominalSubtypeNativeReport(records, run);
		const reportBytes = await records("report.json"), report = JSON.parse(reportBytes);
		assert.equal(sha256(reportBytes), run.reportSha256);
		const start = JSON.parse(files.get(`${run.label}/start.json`)), end = JSON.parse(files.get(`${run.label}/end.json`));
		const tap = files.get(`${run.label}/run.tap`);
		assert.equal(start.revision, run.producerCommit); assert.equal(start.runnerSha256, sha256(files.get("runner.mjs")));
		assert.equal(start.route, run.route); assert.equal(start.mode, run.mode);
		assert.equal(start.started, run.started); assert.equal(end.finished, run.finished);
		assert.equal(sha256(tap), run.tapSha256); assert.equal(end.tapSha256, run.tapSha256);
		assert.deepEqual([end.code, end.signal, end.stopReason], [0, null, null]);
		assert.doesNotMatch(tap.toString(), /^(?:not ok|Bail out!)|# (?:SKIP|TODO)/mu);
		assert.match(tap.toString(), /# tests 1\n# suites 0\n# pass 1\n# fail 0\n# cancelled 0\n# skipped 0\n/u);
		assert.ok(tap.toString().includes(`ok 1 - installed native nominal Subtypes reproduce and relocate ${run.route} ${run.mode}\n`));
		assert.equal(start.environment.LEAN_BRIDGE_NOMINAL_SUBTYPE_NATIVE_TEST, "1");
		assert.equal(start.environment.LEAN_BRIDGE_NOMINAL_SUBTYPE_NATIVE_PROFILES, "c,cpp");
		assert.equal(start.environment.LEAN_BRIDGE_NOMINAL_SUBTYPE_NATIVE_ROUTES, run.route);
		assert.equal(start.environment.LEAN_BRIDGE_NOMINAL_SUBTYPE_NATIVE_MODES, run.mode);
		assert.equal(start.environment.LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR, run.runtime.glibc);
		const command = [...Object.entries(start.environment).map(([key, value]) => {
			assert.match(key, /^[A-Z_][A-Z0-9_]*$/u); assert.equal(typeof value, "string");
			return key + "=" + quote(value);
		})
		, quote(start.command), ...start.args.map(quote)].join(" ");
		const selected = index.files.filter(file => file.path.startsWith(run.label + "/") || file.path.startsWith("sources/") || ["checker.mjs", "runner.mjs"].includes(file.path));
		references.push({ id: `nominal-subtype-native-${run.route}-${run.mode}-installed`
			, route: run.route, mode: run.mode
			, sourcePath: run.route === "ordinary" ? "ordinary-source" : "reviewed-ir"
			, profiles: [...nominalSubtypeNativeProfiles]
			, revision: run.producerCommit, command, counts
			, scope: `Two independent author builds reproduce models, receipts and package archives. Author sources are removed before offline installation; unchanged C11/GMP and C++20 callers replay after moving the actual installed consumer tree. ${run.mode === "full" ? "The full fixture checks per-use constructor selection and normalization, repeated record fields, variants, aliases, mixed Fin guards, rejected-input preservation and recovery; C also preserves an existing output on rejection." : "The standalone result-only fixture projects scalars, structural containers, records, variants and aliases without input constructor choices, including 100-bit Nat results."} ${nominalSubtypeNativeLimit}`
			, files: [{ path: `${nominalSubtypeNativeArchive}/index.json`, sha256: nominalSubtypeNativeIndexSha256 }, ...selected.map(file => ({ path: `${nominalSubtypeNativeArchive}/${file.path}`, sha256: file.sha256 }))]
			, artifacts: Object.entries(report.builds[0].archives).map(([path, digest]) => ({ path, sha256: digest })) });
	}
	return references;
};

/**
 * Add C/C++ field observations and supplement existing input/result evidence only.
 *
 * @param original - Exact inventory before this milestone.
 * @param references - Four independently authenticated original selections.
 */
export const promoteNominalSubtypeNative = async (original, references) => {
	assert.deepEqual(references, await nominalSubtypeNativeReferences());
	const inventory = structuredClone(original), validators = [];
	for(const path of ["tests/helpers/nominal-subtype-native-report.mjs", "tests/helpers/nominal-subtype-native-promotion.mjs", "tests/helpers/nominal-subtype-native-promotion-tests.mjs", "docs/evidence/nominal-subtype-native-acceptance-20261011.md"])
		validators.push({ path, sha256: sha256(await readFile(path)) });
	for(const reference of references)
	{
		assert.ok(!inventory.evidence.some(item => item.id === reference.id), "Already promoted: " + reference.id);
		inventory.evidence.push({ id: reference.id, kind: "installed"
			, revision: reference.revision
			, command: reference.command, scope: reference.scope
			, files: [...validators, ...reference.files]
			, artifacts: reference.artifacts.map(item => ({ ...item, path: reference.id + "/" + item.path })) });
	}
	for(const path of ["ordinary-source", "reviewed-ir"])
	{
		const matches = inventory.observations.filter(item => item.path === path && item.shapes.includes("subtype") && item.profiles.some(profile => nominalSubtypeNativeProfiles.includes(profile)));
		assert.equal(matches.length, 1, "Missing or overlapping C/C++ Subtype observation");
		const observation = matches[0];
		assert.deepEqual(observation.profiles, nominalSubtypeNativeProfiles);
		assert.deepEqual(observation.shapes, ["subtype"]); assert.deepEqual(observation.positions, ["parameter", "result"]);
		const matched = references.filter(item => item.sourcePath === path), ids = matched.map(item => item.id);
		assert.equal(matched.length, 2);
		const scope = matched.map(item => item.scope).join(" ");
		observation.scope += " Additional nominal C/C++ acceptance: " + scope;
		observation.conversionNotes.subtype += " " + nominalSubtypeNativeConversion;
		observation.limitations.push(nominalSubtypeNativeLimit);
		for(const position of observation.positions) observation.hostTypes.subtype[position] += nominalSubtypeNativeHostSuffix;
		for(const stage of Object.values(observation.stages))
		{
			assert.equal(stage.state, "passed"); stage.evidence.push(...ids);
			stage.note += " Additional nominal C/C++ acceptance: " + scope;
		}
		inventory.observations.push({ id: `nominal-subtype-native-fields-${path}`
			, profiles: [...nominalSubtypeNativeProfiles], shapes: ["subtype"]
			, positions: ["field"], path, scope
			, hostTypes: { subtype: { field: "GMP integer (C) or boost::multiprecision::cpp_int (C++) payload in the tested acyclic records and variants; no proof field" } }
			, stages: Object.fromEntries(inventory.stages.map(stage => [stage, { state: "passed", evidence: ids, note: scope }]))
			, limitations: [nominalSubtypeNativeLimit]
			, conversionNotes: { subtype: observation.conversionNotes.subtype } });
	}
	return inventory;
};
