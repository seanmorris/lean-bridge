/**
 * Promote archived C/C++ products and nominal Fin fields without widening other hosts.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { sha256 } from "../src/capsule/node.mjs";
import { nativeFinPromotionReferences } from "../tests/helpers/native-fin-promotion-references.mjs";

const path = "docs/type-surface.v1.json", inventory = JSON.parse(await readFile(path, "utf8"));
const references = await nativeFinPromotionReferences();
assert.equal(references.length, 8);
const common = ["src/analyze/NativeExports.lean", "src/analyze/native-types.mjs"
	, "src/analyze/reviewed-refinements.mjs", "src/analyze/reviewed-source.mjs"
	, "src/abi/refinements.mjs", "src/build/native-model.mjs"
	, "src/backends/c/native-copied-values.mjs"
	, "src/backends/native/fin-refinements.mjs"
	, "tests/helpers/native-fin-promotion-references.mjs"
	, "tests/helpers/native-fin-promotion-tests.mjs"];
for(const reference of references)
{
	assert.ok(!inventory.evidence.some(item => item.id === reference.id), `Already promoted: ${reference.id}`);
	const historical = reference.kind === "products" ? ["docs/evidence/native-fin-products-20261007/original-fixture-reference.json"] : [];
	const files = [...common, reference.validator, reference.receiptPath, reference.reportPath, ...historical];
	const scope = `${reference.sourcePath} C/C++ ${reference.kind} Fin. Two-root reproducible archives and source-free offline installed execution on Debian 12, glibc 2.36. Original producer revisions and artifact identities are retained. `
		+ (reference.kind === "arrays" ? "This original Array run has no source or raw-adapter dispatch measurements."
			: "Only C has measured dispatch; C++ does not inherit its counters. " + (reference.kind === "array-dispatch" ? "Only rows is instrumented, not reversed." : ""))
		+ (reference.kind === "products" ? " The original fixture called its Fin 0 export never; the historical reference preserves that name. This is not an execution of the renamed absentOnly fixture." : "")
		+ " No other host, callback, Subtype, recursive/generic field or hosted CI claim is inferred.";
	inventory.evidence.push({ id: reference.id, kind: "installed"
		, revision: reference.revision, command: reference.command, scope
		, files: await Promise.all(files.map(async path => ({ path, sha256: sha256(await readFile(path)) })))
		, artifacts: reference.artifacts.map(item => ({ ...item, path: `${reference.id}/${item.path}` })) });
}

const notes = {
	analysis: "Fresh Lean metadata retains every closed bound at the selected structural or nominal site; reviewed decisions reconcile with that metadata."
	, generation: "Nat carriers keep their exact bounds through Array/List/Option/Prod/Except and supported record or active variant fields."
	, compilation: "Generated Lean constructs Fin only after checking its bound. C source/adapter dispatch observations are separate from C++ public rejection tests."
	, packaging: "Two unrelated author roots reproduce the original C/C++ archives before source-free offline installation."
	, installedExecution: "Installed consumers execute valid endpoints, Fin 0 absence, large bounds, invalid inputs and recovery. Original reports identify the exact fixture and measured dispatch scope."
};
for(const sourcePath of ["ordinary-source", "reviewed-ir"])
{
	const existing = inventory.observations.find(item => item.id === `native-fin-c-family-${sourcePath}`);
	assert.ok(existing);
	const structural = references.filter(item => item.sourcePath === sourcePath && item.kind !== "fields");
	existing.scope = `${sourcePath} C/C++ Fin parameters and results retain exact closed bounds, including Array/List/Option/Prod/Except compositions and transparent aliases. Installed consumers exercise invalid active leaves and recovery; nominal fields are recorded separately.`;
	for(const [name, stage] of Object.entries(existing.stages))
	{
		stage.evidence.push(...structural.map(item => item.id));
		stage.note = notes[name];
	}
	existing.limitations = ["Only the named C/C++ source route and structural parameter/result positions; nominal fields are recorded separately. Callback and Subtype claims are not added."
		, "Local glibc 2.36 execution does not establish hosted CI or another runtime floor."
		, "Only C measures dispatch, with the scope of each original report; C++ and Array reversed have no independent counters."];
	existing.conversionNotes.fin = "Use Nat values with their declared closed bounds through arrays, lists, options, products and active Except branches. Every present constrained leaf is checked; empty or absent Fin 0 containers remain valid.";
	const fields = references.filter(item => item.sourcePath === sourcePath && item.kind === "fields");
	assert.equal(fields.length, 1);
	inventory.observations.push({ id: `native-nominal-fin-c-family-${sourcePath}`
		, profiles: ["c", "cpp"], shapes: ["fin"]
		, positions: ["field"], path: sourcePath
		, scope: `${sourcePath} C/C++ nonrecursive, nongeneric record and active variant fields retain closed Fin bounds through Array/List/Option/Prod/Except compositions. C executes 2064 checks and C++ 2053; five contradictory reviewed field contracts fail fresh Lean reconciliation.`
		, hostTypes: { fin: { field: "GMP integer (C) or cpp_int (C++) checked against the field's closed bound" } }
		, stages: Object.fromEntries(inventory.stages.map(name => [name, { state: "passed", evidence: fields.map(item => item.id), note: notes[name] }]))
		, limitations: ["C/C++ only, on the named source path; no recursive, generic, indexed or inherited refined record coverage."
			, "No callback, Subtype, browser, PHP-Wasm or other native-host acceptance is inferred."
			, "The C package alone measures dispatch. Local glibc 2.36 acceptance does not establish a hosted CI result or another runtime floor."]
		, conversionNotes: { fin: "Record and active variant fields keep Nat values and exact closed bounds. Constraints also apply inside their structural containers; an inactive Fin 0 branch is not constructed or read." } });
}
await writeFile(path, JSON.stringify(inventory, null, 2) + "\n");
process.stdout.write("Promoted eight original C/C++ bundles, four field cells and eight supplemental parameter/result cells.\n");
