/**
 * Expand only Rust's proven nominal Subtype parameter, result and field positions.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import {
	checkNominalPrimitiveSubtypeRustEvidence
	, nominalPrimitiveSubtypeRustEvidence
	, nominalPrimitiveSubtypeRustEvidenceSha256
} from "./nominal-primitive-subtype-rust-evidence.mjs";
import {
	nominalSubtypeRustConversion
	, nominalSubtypeRustLimit
} from "./nominal-subtype-rust-promotion.mjs";

export const nominalPrimitiveSubtypeRustProfiles = ["rust"];
export const nominalPrimitiveSubtypeRustConversion = "In Rust, checked nominal values preserve all nineteen tested primitive representations: `()`, `bool`, matching fixed-width integers, `BigUint` for `Nat`, `BigInt` for `Int`, `f32`, `f64`, `String`, `Vec<u8>`, `char`, `u64` for `USize` and `i64` for `ISize`. Generated structs and enums carry owned record and active-variant fields; input functions borrow those aggregate values. Each input site retains its selected checked constructor and accepted normalization. Rejection preserves the complete caller value and later valid calls succeed. Copied results project proof-backed payloads without proof fields or input constructor selections, including standalone result-only crates.";
export const nominalPrimitiveSubtypeRustLimit = "Primitive-base nominal Rust acceptance covers the tested acyclic records, variants, aliases, mixed Fin guards and constructor-free results over Unit, Bool, UInt8, UInt16, UInt32, UInt64, Int8, Int16, Int32, Int64, Nat, Int, Float32, Float, String, ByteArray, Char, USize and ISize. Both author routes and full/result-only APIs reproduce complete crates from two author roots, authenticate fourteen offline dependencies, remove author sources, install offline, replay after relocation and execute again after deleting all consumer sources. The runs use Rust and Cargo 1.90.0 on Linux x64/glibc 2.36 with an explicit 2.36 package floor and 64-bit machine words. Original crates, dependencies, receipts, execution records, the interrupted pre-fix launch and selected sources are retained; external toolchain binaries are represented by version, size and digest. Refined callbacks, owned, recursive, dependent and broader generic Subtypes remain separate work. Constructor/source entry counts and memory are unmeasured. Hosted release-floor acceptance remains assigned to the recurring workflow; archived absolute paths describe the original local runs and are not CI prerequisites.";
export const nominalPrimitiveSubtypeRustHostTypes = Object.freeze({
	parameter: "(), bool, matching fixed-width integer, &BigUint, &BigInt, f32, f64, &str, &[u8], char, u64 or i64; generated nominal structs and enums are borrowed and checked by the selected Lean constructor before dispatch"
	, result: "corresponding owned Rust base value projected from the proof-backed Lean result, including BigUint, BigInt, String and Vec<u8>; no proof field"
	, field: "corresponding owned Rust base value in generated structs and active enum variants across all nineteen tested bases; no proof field"
});
export const nominalPrimitiveSubtypeRustField = nominalPrimitiveSubtypeRustHostTypes.field;
const quote = value => "'" + String(value).replaceAll("'", "'\\''") + "'";

const commandFor = run => {
	const suffix = `/${run.route}/${run.mode}`;
	assert.ok(run.origin.records.endsWith(suffix));
	const output = run.origin.records.slice(0, -suffix.length);
	const name = `installed primitive-base nominal Rust packages reproduce and relocate ${run.route} ${run.mode}`;
	const environment = {
		CARGO_BUILD_JOBS: "1", CMAKE_BUILD_PARALLEL_LEVEL: "1"
		, LEAN_BRIDGE_CARGO: run.toolchain.cargo.command
		, LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR: run.floor
		, LEAN_BRIDGE_NOMINAL_PRIMITIVE_SUBTYPE_RUST_MAX_LOAD: String(run.loadCeiling)
		, LEAN_BRIDGE_NOMINAL_PRIMITIVE_SUBTYPE_RUST_MODES: run.mode
		, LEAN_BRIDGE_NOMINAL_PRIMITIVE_SUBTYPE_RUST_OUTPUT: output
		, LEAN_BRIDGE_NOMINAL_PRIMITIVE_SUBTYPE_RUST_ROUTES: run.route
		, LEAN_BRIDGE_NOMINAL_PRIMITIVE_SUBTYPE_RUST_TEST: "1"
		, LEAN_BRIDGE_RUSTC: run.toolchain.rustc.command
		, LEAN_NUM_THREADS: "1", MAKEFLAGS: "-j1", OMP_NUM_THREADS: "1"
	};
	return "source 'scripts/env.sh' && " + [...Object.entries(environment).map(([key, value]) => key + "=" + quote(value))
		, "node", "--test", "--test-concurrency=1", "--test-reporter=tap"
		, `--test-name-pattern=^${name}$`
		, "tests/helpers/nominal-primitive-subtype-rust-installed-tests.mjs"
	].map((value, index) => index < Object.keys(environment).length ? value : quote(value)).join(" ");
};

/**
 * Derive four inventory references from an explicitly selected evidence descriptor.
 *
 * @param checked - Fully validated evidence or a metadata-only rejection precheck.
 * @param read - Reader of repository-relative immutable evidence bytes.
 */
