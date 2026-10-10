/**
 * Authenticate the completed #1439 hosted rollout independently of current producer helpers.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { stripVTControlCharacters } from "node:util";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { assertHostedSpecializationReport, strictArtifactZipMembers } from "./hosted-specialization-evidence.mjs";

export const hostedArrayDirectory = "docs/evidence/generic-record-array-hosted-20261010";
export const hostedArrayReceiptSha256 = "bf6d8306150d051ae1b9e02926b19c5cbefc14cad553e080a86cacc66b95ebc0";
const revision = "ff71335c762628da47887bfd4f208e62c39b94b7", runId = 37969725049;
const title = "relocated source-free native packages carry Array fields and results over alias-named generic records";
const counts = { c: 2078, cpp: 2058, python: 2144, rust: 2034, ruby: 2141, dotnet: 2088, java: 2105, kotlin: 2067, "php-native": 2124, "wit-wasi": 2091, perl: 2145 };
const bases = { c: 1029, cpp: 1024, python: 1036, rust: 1025, ruby: 1036, dotnet: 1034, java: 1034, kotlin: 1030, "php-native": 1035, "wit-wasi": 1036, perl: 1040 };
const caseCounts = { c: 19, cpp: 13, python: 12, rust: 8, ruby: 10, dotnet: 9, java: 9, kotlin: 9, "php-native": 9, "wit-wasi": 8, perl: 9 };
const extensions = { c: "c", cpp: "cpp", python: "py", rust: "rs", ruby: "rb", dotnet: "cs", java: "java", kotlin: "kt", "php-native": "php", "wit-wasi": "c", perl: "pl" };
const markers = { c: "  for (unsigned long i", cpp: "  for (unsigned i", python: "for i in range(1000):", rust: "    for i in 0..1000u64", ruby: "1000.times do", dotnet: "        for (int i", java: "        for (long i", kotlin: "    for (i in 0L", "php-native": "for ($i = 0;", "wit-wasi": "  for (uint64_t i", perl: "for my $i (0 .. 999)" };
const profilesOf = name => name === "c-family" ? ["c", "cpp"] : name === "jvm" ? ["java", "kotlin"] : [name.startsWith("perl-") ? "perl" : name];
const suffixesOf = name => name === "python" ? ["python", "python312"] : [profilesOf(name).join("-")];
const array = value => ({ kind: "apply", constructor: "array", arguments: [value] });
const cleanLog = text => stripVTControlCharacters(text).replace(/^\d{4}-\d\d-\d\dT[\d:.]+Z /gmu, "");

/**
 * Check Array values, consumer identities, rejection controls and unchanged base coverage.
 *
 * @param data - Original Array report.
 * @param group - Native job group.
 * @param member - Exact selected ZIP member.
 * @param source - Authenticated producer source reader.
 * @param base - Authenticated direct-record report from the same job.
 * @param specialized - Authenticated nine-specialization report from the same job.
 */
