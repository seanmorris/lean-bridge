/**
 * Reconcile the hosted ordinary npm generic-record acceptance without widening another host or route.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { sha256 } from "../../src/capsule/node.mjs";
import { assertGenericNpmArchive, genericNpmDirectory, genericNpmRevision, genericNpmRuns } from "./generic-record-npm-hosted-evidence.mjs";

export const genericNpmEvidenceId = "generic-record-npm-hosted-installed";
export const genericNpmClosureCells = ["node-javascript", "node-typescript"].flatMap(profile => [
	...["generic", "implicit", "instance"].map(shape => `${profile}/${shape}/ordinary-source/signature`)
	, ...["parameter", "result", "field"].map(position => `${profile}/record/ordinary-source/${position}`)
]);

/**
 * Separate instance-dictionary evidence from the record echo fixture and attach the hosted record checks.
 *
 * @param observations - Accepted observations before this milestone.
 */
export const reconcileGenericNpmObservations = observations => {
	const result = structuredClone(observations);
	const original = result.find(item => item.id === "npm-finite-specializations-ordinary-source");
	assert.ok(original); assert.equal(original.path, "ordinary-source");
	assert.deepEqual(original.profiles, ["node-javascript", "node-typescript"]);
	assert.deepEqual(original.shapes, ["generic", "implicit", "instance"]);
	assert.deepEqual(original.positions, ["signature"]);
	const records = structuredClone(original);
	records.id = "npm-record-specializations-ordinary-source";
	assert.ok(!result.some(item => item.id === records.id));
	records.shapes = ["generic", "implicit"];
	delete records.hostTypes.instance; delete records.conversionNotes.instance;
	records.scope = "Ordinary-source finite npm specializations expose concrete functions with no runtime type argument. The hosted generic-record fixture separately passes direct record exports (1010 checks, 1005 rejections) and nine configured echo specializations over record, List and Option aliases in two namespaces (1019 checks, 1010 rejections). Node runs the installed Wasm; strict TypeScript checks installed declarations with skipLibCheck disabled. Each alias keeps its compiler-resolved structure, arguments and field types; two aliases of one application retain distinct names with the same layout. Two author builds reproduce component and runtime archives. The harness copies the handoff, deletes both author roots and all build staging, then installs offline and executes Node with a Node-only PATH. The echo fixture binds an implicit type parameter and contains no instance binder.";
	records.limitations = [
		"Finite configured specializations only; open generic host dispatch is not generated."
		, "The hosted record fixture covers closed, nonrecursive copied aliases. Inherited, indexed, proof-bearing or dependent records, generic variants and refined, resource or callback arguments are not established by this run."
		, "This hosted archive covers ordinary-source Node and strict TypeScript. Browser, reviewed-IR and inherited-record results have separate evidence."
		, "No instance-dictionary or source-entry-counter claim follows from the generic-record echo fixture."
	];
	original.shapes = ["instance"];
	delete original.hostTypes.generic; delete original.hostTypes.implicit;
	delete original.conversionNotes.generic; delete original.conversionNotes.implicit;
	original.scope = "The original ordinary-source finite-specialization npm fixture resolves Lean instance dictionaries immediately following the configured type prefix before compilation. Node executes the concrete installed Wasm exports and strict TypeScript checks the installed declarations. The host cannot supply a runtime dictionary. This instance evidence comes from npm-finite-specializations-installed, not the separate generic-record echo fixture, which has no instance binder.";
	original.limitations = [
		"Only instance dictionaries immediately following the configured leading type prefix are resolved."
		, "Finite ordinary-source Node specializations only; open host dispatch, reviewed IR and browser instance specialization are not established by this observation."
	];
	for(const [stage, value] of Object.entries(records.stages))
	{
		assert.equal(value.state, "passed");
		assert.deepEqual(value.evidence, ["npm-finite-specializations-installed", "npm-generic-records-installed", "generic-record-specialized-npm-installed"]);
		value.evidence = ["npm-finite-specializations-installed", genericNpmEvidenceId];
		value.note += " Hosted ordinary npm record acceptance uses actual author/build deletion and compiler-free Node execution; strict TypeScript checks installed declarations.";
		original.stages[stage].evidence = ["npm-finite-specializations-installed"];
	}
	result.push(records);
	const record = result.find(item => item.id === "npm-records-ordinary-source-inherited");
	assert.ok(record); assert.equal(record.path, "ordinary-source");
	assert.deepEqual(record.profiles, ["node-javascript", "node-typescript"]);
	assert.deepEqual(record.shapes, ["record"]);
	assert.deepEqual(record.positions, ["parameter", "result", "field"]);
	record.scope += " The separate hosted ordinary npm generic-record archive adds direct exports and nine configured specializations over noninherited record, List and Option aliases, with exact alias origins, two namespaces, rejection/recovery and strict TypeScript. Both author roots and build staging are deleted before offline installation; Node executes on a Node-only PATH.";
	for(const value of Object.values(record.stages))
	{
		assert.equal(value.state, "passed");
		value.evidence.push(genericNpmEvidenceId);
		value.note += " Hosted noninherited alias-named records pass 1010 direct checks and 1019 specialized checks, plus strict TypeScript.";
	}
	return result;
};

