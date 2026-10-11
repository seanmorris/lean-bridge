/**
 * Promote installed checked-record inputs and results on eight native hosts.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { sha256 } from "../../src/capsule/node.mjs";
import { readCheckedRecordPythonArchive, checkedRecordPythonRoot, checkedRecordPythonIndexSha256 } from "./checked-record-python-archive.mjs";
import { readCheckedRecordRubyJvmArchive, checkedRecordRubyJvmRoot, checkedRecordRubyJvmIndexSha256 } from "./checked-record-ruby-jvm-archive.mjs";
import { readCheckedRecordRemainingHostsArchive, checkedRecordRemainingHostsRoot, checkedRecordRemainingHostsIndexSha256 } from "./checked-record-remaining-hosts-archive.mjs";

export const checkedRecordNativeProfiles = ["python", "rust", "ruby", "dotnet", "java", "kotlin", "php-native", "wit-wasi"];
export const checkedRecordNativeLimit = "Only top-level Interval, Sized 3 and Bounded 0 101 parameters/results with erased Prop fields and selected safe constructors are established. Nested, refined, recursive, inherited and general dependent payloads, other indices, zero-payload records, callback and owned positions remain unreviewed. These local glibc 2.36 runs do not establish hosted release-floor acceptance. Dispatch counts are unmeasured. Archives retain selected sources and package digests, not package binaries or a complete toolchain closure.";
export const checkedRecordNativeConversion = "Pass the generated record's runtime payload fields, without proof values. The selected Lean constructor checks each input and may normalize it; rejection identifies the parameter and constructor and preserves caller data. Results contain copied payload fields with proofs erased. Both ordinary and independently reviewed packages, including standalone result-only packages, passed installed checks.";
export const checkedRecordNativeHostTypes = {
	python: "Generated record dataclass with int and tuple payload fields"
	, rust: "Generated record struct with BigUint and Vec<BigUint> payload fields"
	, ruby: "Generated record value with Integer and Array payload fields"
	, dotnet: "Generated record with BigInteger and BigInteger[] payload fields"
	, java: "Generated Java record with BigInteger and BigInteger[] payload fields"
	, kotlin: "Generated Kotlin API record with BigInteger and Array<BigInteger> payload fields"
	, "php-native": "Generated PHP record with Brick\\Math\\BigInteger and array payload fields"
	, "wit-wasi": "WIT record with list<u32> natural-number limbs and lists of limb lists"
};
export const checkedRecordNativeValidators = [
	"tests/helpers/checked-record-native-promotion.mjs"
	, "tests/helpers/checked-record-native-promotion-tests.mjs"
	, "tests/helpers/checked-record-python-archive.mjs"
	, "tests/helpers/checked-record-ruby-jvm-archive.mjs"
	, "tests/helpers/checked-record-remaining-hosts-archive.mjs"
	, "tests/helpers/checked-record-native-records.mjs"
	, "tests/helpers/checked-record-ruby-jvm-report.mjs"
	, "tests/helpers/checked-record-remaining-host-report.mjs"
];

/**
 * Authenticate all three archives before selecting their sixteen successful runs.
 *
 * @param read - Byte reader, replaceable for corruption controls.
 */
