/**
 * Reconcile the four-ABI installed Perl refinement evidence with its exact inventory scope.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { sha256 } from "../../src/capsule/node.mjs";
import { perlRefinementCases } from "./perl-refinement-hosted-evidence.mjs";
import { assertPerlRelocatedArchive, perlRelocatedConfigurations, perlRelocatedDirectory, perlRelocatedOriginalReceipt, perlRelocatedRevision } from "./perl-relocated-hosted-evidence.mjs";

export const perlRelocatedPromotionIds = ["perl-fin-containers-ordinary-source", "perl-subtype-ordinary-source"];
export const perlRelocatedReviewedId = "reviewed-fin-perl-scalar-containers";
const evidenceId = kind => `perl-relocated-${kind}-hosted-installed`;
const receiptPath = `${perlRelocatedDirectory}/receipt.json`;
const environment = "Perl 5.36.3 and 5.38.2, each threaded and unthreaded, on hosted Ubuntu 24.04 with the glibc 2.38 package floor. Two clean builds reproduce archives within each configuration. Author sources are removed before offline, compiler-free installation; the installed tree is moved after the first run and the unchanged full consumer runs again from the moved prefix.";
const commands = {
	subtype: "LEAN_BRIDGE_SUBTYPE_PROFILES=perl node --test tests/native-subtype.test.mjs"
	, container: "LEAN_BRIDGE_FIN_CONTAINER_PROFILES=perl LEAN_BRIDGE_REVIEWED_FIN_CONTAINER_PROFILES=perl node --test tests/native-fin-containers.test.mjs tests/perl-fin-containers.test.mjs"
	, supplemental: "LEAN_BRIDGE_PERL_REFINEMENT_TEST=1 node --test tests/perl-refinements.test.mjs"
};
const scopes = {
	subtype: "Top-level ordinary-source Subtype over String, Nat, Int and ByteArray: 2017 checks per full consumer run, including Unicode, embedded NUL, 2^100, normalization, projected results, late-argument rejection and 1000 rejection/recovery cycles. Public mix/half controls separately measure the named validator, adapter and source columns; Fin rejection enters none and constructor rejection enters only the validator. Direct typed-adapter controls belong to separate C evidence."
	, container: "Ordinary-source Fin inside Array, List, Option, their tested nested compositions and transparent aliases: 2027 checks per full consumer run. Public mirrorAll/orDefault controls measure only their two adapters and two source functions, with zero-entry rejection and positive/recovery controls. This does not establish relocated scalar native-fin acceptance."
	, "reviewed-container": "Independently reviewed Fin inside Array, List, Option, their tested nested compositions and transparent aliases: 2027 checks per full consumer run. Public mirrorAll/orDefault controls measure only their two adapters and two source functions, with zero-entry rejection and positive/recovery controls. This does not extend earlier scalar measurements or cover reviewed Subtype."
	, supplemental: "Ordinary-source checkedDigit32 over UInt32 and nested Fin 0 containers: 1518 checks per full consumer run, including 500 mixed rejection/recovery cycles. No dispatch counters are measured by this supplemental report."
};

/** Build four scoped evidence entries only after authenticating both immutable archives. */
export const perlRelocatedPromotionEvidence = async () => {
	const bytes = await readFile(receiptPath);
	assert.equal(sha256(bytes), "c26fe20d9cf0b17349db42d33d1e11063a76e767dd378df3d0b3ed0b24f9a069");
	const receipt = JSON.parse(bytes);
	await assertPerlRelocatedArchive(receipt, readFile);
	const paths = [receiptPath, perlRelocatedOriginalReceipt.path
		, "tests/helpers/perl-refinement-hosted-evidence.mjs"
		, "tests/helpers/perl-relocated-hosted-evidence.mjs"
		, "tests/perl-relocated-hosted-evidence.test.mjs"
		, "tests/helpers/perl-relocated-promotion.mjs"
		, "tests/perl-relocated-promotion.test.mjs"
		, ...receipt.files.map(file => file.path)];
	const files = await Promise.all(paths.map(async path => ({ path, sha256: sha256(await readFile(path)) })));
	return Promise.all(perlRefinementCases.map(async selected => ({
		id: evidenceId(selected.id), kind: "installed"
		, revision: perlRelocatedRevision
		, command: commands[selected.id === "reviewed-container" ? "container" : selected.id]
		, scope: `${scopes[selected.id]} ${environment} Reports retain model, Binding IR and receipt digests without their complete original files; the reader authenticates original report bytes, not a reconstruction of those identities. Source snapshots are selected Git identities, not a complete dependency closure. Package binaries are not retained in this repository archive.`
		, files: structuredClone(files)
		, artifacts: (await Promise.all(perlRelocatedConfigurations.map(async configuration => {
			const report = JSON.parse(await readFile(`${perlRelocatedDirectory}/${configuration.name}/${selected.id}.json`));
			return Object.entries(report.archives).map(([path, sha256]) => ({ path: `${configuration.name}/${selected.id}/${path}`, sha256 }));
		}))).flat()
	})));
};

