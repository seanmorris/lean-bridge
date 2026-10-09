/**
 * Array fields and results over alias-named generic records in installed native packages: ArrayBox's Array Nat,
 * BoxRow as Array NatBox and RowBox's Array NatBox field, composed onto the accepted specialization fixture.
 *
 * @file
 */
import assert from "node:assert/strict";
import { access, cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, relative, resolve } from "node:path";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { buildCanonicalProject } from "../../src/build/canonical-build.mjs";
import { processBuildRunner } from "../../src/build/process-runner.mjs";
import { verifyPackageSetReceipt } from "../../src/release/package-set-receipt.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";
import { copyPackageSetHandoff } from "./package-set.mjs";
import { genericRecordArrayExports, genericRecordBrowserConfiguration, genericRecordBrowserSource } from "./generic-record-browser.mjs";
import { genericRecordEnvironment, genericRecordExports, genericRecordInstantiations, genericRecordTargets, installGenericRecordConsumer } from "./generic-record-packages.mjs";
import { genericRecordSpecializations, specializedGenericRecordCase, specializedGenericRecordConsumer } from "./generic-record-specializations.mjs";

/** Hosts in this first Array slice; every other native host stays under the full rollout. */
export const genericRecordArrayProfiles = Object.freeze(["c", "cpp", "python"]);
const extensions = Object.freeze({ c: "c", cpp: "cpp", python: "py" });
// The accepted specialized consumers, pinned to the bytes the hosted specialization archive measured.
export const genericRecordArrayBaseConsumers = Object.freeze({
	c: { sha256: "b36971096ba246e78db0aea400943b83b9b8209968025f63df36fe2ae7b22b56", checks: 1029 }
	, cpp: { sha256: "f4aa664ccc8c1f8de48b84561b76162cd8ef880b3d073a60844f0168a0c4bc44", checks: 1024 }
	, python: { sha256: "cf9e5bdacee2541ff291b58aa81578f5fe5b8b7254bbbbbd4aef384dc9748ab9", checks: 1036 } });
// Each language's own insertion site in the specialized consumer: before the original bump loop.
const markers = Object.freeze({ c: "  for (unsigned long i", cpp: "  for (unsigned i", python: "for i in range(1000):" });

/**
 * The cases each fragment runs, in order. Checks are the fragment's own: valid calls, rejected members with
 * unchanged input and recovery, then 1000 Array rounds counted once each.
 */
export const genericRecordArrayCases = Object.freeze({
	c: Object.freeze({ checks: 1049
		, cases: [
			"pushCount nonempty with 2^70"
			, "pushCount input unchanged"
			, "pushCount empty"
			, "rowTotal nonempty"
			, "rowTotal empty"
			, "rowTotal input unchanged"
			, "rowOf 3"
			, "rowTotal of rowOf"
			, "rowOf 0"
			, "rowBoxSum nonempty"
			, "rowBoxSum empty field"
			, "negative ArrayBox.value at 0..2 refused, unchanged, recovered"
			, "negative BoxRow NatBox.value and count at 0..2 refused by rowTotal and rowBoxSum, unchanged, recovered"
			, "negative ArrayBox.count"
			, "negative RowBox.count"
			, "NULL ArrayBox.value span"
			, "NULL BoxRow span"
			, "NULL RowBox.value span"
			, "1000 Array rounds"] })
	, cpp: Object.freeze({ checks: 1034
		, cases: [
			"pushCount nonempty with 2^70"
			, "pushCount input unchanged"
			, "pushCount empty"
			, "rowTotal nonempty and empty"
			, "BoxRow input unchanged"
			, "rowOf 3 and rowTotal of it"
			, "rowOf 0"
			, "rowBoxSum nonempty and empty field"
			, "negative ArrayBox.value at 0..2 refused, unchanged, recovered"
			, "negative BoxRow NatBox.value and count at 0..2 refused by rowTotal and rowBoxSum, unchanged, recovered"
			, "negative ArrayBox.count"
			, "negative RowBox.count"
			, "1000 Array rounds"] })
	, python: Object.freeze({ checks: 1108
		, cases: [
			"pushCount nonempty with 2^70 returns a tuple"
			, "pushCount empty"
			, "pushCount tuple input"
			, "pushCount input unchanged"
			, "rowTotal list, empty and tuple"
			, "BoxRow input unchanged"
			, "rowOf 3 and 0, rowTotal of rowOf"
			, "rowBoxSum nonempty, empty and rowOf field"
			, "ArrayBox.value member -1, bool, str, float at 0..2 refused with exact class, unchanged, recovered"
			, "BoxRow and RowBox member negative value, negative count, bool, wrong alias, tuple, int at 0..2 refused with exact class, unchanged, recovered"
			, "non-sequence Arrays, negative and bool counts, negative rowOf, wrong record class"
			, "1000 Array rounds"] }) });