export const checkedRecordNativeReferences = async (read = readFile) => {
	const groups = [
		{ archive: await readCheckedRecordPythonArchive(read), root: checkedRecordPythonRoot, indexSha256: checkedRecordPythonIndexSha256, label: "python" }
		, { archive: await readCheckedRecordRubyJvmArchive(read), root: checkedRecordRubyJvmRoot, indexSha256: checkedRecordRubyJvmIndexSha256, label: "ruby-jvm" }
		, { archive: await readCheckedRecordRemainingHostsArchive(read), root: checkedRecordRemainingHostsRoot, indexSha256: checkedRecordRemainingHostsIndexSha256, label: "remaining" }
	];
	return groups.flatMap(({ archive, root, indexSha256, label }) => archive.index.runs.map(run => {
		const report = JSON.parse(archive.files.get(`${run.archive}/report.json`));
		const start = JSON.parse(archive.files.get(`${run.archive}/run.start.json`));
		const quote = value => "'" + String(value).replaceAll("'", "'\\''") + "'";
		const command = [...Object.entries(start.environment).map(([key, value]) => {
			assert.match(key, /^[A-Z_][A-Z0-9_]*$/u);
			return key + "=" + quote(value);
		})
		, quote(start.command), ...start.args.map(quote)].join(" ");
		const selected = archive.index.sources.map(source => source.archive);
		const records = archive.index.artifacts.filter(file => file.path.startsWith(run.archive + "/")
			|| file.path === "runner.mjs.txt" || selected.includes(file.path));
		for(const path of ["run.tap", "report.json", "build-0/model.json", "build-1/package-set-receipt.json"])
			assert.ok(records.some(file => file.path === `${run.archive}/${path}`));
		const resultOnly = run.route.startsWith("result-only-");
		const sourcePath = run.route.replace(/^result-only-/u, "");
		const runtime = run.version ? `Python ${run.version}` : report.profiles.join(", ");
		return {
			id: `checked-record-native-${label}-${run.archive.replaceAll("/", "-").replaceAll(".", "-")}-installed`
			, profiles: report.profiles
			, sourcePath, positions: resultOnly ? ["result"] : ["parameter", "result"]
			, resultOnly, revision: archive.index.revision, group: run.archive
			, checks: report.reports.map(item => [item.profile, item.checks])
			, command
			, scope: `${runtime}; ${sourcePath}; ${resultOnly ? "standalone result-only" : "checked inputs and results"}; ${resultOnly ? 1002 : 9024} checks per host, repeated after relocation. Two author roots reproduce the packages; author sources are removed before offline installation and unchanged caller replay. Full consumers test per-site constructor selection, normalization, mixed arguments, invalid inputs and 1000 rejection/recovery cycles. Result-only consumers test output registration without checked-input metadata. ${checkedRecordNativeLimit}`
			, files: [{ path: `${root}/index.json`, sha256: indexSha256 }
				, ...records.map(file => ({ path: `${root}/${file.path}`, sha256: file.sha256 }))]
			, artifacts: Object.entries(report.builds[0].archives).map(([path, sha256]) => ({ path, sha256 }))
		};
	}));
};

/**
 * Add thirty-two scoped observations without rewriting any earlier claim.
 *
 * @param original - Pre-promotion inventory.
 * @param references - Complete authenticated references.
 */
export const promoteCheckedRecordNative = async (original, references) => {
	assert.deepEqual(references, await checkedRecordNativeReferences());
	assert.equal(references.length, 16);
	const inventory = structuredClone(original);
	const validators = await Promise.all(checkedRecordNativeValidators.map(async path => ({ path, sha256: sha256(await readFile(path)) })));
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
	for(const profile of checkedRecordNativeProfiles) for(const sourcePath of ["ordinary-source", "reviewed-ir"])
		for(const position of ["parameter", "result"])
		{
			assert.ok(!original.observations.some(item => item.path === sourcePath && item.profiles.includes(profile)
				&& item.shapes.includes("checked-record") && item.positions.includes(position)), "Overlapping checked-record cells: " + profile);
			const matches = references.filter(item => item.profiles.includes(profile) && item.sourcePath === sourcePath && item.positions.includes(position));
			assert.equal(matches.length, (profile === "python" ? 2 : 1) * (position === "result" ? 2 : 1));
			const scope = matches.map(item => item.scope).join(" ");
			const notes = {
				analysis: "Fresh Lean identifies exact erased proof fields, closed Nat indices and per-site checked constructors; independently reviewed decisions reconcile with source."
				, generation: "Generated host records carry typed runtime payloads without proof values."
				, compilation: "Compiled Lean constructs checked inputs through selected safe constructors and projects result payloads."
				, packaging: "Two author roots reproduce packages before source removal, offline installation and installed-tree relocation."
				, installedExecution: scope
			};
			assert.deepEqual(Object.keys(notes), inventory.stages);
			inventory.observations.push({
				id: `checked-record-native-${profile}-${sourcePath}-${position}`
				, profiles: [profile], shapes: ["checked-record"], positions: [position]
				, path: sourcePath, scope
				, hostTypes: { "checked-record": { [position]: checkedRecordNativeHostTypes[profile] } }
				, conversionNotes: { "checked-record": checkedRecordNativeConversion }
				, limitations: [checkedRecordNativeLimit]
				, stages: Object.fromEntries(inventory.stages.map(stage => [stage, {
					state: "passed", evidence: matches.map(item => item.id), note: notes[stage]
				}]))
			});
		}
	return inventory;
};
