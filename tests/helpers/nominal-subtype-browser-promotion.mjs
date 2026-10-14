/**
 * Tie nominal browser support to complete original installed package evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { nominalSubtypeBrowserSelections, assertNominalSubtypeBrowserRun } from "./nominal-subtype-browser-provenance.mjs";
import { nominalSubtypeBrowserRecords, checkNominalSubtypeBrowserReport } from "./nominal-subtype-browser-report.mjs";
import { nominalSubtypeBrowserHandoffRecords } from "./nominal-subtype-browser-package.mjs";
import { nominalSubtypeBrowserOriginal, nominalSubtypeBrowserSnapshot, nominalSubtypeBrowserGeneratorClosure } from "./nominal-subtype-browser-sources.mjs";

export const nominalSubtypeBrowserArchive = "docs/evidence/nominal-subtype-browser-20261014";
export const nominalSubtypeBrowserIndexSha256 = "bc4f0403b5ab7faa2fe6ad0a3df7755bba4e24bbf0127fd95df1ce66348b6c4a";
export const nominalSubtypeBrowserProfiles = ["browser-javascript", "browser-react", "browser-worker"];
export const nominalSubtypeBrowserHostSuffix = "; also in tested acyclic records and variants";
export const nominalSubtypeBrowserConversion = "Browser pages, React and workers use bigint for the tested Nat Subtype payloads, including generated record fields and tagged variant cases. Each input site keeps its selected checked Lean constructor, including distinct normalizing choices for the same record. Only the active variant case runs its constructors. Rejection leaves caller values unchanged and later valid calls succeed. Copied results project existing Lean payloads without proof fields or input constructor selections, including result-only packages.";
export const nominalSubtypeBrowserLimit = "Nominal browser acceptance covers the tested Nat records, variants, aliases, nested copied containers and constructor-free results on Linux x64 with Chromium 151.0.7922.34, Firefox 153.0 and WebKit 26.5. Strict TypeScript and Node 22.23.2 callers also pass before and after installation-tree relocation. Two independent author roots reproduce both npm archives; author roots are removed before offline installation. Browser callers use source-free production bundles. Complete component and shared-runtime npm archives, original caller and compiler records, launcher and test output are retained; browser binaries, framework archives and deployment bundles are not. The local compiler ran through the recorded Nix command transport adapter, not a Nix sandbox. Other primitive-base nominal fixtures, refined callbacks, owned, recursive, dependent and broader generic Subtypes remain separate work. Entry counts and memory are unmeasured. These local results do not claim hosted acceptance of a later revision. Historical absolute command paths document the original machine and are not CI prerequisites.";
const quote = value => "'" + String(value).replaceAll("'", "'\\''") + "'";

/**
 * Authenticate complete archives, frozen producer sources and original launch records.
 *
 * @param read - Reader of repository-relative original evidence files.
 */
