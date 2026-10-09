/**
 * Supplement existing scalar Fin observations without promoting new hosts or positions.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { sha256 } from "../../src/capsule/node.mjs";
import { assertFinDispatchReferences, finDispatchArchives } from "./fin-dispatch-references.mjs";
import { beforeReviewedFinRefusalSource } from "./reviewed-fin-refusal-source-history.mjs";

export const scalarDispatchObservationIds = [
	"native-fin-php-ordinary-source", "native-fin-wit-ordinary-source"
	, "native-fin-ruby-ordinary-source", "native-fin-dotnet-ordinary-source"
	, "native-fin-jvm-ordinary-source"
	, ...["php-native", "wit-wasi", "ruby", "dotnet", "java", "kotlin"].map(profile => `reviewed-fin-${profile}-scalar-containers`)
];
const observationId = reference => reference.sourcePath === "reviewed-ir"
	? `reviewed-fin-${reference.caller}-scalar-containers`
	: `native-fin-${({ "php-native": "php", "wit-wasi": "wit", java: "jvm", kotlin: "jvm" })[reference.caller] ?? reference.caller}-ordinary-source`;
const scalarScope = "The separately dated scalar measurements count the mirror, impossible and label source functions and their three adapters. Rejected calls enter neither source nor adapter; valid calls, including recovery after rejection, enter their own source and adapter once. These measurements do not cover containers, products, fields, callbacks, Subtype, other hosts or hosted CI.";

/**
 * Build the complete expected observation array from its immutable predecessor.
 *
 * @param previous - Original observation array.
 * @param references - Authenticated scalar selections.
 */
export const supplementScalarDispatchObservations = (previous, references) => {
	assertFinDispatchReferences(references);
	const keys = references.map(reference => `${reference.caller}/${reference.sourcePath}`);
	const expected = ["php-native", "wit-wasi", "ruby", "dotnet", "java", "kotlin"]
		.flatMap(profile => ["ordinary-source", "reviewed-ir"].map(path => `${profile}/${path}`));
	assert.deepEqual([...keys].sort(), expected.sort(), "exactly twelve distinct scalar host/route selections");
	assert.equal(new Set(references.map(reference => reference.id)).size, 12);
	const observations = structuredClone(previous), selectedIds = new Set();
	for(const id of scalarDispatchObservationIds)
	{
		const observation = observations.find(item => item.id === id); assert.ok(observation, id);
		const selected = references.filter(reference => observationId(reference) === id);
		assert.equal(selected.length, id === "native-fin-jvm-ordinary-source" ? 2 : 1, id);
		for(const reference of selected)
		{
			assert.ok(observation.profiles.includes(reference.caller));
			assert.equal(observation.path, reference.sourcePath);
			assert.ok(!observation.stages.installedExecution.evidence.includes(reference.id), `Already supplemented: ${reference.id}`);
			selectedIds.add(reference.id);
		}
		assert.deepEqual(observation.shapes, ["fin"]);
		assert.deepEqual(observation.positions, ["parameter", "result"]);
		observation.stages.installedExecution.evidence.push(...selected.map(reference => reference.id));
		// Qualify old statements by their original report, rather than changing that report.
		observation.limitations = observation.limitations.map(note => {
			if(note.startsWith("Dispatch is not counted in this host's process") || note.startsWith("Ordinary Ruby dispatch is not counted"))
				return "Earlier scalar reports compared bundled libraries with the C archive but did not count host-process entries. Older container, product and field reports retain their original measurement scope.";
			return note;
		});
		observation.limitations.push(scalarScope);
		const measured = selected.map(reference => `${reference.caller}: ${reference.checks} public checks. ${reference.environment}`).join(" ");
		observation.stages.installedExecution.note += ` Separate scalar entry-counter reports: ${measured} ${scalarScope}`;
		// Here 'result' meant Except, not the already accepted top-level result position.
		if(["native-fin-jvm-ordinary-source", "native-fin-php-ordinary-source", "native-fin-wit-ordinary-source"].includes(id))
		{
			observation.scope = observation.scope.replace("nominal, callback, product, result and reviewed-IR positions are not promoted", "nominal fields, callbacks, products, Except and reviewed-IR coverage are not added by this observation");
			observation.limitations = observation.limitations.map(note => note.replace("no nominal, callback, product, result or reviewed-IR claim", "no nominal-field, callback, product, Except or reviewed-IR claim"));
			observation.stages.analysis.note = "Fresh Lean metadata keeps exact closed bounds on parameters and results, at depth zero and inside arrays, lists and options. Other shapes and positions require their own acceptance evidence.";
		}
	}
	assert.equal(selectedIds.size, 12);
	return observations;
};

