/**
 * Promote only the nested checked-record positions authenticated by NuGet runs.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import {
	checkNestedCheckedRecordDotnetEvidence
	, nestedCheckedRecordDotnetEvidence
	, nestedCheckedRecordDotnetEvidenceSha256
} from "./nested-checked-record-dotnet-evidence.mjs";
export const nestedCheckedRecordDotnetProfiles = Object.freeze(["dotnet"]);
export const nestedCheckedRecordDotnetConversion = "The tested Packet is a generated sealed C# record whose Fin 10 Digit and checked Nat Subtype Word are BigInteger values. Holder nests Packet, and ChoicePacket carries it in the active Choice branch. The generated adapter applies the exact Packet and nested Word constructors selected at each direct, repeated, array, list, option, tuple, result, Holder and Choice input site. Rejected calls preserve the complete caller graph and later valid calls recover. Packet arrays and options returned by Lean contain proof-free payloads without input-constructor selections.";
export const nestedCheckedRecordDotnetLimit = "Nested checked-record C# acceptance covers only the tested acyclic Packet, Holder and Choice forms through Array, List, Option, Product and Except copied positions. Generic, recursive and inherited records, other index kinds, open dependent or zero-payload records, callbacks and owned positions remain unreviewed. Both author routes and full/result-only APIs reproduce complete NuGet packages from two author roots, remove author sources, restore offline, replay after relocation and execute again after deleting all consumer sources. The runs use .NET SDK 8.0.424 and shared framework 8.0.30 on Linux x64/glibc 2.36 with an explicit 2.36 package floor and 64-bit machine words. Original packages, receipts, restore inputs, API-probe diagnostics, execution records and selected sources are retained; external toolchain binaries are represented by version, size and digest. Constructor/source entry counts and peak memory are unmeasured. Hosted glibc 2.38 release-floor acceptance remains assigned to the recurring workflow.";
export const nestedCheckedRecordDotnetField = "Generated sealed Packet record with BigInteger Digit and Word fields nested inside Holder and ChoicePacket; no proof field";
const quote = value => "'" + String(value).replaceAll("'", "'\\''") + "'";

const commandFor = start => [...Object.entries(start.environment).map(([key, value]) => {
	assert.match(key, /^[A-Z_][A-Z0-9_]*$/u); assert.equal(typeof value, "string");
	return key + "=" + quote(value);
})
, quote(start.command), ...start.args.map(quote)].join(" ");

/**
 * Derive four inventory references from validated evidence or a metadata precheck.
 *
 * @param checked - Validated archive descriptor.
 * @param read - Reader of repository-relative immutable evidence bytes.
 */
const referencesFromEvidence = async (checked, read) => {
	const index = JSON.parse(await read(`${nestedCheckedRecordDotnetEvidence}/index.json`));
	assert.equal(index.producerCommit, checked.producerCommit);
	assert.equal(index.runs.length, checked.selections.length);
	const references = [];
	for(const [position, counts] of checked.selections.entries())
	{
		const run = index.runs[position], label = `${run.route}-${run.mode}`;
		assert.equal(counts.route, run.route); assert.equal(counts.mode, run.mode);
		const start = JSON.parse(await read(`${nestedCheckedRecordDotnetEvidence}/${label}/producer/start.json`));
		const report = JSON.parse(await read(`${nestedCheckedRecordDotnetEvidence}/${label}/records/report.json`));
		const files = checked.files.filter(file => file.path.startsWith(label + "/")
			|| file.path.startsWith("sources/"));
		references.push({
			id: `nested-checked-record-dotnet-${run.route}-${run.mode}-installed`
			, route: run.route, mode: run.mode
			, sourcePath: run.route === "ordinary" ? "ordinary-source" : "reviewed-ir"
			, profiles: [...nestedCheckedRecordDotnetProfiles]
			, positions: run.mode === "full"
				? ["parameter", "result", "field"] : ["result"]
			, revision: checked.producerCommit, counts, command: commandFor(start)
			, scope: `Two independent author builds reproduce the complete NuGet package. Author sources are removed before offline restore; unchanged callers replay after moving the installed tree and execute again after deleting all consumer sources, giving three executions per selection. ${run.mode === "full" ? "The full API checks direct and repeated parameters, Array, List, Option, Product, both Except branches, Holder.packet and the active Choice.packet.value field, including exact per-site constructors, normalization, complete rejected-input snapshots and recovery." : "The standalone result-only API projects checked-record payloads through Array and Option results without checked-input metadata."} Independent controls reject every missing record and coordinated environment, resource, model, package and execution mutation. ${nestedCheckedRecordDotnetLimit}`
			, files: [{
				path: nestedCheckedRecordDotnetEvidence + "/index.json"
				, sha256: nestedCheckedRecordDotnetEvidenceSha256
			}
			, ...files.map(file => ({
				path: nestedCheckedRecordDotnetEvidence + "/" + file.path
				, sha256: file.sha256
			}))]
			, artifacts: report.receipt.packages[0].artifacts
				.map(({ path, sha256 }) => ({ path, sha256 }))
		});
	}
	return references;
};