export const assertHostedArrayReport = (data, group, member, source, base, specialized) => {
	assert.deepEqual([data.schemaVersion, data.profiles, data.reproducible, data.authorRoots], [1, profilesOf(group), true, 2]);
	assert.deepEqual(data.reports.map(item => item.profile), profilesOf(group));
	const archives = {};
	for(const item of data.reports)
	{
		const profile = item.profile, extension = extensions[profile];
		assert.deepEqual([item.path, item.checks, item.expectedChecks, item.baseConsumer.checks], ["ordinary-source", counts[profile], counts[profile], bases[profile]]);
		for(const flag of ["sourceRemovedBeforeInstallation", "offlineInstall", "compilerFreePath"]) assert.equal(item[flag], true, flag);
		for(const field of ["modelSha256", "bindingIrSha256", "sourceTreeSha256", "receiptSha256"]) assert.match(item[field], /^[a-f0-9]{64}$/u);
		let consumer = source(`tests/fixtures/generic-record-consumers/${profile}.${extension}`);
		for(const kind of ["specialization", "array"])
		{
			const fragment = source(`tests/fixtures/generic-record-${kind}-consumers/${profile}.${extension}`);
			assert.equal(consumer.split(markers[profile]).length, 2); assert.ok(!fragment.includes(markers[profile]));
			consumer = consumer.replace(markers[profile], () => `${fragment}\n${markers[profile]}`);
			assert.equal(sha256(consumer), kind === "array" ? item.consumerSha256 : item.baseConsumer.sha256, `${profile} ${kind} consumer`);
		}
		assert.deepEqual(item.instantiations, { ...base.reports.find(row => row.profile === profile).instantiations
			, "lean:GenericRecords.ArrayBox": { structure: "GenericRecords.Box", arguments: [array({ kind: "primitive", name: "nat" })] }
			, "lean:GenericRecords.RowBox": { structure: "GenericRecords.Box", arguments: [array({ kind: "named", id: "lean:GenericRecords.NatBox" })] } });
		assert.deepEqual(item.specializations, specialized.reports.find(row => row.profile === profile).specializations);
		assert.equal(item.specializations.length, 9);
		assert.deepEqual(item.arrayExports, ["pushCount", "rowTotal", "rowOf", "rowBoxSum"].map(name => `GenericRecords.${name}`));
		assert.equal(item.cases.length, caseCounts[profile]); assert.equal(new Set(item.cases).size, item.cases.length);
		assert.equal(item.cases.at(-1), "1000 Array rounds");
		for(const label of item.cases) assert.ok(source("tests/helpers/generic-record-arrays.mjs").includes(JSON.stringify(label)), label);
		for(const pkg of item.packages) for(const artifact of pkg.artifacts)
		{
			assert.match(artifact.sha256, /^[a-f0-9]{64}$/u); assert.ok(artifact.bytes > 0);
			if(Object.hasOwn(archives, artifact.path)) assert.equal(archives[artifact.path], artifact.sha256);
			archives[artifact.path] = artifact.sha256;
		}
		if(profile === "python")
		{
			const version = member.includes("python312") ? "3.12.15" : "3.11.17";
			assert.deepEqual(item.python, { command: `/opt/hostedtoolcache/Python/${version}/x64/bin/python`, version });
			assert.ok(Object.keys(data.archives).some(name => name.endsWith("manylinux_2_38_x86_64.whl")));
		}
		if(["rust", "dotnet", "java", "kotlin"].includes(profile))
		{
			const types = item.rustTypes ?? item.managedTypes;
			assert.equal(types.repeatExecutionAfterTypeRejection, true);
			assert.deepEqual(types.rejected.map(rejection => rejection.case), ["alias", "field", "missing"]);
			const codes = { rust: ["E0308", "E0308", "E0063"], dotnet: ["CS1503", "CS1503", "CS7036"], java: Array(3).fill("compiler.err.cant.apply.symbol"), kotlin: ["ARGUMENT_TYPE_MISMATCH", "ARGUMENT_TYPE_MISMATCH", "NO_VALUE_FOR_PARAMETER"] };
			for(const [index, rejection] of types.rejected.entries())
			{
				assert.match(rejection.sourceSha256, /^[a-f0-9]{64}$/u); assert.ok(rejection.diagnostics.length > 0);
				for(const diagnostic of rejection.diagnostics)
				{
					assert.equal(diagnostic.file, `invalid-${rejection.case}.${extension}`);
					assert.equal(diagnostic.code, codes[profile][index]); assert.ok(diagnostic.line > 0 && diagnostic.column > 0);
				}
			}
			if(profile !== "rust")
			{
				assert.equal(types.positiveCompiles, true); assert.equal(types.artifactUnchanged, true);
				for(const key of ["artifactSha256", "positiveSourceSha256"]) assert.match(types[key], /^[a-f0-9]{64}$/u);
			}
		}
	}
	assert.deepEqual(data.archives, archives);
};

/**
 * Require actual successful TAP executions, real compare-step commands and exact selected runtimes.
 *
 * @param group - Pinned artifact/job group.
 * @param job - Original GitHub job metadata.
 * @param log - Original complete job transcript.
 */
