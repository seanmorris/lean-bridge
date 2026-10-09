/**
 * Authenticate plain and closed generic inheritance through their original installed-package reports.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import identities from "../fixtures/inherited-record-evidence-identities.json" with { type: "json" };
import { beforeFinRefinementSource } from "./fin-refinement-source-history.mjs";
import { expectedGenericInheritanceRecords, genericInheritanceNodeConsumer } from "./generic-inheritance-packages.mjs";

export const inheritedRecordEvidenceDirectory = "docs/evidence/inherited-records-20261008";
export const inheritedRecordEvidenceIdentities = identities;
const digest = value => assert.match(value, /^[a-f0-9]{64}$/u);
const nativeNames = {
	plain: "relocated source-free C and C++ packages construct inherited records and check a parent's Fin field"
	, generic: "relocated source-free C and C++ packages keep each inherited generic parent as its alias-typed field"
};
const npmName = "a relocated source-free npm package keeps each inherited generic parent for Node and strict TypeScript";

/**
 * Check native report facts and identities independently of its file digest.
 *
 * @param report - Original parsed report.
 * @param kind - Plain or generic inheritance.
 */
export const assertInheritedNativeReport = async (report, kind) => {
	assert.ok(["plain", "generic"].includes(kind));
	assert.equal(report.schemaVersion, 1); assert.equal(report.reproducible, true);
	assert.deepEqual(report.reports.map(item => item.profile), ["c", "cpp"]);
	const name = kind === "plain" ? "inheritedrecords" : "genericinheritance";
	assert.deepEqual(Object.keys(report.archives).sort(), [`archives/${name}-1.0.0-c.tar.gz`, `archives/${name}-1.0.0-cpp.tar.gz`]);
	if(kind === "generic")
	{
		assert.equal(report.independentBuilds, 2);
		assert.deepEqual(report.records, expectedGenericInheritanceRecords("GenericInheritance"));
	}
	for(const item of report.reports)
	{
		assert.equal(item.path, "ordinary-source");
		assert.equal(item.checks, kind === "plain" ? 2010 : { c: 2011, cpp: 2007 }[item.profile]);
		for(const flag of ["sourceRemovedBeforeInstallation", "offlineInstall", "compilerFreePath"]) assert.equal(item[flag], true, flag);
		for(const key of ["bindingIrSha256", "modelSha256", "receiptSha256", "consumerSha256"]) digest(item[key]);
		if(kind === "generic") assert.equal(item.modelBindingIrSha256, item.bindingIrSha256);
		const directory = kind === "plain" ? "inherited-record" : "generic-inheritance";
		assert.equal(item.consumerSha256, sha256(await readFile(`tests/fixtures/${directory}-consumers/${item.profile}.${item.profile}`)));
		assert.equal(item.packages.length, 1);
		const [pkg] = item.packages;
		assert.deepEqual([pkg.target, pkg.name, pkg.version, pkg.role], [item.profile, name, "1.0.0", "component"]);
		assert.equal(pkg.artifacts.length, 1);
		const [artifact] = pkg.artifacts;
		assert.equal(artifact.path, `archives/${name}-1.0.0-${item.profile}.tar.gz`);
		assert.equal(artifact.sha256, report.archives[artifact.path]); digest(artifact.sha256);
		assert.ok(Number.isSafeInteger(artifact.bytes) && artifact.bytes > 0);
		assert.equal(Object.hasOwn(item, "dispatch"), false, "no entry counters were measured");
	}
	for(const key of ["bindingIrSha256", "modelSha256", "receiptSha256"])
		assert.equal(report.reports[0][key], report.reports[1][key]);
};

/**
 * Check the installed Node/strict TypeScript facts, aliases and receipt relationships.
 *
 * @param report - Original parsed npm report.
 */
