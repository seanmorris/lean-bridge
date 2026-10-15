/**
 * Expand only native PHP positions established by nineteen-base Composer runs.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import {
	nominalPrimitiveSubtypePhpEvidence
	, nominalPrimitiveSubtypePhpEvidenceSha256
} from "./nominal-primitive-subtype-php-evidence.mjs";
import {
	nominalPrimitiveSubtypePhpLoadCeiling
	, nominalPrimitiveSubtypePhpProducer
	, nominalPrimitiveSubtypePhpSelections
} from "./nominal-primitive-subtype-php-provenance.mjs";
import {
	nominalSubtypePhpConversion
	, nominalSubtypePhpLimit
} from "./nominal-subtype-php-promotion.mjs";

export const nominalPrimitiveSubtypePhpProfiles = ["php-native"];
export const nominalPrimitiveSubtypePhpConversion = "In native PHP, checked nominal values preserve all nineteen tested primitive representations: null for Unit; bool; int for the bounded integers through UInt32 and Int64; Brick\\Math\\BigInteger for UInt64, Nat, Int and USize; float for Float32 and Float64; string for String and Char; Bytes for ByteArray; and int for 64-bit ISize. Generated final readonly classes carry record and active-variant fields without proof fields. Each input site retains its selected checked constructor and accepted normalization; only the active variant branch is checked. Fixed-width overflow, invalid Unicode scalars, malformed Bytes, non-finite floats where the contract refuses them, wrong classes and invalid Fin siblings reject before Lean dispatch. Rejection preserves the complete caller value, including signed zero and embedded NUL data, and later valid calls succeed. Copied results project proof-backed payloads without input constructor selections, including standalone result-only packages.";
export const nominalPrimitiveSubtypePhpLimit = "Primitive-base nominal native PHP acceptance covers the tested acyclic records, variants, aliases, nested Pair/Array/Option/Except values, mixed Fin guards and constructor-free results over Unit, Bool, UInt8, UInt16, UInt32, UInt64, Int8, Int16, Int32, Int64, Nat, Int, Float32, Float, String, ByteArray, Char, USize and ISize. Both author routes and full/result-only APIs reproduce complete Composer ZIPs from two author roots, remove author and build roots, install offline, and replay weak and strict PHP callers before and after relocation. The runs use PHP 8.2.33 and Composer 2.5.5 on Linux x64/glibc 2.36 with an explicit 2.36 package floor, 64-bit machine words and an 8.0 host-load admission ceiling. Original packages, receipts, Composer inputs, execution records and selected sources are retained; external toolchain binaries are represented by version, size and digest. PHP consumer source remains required at runtime. Refined callbacks, owned, recursive, dependent and broader generic Subtypes remain separate work. Constructor/source entry counts and memory are unmeasured. Hosted release-floor acceptance remains assigned to the recurring workflow; archived absolute paths describe the original local runs and are not CI prerequisites.";
export const nominalPrimitiveSubtypePhpField = "corresponding native PHP primitive value in generated final readonly records and active variant cases across all nineteen tested bases; no proof field";
const quote = value => "'" + String(value).replaceAll("'", "'\\''") + "'";

const commandFor = run => {
	const environment = {
		CMAKE_BUILD_PARALLEL_LEVEL: "1"
		, LEAN_BRIDGE_COMPOSER: "/usr/bin/composer"
		, LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR: run.floor
		, LEAN_BRIDGE_NOMINAL_PRIMITIVE_SUBTYPE_PHP_MAX_LOAD: String(run.loadCeiling)
		, LEAN_BRIDGE_NOMINAL_PRIMITIVE_SUBTYPE_PHP_MODES: run.mode
		, LEAN_BRIDGE_NOMINAL_PRIMITIVE_SUBTYPE_PHP_OUTPUT: `build/nominal-primitive-subtype-php-promotion/${run.route}-${run.mode}`
		, LEAN_BRIDGE_NOMINAL_PRIMITIVE_SUBTYPE_PHP_ROUTES: run.route
		, LEAN_BRIDGE_NOMINAL_PRIMITIVE_SUBTYPE_PHP_TEST: "1"
		, LEAN_BRIDGE_NOMINAL_SUBTYPE_PHP_COMPOSER_VERSION: run.composerVersion
		, LEAN_BRIDGE_NOMINAL_SUBTYPE_PHP_VERSION: run.phpVersion
		, LEAN_BRIDGE_PHP: "/usr/bin/php"
		, LEAN_NUM_THREADS: "1", MAKEFLAGS: "-j1", OMP_NUM_THREADS: "1"
	};
	const name = `installed primitive-base nominal PHP packages reproduce and relocate ${run.route} ${run.mode}`;
	return "source 'scripts/env.sh' && "
		+ [...Object.entries(environment).map(([key, value]) => `${key}=${quote(value)}`)
			, "node", "--test", "--test-concurrency=1", "--test-reporter=tap"
			, `--test-name-pattern=^${name}$`
			, "tests/helpers/nominal-primitive-subtype-php-installed-tests.mjs"
		].map((value, index) => index < Object.keys(environment).length ? value : quote(value)).join(" ");
};

/**
 * Derive four inventory references from validated evidence or its digest precheck.
 *
 * @param checked - Validated archive descriptor.
 * @param read - Reader of repository-relative immutable evidence bytes.
 */