const referencesFromEvidence = async (checked, read) => {
	const index = JSON.parse(await read(`${nominalPrimitiveSubtypeRustEvidence}/index.json`)), references = [];
	assert.equal(index.producerCommit, checked.producerCommit); assert.equal(index.runs.length, checked.selections.length);
	for(const [position, counts] of checked.selections.entries())
	{
		const run = index.runs[position], label = `${run.route}-${run.mode}`;
		assert.equal(counts.route, run.route); assert.equal(counts.mode, run.mode);
		const report = JSON.parse(await read(`${nominalPrimitiveSubtypeRustEvidence}/${label}/records/report.json`));
		const files = checked.files.filter(file => file.path.startsWith(label + "/") || file.path.startsWith("sources/"));
		references.push({
			id: `nominal-primitive-subtype-rust-${run.route}-${run.mode}-installed`
			, route: run.route, mode: run.mode
			, sourcePath: run.route === "ordinary" ? "ordinary-source" : "reviewed-ir"
			, profiles: [...nominalPrimitiveSubtypeRustProfiles]
			, revision: checked.producerCommit, counts, command: commandFor(run)
			, scope: `Two independent author builds reproduce the complete Rust crate. Offline installation with fourteen authenticated dependencies follows author removal; unchanged callers replay after moving the installed tree and execute again after deleting all consumer sources, giving three executions per selection. ${run.mode === "full" ? "The full API checks all nineteen primitive fields, per-site constructors and normalization, repeated fields, active variants, aliases, mixed Fin guards, exact rejection paths, caller snapshots and recovery." : "The standalone result-only API projects all nineteen primitive payloads through scalars, copied containers, records, variants and aliases without any input constructor selections."} ${nominalPrimitiveSubtypeRustLimit}`
			, files: [{ path: nominalPrimitiveSubtypeRustEvidence + "/index.json", sha256: nominalPrimitiveSubtypeRustEvidenceSha256 }
				, ...files.map(file => ({ path: nominalPrimitiveSubtypeRustEvidence + "/" + file.path, sha256: file.sha256 }))]
			, artifacts: [...Object.entries(report.builds[0].archives).map(([path, digest]) => ({ path, sha256: digest }))
				, { path: "dependency-handoff/" + report.dependencies.archive, sha256: report.dependencies.sha256 }]
		});
	}
	return references;
};

let defaultReferences;

/**
 * Derive references only after authenticating every original selection and failure.
 *
 * @param read - Reader of repository-relative immutable evidence bytes.
 */
export const nominalPrimitiveSubtypeRustReferences = async (read = readFile) => {
	if(read !== readFile) return referencesFromEvidence(await checkNominalPrimitiveSubtypeRustEvidence(read), read);
	defaultReferences ??= referencesFromEvidence(await checkNominalPrimitiveSubtypeRustEvidence(), readFile);
	return structuredClone(await defaultReferences);
};

// Refuse changed reference metadata before paying for the representative control
// replay. Every valid promotion still authenticates the complete archive below.
const referencePrecheck = async () => {
	const bytes = await readFile(nominalPrimitiveSubtypeRustEvidence + "/index.json");
	assert.equal(sha256(bytes), nominalPrimitiveSubtypeRustEvidenceSha256);
	const index = JSON.parse(bytes); assert.equal(bytes.toString(), canonicalJson(index));
	const read = async path => {
		if(path === nominalPrimitiveSubtypeRustEvidence + "/index.json") return bytes;
		const entry = index.files.find(file => nominalPrimitiveSubtypeRustEvidence + "/" + file.path === path);
		assert.ok(entry, path); const value = await readFile(path);
		assert.equal(value.length, entry.bytes); assert.equal(sha256(value), entry.sha256); return value;
	};
	const selections = [];
	for(const run of index.runs)
	{
		const checked = JSON.parse(await read(`${nominalPrimitiveSubtypeRustEvidence}/${run.label}/producer/verification.json`));
		selections.push({ ...checked, ...run.controls, attempt: run.attempt, loadCeiling: run.loadCeiling });
	}
	return referencesFromEvidence({ producerCommit: index.producerCommit, files: index.files, selections }, read);
};