export const assertInheritedNpmReport = async report => {
	assert.deepEqual([report.schemaVersion, report.profile, report.path], [1, "npm", "ordinary-source"]);
	assert.deepEqual([report.checks, report.rejections], [1005, 1006]);
	assert.deepEqual(report.records, expectedGenericInheritanceRecords("OnboardingSmall"));
	for(const flag of ["reproducible", "sourceRemovedBeforeInstallation", "offlineInstall", "compilerFreePath"]) assert.equal(report[flag], true, flag);
	assert.equal(report.independentBuilds, 2); assert.equal(report.dispatch, "not measured");
	assert.equal(report.consumerSha256, sha256(genericInheritanceNodeConsumer()));
	assert.equal(report.typescript.strict, true); assert.equal(report.typescript.skipLibCheck, false);
	for(const key of ["sourceSha256", "declarationsSha256"]) digest(report.typescript[key]);
	const source = await readFile("tests/helpers/generic-inheritance-packages.mjs", "utf8");
	const typescript = /^const typescript = `([^`]+)`;/mu.exec(source);
	assert.ok(typescript); assert.equal(report.typescript.sourceSha256, sha256(typescript[1]));
	for(const key of ["archiveSha256", "runtimeArchiveSha256", "bindingIrSha256", "bindingIrFileSha256", "receiptSha256"]) digest(report[key]);
	assert.equal(report.receiptSha256, sha256(canonicalJson(report.receipt)));
	assert.equal(report.receipt.bindingIrSha256, report.bindingIrSha256);
	assert.equal(report.receipt.package.sha256, report.archiveSha256);
	assert.equal(report.receipt.runtime.sha256, report.runtimeArchiveSha256);
	assert.equal(report.receipt.package.package, "onboarding-small@1.0.0");
	assert.deepEqual(report.receipt.policies, { componentCompiledOnce: true, nativeCallablesOnly: true, runtimeBinaryInComponent: false, runtimeShared: true });
};

/**
 * Require one complete successful selected test, its exact name, plan, counters and terminal record.
 *
 * @param text - Original TAP selection.
 * @param name - Selected installed test.
 */
const oneRun = (text, name) => {
	assert.deepEqual([...text.matchAll(/^(not ok|ok) (\d+) - (.+)$/gmu)].map(match => match.slice(1)), [["ok", "1", name]]);
	assert.deepEqual([...text.matchAll(/^1\.\.(\d+)$/gmu)].map(match => match[1]), ["1"]);
	for(const [key, count] of Object.entries({ tests: 1, pass: 1, fail: 0, cancelled: 0, skipped: 0, todo: 0 }))
		assert.deepEqual([...text.matchAll(new RegExp(`^# ${key} (.+)$`, "gmu"))].map(match => match[1]), [String(count)]);
	assert.deepEqual([...text.matchAll(/^exit=(.+)$/gmu)].map(match => match[1]), ["0"]);
	assert.doesNotMatch(text, /# (?:SKIP|TODO)\b/u);
};

/**
 * Preserve both queues and selected test outcomes without treating the separate Lean log as an installed run.
 *
 * @param files - Text keyed by artifact basename.
 */
