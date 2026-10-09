/**
 * Scope installed inheritance evidence to ordinary copied records and the measured parent Fin field.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { sha256 } from "../../src/capsule/node.mjs";
import { assertInheritedRecordArchive, inheritedRecordEvidenceDirectory } from "./inherited-record-evidence.mjs";

export const inheritedRecordReceiptPath = `${inheritedRecordEvidenceDirectory}/receipt.json`;
export const inheritedRecordEvidenceIds = Object.freeze({
	plain: "inherited-records-c-cpp-installed"
	, native: "generic-inheritance-c-cpp-installed"
	, npm: "generic-inheritance-npm-installed"
});
export const inheritedRecordPromotedCells = ["c", "cpp", "node-javascript", "node-typescript"].flatMap(profile =>
	["parameter", "result", "field"].map(position => `${profile}/record/ordinary-source/${position}`))
	.concat(["c/fin/ordinary-source/field", "cpp/fin/ordinary-source/field"]);

/**
 * Extend only observed record and Fin-field scopes, retaining earlier evidence and other cells.
 *
 * @param observations - Previously accepted observations.
 */
export const reconcileInheritedRecordObservations = observations => {
	const result = structuredClone(observations);
	for(const id of ["native-c-copied", "native-cpp-copied", "npm-records-ordinary-source"])
	{
		const original = result.find(item => item.id === id);
		assert.ok(original); assert.equal(original.path, "ordinary-source");
		assert.deepEqual(original.positions, ["parameter", "result", "field"]);
		const expanded = structuredClone(original);
		expanded.id = `${id}-inherited`; expanded.shapes = ["record"];
		assert.ok(!result.some(item => item.id === expanded.id));
		let added, measured;
		if(id === "npm-records-ordinary-source")
		{
			assert.deepEqual(original.shapes, ["record"]);
			assert.deepEqual(original.profiles, ["node-javascript", "node-typescript", "browser-javascript", "browser-react", "browser-worker"]);
			expanded.profiles = ["node-javascript", "node-typescript"];
			original.profiles = original.profiles.filter(profile => !expanded.profiles.includes(profile));
			added = [inheritedRecordEvidenceIds.npm];
			measured = "Node passes 1005 checks and 1006 rejections; strict TypeScript checks the installed declarations with skipLibCheck disabled.";
			expanded.scope += ` Separately archived ordinary-source Node packages execute three direct exports over six closed alias-named inherited records with universe and phantom arguments. ${measured} Parent subobjects retain their alias types rather than flattening their fields.`;
			expanded.limitations[0] = "The earlier npm corpus covers its original concrete acyclic records and dense arrays. The additional inheritance run covers only the named ordinary-source closed aliases, without inherited-record function specializations or instance dictionaries. No dependent or recursive records, variants or List promotion in these Node record cells.";
		}
		else
		{
			assert.deepEqual(original.shapes, ["array", "record"]);
			assert.deepEqual(original.profiles, [id === "native-c-copied" ? "c" : "cpp"]);
			original.shapes = ["array"];
			delete original.hostTypes.record; delete original.conversionNotes.record;
			delete expanded.hostTypes.array; delete expanded.conversionNotes.array;
			added = [inheritedRecordEvidenceIds.plain, inheritedRecordEvidenceIds.native];
			measured = "Plain C and C++ each pass 2010 checks; generic C passes 2011 and C++ 2007.";
			expanded.scope += ` Separately archived ordinary-source C/C++ packages execute five direct exports over six plain inherited layouts, including single, multiple, multilevel and overlapping parents, plus three direct exports over six closed alias-named inherited records with universe and phantom arguments. ${measured} Parent subobjects retain Lean's declared layout.`;
		}
		expanded.scope += " The added inheritance packages reproduce archives from two author builds and install offline after actual author/build deletion.";
		expanded.conversionNotes.record += id === "npm-records-ordinary-source"
			? " Ordinary-source Node inputs/results/fields keep inherited parent subobjects in their declared named fields (for example toBase), with the parent's own record value nested inside."
			: " Ordinary-source inputs/results/fields keep inherited parent subobjects in their generated named fields (for example to_base), with the parent's own struct nested inside. Keep overlapping-parent layouts exactly as generated.";
		expanded.limitations.push("The additional inheritance evidence is local and ordinary-source on the named hosts. No browser, reviewed-inheritance, configured inherited-record function specialization, instance dictionary, source-entry counter or sanitizer claim.");
		for(const [stage, value] of Object.entries(expanded.stages))
		{
			assert.equal(value.state, "passed"); value.evidence.push(...added);
			value.note += stage === "installedExecution" ? ` ${measured}` : " The added inheritance evidence covers direct exports with Lean's parent subobjects and declared field order.";
		}
		result.push(expanded);
	}
	const fin = result.find(item => item.id === "native-nominal-fin-c-family-ordinary-source");
	assert.ok(fin); assert.deepEqual(fin.profiles, ["c", "cpp"]); assert.deepEqual(fin.shapes, ["fin"]);
	assert.deepEqual(fin.positions, ["field"]); assert.equal(fin.path, "ordinary-source");
	fin.scope += " The separate plain-inheritance fixture also checks a Fin 10 field inside a parent, with rejection and recovery, in ordinary-source C and C++ packages.";
	fin.limitations[0] = "The added inheritance evidence covers only a Fin 10 field in the named nongeneric plain parent layouts. Recursive, generic and indexed refined parents require separate evidence.";
	fin.conversionNotes.fin += " In the ordinary-source C/C++ inherited-parent checks, a parent record's Fin 10 field keeps its bound in the child.";
	for(const value of Object.values(fin.stages))
	{
		assert.equal(value.state, "passed"); value.evidence.push(inheritedRecordEvidenceIds.plain);
		value.note += " The plain inherited-parent fixture preserves and checks its Fin 10 field.";
	}
	return result;
};

