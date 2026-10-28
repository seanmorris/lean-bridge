#!/usr/bin/env node
/**
 * Promote exactly the remaining 50 installed copied-field and callback Fin
 * cells from the four immutable hosted archives.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { typeSurfaceCells } from "../src/adoption/type-surface.mjs";
import {
	finCompletionPromotionReferences, finCompletionTargetCells
} from "../tests/helpers/fin-completion-promotion.mjs";

assert.deepEqual(process.argv.slice(2), []
	, "Usage: promote-fin-completion.mjs");
const path = "docs/type-surface.v1.json";
const [inventory, irSchema, consumers] = await Promise.all([
	path, "schema/binding-ir.schema.json", "docs/consumer-support.v1.json"
].map(async file => JSON.parse(await readFile(file, "utf8"))));
const contracts = { irSchema, consumers };
const references = await finCompletionPromotionReferences();
const byName = new Map(references.map(reference => [
	reference.name, reference
]));
assert.equal(byName.size, 4);

for(const reference of references)
{
	assert.ok(!inventory.evidence.some(item => item.id === reference.id)
		, reference.id);
	inventory.evidence.push({
		id: reference.id, kind: "installed", revision: reference.revision
		, command: reference.command
		, scope: `${reference.scope} The immutable archive retains and independently replays the original GitHub artifact, API identities, reports, package receipts, checker output and selected exact source snapshots.`
		, files: reference.files
		, artifacts: reference.artifacts.map(artifact => ({
			...artifact, path: `${reference.id}/${artifact.path}`
		}))
	});
}

const browserProfiles = [
	"browser-javascript", "browser-react", "browser-worker"
];
const fieldReviewedProfiles = [
	"node-javascript", "node-typescript", ...browserProfiles
];
const managedProfiles = [
	"dotnet", "java", "kotlin", "php-native", "wit-wasi"
];
const nativeProfiles = ["python", "ruby", "rust", "perl"];
const groups = [
	{
		id: "fin-completion-browser-fields-ordinary", reference: "fields"
		, profiles: browserProfiles, path: "ordinary-source"
		, positions: ["field"]
		, scope: "Ordinary-source copied Fin fields execute through pages, React lifecycles and dedicated workers in all three declared browser engines."
	}
	, {
		id: "fin-completion-wasm-fields-reviewed", reference: "fields"
		, profiles: fieldReviewedProfiles, path: "reviewed-ir"
		, positions: ["field"]
		, scope: "Independently reviewed copied Fin fields execute through Node JavaScript, strict TypeScript and every declared browser context and engine."
	}
	, {
		id: "fin-completion-browser-callbacks-reviewed"
		, reference: "browserCallbacks", profiles: browserProfiles
		, path: "reviewed-ir"
		, positions: ["callback-parameter", "callback-result"]
		, scope: "Independently reviewed Fin values cross synchronous callback arguments, replies and returned Lean closures in every declared browser context and engine."
	}
	, ...["ordinary-source", "reviewed-ir"].map(sourcePath => ({
		id: `fin-completion-managed-callbacks-${sourcePath}`
		, reference: "managedCallbacks", profiles: managedProfiles
		, path: sourcePath
		, positions: ["callback-parameter", "callback-result"]
		, scope: `${sourcePath === "ordinary-source" ? "Ordinary-source" : "Independently reviewed"} Fin values cross synchronous callback arguments, replies and returned Lean closures in installed .NET, Java, Kotlin, native PHP and WIT/WASI packages.`
	}))
	, ...["ordinary-source", "reviewed-ir"].map(sourcePath => ({
		id: `fin-completion-native-callbacks-${sourcePath}`
		, reference: "nativeCallbacks", profiles: nativeProfiles
		, path: sourcePath
		, positions: ["callback-parameter", "callback-result"]
		, scope: `${sourcePath === "ordinary-source" ? "Ordinary-source" : "Independently reviewed"} Fin values cross synchronous callback arguments, replies and returned Lean closures in installed Python, Ruby, Rust and Perl packages.`
	}))
];
assert.equal(groups.length, 7);

const targetIds = groups.flatMap(group => group.profiles.flatMap(profile =>
	group.positions.map(position => `${profile}/fin/${group.path}/${position}`)));
assert.equal(targetIds.length, 50);
assert.equal(new Set(targetIds).size, 50);
assert.deepEqual([...targetIds].sort(), [...finCompletionTargetCells].sort());
const beforeCells = typeSurfaceCells(inventory, contracts);
const before = new Map(beforeCells.map(cell => [cell.id, cell]));
for(const id of targetIds)
	assert.notEqual(before.get(id)?.stages.installedExecution.state, "passed", id);
const missing = beforeCells.filter(cell => cell.shape === "fin"
	&& ["field", "callback-parameter", "callback-result"].includes(cell.position)
	&& cell.stages.installedExecution.state !== "passed").map(cell => cell.id);
assert.deepEqual([...missing].sort(), [...targetIds].sort()
	, "The promotion target is the exact missing Fin scope");

const notes = {
	analysis: "Compiler-derived bounds and independently reviewed decisions retain the exact Fin position and reject disagreement with fresh Lean metadata."
	, generation: "Generated public and raw adapters keep the declared bound and use checked reconstruction for host-produced values."
	, compilation: "Invalid host values fail before the selected Lean body or callback continuation; no default Fin value or proof is synthesized."
	, packaging: "Independent author roots reproduce source-free packages whose receipt-closed archives install offline and retain exact runtime identities."
	, installedExecution: "Hosted installed consumers exercise in-range values, exact-bound and over-bound rejection, unchanged caller values, recovery and the archive-specific context matrix."
};
for(const group of groups)
{
	const reference = byName.get(group.reference);
	assert.ok(reference);
	const hostTypes = group.positions.includes("field")
		? { field: "The target's Nat representation, checked against the copied field's declared Fin bound" }
		: {
			"callback-parameter": "The target's Nat representation, checked against the declared bound before a returned Lean closure or host callback consumes it"
			, "callback-result": "The target's Nat representation, checked against the declared bound before a host reply is reconstructed or projected from Lean"
		};
	inventory.observations.push({
		id: group.id, profiles: group.profiles, shapes: ["fin"]
		, positions: group.positions, path: group.path, scope: group.scope
		, hostTypes: { fin: hostTypes }
		, stages: Object.fromEntries(inventory.stages.map(stage => [stage, {
			state: "passed", evidence: [reference.id], note: notes[stage]
		}]))
		, limitations: [
			"Only the named copied-field or synchronous callback positions, source route, installed profiles and fixture shapes are established by this observation."
			, "Retained or asynchronous callbacks, arbitrary dependent bounds, recursive refined payloads, dispatch cost and peak memory remain separate."
			, ...reference.index.limitations
		]
		, conversionNotes: {
			fin: "Host-produced Nat carriers are checked against the compiler-derived bound before Lean reconstructs Fin. Lean-produced Fin values cross as their proof-erased Nat carriers. Rejection never synthesizes a default Fin value or proof."
		}
	});
}

const afterCells = typeSurfaceCells(inventory, contracts);
const changed = afterCells.filter(cell => JSON.stringify(cell.stages)
	!== JSON.stringify(before.get(cell.id).stages));
assert.deepEqual(changed.map(cell => cell.id).sort(), [...targetIds].sort());
for(const cell of changed)
	for(const stage of Object.values(cell.stages))
		assert.equal(stage.state, "passed", cell.id);
await writeFile(path, JSON.stringify(inventory, null, 2) + "\n");
process.stdout.write("Promoted four immutable hosted archives through seven observations and exactly 50 remaining Fin cells.\n");