/**
 * Every check the composed consumer must print: the accepted specialized consumer plus the Array fragment.
 *
 * @param profile - Native profile in this slice.
 */
export const genericRecordArrayExpectedChecks = profile => genericRecordArrayBaseConsumers[profile].checks + genericRecordArrayCases[profile].checks;

/**
 * Accept only this slice's profiles, each once.
 *
 * @param value - Comma-separated profile list, or undefined when the installed test is not requested.
 */
export const genericRecordArrayProfileSelection = value => {
	if(value === undefined) return [];
	assert.equal(typeof value, "string");
	const profiles = value.split(",").sort();
	assert.ok(profiles.length > 0 && profiles.every(profile => genericRecordArrayProfiles.includes(profile)), `Unknown or empty generic record Array profile: ${value}`);
	assert.equal(new Set(profiles).size, profiles.length, "Duplicate generic record Array profile");
	return profiles;
};

/**
 * Keep Array reports apart from the ordinary and specialized generic-record reports.
 *
 * @param profiles - Selected profiles.
 * @param configured - Optional explicit report path.
 */
export const genericRecordArrayReportPath = (profiles, configured) => {
	const path = resolve(configured ?? `build/generic-records/array-${profiles.join("-")}.json`);
	assert.match(basename(path), /^array-[a-z0-9-]+\.json$/u, "an Array report is named array-*.json");
	const name = profiles.join("-");
	for(const other of [`${name}.json`, `specialized-${name}.json`, `${name.replaceAll("python", "python312")}.json`, `specialized-${name.replaceAll("python", "python312")}.json`])
		assert.notEqual(path, resolve("build/generic-records", other), "an Array report never replaces another generic-record report");
	return path;
};

/**
 * Refuse a destination that already holds a report, before any expensive work.
 *
 * @param path - Resolved Array report path.
 */
export const claimGenericRecordArrayReport = async path => {
	await assert.rejects(access(path), { code: "ENOENT" }, `an Array report already exists at ${path}`);
};

/**
 * Write the final report exclusively, so a concurrent or earlier report is never replaced.
 *
 * @param path - Resolved Array report path.
 * @param report - Complete report.
 */
export const writeGenericRecordArrayReport = async (path, report) => {
	await mkdir(dirname(path), { recursive: true });
	await writeFile(path, canonicalJson(report), { flag: "wx" });
};

/**
 * The accepted specialization source with GenericRecordArrays.lean appended, unchanged except for the module name.
 *
 * @param module - Lean module and namespace name.
 */
export const genericRecordArraySource = (module = "GenericRecords") => genericRecordBrowserSource(module);

/**
 * The specialization configuration plus the four Array exports.
 *
 * @param module - Lean module and namespace name.
 */
export const genericRecordArrayConfiguration = (module = "GenericRecords") => genericRecordBrowserConfiguration(module);

const named = id => ({ kind: "named", id });
const array = element => ({ kind: "apply", constructor: "array", arguments: [element] });

/**
 * The Array-field instantiations, qualified by the native module.
 *
 * @param module - Lean module and namespace name.
 * @param nat - The fixture's own Nat reference, read from NatBox.
 */
export const genericRecordArrayInstantiations = (module = "GenericRecords", nat = { kind: "primitive", name: "nat" }) => ({
	[`lean:${module}.ArrayBox`]: { structure: `${module}.Box`, arguments: [array(nat)] }
	, [`lean:${module}.RowBox`]: { structure: `${module}.Box`, arguments: [array(named(`lean:${module}.NatBox`))] } });

/**
 * Require the Array additions exactly: two Box records with their origins, argument order and field types, the
 * BoxRow alias, and four declarations that name them.
 *
 * @param ir - Compiler-derived Binding IR.
 * @param module - Lean module and namespace name.
 */