/**
 * Correct isolation claims in the current inventory while preserving the earlier original reports.
 *
 * @param evidence - Previous evidence entries, with any current source pins already refreshed.
 */
export const reconcileGenericNpmEarlierEvidence = evidence => {
	const result = structuredClone(evidence);
	const direct = result.find(item => item.id === "npm-generic-records-installed");
	const specialized = result.find(item => item.id === "generic-record-specialized-npm-installed");
	assert.equal(direct.revision, "018872e23dd930fd652c7a28a335ea3d6dea935e");
	assert.equal(specialized.revision, "d5705ff38d67e6410c987a3a3a28cc409162ebfd");
	assert.ok(direct.scope.includes("A source-free offline Node consumer"));
	assert.ok(specialized.scope.includes("consumers install offline after author removal."));
	direct.scope = direct.scope.replace("A source-free offline Node consumer", "An offline Node consumer");
	specialized.scope = specialized.scope.replace("consumers install offline after author removal.", "consumers install offline after renaming, but retaining, the author directories and build staging.");
	for(const entry of [direct, specialized])
		entry.scope += " The original harness retained author/build inputs and did not remove compilers from PATH; this report is not deletion-before-install or compiler-free evidence. The hosted generic-record-npm-hosted-installed archive supplies that stronger acceptance. Original archived bytes remain unchanged.";
	return result;
};

/** Build the current inventory entry from the exact hosted originals and current verifier sources. */
export const genericNpmClosureEvidence = async () => {
	const receiptPath = `${genericNpmDirectory}/receipt.json`;
	const receipt = JSON.parse(await readFile(receiptPath));
	await assertGenericNpmArchive(receipt, readFile, { currentSources: false });
	const paths = [...new Set([
		...receipt.sourceFiles.map(file => file.path)
		, receiptPath
		, ...receipt.artifacts.map(file => file.path)
		, "scripts/archive-generic-record-npm-hosted-evidence.mjs"
		, "tests/helpers/generic-record-npm-hosted-evidence.mjs"
		, "tests/generic-record-npm-hosted-evidence.test.mjs"
		, "tests/helpers/generic-record-npm-closure.mjs"
		, "tests/helpers/generic-record-npm-closure-tests.mjs"
	])];
	const artifacts = [];
	for(const run of genericNpmRuns)
	{
		const report = JSON.parse(await readFile(`${genericNpmDirectory}/${run.id}.json`));
		artifacts.push({ path: `hosted-npm/${run.id}/component.tgz`, sha256: report.archiveSha256 }
			, { path: `hosted-npm/${run.id}/runtime.tgz`, sha256: report.runtimeArchiveSha256 });
	}
	return {
		id: genericNpmEvidenceId, kind: "installed", revision: genericNpmRevision
		, command: "LEAN_BRIDGE_LAKE_WASM_TEST=1 node --test tests/generic-records.test.mjs"
		, scope: "Hosted job 113176414840 in run 37736101772 passed direct ordinary-source npm generic records and nine configured record/List/Option specializations in two namespaces. Direct Node checks/rejections: 1010/1005; specialized: 1019/1010. Strict TypeScript checks installed declarations with skipLibCheck disabled. Two author builds reproduce the component and runtime archives. Both author roots and all build staging are deleted before offline installation; Node runs on a Node-only PATH. The receipt retains exact original reports, job metadata, full log and GitHub artifact metadata; package/ZIP hashes are retained, not binaries. Selected source pins identify the test, harness, fixtures, packaging and workflow, not a complete dependency closure. The command is the selected hosted test with its gate; the archived workflow/log retain the locked engine and runtime setup. This successful Node job does not establish the whole workflow, browser or reviewed-IR acceptance, instance dictionaries, inherited-record specializations, or source-entry counters."
		, files: await Promise.all(paths.map(async path => ({ path, sha256: sha256(await readFile(path)) })))
		, artifacts
	};
};
