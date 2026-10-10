/**
 * Promote the accepted reviewed primitive-Subtype parameter/result cells on native hosts.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { sha256 } from "../../src/capsule/node.mjs";
import { readReviewedSubtypePythonArchive, reviewedSubtypePythonRoot, reviewedSubtypePythonIndexSha256 } from "./reviewed-subtype-python-archive.mjs";
import { readReviewedSubtypeRubyJvmArchive, reviewedSubtypeRubyJvmRoot, reviewedSubtypeRubyJvmIndexSha256 } from "./reviewed-subtype-ruby-jvm-archive.mjs";
import { readReviewedSubtypeRemainingArchive, reviewedSubtypeRemainingRoot, reviewedSubtypeRemainingIndexSha256 } from "./reviewed-subtype-remaining-archive.mjs";

export const reviewedSubtypeNativeProfiles = ["python", "rust", "dotnet", "java", "kotlin", "ruby", "php-native", "wit-wasi", "perl"];
export const reviewedSubtypeNativeLimit = "Only reviewed top-level primitive-base Subtype parameters and results. Nested, nominal-field, callback, owned and browser positions are not established by these runs. Two finite instantiations of one generic are tested; arbitrary generic Subtypes are not. Dispatch counts are unmeasured. The local glibc 2.36 runs do not establish hosted CI or another platform floor. Archives retain selected sources and package digests, not package binaries or a complete toolchain closure.";
export const reviewedSubtypeNativeConversion = "Pass the primitive base value. The reviewed API selects Lean's checked constructor; the export receives the constructed value, including any normalization. Rejection preserves the caller's input and identifies the reviewed parameter and constructor. Results project the proof-backed base value. These installed checks cover top-level parameters and results; dispatch counts were not measured.";
export const reviewedSubtypeNativeValidators = [
	"tests/helpers/reviewed-subtype-native-promotion.mjs"
	, "tests/helpers/reviewed-subtype-native-promotion-tests.mjs"
	, "tests/helpers/reviewed-subtype-python-archive.mjs"
	, "tests/helpers/reviewed-subtype-ruby-jvm-archive.mjs"
	, "tests/helpers/reviewed-subtype-remaining-archive.mjs"
	, "tests/helpers/reviewed-subtype-host-report.mjs"
	, "tests/helpers/reviewed-subtype-ruby-jvm-report.mjs"
	, "tests/helpers/reviewed-subtype-remaining-host-report.mjs"
];

/**
 * Authenticate every archive before selecting the twelve installed run groups.
 *
 * @param read - Archive reader, replaceable for byte-corruption controls.
 */
export const reviewedSubtypeNativeReferences = async (read = readFile) => {
	const python = await readReviewedSubtypePythonArchive(read);
	const managed = await readReviewedSubtypeRubyJvmArchive(read);
	const remaining = await readReviewedSubtypeRemainingArchive(read);
	const selections = [
		...[["3.11", "3.11.16"], ["3.12", "3.12.14"]].map(([group, version]) => ({
			archive: python
			, root: reviewedSubtypePythonRoot
			, indexSha256: reviewedSubtypePythonIndexSha256
			, group
			, revision: python.index.revision
			, runner: "runner.mjs.txt"
			, runtime: `Python ${version}`
			, label: "python-" + group
		}))
		, ...["ruby", "jvm"].map(group => ({
			archive: managed
			, root: reviewedSubtypeRubyJvmRoot
			, indexSha256: reviewedSubtypeRubyJvmIndexSha256
			, group, revision: managed.index.revision, runner: "runner.mjs.txt"
			, runtime: group === "ruby" ? "Ruby" : "Java and Kotlin", label: group
		}))
		, ...remaining.index.runs.map(run => ({
			archive: remaining
			, root: reviewedSubtypeRemainingRoot
			, indexSha256: reviewedSubtypeRemainingIndexSha256
			, ...run, runtime: run.group, label: run.group
		}))
	];
	return selections.map(({ archive, root, indexSha256, group, revision, runner, runtime, label }) => {
		const report = JSON.parse(archive.files.get(`${group}/report.json`));
		const start = JSON.parse(archive.files.get(`${group}/run.start.json`));
		const quote = value => "'" + String(value).replaceAll("'", "'\\''") + "'";
		const command = [...Object.entries(start.environment).map(([key, value]) => {
			assert.match(key, /^[A-Z_][A-Z0-9_]*$/u);
			return key + "=" + quote(value);
		})
		, quote(start.command), ...start.args.map(quote)].join(" ");
		const selectedSources = archive.index.sources.filter(source => source.revision === revision).map(source => source.archive);
		const records = archive.index.artifacts.filter(file => file.path.startsWith(group + "/")
			|| file.path === runner || selectedSources.includes(file.path));
		assert.ok(records.some(file => file.path === `${group}/run.tap`));
		assert.ok(records.some(file => file.path === `${group}/build-0/review.json`));
		assert.ok(records.some(file => file.path === `${group}/build-1/package-set-receipt.json`));
		const counts = report.reports.map(item => `${item.profile}: ${item.checks} checks`).join(", ");
		return {
			id: `reviewed-native-subtype-${label.replaceAll(".", "-")}-installed`
			, profiles: report.profiles
			, sourcePath: "reviewed-ir", revision, runtime, group
			, checks: report.reports.map(item => [item.profile, item.checks])
			, command
			, scope: `${runtime}; ${counts}. Twelve independently reviewed exports over String, Nat, Int, ByteArray and UInt8 bases, two reproduced author roots, author removal before offline compiler-free installation, relocated installation and unchanged caller replay. Tests include distinct checked constructors for two instantiations of one generic, normalization, a zero-argument refined result, mixed Fin/Subtype and 1000 rejection/recovery pairs. ${reviewedSubtypeNativeLimit}`
			, files: [{ path: `${root}/index.json`, sha256: indexSha256 }
				, ...records.map(file => ({ path: `${root}/${file.path}`, sha256: file.sha256 }))]
			, artifacts: Object.entries(report.builds[0].archives).map(([path, sha256]) => ({ path, sha256 }))
		};
	});
};