export const nominalSubtypeBrowserReferences = async (read = readFile) => {
	const bytes = await read(`${nominalSubtypeBrowserArchive}/index.json`);
	assert.equal(sha256(bytes), nominalSubtypeBrowserIndexSha256);
	const index = JSON.parse(bytes), files = new Map();
	assert.equal(bytes.toString(), canonicalJson(index));
	assert.equal(index.schemaVersion, 1); assert.equal(index.kind, "nominal-subtype-browser-installed-v1");
	assert.deepEqual(index.runs.map(run => [run.route, run.mode]), nominalSubtypeBrowserSelections);
	for(const entry of index.files)
	{
		assert.ok(/^[A-Za-z0-9_@.$/+-]+$/u.test(entry.path) && !entry.path.startsWith("/") && entry.path.split("/").every(part => part && part !== "." && part !== ".."));
		assert.ok(!files.has(entry.path)); const value = await read(`${nominalSubtypeBrowserArchive}/${entry.path}`);
		assert.equal(value.length, entry.bytes); assert.equal(sha256(value), entry.sha256); files.set(entry.path, value);
	}
	const snapshot = nominalSubtypeBrowserSnapshot(index.producerCommit);
	assert.equal(index.sourceSnapshotCount, Object.keys(snapshot).length);
	assert.deepEqual(index.generatorClosure, nominalSubtypeBrowserGeneratorClosure(index.producerCommit));
	assert.ok(index.generatorClosure.every(path => index.selectedSources.includes(path)));
	for(const path of index.selectedSources)
	{
		const original = files.get(`sources/${path}`);
		assert.deepEqual(original, nominalSubtypeBrowserOriginal(index.producerCommit, path));
		assert.equal(snapshot[path], sha256(original));
	}
	const references = []; let previousEnd = 0;
	for(const run of index.runs)
	{
		assert.equal(run.producerCommit, index.producerCommit); assert.equal(run.label, `${run.route}-${run.mode}`);
		assert.deepEqual(run.runtime, { node: "v22.23.2", platform: "linux", arch: "x64" });
		const prefix = `${run.label}/records/`, records = async path => files.get(prefix + path);
		const npm = JSON.parse(await records("report.json")), browser = JSON.parse(await records("browser.json"));
		const paths = [...nominalSubtypeBrowserRecords(run.mode), ...nominalSubtypeBrowserHandoffRecords(npm.receipt)].sort();
		assert.deepEqual([...files.keys()].filter(path => path.startsWith(prefix)).map(path => path.slice(prefix.length)).sort(), paths);
		assert.deepEqual(run.records, paths);
		const checked = await checkNominalSubtypeBrowserReport(records, run);
		for(const [key, value] of Object.entries(checked)) assert.deepEqual(run[key], value);
		assert.equal(sha256(await records("report.json")), run.reportSha256);
		assert.equal(sha256(await records("browser.json")), run.browserSha256);
		const start = JSON.parse(files.get(`${run.label}/start.json`)), end = JSON.parse(files.get(`${run.label}/end.json`)), tap = files.get(`${run.label}/run.tap`);
		assert.equal(start.started, run.started); assert.equal(end.finished, run.finished); assert.equal(sha256(tap), run.tapSha256);
		assert.deepEqual(start.sources, snapshot);
		assertNominalSubtypeBrowserRun({ ...run, start, end, tap, runner: files.get("runner.mjs") });
		assert.ok(Date.parse(start.started) >= previousEnd); previousEnd = Date.parse(end.finished);
		assert.deepEqual(run.browserVersions, { chromium: "151.0.7922.34", firefox: "153.0", webkit: "26.5" });
		for(const profile of browser.reports) for(const execution of profile.browser.executions)
			assert.equal(execution.observation.hostVersion, run.browserVersions[execution.engine]);
		const command = [...Object.entries(start.environment).map(([key, value]) => key + "=" + quote(value))
			, quote(start.command), ...start.args.map(quote)].join(" ");
		const selected = index.files.filter(file => file.path.startsWith(run.label + "/") || file.path.startsWith("sources/") || file.path.startsWith("checkers/") || file.path === "runner.mjs");
		references.push({ id: `nominal-subtype-browser-${run.route}-${run.mode}-installed`
			, route: run.route, mode: run.mode
			, sourcePath: run.route === "ordinary" ? "ordinary-source" : "reviewed-ir"
			, profiles: [...nominalSubtypeBrowserProfiles]
			, revision: run.producerCommit, command
			, counts: { ...checked, browserVersions: run.browserVersions }
			, scope: `Both independently built component and shared-runtime npm archives reproduce. Offline installation follows author-root removal. The original strict-TypeScript and Node callers pass before and after moving the installation. Each page, React production/strict and dedicated-worker selection executes in Chromium, Firefox and WebKit: twelve browser executions and 51 lifecycle observations per source/API selection. Checks include missing-asset recovery, React remount and pending-unmount, worker restart and disposal, complete installed-file closure and independently authenticated served Wasm. ${run.mode === "full" ? "The full API checks per-use constructor selection and normalization, repeated record fields, active variant branches, aliases, mixed Fin guards, rejection paths, unchanged caller inputs and recovery." : "The standalone result-only API projects scalars, structural containers, records, variants and aliases without input constructor choices, including 100-bit Nat results."} ${nominalSubtypeBrowserLimit}`
			, files: [{ path: `${nominalSubtypeBrowserArchive}/index.json`, sha256: nominalSubtypeBrowserIndexSha256 }, ...selected.map(file => ({ path: `${nominalSubtypeBrowserArchive}/${file.path}`, sha256: file.sha256 }))]
			, artifacts: [npm.receipt.package, npm.receipt.runtime].map(({ archive, sha256 }) => ({ path: archive, sha256 })) });
	}
	return references;
};