export const assertHostedArrayExecution = (group, job, log) => {
	assert.deepEqual([job.id, job.run_id, job.head_sha, job.status, job.conclusion], [group.jobId, runId, revision, "completed", "success"]);
	const clean = cleanLog(log), profiles = profilesOf(group.name);
	assert.ok(clean.includes("Image: ubuntu-24.04\n")); assert.ok(clean.includes("Version: 20261004.327.1\n"));
	assert.doesNotMatch(clean, /LEAN_BRIDGE_(?:NATIVE|PERL)_TEST_GLIBC_FLOOR/u);
	const command = `LEAN_BRIDGE_GENERIC_RECORD_ARRAY_PROFILES=${profiles.join(",")} node --test --test-concurrency=1 tests/generic-record-arrays.test.mjs`;
	const headers = [...clean.matchAll(/^##\[group\]Run [^\n]*\n([\s\S]*?)^##\[endgroup\]$/gmu)].map(match => match[1]);
	const selected = headers.filter(header => header.split("\n").includes(command));
	assert.equal(selected.length, 1, `${group.name}: one real compare step`);
	for(const suffix of suffixesOf(group.name)) assert.ok(selected[0].includes(`\ntest -s build/generic-records/array-${suffix}.json\n`));
	assert.doesNotMatch(selected[0], /^ {2}LEAN_BRIDGE_GENERIC_RECORD_ARRAY_(?:PROFILES|REPORT):/mu);
	if(group.name === "python")
	{
		assert.ok(selected[0].includes("  LEAN_BRIDGE_PYTHON: /opt/hostedtoolcache/Python/3.11.17/x64/bin/python\n"));
		assert.ok(selected[0].includes(`\nLEAN_BRIDGE_PYTHON="/opt/hostedtoolcache/Python/3.12.15/x64/bin/python" LEAN_BRIDGE_GENERIC_RECORD_ARRAY_REPORT=build/generic-records/array-python312.json ${command}\n`));
	}
	if(group.name.startsWith("perl-"))
	{
		assert.ok(selected[0].includes('export LEAN_BRIDGE_CORPUS_PERL="$PWD/.toolchains/perl/$CORPUS_PERL_CONFIGURATION/bin/perl"'));
		assert.ok(selected[0].includes(`  CORPUS_PERL_CONFIGURATION: ${group.name.slice(5)}\n`));
		assert.ok(clean.includes(`\nPerl ${group.name.slice(5)}\n`));
	}
	const selectedCount = group.name === "python" ? 2 : 1;
	for(const name of [title, "relocated source-free native packages construct and project alias-named generic records", "relocated source-free native packages construct specialized generic records in two namespaces and Option/List aliases"])
	{
		const passes = [...clean.matchAll(new RegExp(`^ok \\d+ - ${name}$`, "gmu"))];
		assert.equal(passes.length, selectedCount, `${group.name}: unskipped ${name}`);
		for(const pass of passes)
		{
			const start = clean.lastIndexOf("TAP version 13\n", pass.index), end = clean.indexOf("# duration_ms ", pass.index);
			assert.ok(start >= 0 && end > pass.index); const tap = clean.slice(start, end);
			assert.doesNotMatch(tap, /^not ok /mu);
			for(const key of ["fail", "cancelled", "todo", ...name === title ? ["skipped"] : []]) assert.match(tap, new RegExp(`^# ${key} 0$`, "mu"));
			if(name === title) for(const line of ["# tests 12", "# pass 12", `# array build 0: ${profiles.join(", ")}`, `# array build 1: ${profiles.join(", ")}`]) assert.ok(tap.split("\n").includes(line), line);
		}
	}
	const stepNames = { "c-family": "Compare relocated C and C++ corpus consumers with fresh Lean", python: "Compare installed Python corpus packages with fresh Lean results", rust: "Compare isolated Cargo corpus consumers with fresh Lean", ruby: "Compare installed Ruby corpus packages with fresh Lean results", dotnet: "Compare installed NuGet corpus packages with fresh Lean results", jvm: "Compare isolated Java and Kotlin corpus consumers with fresh Lean", "php-native": "Compare weak and strict installed Composer callers with fresh Lean", "wit-wasi": "Compile ordinary Lean APIs and consume relocated WIT packages" };
	const stepName = group.name.startsWith("perl-") ? "Compare installed Perl corpus packages with fresh Lean results" : stepNames[group.name];
	const step = job.steps.find(item => item.name === stepName);
	assert.deepEqual([step?.status, step?.conclusion], ["completed", "success"]);
};

/**
 * Authenticate all originals, ZIP membership, Git snapshots and forty-five generic observations.
 *
 * @param receipt - Parsed archive receipt.
 * @param read - Repository-relative byte reader, injectable for corruption controls.
 */
export const assertHostedArrayArchive = async (receipt, read = readFile) => {
	assert.equal(sha256(canonicalJson(receipt)), hostedArrayReceiptSha256, "fixed receipt before reading any supplied path");
	const files = new Map();
	for(const file of receipt.files)
	{
		const bytes = await read(file.path);
		assert.ok(Buffer.isBuffer(bytes)); assert.equal(bytes.length, file.bytes, file.path); assert.equal(sha256(bytes), file.sha256, file.path);
		assert.ok(!files.has(file.path)); files.set(file.path, bytes);
	}
	const bytes = name => { const value = files.get(`${hostedArrayDirectory}/${name}`); assert.ok(value, name); return value; };
	const json = name => JSON.parse(bytes(name)), source = path => bytes(`sources/${path}.txt`).toString("utf8");
	for(const id of [runId, 37969723940, 37969723919])
	{
		const run = json(`run-${id}.json`);
		assert.deepEqual([run.id, run.head_sha, run.status, run.conclusion, run.run_attempt], [id, revision, "completed", "success", 1]);
	}
	const jobs = json("jobs.json"); assert.equal(jobs.total_count, 46); assert.equal(jobs.jobs.length, 46);
	for(const job of jobs.jobs) assert.deepEqual([job.head_sha, job.run_id, job.status, job.conclusion], [revision, runId, "completed", "success"]);
	const artifacts = json("artifacts.json"); assert.equal(artifacts.total_count, artifacts.artifacts.length);
	const members = group => {
		const artifact = artifacts.artifacts.find(item => item.id === group.artifactId), zip = bytes(`${group.name}.zip`);
		assert.deepEqual([artifact.workflow_run.id, artifact.workflow_run.head_sha, artifact.digest, artifact.size_in_bytes], [runId, revision, `sha256:${sha256(zip)}`, zip.length]);
		const selected = strictArtifactZipMembers(zip, group.reports.map(item => item.member));
		for(const item of group.reports)
		{
			const original = selected.get(item.member);
			assert.equal(original.length, item.bytes); assert.equal(sha256(original), item.sha256);
			assert.deepEqual(original, bytes(`${group.name}/${item.member}`));
		}
		return selected;
	};
	let arraySelections = 0, arrayObservations = 0, genericReports = 0, genericObservations = 0;
	for(const group of receipt.groups)
	{
		const job = json(`job-${group.jobId}.json`);
		assert.deepEqual(job, jobs.jobs.find(item => item.id === group.jobId));
		assertHostedArrayExecution(group, job, bytes(`job-${group.jobId}.log`).toString("utf8"));
		const selected = members(group);
		for(const suffix of suffixesOf(group.name))
		{
			const baseName = `generic-records/${suffix}.json`, specializedName = `generic-records/specialized-${suffix}.json`, arrayName = `generic-records/array-${suffix}.json`;
			const base = JSON.parse(selected.get(baseName)), specialized = JSON.parse(selected.get(specializedName)), arrays = JSON.parse(selected.get(arrayName));
			assertHostedSpecializationReport(base, group.name, baseName, source);
			assertHostedSpecializationReport(specialized, group.name, specializedName, source);
			assertHostedArrayReport(arrays, group.name, arrayName, source, base, specialized);
			arraySelections++; arrayObservations += arrays.reports.length; genericReports += 3;
			genericObservations += base.reports.length + specialized.reports.length + arrays.reports.length;
		}
	}
	for(const group of receipt.perlAbi)
	{
		const selected = members(group), configuration = group.name.slice("perl-abi-".length);
		const acceptance = JSON.parse(selected.get(`${configuration}/acceptance.json`)), benchmark = JSON.parse(selected.get(`${configuration}/benchmark.json`));
		assert.equal(acceptance.perl, `/home/runner/work/lean-bridge/lean-bridge/.toolchains/perl/${configuration}/bin/perl`);
		assert.equal(acceptance.glibcMinimumVersion, "2.38");
		const arrays = json(`perl-${configuration}/generic-records/array-perl.json`);
		for(const pkg of arrays.reports[0].packages) assert.equal(pkg.runtimeIdentity, benchmark.runtimeIdentity);
	}
	for(const path of [".github/workflows/consumer-matrix.yml", ".github/workflows/perl-consumer.yml"])
		assert.doesNotMatch(source(path), /LEAN_BRIDGE_(?:NATIVE|PERL)_TEST_GLIBC_FLOOR/u);
	for(const path of ["src/build/native-c-projection.mjs", "src/build/cpan-projection.mjs"]) assert.match(source(path), /TEST_GLIBC_FLOOR \?\? "2\.38"/u);
	assert.deepEqual([arraySelections, arrayObservations, genericReports, genericObservations], [13, 15, 39, 45]);
	return { groups: receipt.groups.length, arraySelections, arrayObservations, genericReports, genericObservations, files: files.size };
};
