/**
 * Promote only nested checked-record positions authenticated by installed Perl runs.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import {
	checkedRecordPerlConversion
	, checkedRecordPerlLimit
} from "./checked-record-perl-promotion.mjs";
import {
	checkNestedCheckedRecordPerlEvidence
	, nestedCheckedRecordPerlEvidence
	, nestedCheckedRecordPerlEvidenceSha256
} from "./nested-checked-record-perl-evidence.mjs";
import {
	nestedCheckedRecordPerlEvidenceCases
	, nestedCheckedRecordPerlProducer
} from "./nested-checked-record-perl-provenance.mjs";

export const nestedCheckedRecordPerlProfiles = Object.freeze(["perl"]);
export const nestedCheckedRecordPerlConversion = "The tested Packet carries a Fin 10 digit and a checked Nat Subtype word as Math::BigInt values. Holder nests Packet, and Choice::Packet carries it in the active Choice branch. Generated Perl adapters apply the exact Packet and nested Word constructors selected at each direct, repeated, Array, List, Option, Product, Except, Holder and Choice input site. Rejected calls preserve the complete caller graph and later valid calls recover. Packet arrays and options returned by Lean contain proof-free payloads without input-constructor selections.";
export const nestedCheckedRecordPerlLimit = "Checked-record Perl acceptance covers the established top-level Interval, Sized 3 and Bounded 0 101 forms plus the tested acyclic Packet, Holder and Choice forms through Array, List, Option, Product and Except copied positions. Generic, recursive and inherited checked records, other index kinds, open dependent or zero-payload records, callbacks and owned positions remain unreviewed. Both author routes and full/result-only APIs reproduce complete CPAN packages from two author roots, remove author sources, install offline in prebuilt-only and build-xs modes, and replay unchanged callers after relocating each installation. The runs cover threaded and unthreaded Perl 5.36.3 and 5.38.2 with Lean 4.32.2 on Linux x64/glibc 2.36, an explicit 2.36 package floor and 64-bit machine words. The archive retains exact records, generated XS and source closure; prepared CPAN archives and installed binaries retain authenticated identities without copied bytes. Hosted glibc 2.38 release-floor acceptance remains assigned to the dedicated workflow.";
export const nestedCheckedRecordPerlField = "Generated Perl Packet class with Math::BigInt digit and word fields nested inside Holder and Choice::Packet; no proof field";
export const nestedCheckedRecordPerlGeneratorPath = "src/backends/perl/generate.mjs";
export const nestedCheckedRecordPerlGeneratorBefore
	= "8a2de5e0052bfc7e4ac625db367bd43a085cc27c0894ba4c75852664dc6bd054";
export const nestedCheckedRecordPerlGeneratorAfter
	= "463cd67ff1630c8c1ffdc1d2bc9961abec266a104a7f83a5ac30453e7c0d6057";
export const nestedCheckedRecordPerlGeneratorPins = 15;

const validators = Object.freeze([
	"tests/helpers/nested-checked-record-perl-records.mjs"
	, "tests/helpers/nested-checked-record-perl-ci-report.mjs"
	, "tests/helpers/nested-checked-record-perl-evidence.mjs"
	, "tests/helpers/nested-checked-record-perl-evidence-tests.mjs"
	, "tests/helpers/nested-checked-record-perl-provenance.mjs"
	, "tests/helpers/nested-checked-record-perl-promotion.mjs"
	, "tests/helpers/nested-checked-record-perl-promotion-tests.mjs"
	, "tests/helpers/nested-checked-record-perl-promotion-history.mjs"
	, "tests/helpers/nested-checked-record-perl-promotion-history-tests.mjs"
	, "tests/helpers/nested-checked-record-perl-ci-workflow.mjs"
	, "tests/helpers/nested-checked-record-perl-ci-workflow-tests.mjs"
	, "tests/helpers/nested-checked-record-perl-ci-shell-tests.mjs"
	, "scripts/archive-nested-checked-record-perl.mjs"
	, "scripts/check-nested-checked-record-perl-ci.mjs"
	, "scripts/run-nested-checked-record-perl-ci.sh"
	, "scripts/update-nested-checked-record-perl-promotion-history.mjs"
	, ".github/workflows/nested-checked-record-perl.yml"
]);

const commandFor = name => {
	const environment = {
		LEAN_BRIDGE_PERL_TEST_GLIBC_FLOOR: "2.36"
		, LEAN_BRIDGE_NESTED_CHECKED_RECORD_PERL_TEST: "1"
		, LEAN_BRIDGE_NESTED_CHECKED_RECORD_PERL_CASES: name
		, LEAN_BRIDGE_NESTED_CHECKED_RECORD_PERL_OUTPUT:
			`build/vo1505-nested-record-perl-902e5a3/${name}/records`
		, LEAN_NUM_THREADS: "1", OMP_NUM_THREADS: "1"
		, MAKEFLAGS: "-j1", CMAKE_BUILD_PARALLEL_LEVEL: "1"
	};
	const quote = value => "'" + String(value).replaceAll("'", "'\\''") + "'";
	return [...Object.entries(environment).map(([key, value]) => `${key}=${quote(value)}`)
		, "node", "--test", "--test-concurrency=1", "--test-reporter=tap"
		, quote(`--test-name-pattern=^installed nested checked-record Perl packages reproduce and relocate for ${name}$`)
		, "tests/helpers/nested-checked-record-perl-installed-tests.mjs"].join(" ");
};

const readJson = async (read, path) => {
	const bytes = Buffer.from(await read(path));
	const value = JSON.parse(bytes); assert.equal(bytes.toString(), canonicalJson(value), path);
	return value;
};

/**
 * Authenticate every retained byte before deriving four promotion references.
 *
 * @param read - Reader of immutable repository-relative evidence bytes.
 */
