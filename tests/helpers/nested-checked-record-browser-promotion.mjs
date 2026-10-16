/**
 * Promote only the nested checked-record positions authenticated by the npm/browser archive.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { sha256 } from "../../src/capsule/node.mjs";
import {
	checkNestedCheckedRecordBrowserArchive,
	nestedCheckedRecordBrowserArchive,
	nestedCheckedRecordBrowserArchiveSha256,
	nestedCheckedRecordBrowserProducer
} from "./nested-checked-record-browser-archive.mjs";
import { checkedRecordBrowserLimit } from "./checked-record-browser-promotion.mjs";
import {
	nestedCheckedRecordHistoryPath
} from "./nested-checked-record-source-history.mjs";

export const nestedCheckedRecordBrowserProfiles = Object.freeze([
	"node-javascript", "node-typescript"
	, "browser-javascript", "browser-react", "browser-worker"
]);
export const nestedCheckedRecordBrowserConversion = "Packet is a proof-free object with digit: bigint for Fin 10 and word: bigint for a checked Nat Subtype. The selected adapter descends through Array, List, Option, Product, Except, enclosing Holder.packet and the active Choice.packet.value field, applies the exact constructor selected for every public site and nested Word field, and leaves the caller's complete rejected graph unchanged. Repeated parameters keep independent constructor choices; later valid calls recover. Copied Array and Option results contain the same nested payload objects without proof fields or input-constructor selection.";
export const nestedCheckedRecordBrowserField = "Nested Packet object with bigint digit and word payload fields; no proof fields";
export const nestedCheckedRecordBrowserLimit = "Nested checked-record acceptance covers only the tested acyclic Packet, Holder and Choice forms through Array, List, Option, Product and Except copy positions. Generic, recursive and inherited records, other index kinds, open dependent or zero-payload records, callbacks and owned positions remain unreviewed. Other host targets require their own installed evidence. These local Linux x64 Node, strict TypeScript, Chromium, Firefox and WebKit runs do not establish hosted acceptance. Constructor dispatch counts and peak memory are unmeasured. Complete npm component/runtime archives and original report inputs are retained; browser binaries, React framework archives and generated deployments are represented by recorded identities and observations rather than copied.";

const validators = Object.freeze([
	"tests/helpers/nested-checked-record-browser-archive.mjs"
	, "tests/nested-checked-record-browser-archive.test.mjs"
	, "tests/helpers/nested-checked-record-browser-report.mjs"
	, "tests/helpers/nested-checked-record-browser-controls.mjs"
	, "tests/helpers/nested-checked-record-npm-report.mjs"
	, "tests/helpers/nested-checked-record-browser-promotion.mjs"
	, "tests/helpers/nested-checked-record-browser-promotion-tests.mjs"
	, "tests/helpers/nested-checked-record-browser-ci-report.mjs"
	, "tests/helpers/nested-checked-record-browser-ci-tests.mjs"
	, "tests/helpers/nested-checked-record-browser-ci-workflow-tests.mjs"
	, "scripts/check-nested-checked-record-browser-ci.mjs"
	, "scripts/run-nested-checked-record-browser-ci.sh"
	, ".github/workflows/nested-checked-record-browser.yml"
]);
const promotionPins = Object.freeze([
	"docs/evidence/README.md"
	, "docs/javascript-typescript.md"
	, "docs/lean/existing-package.md"
	, "docs/lean/export-decisions.md"
	, "docs/reference/types.md"
	, "scripts/generate-type-docs.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
	, "tests/helpers/nested-checked-record-browser-promotion-tests.mjs"
	, "tests/nested-checked-records.test.mjs"
	, "tests/type-surface.test.mjs"
]);
const quote = value => "'" + String(value).replaceAll("'", "'\\''") + "'";
const without = (source, text) => source.split(text).join("").replaceAll(/\s{2,}/gu, " ").trim();

/**
 * Derive four references only after checking every archived source and report byte.
 *
 * @param read - Repository-relative archive reader.
 */