export const assertInheritedRuns = files => {
	oneRun(files["plain.tap"], nativeNames.plain);
	const plain = files["plain.queue"];
	assert.ok(plain.startsWith(`revision=${identities.sources.plain.revision}\n`));
	assert.match(plain, /node=v22\.23\.3 cpu=3 concurrency=1 pattern=\^relocated source-free C and C\n/u);
	assert.match(plain, /^LEAN_BRIDGE_INHERITED_RECORD_PROFILES=c,cpp$/mu);
	assert.match(plain, /^LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR=2\.36$/mu);
	assert.deepEqual([...plain.matchAll(/^end=.+ exit=(\d+) # pass (\d+) # fail (\d+) # skipped (\d+) $/gmu)].map(match => match.slice(1)), [["0", "1", "0", "0"]]);
	const generic = files["generic.queue"];
	assert.ok(generic.startsWith(`revision=${identities.sources.generic.revision}\n`));
	assert.match(generic, /node=v22\.23\.3 cpu=3 concurrency=1 queue=c-cpp,npm build\/lean-runtime=\/app\/build\/lean-runtime/u);
	assert.match(generic, /LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR=2\.36 LEAN_BRIDGE_GENERIC_INHERITANCE_PROFILES=c,cpp/u);
	assert.match(generic, /LEAN_BRIDGE_GENERIC_INHERITANCE_NPM_TEST=1 LEAN_BRIDGE_LAKE_RUNTIME_ROOT=\/app\/build\/lean-link-spike\/lazy/u);
	assert.deepEqual([...generic.matchAll(/^end (\S+) \S+ exit=(\d+)$/gmu)].map(match => match.slice(1)), [["c-cpp", "0"], ["npm", "0"]]);
	assert.equal([...generic.matchAll(/^all steps passed \S+$/gmu)].length, 1);
	const selections = files["generic.tap"].split(/^# step /mu).slice(1);
	assert.equal(selections.length, 2);
	assert.ok(selections[0].startsWith("c-cpp pattern=^relocated source-free C and C\n"));
	assert.ok(selections[1].startsWith("npm pattern=^a relocated source-free npm package\n"));
	oneRun(selections[0], nativeNames.generic); oneRun(selections[1], npmName);
	const lean = files["plain-lean.tap"];
	const names = ["inherited records carry each subobject parent as its own field and compile their Lean adapters"
		, "inherited fields that depend on the record value and generic inheritance stay refused at their source"
		, nativeNames.plain + " # SKIP"];
	assert.deepEqual([...lean.matchAll(/^(not ok|ok) (\d+) - (.+)$/gmu)].map(match => match.slice(1)), names.map((name, index) => ["ok", String(index + 1), name]));
	assert.deepEqual([...lean.matchAll(/^1\.\.(\d+)$/gmu)].map(match => match[1]), ["3"]);
	for(const [key, count] of Object.entries({ tests: 3, pass: 2, fail: 0, cancelled: 0, skipped: 1, todo: 0 }))
		assert.deepEqual([...lean.matchAll(new RegExp(`^# ${key} (.+)$`, "gmu"))].map(match => match[1]), [String(count)]);
};

/** Exact receipt: local installed observations, selected source identities and explicit attribution limits. */
export const inheritedRecordEvidenceReceipt = () => ({
	schemaVersion: 1, planNode: 1433, execution: "local"
	, producers: identities.sources
	, artifacts: Object.entries(identities.originals).map(([name, item]) => ({ path: `${inheritedRecordEvidenceDirectory}/${name}`, ...item }))
	, scope: {
		sourcePath: "ordinary-source"
		, plainHosts: ["c", "cpp"]
		, genericHosts: ["c", "cpp", "node-javascript", "node-typescript"]
		, plain: "Six record layouts and five exports: single, multiple, multilevel and overlapping parents, including a Fin 10 field in a parent and rejection/recovery. C and C++ each pass 2010 checks."
		, generic: "Three exports over six closed alias-named inherited records with universe and phantom arguments. Parent subobjects retain their alias types, field order and compiler-resolved origins. C passes 2011 checks, C++ 2007; Node passes 1005 checks and 1006 rejections. Strict TypeScript checks the installed declarations with skipLibCheck disabled."
		, isolation: "Two author builds reproduce archives; actual author/build deletion precedes offline installation. Native callers still compile against installed headers with host C/C++ compilers. Node uses a Node-only PATH; strict TypeScript uses the engine checkout's compiler."
		, sourceIdentity: "Selected compiler, harness, fixture and caller files recovered from the queue revisions, not a complete dependency closure or a contemporaneous source-pin manifest."
		, environment: "Local Node v22.23.3, CPU 3/concurrency 1, native glibc floor override 2.36; npm uses /app/build/lean-link-spike/lazy and build/lean-runtime. Queues record selections and environment, not the complete shell command."
		, dispatch: "not measured", hostedCi: false, binaryArchivesRetained: false
		, exclusions: ["reviewed inheritance", "browser inheritance", "inherited-record instance dictionaries", "open, recursive, indexed or refined generic parents", "source-entry counters", "sanitizer measurements"]
	}
	, freshLean: {
		artifact: "plain-lean.tap", passed: 2, skipped: 1
		, attribution: "No original queue or execution-revision record accompanies this log. The retained filename and matching producer test names attribute it to the earlier plain-inheritance source; this is not independent execution-revision evidence. Its installed gate was skipped. Its generic-inheritance refusal predates the separately installed generic-parent implementation."
	}
});

/**
 * Authenticate fixed artifact paths before reads, original bytes, report facts and exact producer source stops.
 *
 * @param receipt - Parsed archive receipt.
 * @param reader - File reader, injectable for corruption controls.
 * @param options - Validation options.
 * @param options.currentSources - Also authenticate current sources through their history.
 */
export const assertInheritedRecordArchive = async (receipt, reader = readFile, { currentSources = true } = {}) => {
	assert.deepEqual(receipt, inheritedRecordEvidenceReceipt());
	const files = {};
	for(const file of receipt.artifacts)
	{
		const bytes = await reader(file.path);
		assert.equal(bytes.length, file.bytes, file.path); assert.equal(sha256(bytes), file.sha256, file.path);
		files[file.path.split("/").at(-1)] = bytes.toString();
	}
	assertInheritedRuns(files);
	await assertInheritedNativeReport(JSON.parse(files["plain-native.json"]), "plain");
	await assertInheritedNativeReport(JSON.parse(files["generic-native.json"]), "generic");
	await assertInheritedNpmReport(JSON.parse(files["generic-npm.json"]));
	for(const [kind, producer] of currentSources ? Object.entries(receipt.producers) : [])
		for(const file of producer.files)
			assert.equal(sha256(beforeFinRefinementSource(file.path, await reader(file.path), file.sha256)), file.sha256, `${kind}/${file.path}`);
};

/**
 * Keep archived evidence immutable; identical regeneration is allowed.
 *
 * @param path - Validated output path.
 * @param bytes - Original bytes.
 */
export const writeInheritedRecordArtifact = async (path, bytes) => {
	await mkdir(dirname(path), { recursive: true });
	try
	{ await writeFile(path, bytes, { flag: "wx" }); }
	catch(error)
	{ if(error.code !== "EEXIST") throw error; assert.deepEqual(await readFile(path), bytes, path); }
};
