/**
 * Bind Perl checked-record support to all four installed source routes and ABI/mode pairs.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { sha256 } from "../../src/capsule/node.mjs";
import { readCheckedRecordPerlArchive, checkedRecordPerlArchiveRoot, checkedRecordPerlArchiveDigest } from "./checked-record-perl-archive.mjs";
import { checkedRecordPerlConfigurations, checkedRecordPerlModes } from "./checked-record-perl-install.mjs";

export const checkedRecordPerlLimit = "Installed checks cover top-level Interval, Sized 3 and Bounded 0 101 parameters/results, with erased Prop fields and selected safe constructors. Nested, refined, recursive and inherited checked records, value-dependent runtime payloads, other index kinds, zero-payload records, callback and owned positions remain unreviewed. All four pinned Perl ABIs and both prebuilt-only/build-xs modes passed. These local glibc 2.36 runs do not establish hosted glibc 2.38 acceptance. Entry counts are unmeasured; the archive retains selected sources and package hashes, not binaries or a complete toolchain closure.";
export const checkedRecordPerlConversion = "Pass generated record objects containing Math::BigInt values and plain array references, without proofs. Lean runs the selected constructor for each input; it may normalize accepted data, or reject with the parameter and constructor name while preserving caller values. Results contain independent copied payload fields with proofs erased. Ordinary and reviewed packages, including standalone result-only packages, passed installed checks.";
export const checkedRecordPerlHostType = "Generated Perl record with Math::BigInt and plain array-reference payload fields";
export const checkedRecordPerlPromotionValidators = [
	"tests/helpers/checked-record-perl-promotion.mjs"
	, "tests/helpers/checked-record-perl-promotion-tests.mjs"
	, "tests/helpers/checked-record-perl-archive.mjs"
	, "tests/helpers/checked-record-perl-archive-tests.mjs"
	, "tests/helpers/checked-record-perl-ci-report.mjs"
	, "tests/helpers/checked-record-perl-records.mjs"
	, "tests/helpers/checked-record-perl-install.mjs"
	, "tests/helpers/checked-record-perl-fixture.mjs"
];

/**
 * Authenticate original records before constructing any support references.
 *
 * @param read - Byte reader, replaceable only for archive-corruption controls.
 */
export const checkedRecordPerlReferences = async (read = readFile) => {
	const { index, files, reports } = await readCheckedRecordPerlArchive(read);
	return index.runs.map((run, position) => {
		const report = reports[position], prefix = run.route + "/";
		const start = JSON.parse(files.get(prefix + "run.start.json"));
		const quote = value => "'" + String(value).replaceAll("'", "'\\''") + "'";
		const command = [...Object.entries(start.environment).map(([key, value]) => {
			assert.match(key, /^[A-Z_][A-Z0-9_]*$/u); return key + "=" + quote(value);
		})
		, quote(start.command), ...start.args.map(quote)].join(" ");
		const sourcePath = run.route.replace(/^result-only-/u, ""), resultOnly = run.route.startsWith("result-only-");
		const sources = index.sources.map(source => source.archive);
		const artifacts = index.artifacts.filter(file => file.path.startsWith(prefix)
			|| ["runner.mjs.txt", "mutation-runner.mjs.txt"].includes(file.path) || sources.includes(file.path));
		assert.deepEqual(report.configurations, checkedRecordPerlConfigurations);
		assert.deepEqual(report.modes, checkedRecordPerlModes);
		return {
			id: `checked-record-perl-${run.route}-installed`, profiles: ["perl"]
			, route: run.route, sourcePath, resultOnly, revision: run.revision
			, positions: resultOnly ? ["result"] : ["parameter", "result"]
			, configurations: report.configurations, modes: report.modes
			, checks: report.reports.map(item => [item.configuration, item.mode, item.checks])
			, command
			, scope: `Perl; ${sourcePath}; ${resultOnly ? "standalone result-only" : "checked inputs and results"}; ${resultOnly ? 1002 : 9024} checks per execution on each of eight ABI/mode combinations. Two author roots reproduce the complete four-ABI runtime/component archives; author/build removal precedes offline installation and unchanged relocated replay. Full routes test per-site constructor choice, normalization, mixed arguments, caller preservation, rejection and 1000 recovery cycles; result-only routes test output mirrors without checked-input metadata. ${checkedRecordPerlLimit}`
			, files: [{ path: `${checkedRecordPerlArchiveRoot}/index.json`, sha256: checkedRecordPerlArchiveDigest }
				, ...artifacts.map(file => ({ path: `${checkedRecordPerlArchiveRoot}/${file.path}`, sha256: file.sha256 }))]
			, artifacts: Object.entries(report.builds[0].archives).map(([path, sha256]) => ({ path, sha256 }))
		};
	});
};

/**
 * Add only ordinary/reviewed top-level Perl input and result observations.
 *
 * @param original - Authenticated inventory before this promotion.
 * @param references - Complete independently authenticated installed references.
 */
export const promoteCheckedRecordPerl = async (original, references) => {
	assert.deepEqual(references, await checkedRecordPerlReferences());
	assert.equal(references.length, 4);
	const inventory = structuredClone(original);
	const validators = await Promise.all(checkedRecordPerlPromotionValidators.map(async path => ({ path, sha256: sha256(await readFile(path)) })));
	for(const reference of references)
	{
		assert.ok(!inventory.evidence.some(item => item.id === reference.id), "Already promoted: " + reference.id);
		inventory.evidence.push({
			id: reference.id, kind: "installed", revision: reference.revision
			, command: reference.command, scope: reference.scope
			, files: [...validators, ...reference.files]
			, artifacts: reference.artifacts.map(file => ({ ...file, path: reference.id + "/" + file.path }))
		});
	}
	for(const sourcePath of ["ordinary-source", "reviewed-ir"]) for(const position of ["parameter", "result"])
	{
		assert.ok(!original.observations.some(item => item.path === sourcePath && item.profiles.includes("perl")
			&& item.shapes.includes("checked-record") && item.positions.includes(position)), "Overlapping Perl checked-record cell");
		const matches = references.filter(item => item.sourcePath === sourcePath && item.positions.includes(position));
		assert.equal(matches.length, position === "result" ? 2 : 1);
		const scope = matches.map(item => item.scope).join(" ");
		const notes = {
			analysis: "Fresh Lean reconciles payload types, erased proof fields, closed Nat indices and per-site constructor choices on each source route."
			, generation: "Perl record objects carry typed payload fields without proof values."
			, compilation: "Compiled Lean checks input constructors and projects proof-erased result payloads."
			, packaging: "Two roots reproduce four-ABI archives before source removal, both offline installation modes and whole-tree relocation."
			, installedExecution: scope
		};
		assert.deepEqual(Object.keys(notes), inventory.stages);
		inventory.observations.push({
			id: `checked-record-perl-${sourcePath}-${position}`
			, profiles: ["perl"], shapes: ["checked-record"], positions: [position]
			, path: sourcePath, scope
			, hostTypes: { "checked-record": { [position]: checkedRecordPerlHostType } }
			, conversionNotes: { "checked-record": checkedRecordPerlConversion }
			, limitations: [checkedRecordPerlLimit]
			, stages: Object.fromEntries(inventory.stages.map(stage => [stage, {
				state: "passed", evidence: matches.map(item => item.id), note: notes[stage]
			}]))
		});
	}
	return inventory;
};
