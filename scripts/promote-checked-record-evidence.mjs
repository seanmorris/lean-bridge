/**
 * Promote only the installed first checked-record slice, without claiming general dependent types.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { sha256 } from "../src/capsule/node.mjs";
import { checkedRecordPromotionEnvironment, checkedRecordPromotionReferences } from "../tests/helpers/checked-record-promotion-references.mjs";

const path = "docs/type-surface.v1.json", inventory = JSON.parse(await readFile(path, "utf8"));
assert.ok(!inventory.shapes.some(shape => shape.id === "checked-record"));
inventory.shapes.splice(inventory.shapes.findIndex(shape => shape.id === "dependent"), 0, {
	id: "checked-record", lean: "Checked records and closed Nat indices"
	, family: "checked-value", ir: null
	, meaning: "A structure with runtime payload fields and erased proofs, optionally specialized at closed Nat literal indices."
	, bounds: "Construct inputs only through the selected safe Lean constructor over the exact payload fields. Preserve closed indices and per-site choices; project proof-backed results without fabricating proofs."
});
const references = await checkedRecordPromotionReferences();
for(const reference of references)
{
	assert.ok(!inventory.evidence.some(item => item.id === reference.id));
	const files = ["tests/fin-python-ruby-evidence.test.mjs"
		, "tests/helpers/checked-record-promotion-references.mjs"
		, "tests/helpers/checked-record-promotion-tests.mjs"
		, "tests/helpers/checked-record-evidence.mjs"
		, "tests/helpers/checked-record-evidence-tests.mjs", reference.receiptPath
		, reference.report.path, ...reference.executionFiles.map(file => file.path)];
	inventory.evidence.push({ id: reference.id, kind: "installed"
		, revision: reference.revision, command: reference.command
		, scope: `${reference.sourcePath} ${reference.host} ${reference.route} checked records: ${Object.entries(reference.checks).map(([profile, checks]) => `${profile} ${checks} checks`).join(", ")}. ${reference.rejections === null ? "" : `${reference.rejections} Node runtime rejections; strict TypeScript validates declarations separately. `}Two-root package reproduction, deleted author/build roots and offline installed calls. ${reference.environment} ${reference.dispatch} Selected source pins are not a complete dependency closure. No reconstructed analyzed-tree claim, general dependent payload, nested record, other host or callback coverage is inferred.`
		, files: await Promise.all(files.map(async path => ({ path, sha256: sha256(await readFile(path)) })))
		, artifacts: reference.artifacts.map(file => ({ ...file, path: `${reference.id}/${file.path}` })) });
}
const hostTypes = {
	c: { parameter: "Borrowed generated C record with GMP integer and typed-span payload fields", result: "Initialized generated C record with owning GMP and span payloads; clear after use" }
	, cpp: { parameter: "Generated value record with cpp_int and vector payload fields", result: "Generated owning value record with cpp_int and vector payloads" }
	, "node-javascript": { parameter: "Object with bigint and bigint[] payload fields", result: "Copied object with bigint and bigint[] payload fields" }
	, "node-typescript": { parameter: "Generated structural record type with bigint and bigint[] payload fields", result: "Generated structural record type with copied bigint and bigint[] fields" }
};
for(const profile of Object.keys(hostTypes)) for(const sourcePath of ["ordinary-source", "reviewed-ir"])
	for(const position of ["parameter", "result"])
	{
		const selected = references.filter(item => item.profiles.includes(profile) && item.sourcePath === sourcePath && item.positions.includes(position));
		assert.equal(selected.length, sourcePath === "ordinary-source" && position === "result" ? 2 : 1);
		const host = profile.startsWith("node-") ? "npm" : "c-cpp";
		const conversion = "Pass only payload fields: Interval {lo, hi}, Triple {data} for Sized 3, and Percent {value} for Bounded 0 101. Input constructors validate cross-field predicates or normalize values inside Lean without changing caller input. Results expose payload fields, not proofs. A standalone result-only package works without any checked input. Other indices, nested/refined/recursive records and dynamic dependent payloads are not covered.";
		const stageNotes = {
			analysis: "Fresh Lean authenticates erased proof fields, closed Nat literal indices and each checked parameter's constructor; independently authored reviewed IR must reconcile exactly."
			, generation: "Typed proof-free payload carriers retain record identity and per-site constructor choices."
			, compilation: "The selected safe constructor returns Option of the exact source record. Lean-produced results project payloads without an input constructor."
			, packaging: `Two roots reproduce the selected release; author/build roots are deleted before offline installation. ${checkedRecordPromotionEnvironment[host]}`
			, installedExecution: `${profile === "node-typescript" ? "Strict generated TypeScript declarations compile with negative type controls; the same installed package executes the Node runtime checks" : `Installed ${profile} ${sourcePath} calls preserve valid values and rejection recovery`}. ${profile === "c" ? "Ordinary/reviewed C interposers distinguish entry, pre-validator, constructor, adapter and source; result-only dispatch is unmeasured." : "Dispatch is unmeasured for this consumer."}`
		};
		inventory.observations.push({ id: `checked-record-${profile}-${sourcePath}-${position}`
			, profiles: [profile], shapes: ["checked-record"]
			, positions: [position], path: sourcePath
			, scope: "First installed slice: Interval, Sized 3 and Bounded 0 101 at top-level parameters/results, including multiple checked inputs, normalizing constructors and result-only output."
			, hostTypes: { "checked-record": { [position]: hostTypes[profile][position] } }
			, stages: Object.fromEntries(inventory.stages.map(name => [name, { state: "passed", evidence: selected.map(item => item.id), note: stageNotes[name] }]))
			, limitations: ["Only this consumer, source route and top-level position. No field or callback observations; nested, recursive, inherited and refined payload records remain separate requirements."
				, "Only closed Nat literal indices. General dependent runtime payloads, other index kinds, zero-payload proofs and open generic records remain required and unpromoted."
				, checkedRecordPromotionEnvironment[host]]
			, conversionNotes: { "checked-record": conversion } });
	}
await writeFile(path, JSON.stringify(inventory, null, 2) + "\n");
process.stdout.write("Promoted six checked-record selections into sixteen top-level cells; general dependent/proof requirements remain unchanged.\n");