export const assertGenericRecordArrayAdditions = (ir, module) => {
	const type = id => ir.types.find(item => item.id === id);
	const natBox = type(`lean:${module}.NatBox`);
	assert.equal(natBox?.kind, "record", "NatBox");
	const [value, count] = natBox.fields.map(field => field.type);
	const expected = genericRecordArrayInstantiations(module, value);
	const fields = { [`lean:${module}.ArrayBox`]: array(value), [`lean:${module}.RowBox`]: array(named(`lean:${module}.NatBox`)) };
	for(const [id, instantiation] of Object.entries(expected))
	{
		const record = type(id);
		assert.equal(record?.kind, "record", id);
		assert.deepEqual(record.fields.map(field => [field.name, field.type]), [["value", fields[id]], ["count", count]], id);
		assert.deepEqual(record.source.extensions["lean-lang.org/instantiation"], instantiation, id);
	}
	const row = type(`lean:${module}.BoxRow`);
	assert.equal(row?.kind, "alias", "BoxRow");
	assert.deepEqual(row.target, array(named(`lean:${module}.NatBox`)), "BoxRow");
	const signature = name => {
		const entry = ir.declarations.find(item => item.id === `lean:${module}.${name}`);
		assert.ok(entry, name);
		assert.deepEqual(entry.typeParameters, [], name);
		return [entry.parameters.map(parameter => parameter.type), entry.result.type];
	};
	assert.deepEqual(signature("pushCount"), [[named(`lean:${module}.ArrayBox`)], named(`lean:${module}.ArrayBox`)]);
	assert.deepEqual(signature("rowTotal"), [[named(`lean:${module}.BoxRow`)], count]);
	assert.deepEqual(signature("rowOf"), [[count], named(`lean:${module}.BoxRow`)]);
	assert.deepEqual(signature("rowBoxSum"), [[named(`lean:${module}.RowBox`)], count]);
};

/**
 * The specialization fixture's complete assertions on everything else, plus the Array additions.
 *
 * @param ir - Compiler-derived Binding IR.
 * @param module - Lean module and namespace name.
 */
export const assertGenericRecordArrayIr = (ir, module = "GenericRecords") => {
	const extras = ["ArrayBox", "RowBox"].map(name => `lean:${module}.${name}`);
	specializedGenericRecordCase.assertIr({ ...ir, types: ir.types.filter(type => !extras.includes(type.id))
		, declarations: ir.declarations.filter(item => !genericRecordArrayExports.some(name => item.id === `lean:${module}.${name}`)) }, module);
	assertGenericRecordArrayAdditions(ir, module);
};

/**
 * The accepted specialized consumer, byte-pinned, with the Array fragment inserted once at the same marker.
 *
 * @param profile - Native profile in this slice.
 */
export const genericRecordArrayConsumer = async profile => {
	assert.ok(genericRecordArrayProfiles.includes(profile), profile);
	const base = await specializedGenericRecordConsumer(profile, extensions[profile]);
	assert.equal(sha256(base), genericRecordArrayBaseConsumers[profile].sha256, `${profile} specialized consumer is the accepted one`);
	const fragment = await readFile(`tests/fixtures/generic-record-array-consumers/${profile}.${extensions[profile]}`, "utf8");
	const marker = markers[profile];
	assert.equal(base.split(marker).length, 2, `Exactly one insertion site for ${profile}`);
	assert.ok(!fragment.includes(marker), `${profile} Array fragment cannot add another insertion site`);
	return base.replace(marker, `${fragment}\n${marker}`);
};

/**
 * Record which interpreter produced a Python report.
 *
 * @param environment - Installed-test environment.
 */
const pythonIdentity = async environment => {
	const command = environment.LEAN_BRIDGE_PYTHON ?? "/usr/bin/python3";
	const { stdout } = await processBuildRunner.capture({ command, args: ["-I", "-c", "import sys; print(sys.version.split()[0])"], cwd: tmpdir(), env: { PATH: "/usr/bin:/bin" }, timeoutMs: 60_000 });
	return { command, version: stdout.trim() };
};

/**
 * Build from two distinct author roots, compare their archives, delete each author tree before installing the
 * first build's packages offline, and run the composed consumer per profile. Mirrors the private loop of the
 * accepted native generic-record test.
 *
 * @param t - Test context responsible for cleanup.
 * @param profiles - Validated profile selection.
 * @param reportPath - Separated Array report path.
 */