let defaultReferences;

/**
 * Derive references only after authenticating all four original packages.
 *
 * @param read - Reader used to authenticate retained evidence bytes.
 */
export const nestedCheckedRecordDotnetReferences = async (read = readFile) => {
	if(read !== readFile)
		return referencesFromEvidence(await checkNestedCheckedRecordDotnetEvidence(read), read);
	defaultReferences ??= referencesFromEvidence(
		await checkNestedCheckedRecordDotnetEvidence(), readFile
	);
	return structuredClone(await defaultReferences);
};

// Reject changed metadata before the representative mutation replay. Every
// accepted promotion still runs the complete archive verifier above.
const referencePrecheck = async () => {
	const bytes = await readFile(nestedCheckedRecordDotnetEvidence + "/index.json");
	assert.equal(sha256(bytes), nestedCheckedRecordDotnetEvidenceSha256);
	const index = JSON.parse(bytes); assert.equal(bytes.toString(), canonicalJson(index));
	const read = async path => {
		if(path === nestedCheckedRecordDotnetEvidence + "/index.json") return bytes;
		const entry = index.files.find(file =>
			nestedCheckedRecordDotnetEvidence + "/" + file.path === path);
		assert.ok(entry, path); const value = await readFile(path);
		assert.equal(value.length, entry.bytes); assert.equal(sha256(value), entry.sha256);
		return value;
	};
	const selections = [];
	for(const run of index.runs)
	{
		const verification = JSON.parse(await read(
			`${nestedCheckedRecordDotnetEvidence}/${run.label}/producer/verification.json`
		));
		const { archiveSha256, ...result } = verification;
		assert.equal(archiveSha256, run.archiveSha256);
		selections.push({ ...result, ...run.controls
			, attempt: run.attempt, loadCeiling: run.loadCeiling });
	}
	return referencesFromEvidence({
		producerCommit: index.producerCommit, files: index.files, selections
	}, read);
};

/**
 * Supplement six proven C# cells and leave every other profile unchanged.
 *
 * @param original - Exact inventory before this milestone.
 * @param references - Four independently authenticated installed selections.
 */