export const nestedCheckedRecordBrowserReferences = async (read = readFile) => {
	const checked = await checkNestedCheckedRecordBrowserArchive(read), references = [];
	assert.equal(checked.producerCommit, nestedCheckedRecordBrowserProducer);
	for(const run of checked.routes)
	{
		const sourcePath = run.route.startsWith("ordinary-")
			? "ordinary-source" : "reviewed-ir";
		const resultOnly = run.mode === "result-only";
		const report = JSON.parse(await read(
			`${nestedCheckedRecordBrowserArchive}/${run.route}/records/report.json`));
		const command = [
			"LEAN_BRIDGE_NESTED_CHECKED_RECORD_BROWSER_TEST=1"
			, `LEAN_BRIDGE_NESTED_CHECKED_RECORD_BROWSER_ROUTES=${quote(run.route)}`
			, "LEAN_BRIDGE_NESTED_CHECKED_RECORD_BROWSER_OUTPUT=/app/build/vo1477-nested-checked-record-npm-r1"
			, "LEAN_BRIDGE_TYPE_CORPUS_BROWSERS=chromium,firefox,webkit"
			, "node --test --test-concurrency=1 tests/nested-checked-record-browser.test.mjs"
		].join(" ");
		const selected = checked.files.filter(file => file.path.startsWith(`${run.route}/`)
			|| file.path.startsWith("sources/"));
		const scope = `Two independent author builds reproduce complete component and runtime archives before source-free offline npm installation. Installed JavaScript and strict TypeScript callers replay after physical relocation. Chromium, Firefox and WebKit each execute page, React production/Strict Mode and dedicated-worker consumers, including missing-Wasm recovery, for twelve browser executions and fifty-one lifecycle observations. ${resultOnly ? "The standalone result-only package projects checked-record payloads through Array and Option results without checked-input metadata." : "The full package checks direct and repeated parameters plus Array, List, Option, Product, Except, enclosing record and active variant fields; exact failures preserve caller graphs and later calls recover."} Producer, browser-consumer and destructive-checker revisions are independently frozen. ${nestedCheckedRecordBrowserLimit}`;
		references.push({
			id: `nested-checked-record-browser-${run.route}-installed`
			, route: run.route, mode: run.mode, sourcePath, resultOnly
			, profiles: [...nestedCheckedRecordBrowserProfiles]
			, positions: resultOnly ? ["result"] : ["parameter", "result", "field"]
			, revision: checked.producerCommit, consumerRevision: checked.consumerCommit
			, checkerRevision: checked.checkerCommit, command, counts: run, scope
			, files: [
				{ path: `${nestedCheckedRecordBrowserArchive}/index.json`
					, sha256: nestedCheckedRecordBrowserArchiveSha256 }
				, ...selected.map(file => ({
					path: `${nestedCheckedRecordBrowserArchive}/${file.path}`
					, sha256: file.sha256
				}))
			]
			, artifacts: [report.receipt.package, report.receipt.runtime].map(item => ({
				path: item.archive, sha256: item.sha256
			}))
		});
	}
	return references;
};

const updateBoundary = source => without(source, checkedRecordBrowserLimit)
	.replace("Only this consumer, source route and top-level position. No field or callback observations; nested, recursive, inherited and refined payload records remain separate requirements."
		, "Only this consumer and source route. Callback positions remain unreviewed; generic, recursive and inherited payload records remain separate requirements.")
	.replace("No browser or hosted CI execution is inferred."
		, "No hosted CI execution is inferred.")
	.replace("Other indices, nested/refined/recursive records and dynamic dependent payloads are not covered."
		, "Generic, recursive and inherited records, other indices and dynamic dependent payloads are not covered.");

/**
 * Supplement twenty parameter/result cells and add ten field cells without touching callbacks.
 *
 * @param original - Exact inventory before this promotion.
 * @param references - Four independently authenticated installed selections.
 */