export const nestedCheckedRecordPerlReferences = async (read = readFile) => {
	const checked = await checkNestedCheckedRecordPerlEvidence(read);
	const indexPath = `${nestedCheckedRecordPerlEvidence}/index.json`;
	const index = await readJson(read, indexPath);
	assert.equal(index.producerCommit, checked.producerCommit);
	assert.equal(index.producerCommit, nestedCheckedRecordPerlProducer);
	assert.deepEqual(index.runs.map(item => item.name), nestedCheckedRecordPerlEvidenceCases);
	return Promise.all(index.runs.map(async (run, index_) => {
		const verified = checked.selections[index_];
		assert.equal(run.name, verified.name);
		const report = await readJson(read
			, `${nestedCheckedRecordPerlEvidence}/${run.name}/records/report.json`);
		assert.equal(report.name, run.name); assert.equal(report.reports.length, 8);
		assert.equal(report.builds.length, 2);
		assert.deepEqual(report.builds[0], report.builds[1]);
		const counts = report.reports[0].counts;
		for(const execution of report.reports)
			assert.deepEqual(execution.counts, counts);
		const full = run.apiMode === "full";
		assert.equal(counts.checks, full ? 4762 : 1571);
		assert.equal(counts.rejections, full ? 524 : 0);
		assert.equal(counts.hostRejections, full ? 4 : 1);
		assert.equal(counts.recoveries, full ? 528 : 1);
		assert.equal(counts.snapshots, full ? 1060 : 520);
		const paths = index.files.filter(file => file.path.startsWith(run.name + "/")
			|| file.path.startsWith("sources/"));
		return {
			id: `nested-checked-record-perl-${run.authorRoute}-${run.apiMode}-installed`
			, route: run.authorRoute, mode: run.apiMode
			, sourcePath: run.authorRoute === "ordinary" ? "ordinary-source" : "reviewed-ir"
			, profiles: [...nestedCheckedRecordPerlProfiles]
			, positions: full ? ["parameter", "result", "field"] : ["result"]
			, revision: index.producerCommit
			, counts: { ...counts, executions: run.executions, records: run.records
				, configurations: run.configurations, installModes: run.installModes }
			, command: commandFor(run.name)
			, scope: `Two independent author builds reproduce the complete CPAN component and runtime archives. Author sources are removed before offline installation on four pinned Perl ABIs in both prebuilt-only and build-xs modes; the unchanged caller runs before and after moving the complete installed tree, giving sixteen executions per selection. ${full ? "The full API checks direct and repeated parameters, Array, List, Option, Product, both Except branches, Holder.packet and the active Choice.packet.value field, including exact per-site constructors, normalization, complete rejected-input snapshots and recovery." : "The standalone result-only API projects checked-record payloads through Array and Option results without checked-input metadata."} ${nestedCheckedRecordPerlLimit}`
			, files: [
				{ path: indexPath, sha256: nestedCheckedRecordPerlEvidenceSha256 }
				, ...paths.map(file => ({
					path: `${nestedCheckedRecordPerlEvidence}/${file.path}`
					, sha256: file.sha256
				}))
			]
			, artifacts: Object.entries(report.builds[0].archives)
				.map(([path, digest]) => ({ path, sha256: digest }))
		};
	}));
};

const updateText = (source, addition) => source.split(checkedRecordPerlLimit)
	.join("").trimEnd() + " " + addition;

/**
 * Supplement four parameter/result cells, add two field cells, and preserve every other claim.
 *
 * @param original - Exact inventory before this promotion.
 * @param references - Four independently authenticated installed selections.
 */