/**
 * Retain each selection's original command, archive and caller identity.
 *
 * @param references - Authenticated scalar selections.
 */
export const scalarDispatchInventoryEvidence = async references => {
	assertFinDispatchReferences(references);
	const common = ["tests/fin-dispatch-references.test.mjs"
		, "tests/helpers/fin-dispatch-references.mjs"
		, "tests/fin-scalar-dispatch-inventory.test.mjs"
		, "tests/helpers/fin-scalar-dispatch-inventory.mjs"];
	return Promise.all(references.map(async reference => {
		const archive = finDispatchArchives.find(archive => archive.host === reference.host);
		const receiptBytes = await readFile(reference.receipt.path);
		assert.equal(sha256(receiptBytes), reference.receipt.sha256);
		const receipt = JSON.parse(receiptBytes);
		const validator = ({ "php-native": "php", "wit-wasi": "wit" })[reference.host] ?? reference.host;
		const files = [...common
			, `tests/helpers/${validator}-fin-dispatch-evidence.mjs`
			, reference.receipt.path
			, ...receipt.artifacts.map(file => file.path)];
		const reportBytes = await readFile(reference.report.path);
		assert.equal(sha256(reportBytes), reference.report.sha256);
		const report = JSON.parse(reportBytes);
		assert.equal(archive.revision, reference.revision);
		return { id: reference.id, kind: "installed"
			, revision: reference.revision, command: reference.command
			, scope: `${reference.sourcePath} ${reference.caller}: ${reference.checks} public checks. ${reference.scope}. ${reference.instrument} measures three Lean source functions and their three adapters, with independent per-call recounts. ${reference.environment}. Consumer SHA-256 ${reference.consumerSha256}; probe SHA-256 ${reference.probeSha256}. Source pins are selected identities, not a complete dependency closure. Older container, product and field measurements are unchanged.`
			// This builder describes the earlier scalar inventory milestone. Later source-only
			// transitions preserve its exact identities; current pins are checked separately.
			, files: await Promise.all(files.map(async path => ({ path, sha256: sha256(beforeReviewedFinRefusalSource(path, await readFile(path, "utf8"))) })))
			, artifacts: Object.entries(report.archives).map(([path, sha256]) => ({ path: `${reference.id}/${path}`, sha256 })) };
	}));
};

/**
 * Append twelve entries and supplement eleven observations from a known predecessor.
 *
 * @param previous - Original inventory.
 * @param references - Authenticated scalar selections.
 */
export const supplementFinScalarDispatchInventory = async (previous, references) => {
	const inventory = structuredClone(previous);
	inventory.observations = supplementScalarDispatchObservations(previous.observations, references);
	const added = await scalarDispatchInventoryEvidence(references);
	for(const item of added) assert.ok(!previous.evidence.some(old => old.id === item.id), `Already supplemented: ${item.id}`);
	inventory.evidence.push(...added);
	return inventory;
};

/**
 * Reject changes outside this supplement and exact predecessor source-pin updates.
 *
 * @param current - Candidate inventory.
 * @param previous - Original inventory.
 * @param references - Authenticated scalar selections.
 * @param updates - Complete authenticated source transitions.
 */
export const assertFinScalarDispatchInventory = async (current, previous, references, updates) => {
	const expected = await supplementFinScalarDispatchInventory(previous, references);
	for(const entry of expected.evidence.slice(0, previous.evidence.length)) for(const file of entry.files)
	{
		const update = updates.find(update => update.path === file.path && update.previousSha256 === file.sha256);
		if(update) file.sha256 = update.currentSha256;
	}
	assert.deepEqual(current, expected, "Only the authenticated scalar supplement and exact old source-pin updates may change");
};