/**
 * Add nine observations and twelve evidence entries without rewriting previous claims.
 *
 * @param original - Inventory before promotion.
 * @param references - Complete authenticated installed selections.
 */
export const promoteReviewedSubtypeNative = async (original, references) => {
	assert.deepEqual(references, await reviewedSubtypeNativeReferences());
	assert.equal(references.length, 12);
	const inventory = structuredClone(original);
	const validators = await Promise.all(reviewedSubtypeNativeValidators.map(async path => ({ path, sha256: sha256(await readFile(path)) })));
	for(const reference of references)
	{
		assert.ok(!inventory.evidence.some(item => item.id === reference.id), "Already promoted: " + reference.id);
		inventory.evidence.push({ id: reference.id
			, kind: "installed"
			, revision: reference.revision
			, command: reference.command, scope: reference.scope
			, files: [...validators, ...reference.files]
			, artifacts: reference.artifacts.map(file => ({ ...file, path: reference.id + "/" + file.path })) });
	}
	for(const profile of reviewedSubtypeNativeProfiles)
	{
		assert.ok(!original.observations.some(item => item.path === "reviewed-ir" && item.profiles.includes(profile)
			&& item.shapes.includes("subtype") && item.positions.some(position => ["parameter", "result"].includes(position))), "Overlapping reviewed Subtype cells: " + profile);
		const matches = references.filter(item => item.profiles.includes(profile));
		assert.equal(matches.length, profile === "perl" ? 4 : profile === "python" ? 2 : 1);
		const ordinary = original.observations.find(item => item.path === "ordinary-source" && item.profiles.includes(profile)
			&& item.shapes.includes("subtype") && item.positions.includes("parameter") && item.positions.includes("result"));
		assert.ok(ordinary, "Missing primitive host mapping: " + profile);
		const scope = matches.map(item => item.scope).join(" ");
		const notes = {
			analysis: "Fresh Lean reconciles the independent reviewed constructors, specialization applications and result decisions."
			, generation: "All twelve reviewed exports preserve the primitive host types and reviewed diagnostic names."
			, compilation: "Lean compiles checked constructors and typed adapters; returned Subtype values project their bases."
			, packaging: "Two author roots reproduce the packages before author removal, offline installation and installed-tree relocation."
			, installedExecution: scope
		};
		assert.deepEqual(Object.keys(notes), inventory.stages);
		inventory.observations.push({ id: `reviewed-native-subtype-${profile}`
			, profiles: [profile]
			, shapes: ["subtype"]
			, positions: ["parameter", "result"]
			, path: "reviewed-ir"
			, scope, hostTypes: { subtype: structuredClone(ordinary.hostTypes.subtype) }
			, conversionNotes: { subtype: reviewedSubtypeNativeConversion }
			, limitations: [reviewedSubtypeNativeLimit]
			, stages: Object.fromEntries(inventory.stages.map(stage => [stage, {
				state: "passed", evidence: matches.map(item => item.id), note: notes[stage]
			}]))
		});
	}
	return inventory;
};