/** Pin original reports and current authenticated readers separately for plain, generic native and npm runs. */
export const inheritedRecordPromotedEvidence = async () => {
	const bytes = await readFile(inheritedRecordReceiptPath);
	assert.equal(sha256(bytes), "ebca0e21cecc65b708b8cce1c7999932d7934287085a8291e52022ec2c0883c9");
	const receipt = JSON.parse(bytes);
	// The draft updater records current-source transitions afterward. Original artifacts are checked now;
	// the acceptance tests also check every original producer stop through the completed history.
	await assertInheritedRecordArchive(receipt, readFile, { currentSources: false });
	const entries = [];
	for(const [kind, id] of Object.entries(inheritedRecordEvidenceIds))
	{
		const producer = receipt.producers[kind === "plain" ? "plain" : "generic"];
		const report = JSON.parse(await readFile(`${inheritedRecordEvidenceDirectory}/${kind === "plain" ? "plain-native" : kind === "native" ? "generic-native" : "generic-npm"}.json`));
		const paths = [...new Set([
			...producer.files.map(file => file.path)
			, inheritedRecordReceiptPath
			, ...receipt.artifacts.map(file => file.path)
			, "tests/helpers/inherited-record-evidence.mjs"
			, "tests/helpers/inherited-record-evidence-tests.mjs"
			, "tests/helpers/inherited-record-promotion.mjs"
			, "tests/helpers/inherited-record-promotion-tests.mjs"
		])];
		const archives = kind === "npm" ? { "component.tgz": report.archiveSha256, "runtime.tgz": report.runtimeArchiveSha256 } : report.archives;
		entries.push({
			id, kind: "installed", revision: producer.revision
			, command: kind === "plain"
				? "LEAN_BRIDGE_INHERITED_RECORD_PROFILES=c,cpp LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR=2.36 node --test --test-concurrency=1 --test-name-pattern='^relocated source-free C and C' tests/inherited-records.test.mjs"
				: kind === "native"
					? "LEAN_BRIDGE_GENERIC_INHERITANCE_PROFILES=c,cpp LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR=2.36 node --test --test-concurrency=1 --test-name-pattern='^relocated source-free C and C' tests/generic-inheritance-installed.test.mjs"
					: "LEAN_BRIDGE_GENERIC_INHERITANCE_NPM_TEST=1 LEAN_BRIDGE_LAKE_RUNTIME_ROOT=/app/build/lean-link-spike/lazy node --test --test-concurrency=1 --test-name-pattern='^a relocated source-free npm package' tests/generic-inheritance-installed.test.mjs"
			, scope: "Local ordinary-source direct inherited-record exports with actual author/build deletion, offline installation and two-build archive reproduction. The command reconstructs the queue's recorded environment and selection; no original full shell command was retained. The separate fresh-Lean log has no original queue or execution-revision record. Selected producer pins are recovered from Git, not a complete dependency closure. Native glibc floor override 2.36; npm uses /app/build/lean-link-spike/lazy and build/lean-runtime. No inherited-record function specialization, instance dictionary, browser, reviewed-inheritance, hosted CI, source-entry counter or sanitizer claim. Binary package hashes are retained, not the packages."
			, files: await Promise.all(paths.map(async path => ({ path, sha256: sha256(await readFile(path)) })))
			, artifacts: Object.entries(archives).map(([path, digest]) => ({ path: `inheritance/${kind}/${path}`, sha256: digest }))
		});
	}
	return entries;
};
