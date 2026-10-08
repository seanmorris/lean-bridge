/**
 * Promote archived checked Subtype and finite-specialization executions on C, C++ and Node.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { sha256 } from "../src/capsule/node.mjs";
import { reviewedApiPromotionReferences } from "../tests/helpers/reviewed-api-promotion-references.mjs";

const path = "docs/type-surface.v1.json", inventory = JSON.parse(await readFile(path, "utf8"));
const references = await reviewedApiPromotionReferences();
assert.equal(references.length, 4);
// Keep the old browser generic observation while replacing only Node's cells.
const delivery = inventory.observations.find(item => item.id === "javascript-delivery");
assert.ok(delivery.shapes.includes("generic"));
const browserGeneric = { ...structuredClone(delivery)
	, id: "javascript-reviewed-browser-generic-unverified"
	, profiles: delivery.profiles.filter(profile => profile.startsWith("browser-"))
	, shapes: ["generic"]
	, hostTypes: { generic: structuredClone(delivery.hostTypes.generic) } };
delivery.shapes = delivery.shapes.filter(shape => shape !== "generic");
delete delivery.hostTypes.generic;
inventory.observations.splice(inventory.observations.indexOf(delivery) + 1, 0, browserGeneric);
const notes = {
	analysis: "Independently reviewed author decisions reconcile with fresh Lean elaboration, including exact source identity and compiled signatures."
	, generation: "Concrete host signatures preserve each chosen constructor or finite application; the host supplies no proof or type argument."
	, compilation: "Typed Lean adapters compile the authorized decision. Checked constructors validate Subtype input before the source export runs."
	, packaging: "Two unrelated author roots reproduce the original archives before source-free offline installation."
	, installedExecution: "The exact archived C/C++ or Node JavaScript and strict TypeScript consumer executes the prepared package. Dispatch counters are not measured."
};
for(const reference of references)
{
	assert.ok(!inventory.evidence.some(item => item.id === reference.id), `Already promoted: ${reference.id}`);
	const files = [...new Set([
		...reference.receipt.sourceFiles.map(item => item.path)
		, reference.receiptPath, reference.reportPath, reference.validator
		, "tests/helpers/reviewed-api-promotion-references.mjs"
		, "tests/helpers/reviewed-api-promotion-tests.mjs"
	])];
	const subtype = reference.kind === "subtype";
	const scope = subtype
		? "Twelve independently reviewed exports with top-level primitive-base Subtype parameters/results, two specializations of one generic choosing different constructors, normalization, rejection/recovery and a zero-argument refined result."
		: "Ten independently reviewed finite function specializations and one ordinary export, closed primitive and alias arguments, and compiler-selected instance dictionaries. Open generic declarations remain absent.";
	inventory.evidence.push({ id: reference.id
		, kind: "installed"
		, revision: reference.revision
		, command: reference.command
		, scope: `${reference.profiles.join(", ")}: ${scope} Two-root reproducibility, source/build removal, offline installation and a compiler-free consumer path. Local native glibc 2.36 acceptance does not establish another floor or hosted CI. Browser, other-host and dispatch-counter coverage is not inferred.`
		, files: await Promise.all(files.map(async path => ({ path, sha256: sha256(await readFile(path)) })))
		, artifacts: reference.artifacts.map(item => ({ ...item, path: `${reference.id}/${item.path}` })) });
	const ordinaryId = subtype
		? reference.npm ? "npm-subtype-refinements-ordinary-source" : "native-subtype-c-cpp-ordinary-source"
		: reference.npm ? "npm-finite-specializations-ordinary-source" : "native-specializations-c-cpp-ordinary-source";
	const ordinary = inventory.observations.find(item => item.id === ordinaryId);
	assert.ok(ordinary, ordinaryId);
	const shapes = subtype ? ["subtype"] : ["generic", "implicit", "instance"];
	const positions = subtype ? ["parameter", "result"] : ["signature"];
	const hostTypes = structuredClone(ordinary.hostTypes);
	if(!subtype) hostTypes.generic.signature = "Concrete host function for each reviewed finite specialization";
	const conversionNotes = subtype
		? { subtype: "Reviewed Binding IR selects the checked constructor, including normalizing constructors that preserve the caller's input." }
		: { ...ordinary.conversionNotes
			, generic: "Reviewed packages select finite applications from the authored Binding IR." };
	inventory.observations.push({ id: reference.id.replace(/-installed$/u, "-reviewed-ir")
		, profiles: reference.profiles
		, shapes, positions, path: "reviewed-ir", scope, hostTypes
		, stages: Object.fromEntries(inventory.stages.map(stage => [stage, { state: "passed", evidence: [reference.id], note: notes[stage] }]))
		, limitations: [
			"Only the named C/C++ or Node JavaScript/TypeScript profiles. Browser and other native-host execution remain separate."
			, subtype ? "Top-level primitive-base Subtype only; nested, nominal-field and callback Subtype positions are not promoted."
				: "Only closed finite function specializations. Open generic dispatch, generic-record instantiation, recursive, inherited and dependent generic structures are not promoted by these reports."
			, "Original local producer revisions and artifact hashes remain authoritative; no integrated CI, additional runtime-floor or measured-dispatch claim is added."
		]
		, conversionNotes });
}
await writeFile(path, JSON.stringify(inventory, null, 2) + "\n");
process.stdout.write("Promoted four archived reports into four reviewed observations (twenty cells); preserved the separate browser generic observation.\n");