const referencesFromEvidence = async (checked, read) => {
	const index = JSON.parse(await read(`${nominalPrimitiveSubtypePhpEvidence}/index.json`));
	assert.equal(index.producerCommit, checked.producerCommit);
	assert.equal(index.runs.length, checked.selections.length);
	const references = [];
	for(const [position, selection] of checked.selections.entries())
	{
		const run = index.runs[position], label = `${run.route}-${run.mode}`;
		assert.equal(selection.route, run.route); assert.equal(selection.mode, run.mode);
		const report = JSON.parse(await read(`${nominalPrimitiveSubtypePhpEvidence}/${label}/records/report.json`));
		const files = checked.files.filter(file => file.path.startsWith(label + "/")
			|| file.path.startsWith("sources/") || file.path.startsWith("checkers/"));
		const counts = { ...run, ...run.controls };
		delete counts.controls; delete counts.label;
		references.push({
			id: `nominal-primitive-subtype-php-${run.route}-${run.mode}-installed`
			, route: run.route, mode: run.mode
			, sourcePath: run.route === "ordinary" ? "ordinary-source" : "reviewed-ir"
			, profiles: [...nominalPrimitiveSubtypePhpProfiles]
			, revision: checked.producerCommit, counts, command: commandFor(run)
			, scope: `Two independent author builds reproduce the complete Composer ZIP. Author and build roots are removed before offline installation; unchanged weak and strict callers replay after moving the installed tree, giving four executions per selection. ${run.mode === "full" ? "The full API checks all nineteen primitive fields, per-site constructors and normalization, repeated fields, active variants, aliases, nested copied containers, mixed Fin guards, exact rejection paths, caller snapshots and recovery." : "The standalone result-only API projects all nineteen primitive payloads through scalars, copied containers, records, variants and aliases without any input constructor selections."} ${nominalPrimitiveSubtypePhpLimit}`
			, files: [{
				path: nominalPrimitiveSubtypePhpEvidence + "/index.json"
				, sha256: nominalPrimitiveSubtypePhpEvidenceSha256
			}
			, ...files.map(file => ({
				path: nominalPrimitiveSubtypePhpEvidence + "/" + file.path
				, sha256: file.sha256
			}))]
			, artifacts: report.receipt.packages[0].artifacts
				.map(({ path, sha256: digest }) => ({ path, sha256: digest }))
		});
	}
	return references;
};

let defaultReferences;

/**
 * Stream-check the immutable archive without expanding its Composer packages.
 * The evidence gate separately validates ZIP contents and mutation controls.
 *
 * @param read - Reader of immutable repository-relative evidence bytes.
 * @param verifyFiles - Whether to hash every retained file.
 */
const checkPromotionEvidence = async (read, verifyFiles) => {
	const indexPath = nominalPrimitiveSubtypePhpEvidence + "/index.json";
	const bytes = Buffer.from(await read(indexPath));
	assert.equal(sha256(bytes), nominalPrimitiveSubtypePhpEvidenceSha256);
	const index = JSON.parse(bytes); assert.equal(bytes.toString(), canonicalJson(index));
	assert.equal(index.schemaVersion, 1);
	assert.equal(index.kind, "nominal-primitive-subtype-php-installed-v1");
	assert.equal(index.producerCommit, nominalPrimitiveSubtypePhpProducer);
	assert.equal(index.loadCeiling, nominalPrimitiveSubtypePhpLoadCeiling);
	assert.deepEqual(index.runs.map(run => [run.route, run.mode]),
		nominalPrimitiveSubtypePhpSelections);
	if(verifyFiles) for(const file of index.files)
	{
		const value = Buffer.from(await read(
			nominalPrimitiveSubtypePhpEvidence + "/" + file.path
		));
		assert.equal(value.length, file.bytes, file.path);
		assert.equal(sha256(value), file.sha256, file.path);
	}
	return {
		producerCommit: index.producerCommit
		, files: index.files
		, selections: index.runs.map(run => ({ route: run.route, mode: run.mode }))
	};
};

/**
 * Authenticate every retained byte before deriving promotion references.
 * ZIP expansion and negative-control replay stay in the evidence gate instead
 * of being repeated while rewriting the inventory.
 *
 * @param read - Reader of immutable repository-relative evidence bytes.
 */
export const nominalPrimitiveSubtypePhpReferences = async (read = readFile) => {
	if(read !== readFile)
		return referencesFromEvidence(await checkPromotionEvidence(read, true), read);
	defaultReferences ??= referencesFromEvidence(
		await checkPromotionEvidence(readFile, true), readFile
	);
	return structuredClone(await defaultReferences);
};