/**
 * Supplement twelve existing cells and add six observed field cells only.
 *
 * @param original - Exact inventory before this milestone.
 * @param references - Four independently authenticated installed selections.
 */
export const promoteNominalSubtypeBrowser = async (original, references) => {
	assert.deepEqual(references, await nominalSubtypeBrowserReferences());
	const inventory = structuredClone(original), validators = [];
	for(const path of ["tests/helpers/nominal-subtype-browser-report.mjs", "tests/helpers/nominal-subtype-browser-promotion.mjs", "tests/helpers/nominal-subtype-browser-promotion-tests.mjs", "docs/evidence/nominal-subtype-browser-promotion-20261014.md"])
		validators.push({ path, sha256: sha256(await readFile(path)) });
	for(const reference of references)
	{
		assert.ok(!inventory.evidence.some(item => item.id === reference.id), "Already promoted: " + reference.id);
		inventory.evidence.push({ id: reference.id, kind: "installed"
			, revision: reference.revision, command: reference.command
			, scope: reference.scope, files: [...validators, ...reference.files]
			, artifacts: reference.artifacts.map(item => ({ ...item, path: reference.id + "/" + item.path })) });
	}
	for(const path of ["ordinary-source", "reviewed-ir"])
	{
		const matches = inventory.observations.filter(item => item.path === path && item.shapes.includes("subtype") && item.profiles.some(profile => nominalSubtypeBrowserProfiles.includes(profile)));
		const expectedId = path === "ordinary-source" ? "npm-browser-subtype-ordinary-source" : "reviewed-browser-subtype";
		assert.deepEqual(matches.map(item => [item.id, item.profiles]), [[expectedId, nominalSubtypeBrowserProfiles]], "Missing or overlapping browser Subtype observations");
		const matched = references.filter(item => item.sourcePath === path), ids = matched.map(item => item.id);
		assert.equal(matched.length, 2); const scope = matched.map(item => item.scope).join(" ");
		for(const observation of matches)
		{
			assert.deepEqual(observation.shapes, ["subtype"]); assert.deepEqual(observation.positions, ["parameter", "result"]);
			observation.scope += " Additional nominal browser acceptance: " + scope;
			observation.conversionNotes.subtype += " " + nominalSubtypeBrowserConversion;
			observation.limitations.push(nominalSubtypeBrowserLimit);
			for(const position of observation.positions) observation.hostTypes.subtype[position] += nominalSubtypeBrowserHostSuffix;
			for(const stage of Object.values(observation.stages))
			{
				assert.equal(stage.state, "passed"); stage.evidence.push(...ids);
				stage.note += " Additional nominal browser acceptance: " + scope;
			}
		}
		inventory.observations.push({ id: `nominal-subtype-browser-fields-${path}`
			, profiles: [...nominalSubtypeBrowserProfiles], shapes: ["subtype"]
			, positions: ["field"], path, scope
			, hostTypes: { subtype: { field: "bigint Nat payload in generated record fields and tagged variant cases for the tested acyclic records and variants; no proof field" } }
			, stages: Object.fromEntries(inventory.stages.map(stage => [stage, { state: "passed", evidence: ids, note: scope }]))
			, limitations: [nominalSubtypeBrowserLimit]
			, conversionNotes: { subtype: nominalSubtypeBrowserConversion } });
	}
	return inventory;
};
