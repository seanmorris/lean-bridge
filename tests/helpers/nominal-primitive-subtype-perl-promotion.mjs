/**
 * Supplement only the Perl positions established by nineteen-base nominal CPAN runs.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { sha256 } from "../../src/capsule/node.mjs";
import { checkNominalPrimitiveSubtypePerlArchive, nominalPrimitiveSubtypePerlArchive, nominalPrimitiveSubtypePerlArchiveSha256 } from "./nominal-primitive-subtype-perl-archive.mjs";
import { nominalSubtypePerlConversion, nominalSubtypePerlLimit } from "./nominal-subtype-perl-promotion.mjs";

export const nominalPrimitiveSubtypePerlProfiles = ["perl"];
export const nominalPrimitiveSubtypePerlConversion = "In Perl, checked fields retain the declared primitive's host representation across all nineteen tested bases: undef for Unit, the generated native boolean for Bool, IV or UV scalars for fixed-width integers and native machine words, Math::BigInt for Nat and Int, NV scalars for Float32 and Float, and strings for String, Char and ByteArray. Generated blessed wrappers carry the record and variant fields. Each input site keeps its selected checked constructor and accepted normalization; only the active variant branch is checked. Rejection preserves caller values and later valid calls succeed. Copied results project existing Lean payloads without proof fields or input constructor selections, including standalone result-only packages.";
export const nominalPrimitiveSubtypePerlLimit = "Primitive-base nominal Perl acceptance covers the tested acyclic records, variants, aliases, mixed Fin guards and constructor-free results over Unit, Bool, UInt8, UInt16, UInt32, UInt64, Int8, Int16, Int32, Int64, Nat, Int, Float32, Float, String, ByteArray, Char, USize and ISize. Both author routes and full/result-only APIs reproduce complete CPAN component and runtime archives from two authors. Perl 5.36.3 and 5.38.2, each threaded and unthreaded, install them offline after author removal as prebuilt-only and build-xs deliveries and replay after physical relocation on Linux x64/glibc 2.36 with an explicit 2.36 package floor. The four accepted selections ran serially under two frozen producer revisions and recorded per-run host-load admission ceilings of 6, 8, 8 and 12; the hosted default stays 6 and the disk and memory floors never changed. Original archives, receipts, control runs, preserved non-accepted launches and selected sources at both revisions are retained; external toolchain binaries are not. The Perl caller's check counts equal the Python caller's as a consistency check, not as borrowed evidence. Other hosts need their own primitive-base nominal acceptance. Refined callbacks, owned, recursive, dependent and broader generic Subtypes remain separate work. Constructor/source entry counts and memory are unmeasured. These local runs do not establish hosted release-floor acceptance; archived absolute paths describe the original machine and are not CI prerequisites.";
export const nominalPrimitiveSubtypePerlField = "declared primitive's host value in generated blessed record and variant wrappers across nineteen tested bases; no proof field";
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
		const label = run.route + "-" + run.mode;
		const start = JSON.parse(await read(`${nominalPrimitiveSubtypePerlArchive}/${label}/producer/start.json`));
		const report = JSON.parse(await read(`${nominalPrimitiveSubtypePerlArchive}/${label}/records/report.json`));
		const command = [...Object.entries(start.environment).map(([key, value]) => {
			assert.match(key, /^[A-Z_][A-Z0-9_]*$/u); assert.equal(typeof value, "string"); return key + "=" + quote(value);
		})
		, quote(start.command), ...start.args.map(quote)].join(" ");
		const files = checked.files.filter(file => file.path.startsWith(label + "/") || file.path.startsWith(`sources/${run.producerCommit}/`) || file.path.startsWith("checkers/") || file.path.startsWith("runners/"));
		references.push({ id: `nominal-primitive-subtype-perl-${run.route}-${run.mode}-installed`
			, route: run.route, mode: run.mode
			, sourcePath: run.route === "ordinary" ? "ordinary-source" : "reviewed-ir"
			, profiles: [...nominalPrimitiveSubtypePerlProfiles]
			, revision: run.producerCommit, counts: run, command
			, scope: `Two independent author roots reproduce the complete component and runtime CPAN archives. Author sources are removed before offline installation; unchanged callers replay after moving each installed consumer tree on all four pinned ABIs in both delivery modes, for sixteen executions per selection. ${run.mode === "full" ? "The full API checks per-site constructors, normalization, repeated record fields, active variants, aliases, mixed Fin guards, rejected-input snapshots and recovery." : "The standalone result-only API projects primitive payloads through scalars, copied containers, records, variants and aliases without any input constructor selections."} This selection ran at producer revision ${run.producerCommit} under a recorded host-load admission ceiling of ${run.loadCeiling}. ${nominalPrimitiveSubtypePerlLimit}`
			, files: [{ path: nominalPrimitiveSubtypePerlArchive + "/index.json", sha256: nominalPrimitiveSubtypePerlArchiveSha256 }
				, ...files.map(file => ({ path: nominalPrimitiveSubtypePerlArchive + "/" + file.path, sha256: file.sha256 }))]
			, artifacts: Object.entries(report.builds[0].archives).map(([path, digest]) => ({ path, sha256: digest })) });
	}
	return references;
};

/**
 * Derive references only after authenticating every complete original package and preserved launch.
 *
 * @param read - Reader of repository-relative original archive bytes.
 */