const stages = (evidence, notes) => Object.fromEntries(Object.entries(notes).map(([stage, note]) => [stage, { state: "passed", evidence: [...evidence], note }]));
const finNotes = {
	analysis: "Fresh Lean metadata retains exact closed Fin bounds inside Array, List, Option and transparent aliases."
	, generation: "Generated XS checks every present element using exact Math::BigInt bounds and reports its indexed path; empty containers and absent options do not construct Fin 0."
	, compilation: "Compiled XS checks bounds before the guarded typed adapter or source call. Public counter controls measure mirrorAll and orDefault only."
	, packaging: environment
	, installedExecution: "All four configurations pass 2027 ordinary container checks and 1518 supplemental checks per full run, including late rejection, caller preservation and recovery, then repeat after installed-tree relocation."
};
const subtypeNotes = {
	analysis: "Fresh Lean verifies the named constructor accepts the exact primitive base and returns Option of the exact subtype."
	, generation: "Generated XS retains object-backed constructor inputs but passes unboxed UInt32 by value; POD names each constructor."
	, compilation: "XS checks all Fin bounds, then each validator in parameter order, before the guarded typed adapter constructs the subtype and invokes the export."
	, packaging: environment
	, installedExecution: "All four configurations pass 2017 Subtype checks and 1518 supplemental checks per full run, including UInt32, normalization, late rejection and recovery, then repeat after installed-tree relocation. Named mix/half counter controls distinguish validators, adapters and source calls."
};

/**
 * Add ordinary container/Subtype observations and supplement reviewed container relocation only.
 *
 * @param previous - Unmodified predecessor observations.
 */
export const promotePerlRelocatedObservations = previous => {
	assert.ok(perlRelocatedPromotionIds.every(id => !previous.some(item => item.id === id)), "Already promoted");
	const observations = structuredClone(previous), reviewed = observations.find(item => item.id === perlRelocatedReviewedId);
	assert.ok(reviewed); assert.deepEqual(reviewed.profiles, ["perl"]);
	assert.deepEqual(reviewed.shapes, ["fin"]); assert.deepEqual(reviewed.positions, ["parameter", "result"]);
	assert.equal(reviewed.path, "reviewed-ir");
	for(const stage of Object.values(reviewed.stages)) stage.evidence.push(evidenceId("reviewed-container"));
	reviewed.stages.installedExecution.note += ` Four new hosted reviewed-container reports each pass 2027 checks before and after installed-tree relocation. ${environment}`;
	reviewed.limitations.push("The new hosted relocation reports cover reviewed Array/List/Option Fin only. Earlier scalar evidence remains unchanged; fresh scalar relocation and reviewed Subtype require separate acceptance.");
	observations.push({
		id: perlRelocatedPromotionIds[0], profiles: ["perl"], shapes: ["fin"]
		, positions: ["parameter", "result"], path: "ordinary-source"
		, scope: "Ordinary-source installed CPAN packages check Fin inside Array, List, Option, their tested nested compositions and transparent aliases. This observation covers container parameters/results, not the separate top-level scalar native-fin relocation gate."
		, hostTypes: { fin: { parameter: "Math::BigInt checked against the declared bound", result: "Math::BigInt below the bound" } }
		, stages: stages([evidenceId("container"), evidenceId("supplemental")], finNotes)
		, limitations: ["Container parameters/results only; no nominal-field, product, Except or callback promotion.", "Only mirrorAll/orDefault entries are counted by the container probe; countNone and the supplemental fixture have no dispatch measurements.", "Ordinary source only. Reviewed containers retain their separate observation."]
		, conversionNotes: { fin: "Array and List use array references; Option uses undef for absence and the generated Some->new(value) for presence. Every present Math::BigInt element must be below its bound. Empty/absent Fin 0 containers are valid; present Fin 0 elements are rejected before dispatch, with the failing indexed path." }
	}, {
		id: perlRelocatedPromotionIds[1], profiles: ["perl"]
		, shapes: ["subtype"], positions: ["parameter", "result"]
		, path: "ordinary-source"
		, scope: "Ordinary-source installed CPAN packages accept top-level author-constructed Subtype parameters/results over String, Nat, Int, ByteArray and UInt32. The exported function receives the checked constructor's value, including normalization; results project the primitive base."
		, hostTypes: { subtype: { parameter: "Primitive base value checked by the named Lean constructor", result: "Constructed subtype projected to its primitive base value" } }
		, stages: stages([evidenceId("subtype"), evidenceId("supplemental")], subtypeNotes)
		, limitations: ["Top-level ordinary-source parameters/results only; no nested, field, callback or reviewed-IR Subtype claim.", "A valid call can run the constructor twice, in the validator and guarded adapter. The host sees only the base value.", "Public counter measurements cover only the report's named mix validator/adapter/source and half source. Direct typed-adapter measurements belong to the C probe; no allocation-count claim is made."]
		, conversionNotes: { subtype: "Use Math::BigInt for Nat/Int, an integer scalar for UInt32, text for String and an octet string for ByteArray. Fin checks run first. Constructor rejection dies naming the parameter and constructor without changing caller data. The export receives the constructed value; results expose its base." }
	});
	return observations;
};

/**
 * Build the only permitted claim changes from the authenticated archive.
 *
 * @param previous - Exact predecessor inventory.
 */
export const promotePerlRelocatedInventory = async previous => {
	const inventory = structuredClone(previous);
	const evidence = await perlRelocatedPromotionEvidence();
	for(const entry of evidence) assert.ok(!inventory.evidence.some(old => old.id === entry.id), "Already promoted");
	inventory.evidence.push(...evidence);
	inventory.observations = promotePerlRelocatedObservations(previous.observations);
	return inventory;
};
