/**
 * Supplement only the browser positions established by the nineteen-base nominal installed runs.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { sha256 } from "../../src/capsule/node.mjs";
import { checkNominalPrimitiveSubtypeBrowserArchive, nominalPrimitiveSubtypeBrowserArchive, nominalPrimitiveSubtypeBrowserArchiveSha256 } from "./nominal-primitive-subtype-browser-archive.mjs";
import { nominalSubtypeBrowserConversion, nominalSubtypeBrowserLimit } from "./nominal-subtype-browser-promotion.mjs";

export const nominalPrimitiveSubtypeBrowserProfiles = ["browser-javascript", "browser-react", "browser-worker"];
export const nominalPrimitiveSubtypeBrowserConversion = "In browser pages, React and workers, checked fields retain the declared primitive's host representation across all nineteen tested bases: undefined (void in TypeScript) for Unit, boolean for Bool, bigint for UInt64, Int64, Nat and Int, string for String and Char, Uint8Array for ByteArray, and number for the other fixed-width integers, floats and wasm32 machine words. Each input site keeps its selected checked constructor and accepted normalization; only the active variant branch is checked. Rejection preserves caller values and later valid calls succeed. Copied results project existing Lean payloads without proof fields or input constructor selections, including standalone result-only packages.";
export const nominalPrimitiveSubtypeBrowserLimit = "Primitive-base nominal browser acceptance covers the tested acyclic records, variants, aliases, mixed Fin guards and constructor-free results over Unit, Bool, UInt8, UInt16, UInt32, UInt64, Int8, Int16, Int32, Int64, Nat, Int, Float32, Float, String, ByteArray, Char, USize and ISize. Pages, React production/Strict Mode and dedicated workers execute in all three pinned Chromium, Firefox and WebKit engines on Linux x64 using wasm32 payloads. Both author routes and full/result-only APIs reproduce complete npm archives from two authors and install offline after author removal. Node and strict TypeScript callers replay after relocation; browser bundles run after installed sources are removed. All contexts check missing-asset recovery, with React remount and pending-unmount checks and worker restart/disposal. Complete Lean component/runtime archives, original records, selected producer sources, generator closure and runtime inputs are retained. External toolchain/browser binaries, framework archives and deployment bundles are not retained. Local compilation uses the recorded Nix command transport adapter, not a Nix sandbox. Other hosts need their own primitive-base nominal acceptance. Refined callbacks, owned, recursive, dependent and broader generic Subtypes remain separate work. Constructor/source entry counts and memory are unmeasured. These local runs do not establish hosted acceptance of later revisions; archived absolute paths describe the original machine and are not CI prerequisites.";

export const nominalPrimitiveSubtypeBrowserField = "declared primitive's host value in copied record and variant fields across nineteen tested bases; no proof field";
const quote = value => "'" + String(value).replaceAll("'", "'\\''") + "'";

/**
 * Derive four inventory references only after authenticating all original installed selections.
 *
 * @param read - Reader of repository-relative original archive bytes.
 */
export const nominalPrimitiveSubtypeBrowserReferences = async (read = readFile) => {
	const checked = await checkNominalPrimitiveSubtypeBrowserArchive(read), references = [];
	for(const run of checked.selections)
	{
		const label = run.route + "/" + run.mode;
		const start = JSON.parse(await read(`${nominalPrimitiveSubtypeBrowserArchive}/${label}/producer/start.json`));
		const report = JSON.parse(await read(`${nominalPrimitiveSubtypeBrowserArchive}/${label}/records/report.json`));
		const command = [...Object.entries(start.selectedEnvironment).map(([key, value]) => {
			assert.match(key, /^[A-Z_][A-Z0-9_]*$/u); assert.equal(typeof value, "string"); return key + "=" + quote(value);
		})
		, "node", ...start.args.map(quote)].join(" ");
		const files = checked.files.filter(file => file.path.startsWith(label + "/") || file.path.startsWith("sources/") || file.path.startsWith("runtime/") || ["producer.mjs", "controls-runner.mjs"].includes(file.path));
		references.push({ id: `nominal-primitive-subtype-browser-${run.route}-${run.mode}-installed`
			, route: run.route, mode: run.mode
			, sourcePath: run.route === "ordinary" ? "ordinary-source" : "reviewed-ir"
			, profiles: [...nominalPrimitiveSubtypeBrowserProfiles]
			, revision: checked.producerCommit, counts: run, command
			, scope: `Two independent author builds reproduce both complete npm archives. Offline installation follows author removal; unchanged JavaScript and strict TypeScript callers replay after moving the installed tree. Source-free page, React and worker bundles then execute in all three engines, producing twelve browser executions and fifty-one lifecycle observations per selection. ${run.mode === "full" ? "The full API checks per-site constructors, normalization, repeated record fields, active variants, aliases, mixed Fin guards, rejected-input snapshots and recovery." : "The standalone result-only API projects primitive payloads through scalars, copied containers, records, variants and aliases without any input constructor selections."} ${nominalPrimitiveSubtypeBrowserLimit}`
			, files: [{ path: nominalPrimitiveSubtypeBrowserArchive + "/index.json", sha256: nominalPrimitiveSubtypeBrowserArchiveSha256 }
				, ...files.map(file => ({ path: nominalPrimitiveSubtypeBrowserArchive + "/" + file.path, sha256: file.sha256 }))]
			, artifacts: [report.receipt.package, report.receipt.runtime].map(item => ({ path: item.archive, sha256: item.sha256 })) });
	}
	return references;
};