export const promoteNestedCheckedRecordBrowsers = async (original, references) => {
	assert.deepEqual(references, await nestedCheckedRecordBrowserReferences());
	const inventory = structuredClone(original);
	const sources = await Promise.all(validators.map(async path => ({
		path, sha256: sha256(await readFile(path))
	})));
	for(const reference of references)
	{
		assert.ok(!inventory.evidence.some(item => item.id === reference.id)
			, "Already promoted: " + reference.id);
		inventory.evidence.push({
			id: reference.id, kind: "installed", revision: reference.revision
			, command: reference.command, scope: reference.scope
			, files: [...sources, ...reference.files]
			, artifacts: reference.artifacts.map(item => ({
				...item, path: reference.id + "/" + item.path
			}))
		});
	}
	for(const profile of nestedCheckedRecordBrowserProfiles)
		for(const path of ["ordinary-source", "reviewed-ir"])
		{
			const full = references.filter(item => item.sourcePath === path
				&& item.mode === "full");
			const result = references.filter(item => item.sourcePath === path
				&& item.positions.includes("result"));
			assert.equal(full.length, 1); assert.equal(result.length, 2);
			for(const position of ["parameter", "result"])
			{
				const matches = position === "result" ? result : full;
				const observations = inventory.observations.filter(item =>
					item.profiles.includes(profile) && item.path === path
					&& item.shapes.includes("checked-record")
					&& item.positions.includes(position));
				assert.equal(observations.length, 1
					, `Missing or overlapping nested checked-record cell: ${profile}/${path}/${position}`);
				const observation = observations[0], ids = matches.map(item => item.id);
				observation.scope = updateBoundary(observation.scope)
					+ " Additional nested checked-record acceptance: "
					+ matches.map(item => item.scope).join(" ");
				observation.conversionNotes["checked-record"]
					= updateBoundary(observation.conversionNotes["checked-record"])
					+ " " + nestedCheckedRecordBrowserConversion;
				observation.limitations = observation.limitations
					.map(updateBoundary).filter(Boolean)
					.filter((value, index, values) => values.indexOf(value) === index);
				observation.limitations.push(nestedCheckedRecordBrowserLimit);
				for(const stage of Object.values(observation.stages))
				{
					assert.equal(stage.state, "passed");
					stage.evidence.push(...ids);
					assert.equal(new Set(stage.evidence).size, stage.evidence.length);
					stage.note = updateBoundary(stage.note)
						+ " Additional nested checked-record acceptance: "
						+ matches.map(item => item.scope).join(" ");
				}
			}
			const fieldScope = full[0].scope;
			const fieldConversion = inventory.observations.find(item =>
				item.profiles.includes(profile) && item.path === path
				&& item.shapes.includes("checked-record")
				&& item.positions.includes("parameter"))
				.conversionNotes["checked-record"];
			const overlap = inventory.observations.filter(item =>
				item.profiles.includes(profile) && item.path === path
				&& item.shapes.includes("checked-record")
				&& item.positions.includes("field"));
			assert.equal(overlap.length, 0
				, `Missing or overlapping nested checked-record field: ${profile}/${path}`);
			const notes = {
				analysis: "Fresh Lean and independently reviewed IR agree on nested checked-record fields, erased proofs and every exact constructor choice."
				, generation: "Generated adapters recurse through supported copy containers, enclosing records and active variants while retaining proof-free object types."
				, compilation: "Compiled Lean constructs Fin 10, the nested Word Subtype and Packet in dependency order at each selected public site."
				, packaging: "Two author roots reproduce both npm archives before source removal, offline installation and physical installed-tree relocation; browser bundles run without author sources or external networking."
				, installedExecution: fieldScope
			};
			assert.deepEqual(Object.keys(notes), inventory.stages);
			inventory.observations.push({
				id: `nested-checked-record-browser-${profile}-${path}-field`
				, profiles: [profile], shapes: ["checked-record"]
				, positions: ["field"], path, scope: fieldScope
				, hostTypes: { "checked-record": {
					field: nestedCheckedRecordBrowserField
				} }
				, conversionNotes: {
					"checked-record": fieldConversion
				}
				, limitations: [nestedCheckedRecordBrowserLimit]
				, stages: Object.fromEntries(inventory.stages.map(stage => [stage, {
					state: "passed", evidence: [full[0].id], note: notes[stage]
				}]))
			});
		}
	const history = JSON.parse(await readFile(nestedCheckedRecordHistoryPath));
	for(const entry of inventory.evidence) for(const file of entry.files)
	{
		const update = history.updates.find(item => item.path === file.path);
		if(update && file.sha256 === update.previousSha256)
			file.sha256 = update.currentSha256;
	}
	const pins = new Map(await Promise.all(promotionPins.map(async path => [
		path, sha256(await readFile(path))
	])));
	for(const entry of inventory.evidence) for(const file of entry.files)
		if(pins.has(file.path)) file.sha256 = pins.get(file.path);
	return inventory;
};
