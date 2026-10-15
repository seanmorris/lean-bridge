/**
 * Supplement only the C/C++ positions established by nineteen-base nominal native runs.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { sha256 } from "../../src/capsule/node.mjs";
import { checkNominalPrimitiveSubtypeNativeArchive, nominalPrimitiveSubtypeNativeArchive, nominalPrimitiveSubtypeNativeArchiveSha256 } from "./nominal-primitive-subtype-native-archive.mjs";
import { nominalSubtypeNativeConversion, nominalSubtypeNativeLimit } from "./nominal-subtype-native-promotion.mjs";

export const nominalPrimitiveSubtypeNativeProfiles = ["c", "cpp"];
export const nominalPrimitiveSubtypeNativeConversion = "In C/C++, checked fields retain the declared primitive's public host type across all nineteen tested bases. C structs use fixed-width scalars, GMP integers and length-aware string/byte spans with explicit ownership; C++ values use fixed-width scalars, boost::multiprecision::cpp_int, std::string and std::vector<uint8_t>. Unit, Bool, Char, floats and native words keep their ordinary generated representations. Each input site keeps its selected checked constructor and accepted normalization; only the active variant branch is checked. Rejection preserves caller values and later valid calls succeed. C also preserves existing output payloads, tags and ownership on rejection. Copied results project existing Lean payloads without proof fields or input constructor selections, including standalone result-only packages.";
export const nominalPrimitiveSubtypeNativeLimit = "Primitive-base nominal C/C++ acceptance covers the tested acyclic records, variants, aliases, mixed Fin guards and constructor-free results over Unit, Bool, UInt8, UInt16, UInt32, UInt64, Int8, Int16, Int32, Int64, Nat, Int, Float32, Float, String, ByteArray, Char, USize and ISize. Both author routes and full/result-only APIs reproduce complete C and C++ packages from two authors. Independent C11/GMP and C++20 callers install offline after author removal and replay after physical relocation on Linux x64/glibc 2.36 with an explicit 2.36 package floor. Original archives retain the embedded Lean runtime and native dependencies; receipts, caller/process records, tamper results and selected sources are retained. External compiler binaries are not retained. Other hosts need their own primitive-base nominal acceptance. Refined callbacks, owned, recursive, dependent and broader generic Subtypes remain separate work. Constructor/source entry counts and memory are unmeasured. These local runs do not establish hosted release-floor acceptance; archived absolute paths describe the original machine and are not CI prerequisites.";
export const nominalPrimitiveSubtypeNativeField = "declared primitive's host value in generated C structs or C++ records and variants across nineteen tested bases; no proof field";
const quote = value => "'" + String(value).replaceAll("'", "'\\''") + "'";

/**
 * Derive inventory references from an explicitly selected archive descriptor.
 *
 * @param checked - Validated archive or metadata-only rejection precheck.
 * @param read - Reader of repository-relative original archive bytes.
 */
const referencesFromArchive = async (checked, read) => {
	const references = [];
	for(const run of checked.selections)
	{
		const label = run.route + "/" + run.mode;
		const start = JSON.parse(await read(`${nominalPrimitiveSubtypeNativeArchive}/${label}/producer/start.json`));
		const report = JSON.parse(await read(`${nominalPrimitiveSubtypeNativeArchive}/${label}/records/report.json`));
		const command = [...Object.entries(start.environment).map(([key, value]) => {
			assert.match(key, /^[A-Z_][A-Z0-9_]*$/u); assert.equal(typeof value, "string"); return key + "=" + quote(value);
		})
		, "node", ...start.args.map(quote)].join(" ");
		const files = checked.files.filter(file => file.path.startsWith(label + "/") || file.path.startsWith("sources/") || ["producer.mjs", "controls-runner.mjs", "process-capture.mjs"].includes(file.path));
		references.push({ id: `nominal-primitive-subtype-native-${run.route}-${run.mode}-installed`
			, route: run.route, mode: run.mode
			, sourcePath: run.route === "ordinary" ? "ordinary-source" : "reviewed-ir"
			, profiles: [...nominalPrimitiveSubtypeNativeProfiles]
			, revision: checked.producerCommit, counts: run, command
			, scope: `Two independent author builds reproduce complete C/C++ packages. Offline installation follows author removal; independent unchanged C11/GMP and C++20 callers replay after moving each installed tree, giving four replay executions plus two setup executions per selection. ${run.mode === "full" ? "The full API checks per-site constructors, normalization, repeated record fields, active variants, aliases, mixed Fin guards, rejected-input snapshots and recovery." : "The standalone result-only API projects primitive payloads through scalars, copied containers, records, variants and aliases without any input constructor selections."} ${nominalPrimitiveSubtypeNativeLimit}`
			, files: [{ path: nominalPrimitiveSubtypeNativeArchive + "/index.json", sha256: nominalPrimitiveSubtypeNativeArchiveSha256 }
				, ...files.map(file => ({ path: nominalPrimitiveSubtypeNativeArchive + "/" + file.path, sha256: file.sha256 }))]
			, artifacts: Object.entries(report.builds[0].archives).map(([path, digest]) => ({ path, sha256: digest })) });
	}
	return references;
};

/**
 * Derive references only after authenticating every complete original package.
 *
 * @param read - Reader of repository-relative original archive bytes.
 */