export const promoteNestedCheckedRecordPerl = async (original, references) => {
	assert.deepEqual(references, await nestedCheckedRecordPerlReferences());
	const inventory = structuredClone(original);
	for(const reference of references)
		assert.ok(!inventory.evidence.some(item => item.id === reference.id)
			, "Already promoted: " + reference.id);
	assert.equal(sha256(await readFile(nestedCheckedRecordPerlGeneratorPath))
		, nestedCheckedRecordPerlGeneratorAfter);
	let refreshedGeneratorPins = 0;
	for(const entry of inventory.evidence) for(const file of entry.files)
		if(file.path === nestedCheckedRecordPerlGeneratorPath)
		{
			assert.equal(file.sha256, nestedCheckedRecordPerlGeneratorBefore);
			file.sha256 = nestedCheckedRecordPerlGeneratorAfter;
			refreshedGeneratorPins++;
		}
	assert.equal(refreshedGeneratorPins, nestedCheckedRecordPerlGeneratorPins);
	const sources = await Promise.all(validators.map(async path => ({
		path, sha256: sha256(await readFile(path))
	})));
	for(const reference of references)
	{
		inventory.evidence.push({
			id: reference.id, kind: "installed", revision: reference.revision
			, command: reference.command, scope: reference.scope
			, files: [...sources, ...reference.files]
			, artifacts: reference.artifacts.map(item => ({
				...item, path: reference.id + "/" + item.path
			}))
		});
	}
	for(const path of ["ordinary-source", "reviewed-ir"])
	{
		const full = references.filter(item => item.sourcePath === path
			&& item.mode === "full");
		const results = references.filter(item => item.sourcePath === path
			&& item.positions.includes("result"));
		assert.equal(full.length, 1); assert.equal(results.length, 2);
		for(const position of ["parameter", "result"])
		{
			const matched = position === "result" ? results : full;
			const observations = inventory.observations.filter(item =>
				item.profiles.includes("perl") && item.path === path
				&& item.shapes.includes("checked-record")
				&& item.positions.includes(position));
			assert.equal(observations.length, 1
				, `Missing or overlapping nested Perl checked-record cell: ${path}/${position}`);
			const observation = observations[0], ids = matched.map(item => item.id);
			const scope = matched.map(item => item.scope).join(" ");
			assert.ok(observation.scope.includes(checkedRecordPerlLimit));
			observation.scope = updateText(observation.scope
				, "Additional nested Perl acceptance: " + scope);
			assert.equal(observation.conversionNotes["checked-record"]
				, checkedRecordPerlConversion);
			observation.conversionNotes["checked-record"] += " "
				+ nestedCheckedRecordPerlConversion;
			assert.deepEqual(observation.limitations, [checkedRecordPerlLimit]);
			observation.limitations = [nestedCheckedRecordPerlLimit];
			for(const stage of Object.values(observation.stages))
			{
				assert.equal(stage.state, "passed"); stage.evidence.push(...ids);
				assert.equal(new Set(stage.evidence).size, stage.evidence.length);
				stage.note = updateText(stage.note
					, "Additional nested Perl acceptance: " + scope);
			}
		}
		const overlap = inventory.observations.filter(item =>
			item.profiles.includes("perl") && item.path === path
			&& item.shapes.includes("checked-record")
			&& item.positions.includes("field"));
		assert.equal(overlap.length, 0
			, `Overlapping nested Perl checked-record field: ${path}`);
		const conversion = inventory.observations.find(item =>
			item.profiles.includes("perl") && item.path === path
			&& item.shapes.includes("checked-record")
			&& item.positions.includes("parameter"))
			.conversionNotes["checked-record"];
		const scope = full[0].scope, notes = {
			analysis: "Fresh Lean and independently reviewed IR agree on Packet's erased proof, nested Fin 10 and Subtype fields, and every exact constructor choice."
			, generation: "Generated Perl adapters recurse through supported copied containers, Holder.packet and the active Choice.packet.value field while retaining proof-free blessed classes."
			, compilation: "Compiled Lean constructs Fin 10, the Word Subtype and Packet in dependency order at each selected public site."
			, packaging: "Two author roots reproduce complete CPAN packages before author removal, offline installation and physical installed-tree relocation."
			, installedExecution: scope
		};
		assert.deepEqual(Object.keys(notes), inventory.stages);
		inventory.observations.push({
			id: `nested-checked-record-perl-${path}-field`
			, profiles: ["perl"], shapes: ["checked-record"]
			, positions: ["field"], path, scope
			, hostTypes: { "checked-record": { field: nestedCheckedRecordPerlField } }
			, conversionNotes: { "checked-record": conversion }
			, limitations: [nestedCheckedRecordPerlLimit]
			, stages: Object.fromEntries(inventory.stages.map(stage => [stage, {
				state: "passed", evidence: [full[0].id], note: notes[stage]
			}]))
		});
	}
	return inventory;
};
