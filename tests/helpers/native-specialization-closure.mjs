/**
 * Close the original ordinary-source native-specialization requirements without conflating fixtures.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { stripVTControlCharacters } from "node:util";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { assertHostedArrayArchive, hostedArrayDirectory } from "./generic-record-array-hosted-evidence.mjs";
import { assertHostedSpecializationArchive, assertHostedSpecializationReport, hostedSpecializationDirectory, strictArtifactZipMembers } from "./hosted-specialization-evidence.mjs";

export const specializationClosureDirectory = "docs/evidence/native-specialization-closure-20261010";
export const specializationClosureSha256 = "2aba48bbfbd00fc3bd885e0ec5c450d16bd3e09e1eecdf5bfce72041c1ca3ce8";
const title = "relocated source-free native packages install concrete specializations without the generic declaration";
const names = ["echoWord", "echoText", "echoNat", "echoWords", "chooseWord", "chooseText", "chooseWords", "firstTextWord", "doubleWord", "doubleNat"];
const profiles = { c: "c", cpp: "cpp", python: "py", rust: "rs", ruby: "rb", dotnet: "cs", java: "java", kotlin: "kt", "php-native": "php", "wit-wasi": "c", perl: "pl" };

/**
 * Verify the real common-function command and successful TAP, not a similarly named record test.
 *
 * @param selection - Pinned report reference.
 * @param log - Original successful hosted job transcript.
 */