export const checkInstalledGenericRecordArrays = async (t, profiles, reportPath) => {
	assert.deepEqual(genericRecordArrayProfileSelection(profiles.join(",")), profiles);
	await claimGenericRecordArrayReport(reportPath);
	const module = "GenericRecords", reports = [], archives = [], authors = [];
	const targets = Object.fromEntries(profiles.map(profile => genericRecordTargets[profile]));
	const environment = genericRecordEnvironment(profiles);
	const python = profiles.includes("python") ? await pythonIdentity(environment) : undefined;
	const configuration = genericRecordArrayConfiguration(module);
	for(const attempt of [0, 1])
	{
		const directory = await mkdtemp(join(tmpdir(), "lean-bridge-generic-record-arrays-author-"));
		const consumer = await mkdtemp(join(tmpdir(), "lean-bridge-generic-record-arrays-consumer-"));
		t.after(() => Promise.all([directory, consumer].map(root => rm(root, { recursive: true, force: true }))));
		// Two independent author roots; the consumer and handoff are never inside one.
		assert.ok(!authors.includes(directory));
		assert.ok(relative(directory, consumer).startsWith(".."));
		authors.push(directory);
		const projectRoot = join(directory, "project"), outputRoot = join(directory, "release"), handoff = join(consumer, "handoff");
		await cp("tests/fixtures/onboarding/generic-records", projectRoot, { recursive: true });
		await saveLakeFile(projectRoot, "GenericRecords.lean", await genericRecordArraySource(module));
		await saveLakeFile(projectRoot, "lean-bridge.exports.json", canonicalJson({ schemaVersion: 1, modules: [module], exports: genericRecordExports, targets, ...configuration }));
		t.diagnostic(`array build ${attempt}: ${profiles.join(", ")}`);
		const built = await buildCanonicalProject({ projectRoot, outputRoot, targets: Object.keys(targets), environment }).catch(error => {
			error.message += `: ${JSON.stringify(error.details)}`; throw error;
		});
		const model = JSON.parse(await readFile(join(outputRoot, "native/component/model.json"), "utf8"));
		// The native model keeps every alias-named record, now including both Array-field instantiations, with its structure.
		const records = model.types.filter(type => type.kind === "record");
		const expectedRecords = { ...genericRecordInstantiations, "Left.LeftBox": { structure: "Box" }, "Right.RightBox": { structure: "Box" }, ArrayBox: { structure: "Box" }, RowBox: { structure: "Box" } };
		assert.deepEqual(records.map(type => type.name).sort(), Object.keys(expectedRecords).map(name => `${module}.${name}`).sort());
		for(const type of records) assert.equal(type.provenance.structure, `${module}.${expectedRecords[type.name.slice(module.length + 1)].structure}`, type.name);
		assert.ok(!model.types.some(type => type.name === `${module}.Marker`));
		assertGenericRecordArrayIr(model.bindingIr, module);
		const receipt = await copyPackageSetHandoff(outputRoot, handoff);
		await verifyPackageSetReceipt({ receiptPath: join(handoff, "package-set-receipt.json") });
		archives.push(Object.fromEntries(receipt.packages.flatMap(pkg => pkg.artifacts.map(artifact => [artifact.path, artifact.sha256]))));
		// Install from prepared archives only. No author workspace or build staging remains.
		await rm(directory, { recursive: true, force: true });
		await assert.rejects(access(directory), { code: "ENOENT" });
		if(attempt === 1) break;
		for(const profile of profiles)
		{
			t.diagnostic(`installing and checking Arrays in ${profile}`);
			const target = genericRecordTargets[profile][0];
			const packages = receipt.packages.filter(pkg => pkg.target === target);
			const source = await genericRecordArrayConsumer(profile);
			const { command, ...observation } = await installGenericRecordConsumer({ profile, consumer, handoff, packages, environment, source: () => source });
			void command;
			assert.equal(observation.checks, genericRecordArrayExpectedChecks(profile), `${profile} ran every Array case`);
			assert.equal(observation.consumerSha256, sha256(source));
			reports.push({ profile, path: "ordinary-source", ...observation, packages
				, expectedChecks: genericRecordArrayExpectedChecks(profile)
				, cases: genericRecordArrayCases[profile].cases
				, baseConsumer: genericRecordArrayBaseConsumers[profile]
				, ...profile === "python" ? { python } : {}
				, instantiations: { ...genericRecordInstantiations, ...genericRecordArrayInstantiations(module) }
				, specializations: genericRecordSpecializations()
				, arrayExports: genericRecordArrayExports.map(name => `${module}.${name}`)
				, bindingIrSha256: built.bindingIrSha256
				, sourceTreeSha256: model.sourceIdentity.sourceTreeSha256
				, modelSha256: sha256(canonicalJson(model))
				, receiptSha256: sha256(await readFile(join(handoff, "package-set-receipt.json")))
				, sourceRemovedBeforeInstallation: true });
			await rm(join(consumer, profile), { recursive: true, force: true });
		}
		await rm(consumer, { recursive: true, force: true });
	}
	assert.equal(new Set(authors).size, 2);
	assert.deepEqual(archives[1], archives[0]);
	const report = { schemaVersion: 1, profiles, reports, archives: archives[0], reproducible: true, authorRoots: 2 };
	await writeGenericRecordArrayReport(reportPath, report);
	return report;
};