// Reject changed reference metadata before streaming the complete archive.
// Every accepted promotion still checks every retained byte above.
const referencePrecheck = async () => {
	const bytes = Buffer.from(await readFile(nominalPrimitiveSubtypePhpEvidence + "/index.json"));
	const index = JSON.parse(bytes);
	const read = async path => {
		if(path === nominalPrimitiveSubtypePhpEvidence + "/index.json") return bytes;
		const entry = index.files.find(file =>
			nominalPrimitiveSubtypePhpEvidence + "/" + file.path === path);
		assert.ok(entry, path); const value = await readFile(path);
		assert.equal(value.length, entry.bytes); assert.equal(sha256(value), entry.sha256);
		return value;
	};
	return referencesFromEvidence(await checkPromotionEvidence(read, false), read);
};

/**
 * Supplement six proven native PHP cells and leave every other profile unchanged.
 *
 * @param original - Exact inventory before this milestone.
 * @param references - Four independently authenticated installed selections.
 */
export const promoteNominalPrimitiveSubtypePhp = async (original, references) => {
	assert.deepEqual(references, await referencePrecheck());
	assert.deepEqual(references, await nominalPrimitiveSubtypePhpReferences());
	const inventory = structuredClone(original), validators = [];
	for(const path of [
		"tests/helpers/nominal-primitive-subtype-php-report.mjs"
		, "tests/helpers/nominal-primitive-subtype-php-evidence.mjs"
		, "tests/helpers/nominal-primitive-subtype-php-controls.mjs"
		, "tests/helpers/nominal-primitive-subtype-php-provenance.mjs"
		, "tests/helpers/nominal-primitive-subtype-php-promotion.mjs"
		, "tests/helpers/nominal-primitive-subtype-php-promotion-tests.mjs"
		, "tests/helpers/nominal-primitive-subtype-php-ci-report.mjs"
		, "tests/helpers/nominal-primitive-subtype-php-ci-workflow.mjs"
		, "scripts/check-nominal-primitive-subtype-php-ci.mjs"
		, "scripts/run-nominal-primitive-subtype-php-ci.sh"
		, ".github/workflows/nominal-primitive-subtype-php.yml"
	]) validators.push({ path, sha256: sha256(await readFile(path)) });
	for(const reference of references)
	{
		assert.ok(!inventory.evidence.some(item => item.id === reference.id),
			"Already promoted: " + reference.id);
		inventory.evidence.push({
			id: reference.id, kind: "installed", revision: reference.revision
			, command: reference.command, scope: reference.scope
			, files: [...validators, ...reference.files]
			, artifacts: reference.artifacts.map(item => ({
				...item, path: reference.id + "/" + item.path
			}))
		});
	}
	for(const path of ["ordinary-source", "reviewed-ir"])
	{
		const matches = inventory.observations.filter(item => item.path === path
			&& item.shapes.includes("subtype")
			&& item.profiles.some(profile => nominalPrimitiveSubtypePhpProfiles.includes(profile)));
		const mainId = path === "ordinary-source"
			? "native-subtype-php-native-ordinary-source" : "reviewed-native-subtype-php-native";
		assert.deepEqual(matches.map(item => [item.id, item.profiles, item.shapes, item.positions]), [
			[mainId, nominalPrimitiveSubtypePhpProfiles, ["subtype"], ["parameter", "result"]]
			, [`nominal-subtype-php-fields-${path}`
				, nominalPrimitiveSubtypePhpProfiles, ["subtype"], ["field"]]
		], "Missing or overlapping native PHP Subtype observations");
		const matched = references.filter(item => item.sourcePath === path);
		const ids = matched.map(item => item.id); assert.equal(matched.length, 2);
		const scope = matched.map(item => item.scope).join(" ");
		for(const observation of matches)
		{
			observation.scope = observation.scope.replaceAll(nominalSubtypePhpLimit, "").trimEnd()
				+ " Additional primitive-base native PHP acceptance: " + scope;
			assert.equal(observation.conversionNotes.subtype.split(nominalSubtypePhpConversion).length, 2);
			observation.conversionNotes.subtype = observation.conversionNotes.subtype.replace(
				nominalSubtypePhpConversion, nominalPrimitiveSubtypePhpConversion
			);
			assert.equal(observation.limitations.filter(item => item === nominalSubtypePhpLimit).length, 1);
			observation.limitations = observation.limitations.map(item =>
				item === nominalSubtypePhpLimit ? nominalPrimitiveSubtypePhpLimit : item);
			if(observation.positions.includes("field"))
				observation.hostTypes.subtype.field = nominalPrimitiveSubtypePhpField;
			for(const stage of Object.values(observation.stages))
			{
				assert.equal(stage.state, "passed"); stage.evidence.push(...ids);
				stage.note = stage.note.replaceAll(nominalSubtypePhpLimit, "").trimEnd()
					+ " Additional primitive-base native PHP acceptance: " + scope;
			}
		}
	}
	return inventory;
};