export const nominalPrimitiveSubtypePerlReferences = async (read = readFile) =>
	referencesFromArchive(await checkNominalPrimitiveSubtypePerlArchive(read), read);

// Refuse changed reference metadata before inflating the retained CPAN archives.
// This precheck grants no acceptance; every accepted promotion still runs the
// complete archive checker below, including every file and original package.
const referencePrecheck = async () => {
	const bytes = await readFile(nominalPrimitiveSubtypePerlArchive + "/index.json");
	assert.equal(sha256(bytes), nominalPrimitiveSubtypePerlArchiveSha256);
	const index = JSON.parse(bytes);
	const read = async path => {
		const entry = index.files.find(file => nominalPrimitiveSubtypePerlArchive + "/" + file.path === path);
		assert.ok(entry, path);
		const value = await readFile(path);
		assert.equal(value.length, entry.bytes); assert.equal(sha256(value), entry.sha256);
		return value;
	};
	const selections = [];
	for(const run of index.runs)
	{
		const controls = JSON.parse(await read(`${nominalPrimitiveSubtypePerlArchive}/${run.label}/controls/controls.json`));
		selections.push({ ...controls.checked, loadCeiling: run.loadCeiling, attempt: run.attempt, owner: run.owner });
	}
	return referencesFromArchive({ producerCommits: index.producerCommits, files: index.files, selections }, read);
};

/**
 * Expand four existing Perl observations without changing any other profile, position or stage state.
 *
 * @param original - Exact inventory at the prior milestone.
 * @param references - Four independently authenticated installed selections.
 */
export const promoteNominalPrimitiveSubtypePerl = async (original, references) => {
	assert.deepEqual(references, await referencePrecheck());
	assert.deepEqual(references, await nominalPrimitiveSubtypePerlReferences());
	const inventory = structuredClone(original), validators = [];
	for(const path of [
		"tests/helpers/nominal-primitive-subtype-perl-report.mjs"
		, "tests/helpers/nominal-primitive-subtype-perl-archive.mjs"
		, "tests/helpers/nominal-primitive-subtype-perl-controls.mjs"
		, "tests/helpers/nominal-primitive-subtype-perl-provenance.mjs"
		, "tests/helpers/nominal-primitive-subtype-perl-promotion.mjs"
		, "tests/helpers/nominal-primitive-subtype-perl-promotion-tests.mjs"
		, "tests/helpers/nominal-primitive-subtype-perl-ci-report.mjs"
		, "scripts/check-nominal-primitive-subtype-perl-ci.mjs"
		, "scripts/run-nominal-primitive-subtype-perl-ci.sh"
		, ".github/workflows/nominal-primitive-subtype-perl.yml"
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
		const matches = inventory.observations.filter(item => item.path === path && item.shapes.includes("subtype") && item.profiles.some(profile => nominalPrimitiveSubtypePerlProfiles.includes(profile)));
		const mainId = path === "ordinary-source" ? "perl-subtype-ordinary-source" : "reviewed-native-subtype-perl";
		assert.deepEqual(matches.map(item => [item.id, item.profiles, item.shapes, item.positions]), [
			[mainId, nominalPrimitiveSubtypePerlProfiles, ["subtype"], ["parameter", "result"]]
			, [`nominal-subtype-perl-fields-${path}`, nominalPrimitiveSubtypePerlProfiles, ["subtype"], ["field"]]
		], "Missing or overlapping Perl Subtype observations");
		const matched = references.filter(item => item.sourcePath === path), ids = matched.map(item => item.id);
		assert.equal(matched.length, 2); const scope = matched.map(item => item.scope).join(" ");
		for(const observation of matches)
		{
			observation.scope = observation.scope.replaceAll(nominalSubtypePerlLimit, "").trimEnd() + " Additional primitive-base Perl acceptance: " + scope;
			assert.equal(observation.conversionNotes.subtype.split(nominalSubtypePerlConversion).length, 2);
			observation.conversionNotes.subtype = observation.conversionNotes.subtype.replace(nominalSubtypePerlConversion, nominalPrimitiveSubtypePerlConversion);
			assert.equal(observation.limitations.filter(item => item === nominalSubtypePerlLimit).length, 1);
			observation.limitations = observation.limitations.map(item => item === nominalSubtypePerlLimit ? nominalPrimitiveSubtypePerlLimit : item);
			if(observation.positions.includes("field")) observation.hostTypes.subtype.field = nominalPrimitiveSubtypePerlField;
			for(const stage of Object.values(observation.stages))
			{
				assert.equal(stage.state, "passed"); stage.evidence.push(...ids);
				stage.note = stage.note.replaceAll(nominalSubtypePerlLimit, "").trimEnd() + " Additional primitive-base Perl acceptance: " + scope;
			}
		}
	}
	return inventory;
};