export const assertSpecializationClosureExecution = (selection, log) => {
	const clean = stripVTControlCharacters(log).replace(/^\d{4}-\d\d-\d\dT[\d:.]+Z /gmu, "");
	const selectedProfiles = selection.checks.map(([profile]) => profile).join(",");
	const command = `LEAN_BRIDGE_SPECIALIZATION_PROFILES=${selectedProfiles} node --test tests/native-specializations.test.mjs`;
	const headers = [...clean.matchAll(/^##\[group\]Run [^\n]*\n([\s\S]*?)^##\[endgroup\]$/gmu)].map(match => match[1]);
	const selected = headers.filter(header => header.split("\n").includes(command));
	assert.equal(selected.length, 1, "one actual function compare command");
	assert.ok(selected[0].includes(`\ntest -s build/${selection.member}\n`), "mandatory function report");
	assert.doesNotMatch(selected[0], /^ {2}LEAN_BRIDGE_SPECIALIZATION_(?:PROFILES|REPORT):/mu);
	if(selection.group === "python")
		assert.ok(selected[0].includes("  LEAN_BRIDGE_PYTHON: /opt/hostedtoolcache/Python/3.11.17/x64/bin/python\n"));
	if(selection.group.startsWith("perl-"))
	{
		assert.ok(selected[0].includes(`  CORPUS_PERL_CONFIGURATION: ${selection.group.slice(5)}\n`));
		assert.ok(selected[0].includes('export LEAN_BRIDGE_CORPUS_PERL="$PWD/.toolchains/perl/$CORPUS_PERL_CONFIGURATION/bin/perl"'));
	}
	const passed = [...clean.matchAll(new RegExp(`^ok \\d+ - ${title}$`, "gmu"))];
	assert.equal(passed.length, 1, `${selection.group}: actual unskipped function acceptance`);
	const start = clean.lastIndexOf("TAP version 13\n", passed[0].index), end = clean.indexOf("# duration_ms ", passed[0].index);
	assert.ok(start >= 0 && end > passed[0].index);
	const tap = clean.slice(start, end);
	assert.doesNotMatch(tap, /^not ok /mu);
	for(const field of ["fail", "cancelled", "todo"]) assert.match(tap, new RegExp(`^# ${field} 0$`, "mu"));
	for(const attempt of [0, 1]) assert.ok(tap.includes(`# build ${attempt}: ${selectedProfiles.replaceAll(",", ", ")}\n`));
	if(selection.group === "c-family")
		assert.match(tap, /^ok \d+ - native builds admit a generic structure instantiation named by an alias, with its provenance$/mu);
};

/**
 * Audit the eighteen retained source files as text; never execute a historical producer.
 *
 * @param source - Authenticated historical source reader.
 */
export const assertSpecializationClosureSources = source => {
	const fixture = source("tests/fixtures/onboarding/native-specializations/Specialized.lean");
	assert.ok(fixture.includes("instance (priority := high) : Inhabited UInt32 := ⟨37⟩"));
	assert.ok(fixture.includes("universe u v")); assert.ok(fixture.includes("abbrev Words := Array Word"));
	const helper = source("tests/helpers/native-specialization-install.mjs");
	const configured = [...helper.matchAll(/\{ name: "Specialized\.([A-Za-z]+)", declaration: "Specialized\.([a-z]+)", types: (\[[^\n]+?\]) \}/gu)]
		.map(match => ({ name: match[1], declaration: match[2], types: JSON.parse(match[3]) }));
	assert.deepEqual(configured.map(item => item.name), names);
	assert.deepEqual(configured.map(item => item.types), [["Specialized.Word"], ["String"], ["Nat"], ["Specialized.Words"], ["UInt32"], ["String"], ["Specialized.Words"], ["String", "UInt32"], ["UInt32"], ["Nat"]]);
	assert.deepEqual([...new Set(configured.map(item => item.declaration))], ["echo", "choose", "first", "duplicate"]);
	for(const name of names) assert.ok(!fixture.includes(`def ${name} `), "no handwritten Lean specialization wrappers");
	for(const [profile, extension] of Object.entries(profiles))
	{
		const consumer = source(`tests/fixtures/specialization-consumers/${profile}.${extension}`);
		assert.match(consumer, /(?:choose[_-]?[Ww]ord|ChooseWord)[^\n]*37/u, `${profile}: selected instance checked`);
		assert.ok(consumer.includes(profile === "perl" ? "for my $i (0 .. 999)" : "1000"), `${profile}: repeated calls`);
	}
	const harness = source("tests/native-specializations.test.mjs");
	for(const contract of ["for(const attempt of [0, 1])", "nativeSpecializationSignatures", "assert.deepEqual(entry.typeParameters, [], name)", "assert.deepEqual(entry.assurance, [], name)", '["echo", "choose", "first", "duplicate"]', "assert.deepEqual(archives[1], archives[0])"])
		assert.ok(harness.includes(contract), contract);
	const removed = harness.indexOf("await rm(directory, { recursive: true, force: true })");
	const installed = harness.indexOf("const observation = await installSpecializationConsumer");
	assert.ok(removed >= 0 && installed > removed, "author root removed before installed consumption");
	const install = source("tests/helpers/copied-fixture-install.mjs");
	for(const flag of ['"-Wall", "-Wextra", "-Werror", "-UNDEBUG"', "<TreatWarningsAsErrors>true", '"--release", "22", "-Werror"', '"-Werror", "-jvm-target", "22"', '"build", "--offline", "--bin", "consumer"']) assert.ok(install.includes(flag), flag);
};

/**
 * Authenticate the function supplement plus the independently accepted record/Array archives.
 *
 * @param receipt - Fixed closure receipt.
 * @param read - Repository-relative byte reader, injectable for corruption controls.
 */
export const assertNativeSpecializationClosure = async (receipt, read = readFile) => {
	assert.equal(sha256(canonicalJson(receipt)), specializationClosureSha256, "fixed closure receipt before reads");
	const documents = [];
	for(const item of receipt.archives)
	{
		const bytes = await read(item.path); assert.equal(sha256(bytes), item.sha256, item.path); documents.push(JSON.parse(bytes));
	}
	const [arrays, previous] = documents;
	const records = await assertHostedArrayArchive(arrays, read);
	await assertHostedSpecializationArchive(previous, read);
	const sourceTexts = new Map();
	for(const item of receipt.sources)
	{
		const archived = previous.files.find(file => file.path === item.archivePath);
		assert.ok(archived); assert.equal(archived.sha256, item.sha256);
		const bytes = await read(item.archivePath); assert.equal(sha256(bytes), item.sha256);
		sourceTexts.set(item.path, bytes.toString("utf8"));
	}
	assert.equal(sourceTexts.size, 18);
	const source = path => { assert.ok(sourceTexts.has(path), path); return sourceTexts.get(path); };
	assertSpecializationClosureSources(source);
	let observations = 0;
	assert.deepEqual(receipt.reports.map(item => item.group), arrays.groups.map(group => group.name));
	for(const item of receipt.reports)
	{
		const group = arrays.groups.find(group => group.name === item.group);
		assert.deepEqual([item.jobId, item.artifactId], [group.jobId, group.artifactId]);
		const zipPath = `${hostedArrayDirectory}/${item.group}.zip`, zip = await read(zipPath);
		assert.equal(sha256(zip), arrays.files.find(file => file.path === zipPath).sha256);
		const bytes = await read(item.path), original = strictArtifactZipMembers(zip, [item.member]).get(item.member);
		assert.deepEqual(bytes, original); assert.equal(bytes.length, item.bytes); assert.equal(sha256(bytes), item.sha256);
		const report = JSON.parse(bytes);
		assertHostedSpecializationReport(report, item.group, item.member, source);
		assert.deepEqual(report.reports.map(row => [row.profile, row.checks]), item.checks);
		assertSpecializationClosureExecution(item, (await read(`${hostedArrayDirectory}/job-${item.jobId}.log`)).toString("utf8"));
		observations += report.reports.length;
	}
	assert.equal(observations, 14);
	assert.equal(previous.files[0].path.startsWith(`${hostedSpecializationDirectory}/`), true);
	return { functionReports: receipt.reports.length
		, functionObservations: observations, functionSources: sourceTexts.size
		, recordReports: records.genericReports
		, recordObservations: records.genericObservations };
};

/**
 * Reconcile every native generic observation with real installed evidence and all current file pins.
 *
 * @param inventory - Current type-surface inventory.
 * @param read - Current source and evidence reader.
 */
export const assertSpecializationClosureInventory = async (inventory, read = readFile) => {
	const groups = { "c-cpp": ["c", "cpp"], python: ["python"], rust: ["rust"], ruby: ["ruby"], dotnet: ["dotnet"], "java-kotlin": ["java", "kotlin"], "php-native": ["php-native"], "wit-wasi": ["wit-wasi"], perl: ["perl"] };
	const files = new Map(), evidence = new Map(inventory.evidence.map(item => [item.id, item]));
	for(const [group, profiles] of Object.entries(groups))
	{
		const prefix = group === "perl" ? "perl-finite-specializations" : `native-specializations-${group}`;
		const found = inventory.observations.filter(item => item.id === `${prefix}-ordinary-source`);
		assert.equal(found.length, 1); const observation = found[0];
		assert.deepEqual([observation.profiles, observation.shapes, observation.positions, observation.path], [profiles, ["generic", "implicit", "instance"], ["signature"], "ordinary-source"]);
		assert.deepEqual(Object.keys(observation.stages).sort(), ["analysis", "compilation", "generation", "installedExecution", "packaging"]);
		for(const stage of Object.values(observation.stages))
		{
			assert.equal(stage.state, "passed"); assert.ok(stage.evidence.includes(`${prefix}-installed`));
			for(const id of stage.evidence)
			{
				const entry = evidence.get(id); assert.ok(entry, id);
				for(const file of entry.files)
				{
					if(files.has(file.path)) assert.equal(files.get(file.path), file.sha256, file.path);
					files.set(file.path, file.sha256);
				}
			}
		}
		assert.equal(evidence.get(`${prefix}-installed`).kind, "installed");
	}
	for(const [path, digest] of files) assert.equal(sha256(await read(path)), digest, path);
	return { observations: Object.keys(groups).length, profiles: Object.values(groups).flat().length, currentFiles: files.size };
};