export const promoteNestedCheckedRecordDotnet = async (original, references) => {
	assert.deepEqual(references, await referencePrecheck());
	assert.deepEqual(references, await nestedCheckedRecordDotnetReferences());
	const inventory = structuredClone(original), validators = [];
	for(const path of [
		"tests/helpers/nested-checked-record-dotnet-report.mjs"
		, "tests/helpers/nested-checked-record-dotnet-evidence.mjs"
		, "tests/helpers/nested-checked-record-dotnet-controls.mjs"
		, "tests/helpers/nested-checked-record-dotnet-provenance.mjs"
		, "tests/helpers/nested-checked-record-dotnet-promotion.mjs"
		, "tests/helpers/nested-checked-record-dotnet-promotion-tests.mjs"
		, "tests/helpers/nested-checked-record-dotnet-ci-report.mjs"
		, "tests/helpers/nested-checked-record-dotnet-ci-policy-tests.mjs"
		, "tests/helpers/nested-checked-record-dotnet-ci-shell-tests.mjs"
		, "tests/helpers/nested-checked-record-dotnet-ci-workflow.mjs"
		, "tests/helpers/nested-checked-record-dotnet-ci-workflow-tests.mjs"
		, "scripts/check-nested-checked-record-dotnet-ci.mjs"
		, "scripts/run-nested-checked-record-dotnet-ci.sh"
		, ".github/workflows/nested-checked-record-dotnet.yml"
	]) validators.push({ path, sha256: sha256(await readFile(path)) });
	for(const reference of references)
	{
		assert.ok(!inventory.evidence.some(item => item.id === reference.id),
			"Already promoted: " + reference.id);
		inventory.evidence.push({
			id: reference.id, kind: "installed", revision: reference.revision
			, command: reference.command, scope: reference.scope
			, files: [...validators, ...reference.files]
			, artifacts: reference.artifacts.map(item => ({
				...item, path: reference.id + "/" + item.path
			}))
		});
	}
	for(const path of ["ordinary-source", "reviewed-ir"])
	{
		const full = references.filter(item => item.sourcePath === path
			&& item.mode === "full");
		const result = references.filter(item => item.sourcePath === path
			&& item.positions.includes("result"));
		assert.equal(full.length, 1); assert.equal(result.length, 2);
		for(const position of ["parameter", "result"])
		{
			const observations = inventory.observations.filter(item =>
				item.profiles.includes("dotnet") && item.path === path
				&& item.shapes.includes("checked-record")
				&& item.positions.includes(position));
			assert.equal(observations.length, 1
				, `Missing or overlapping C# checked-record cell: ${path}/${position}`);
			const observation = observations[0];
			assert.equal(observation.limitations.length, 1);
			const previousLimit = observation.limitations[0];
			assert.match(previousLimit, /Nested.*remain unreviewed/u);
			const matched = position === "result" ? result : full;
			const scope = matched.map(item => item.scope).join(" ");
			observation.scope = observation.scope.replaceAll(previousLimit, "").trimEnd()
				+ " Additional nested C# acceptance: " + scope;
			observation.conversionNotes["checked-record"] += " "
				+ nestedCheckedRecordDotnetConversion;
			observation.limitations = [nestedCheckedRecordDotnetLimit];
			for(const stage of Object.values(observation.stages))
			{
				assert.equal(stage.state, "passed");
				stage.evidence.push(...matched.map(item => item.id));
				assert.equal(new Set(stage.evidence).size, stage.evidence.length);
				stage.note = stage.note.replaceAll(previousLimit, "").trimEnd()
					+ " Additional nested C# acceptance: " + scope;
			}
		}
		const overlap = inventory.observations.filter(item =>
			item.profiles.includes("dotnet") && item.path === path
			&& item.shapes.includes("checked-record")
			&& item.positions.includes("field"));
		assert.equal(overlap.length, 0
			, `Overlapping C# checked-record field: ${path}`);
		const conversion = inventory.observations.find(item =>
			item.profiles.includes("dotnet") && item.path === path
			&& item.shapes.includes("checked-record")
			&& item.positions.includes("parameter"))
			.conversionNotes["checked-record"];
		const scope = full[0].scope;
		const notes = {
			analysis: "Fresh Lean and independently reviewed IR agree on Packet's erased proof, nested Fin 10 and Subtype fields, and every exact constructor choice."
			, generation: "Generated C# adapters recurse through supported copied containers, Holder.packet and the active Choice.packet.value field while retaining proof-free public records."
			, compilation: "Compiled Lean constructs Fin 10, the Word Subtype and Packet in dependency order at each selected public site."
			, packaging: "Two author roots reproduce complete NuGet packages before author removal, offline installation and physical installed-tree relocation."
			, installedExecution: scope
		};
		assert.deepEqual(Object.keys(notes), inventory.stages);
		inventory.observations.push({
			id: `nested-checked-record-dotnet-${path}-field`
			, profiles: ["dotnet"], shapes: ["checked-record"]
			, positions: ["field"], path, scope
			, hostTypes: { "checked-record": {
				field: nestedCheckedRecordDotnetField
			} }
			, conversionNotes: { "checked-record": conversion }
			, limitations: [nestedCheckedRecordDotnetLimit]
			, stages: Object.fromEntries(inventory.stages.map(stage => [stage, {
				state: "passed", evidence: [full[0].id], note: notes[stage]
			}]))
		});
	}
	return inventory;
};