/**
 * Supplement the six proven Rust cells and leave every other profile and position unchanged.
 *
 * @param original - Exact inventory before this milestone.
 * @param references - Four independently authenticated installed selections.
 */
export const promoteNominalPrimitiveSubtypeRust = async (original, references) => {
	assert.deepEqual(references, await referencePrecheck());
	assert.deepEqual(references, await nominalPrimitiveSubtypeRustReferences());
	const inventory = structuredClone(original), validators = [];
	for(const path of [
		"tests/helpers/nominal-primitive-subtype-rust-report.mjs"
		, "tests/helpers/nominal-primitive-subtype-rust-evidence.mjs"
		, "tests/helpers/nominal-primitive-subtype-rust-controls.mjs"
		, "tests/helpers/nominal-primitive-subtype-rust-provenance.mjs"
		, "tests/helpers/nominal-primitive-subtype-rust-promotion.mjs"
		, "tests/helpers/nominal-primitive-subtype-rust-promotion-tests.mjs"
		, "tests/helpers/nominal-primitive-subtype-rust-ci-report.mjs"
		, "tests/helpers/nominal-primitive-subtype-rust-ci-workflow.mjs"
		, "scripts/check-nominal-primitive-subtype-rust-ci.mjs"
		, "scripts/run-nominal-primitive-subtype-rust-ci.sh"
		, ".github/workflows/nominal-primitive-subtype-rust.yml"
	]) validators.push({ path, sha256: sha256(await readFile(path)) });
	for(const reference of references)
	{
		assert.ok(!inventory.evidence.some(item => item.id === reference.id), "Already promoted: " + reference.id);
		inventory.evidence.push({
			id: reference.id, kind: "installed", revision: reference.revision
			, command: reference.command, scope: reference.scope
			, files: [...validators, ...reference.files]
			, artifacts: reference.artifacts.map(item => ({ ...item, path: reference.id + "/" + item.path }))
		});
	}
	for(const path of ["ordinary-source", "reviewed-ir"])
	{
		const matches = inventory.observations.filter(item => item.path === path && item.shapes.includes("subtype")
			&& item.profiles.some(profile => nominalPrimitiveSubtypeRustProfiles.includes(profile)));
		const mainId = path === "ordinary-source" ? "native-subtype-rust-ordinary-source" : "reviewed-native-subtype-rust";
		assert.deepEqual(matches.map(item => [item.id, item.profiles, item.shapes, item.positions]), [
			[mainId, nominalPrimitiveSubtypeRustProfiles, ["subtype"], ["parameter", "result"]]
			, [`nominal-subtype-rust-fields-${path}`, nominalPrimitiveSubtypeRustProfiles, ["subtype"], ["field"]]
		], "Missing or overlapping Rust Subtype observations");
		const matched = references.filter(item => item.sourcePath === path), ids = matched.map(item => item.id);
		assert.equal(matched.length, 2); const scope = matched.map(item => item.scope).join(" ");
		for(const observation of matches)
		{
			observation.scope = observation.scope.replaceAll(nominalSubtypeRustLimit, "").trimEnd() + " Additional primitive-base Rust acceptance: " + scope;
			assert.equal(observation.conversionNotes.subtype.split(nominalSubtypeRustConversion).length, 2);
			observation.conversionNotes.subtype = observation.conversionNotes.subtype.replace(nominalSubtypeRustConversion, nominalPrimitiveSubtypeRustConversion);
			assert.equal(observation.limitations.filter(item => item === nominalSubtypeRustLimit).length, 1);
			observation.limitations = observation.limitations.map(item => item === nominalSubtypeRustLimit ? nominalPrimitiveSubtypeRustLimit : item);
			if(observation.positions.includes("field")) observation.hostTypes.subtype.field = nominalPrimitiveSubtypeRustField;
			for(const stage of Object.values(observation.stages))
			{
				assert.equal(stage.state, "passed"); stage.evidence.push(...ids);
				stage.note = stage.note.replaceAll(nominalSubtypeRustLimit, "").trimEnd() + " Additional primitive-base Rust acceptance: " + scope;
			}
		}
	}
	return inventory;
};