/**
 * Expand four existing observations without changing any other profile, position or stage state.
 *
 * @param original - Exact inventory at the prior milestone.
 * @param references - Four independently authenticated installed selections.
 */
export const promoteNominalPrimitiveSubtypeBrowser = async (original, references) => {
	assert.deepEqual(references, await nominalPrimitiveSubtypeBrowserReferences());
	const inventory = structuredClone(original), validators = [];
	for(const path of [
		"tests/helpers/nominal-primitive-subtype-browser-report.mjs"
		, "tests/helpers/nominal-primitive-subtype-browser-archive.mjs"
		, "tests/helpers/nominal-primitive-subtype-browser-controls.mjs"
		, "tests/helpers/nominal-primitive-subtype-browser-promotion.mjs"
		, "tests/helpers/nominal-primitive-subtype-browser-promotion-tests.mjs"
		, "tests/helpers/nominal-primitive-subtype-browser-ci-report.mjs"
		, "scripts/check-nominal-primitive-subtype-browser-ci.mjs"
		, "scripts/run-nominal-primitive-subtype-browser-ci.sh"
		, ".github/workflows/nominal-primitive-subtype-browser.yml"
	]) validators.push({ path, sha256: sha256(await readFile(path)) });
	for(const reference of references)
	{
		assert.ok(!inventory.evidence.some(item => item.id === reference.id), "Already promoted: " + reference.id);
		inventory.evidence.push({
			id: reference.id, kind: "installed", revision: reference.revision
			, command: reference.command, scope: reference.scope
			, files: [...validators, ...reference.files]
			, artifacts: reference.artifacts.map(item => ({ ...item, path: reference.id + "/" + item.path })) });
	}
	for(const path of ["ordinary-source", "reviewed-ir"])
	{
		const matches = inventory.observations.filter(item => item.path === path && item.shapes.includes("subtype") && item.profiles.some(profile => nominalPrimitiveSubtypeBrowserProfiles.includes(profile)));
		const mainId = path === "ordinary-source" ? "npm-browser-subtype-ordinary-source" : "reviewed-browser-subtype";
		assert.deepEqual(matches.map(item => [item.id, item.profiles, item.shapes, item.positions]), [
			[mainId, nominalPrimitiveSubtypeBrowserProfiles, ["subtype"], ["parameter", "result"]]
			, [`nominal-subtype-browser-fields-${path}`, nominalPrimitiveSubtypeBrowserProfiles, ["subtype"], ["field"]]
		], "Missing or overlapping browser Subtype observations");
		const matched = references.filter(item => item.sourcePath === path), ids = matched.map(item => item.id);
		assert.equal(matched.length, 2); const scope = matched.map(item => item.scope).join(" ");
		const conversion = matches[0].conversionNotes.subtype.replace(nominalSubtypeBrowserConversion, nominalPrimitiveSubtypeBrowserConversion);
		for(const observation of matches)
		{
			observation.scope = observation.scope.replaceAll(nominalSubtypeBrowserLimit, "").trimEnd() + " Additional primitive-base browser acceptance: " + scope;
			assert.equal(observation.conversionNotes.subtype.split(nominalSubtypeBrowserConversion).length, 2);
			observation.conversionNotes.subtype = conversion;
			assert.equal(observation.limitations.filter(item => item === nominalSubtypeBrowserLimit).length, 1);
			observation.limitations = observation.limitations.map(item => item === nominalSubtypeBrowserLimit ? nominalPrimitiveSubtypeBrowserLimit : item);
			if(observation.positions.includes("field")) observation.hostTypes.subtype.field = nominalPrimitiveSubtypeBrowserField;
			for(const stage of Object.values(observation.stages))
			{
				assert.equal(stage.state, "passed"); stage.evidence.push(...ids);
				stage.note = stage.note.replaceAll(nominalSubtypeBrowserLimit, "").trimEnd() + " Additional primitive-base browser acceptance: " + scope;
			}
		}
	}
	return inventory;
};