export const nominalPrimitiveSubtypeNativeReferences = async (read = readFile) =>
	referencesFromArchive(await checkNominalPrimitiveSubtypeNativeArchive(read), read);

// Refuse changed reference metadata before inflating large package archives.
// This precheck grants no acceptance; every accepted promotion still runs the
// complete archive checker below, including every file and original package.
const referencePrecheck = async () => {
	const bytes = await readFile(nominalPrimitiveSubtypeNativeArchive + "/index.json");
	assert.equal(sha256(bytes), nominalPrimitiveSubtypeNativeArchiveSha256);
	const index = JSON.parse(bytes);
	const read = async path => {
		const entry = index.files.find(file => nominalPrimitiveSubtypeNativeArchive + "/" + file.path === path);
		assert.ok(entry, path);
		const value = await readFile(path);
		assert.equal(value.length, entry.bytes); assert.equal(sha256(value), entry.sha256);
		return value;
	};
	const selections = [];
	for(const { route, mode } of index.runs)
		selections.push(JSON.parse(await read(`${nominalPrimitiveSubtypeNativeArchive}/${route}/${mode}/controls/complete.json`)).checked);
	return referencesFromArchive({ producerCommit: index.producerCommit, files: index.files, selections }, read);
};

/**
 * Expand four existing observations without changing any other profile, position or stage state.
 *
 * @param original - Exact inventory at the prior milestone.
 * @param references - Four independently authenticated installed selections.
 */
export const promoteNominalPrimitiveSubtypeNative = async (original, references) => {
	assert.deepEqual(references, await referencePrecheck());
	assert.deepEqual(references, await nominalPrimitiveSubtypeNativeReferences());
	const inventory = structuredClone(original), validators = [];
	for(const path of [
		"tests/helpers/nominal-primitive-subtype-native-report.mjs"
		, "tests/helpers/nominal-primitive-subtype-native-archive.mjs"
		, "tests/helpers/nominal-primitive-subtype-native-controls.mjs"
		, "tests/helpers/nominal-primitive-subtype-native-promotion.mjs"
		, "tests/helpers/nominal-primitive-subtype-native-promotion-tests.mjs"
		, "tests/helpers/nominal-primitive-subtype-native-ci-report.mjs"
		, "scripts/check-nominal-primitive-subtype-native-ci.mjs"
		, "scripts/run-nominal-primitive-subtype-native-ci.sh"
		, ".github/workflows/nominal-primitive-subtype-native.yml"
	]) validators.push({ path, sha256: sha256(await readFile(path)) });
	for(const reference of references)
	{
		assert.ok(!inventory.evidence.some(item => item.id === reference.id), "Already promoted: " + reference.id);
		inventory.evidence.push({
			id: reference.id, kind: "installed", revision: reference.revision
			, command: reference.command, scope: reference.scope
			, files: [...validators, ...reference.files]
			, artifacts: reference.artifacts.map(item => ({ ...item, path: reference.id + "/" + item.path })) });
	}
	for(const path of ["ordinary-source", "reviewed-ir"])
	{
		const matches = inventory.observations.filter(item => item.path === path && item.shapes.includes("subtype") && item.profiles.some(profile => nominalPrimitiveSubtypeNativeProfiles.includes(profile)));
		const mainId = path === "ordinary-source" ? "native-subtype-c-cpp-ordinary-source" : "reviewed-subtype-c-cpp-reviewed-ir";
		assert.deepEqual(matches.map(item => [item.id, item.profiles, item.shapes, item.positions]), [
			[mainId, nominalPrimitiveSubtypeNativeProfiles, ["subtype"], ["parameter", "result"]]
			, [`nominal-subtype-native-fields-${path}`, nominalPrimitiveSubtypeNativeProfiles, ["subtype"], ["field"]]
		], "Missing or overlapping C/C++ Subtype observations");
		const matched = references.filter(item => item.sourcePath === path), ids = matched.map(item => item.id);
		assert.equal(matched.length, 2); const scope = matched.map(item => item.scope).join(" ");
		for(const observation of matches)
		{
			observation.scope = observation.scope.replaceAll(nominalSubtypeNativeLimit, "").trimEnd() + " Additional primitive-base C/C++ acceptance: " + scope;
			assert.equal(observation.conversionNotes.subtype.split(nominalSubtypeNativeConversion).length, 2);
			observation.conversionNotes.subtype = observation.conversionNotes.subtype.replace(nominalSubtypeNativeConversion, nominalPrimitiveSubtypeNativeConversion);
			assert.equal(observation.limitations.filter(item => item === nominalSubtypeNativeLimit).length, 1);
			observation.limitations = observation.limitations.map(item => item === nominalSubtypeNativeLimit ? nominalPrimitiveSubtypeNativeLimit : item);
			if(observation.positions.includes("field")) observation.hostTypes.subtype.field = nominalPrimitiveSubtypeNativeField;
			for(const stage of Object.values(observation.stages))
			{
				assert.equal(stage.state, "passed"); stage.evidence.push(...ids);
				stage.note = stage.note.replaceAll(nominalSubtypeNativeLimit, "").trimEnd() + " Additional primitive-base C/C++ acceptance: " + scope;
			}
		}
	}
	return inventory;
};
