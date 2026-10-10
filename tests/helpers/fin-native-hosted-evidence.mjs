/**
 * Authenticate the original hosted native product and nominal Fin reports without rerunning them.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { stripVTControlCharacters } from "node:util";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { assertHostedArrayArchive, hostedArrayDirectory, hostedArrayReceiptSha256 } from "./generic-record-array-hosted-evidence.mjs";
import { strictArtifactZipMembers } from "./hosted-specialization-evidence.mjs";
import { finPythonRubyFamilies } from "./fin-python-ruby-evidence.mjs";
import { finProductTargets } from "./fin-product-install.mjs";
import { finProductArrayTargets } from "./fin-product-array-install.mjs";
import { finRecordTargets } from "./fin-record-install.mjs";
import { finProductDispatchColumns, finProductDispatchExpected } from "./fin-product-dispatch.mjs";
import { finProductArrayDispatchColumns, finProductArrayDispatchExpected } from "./fin-product-array-dispatch.mjs";
import { finRecordDispatchColumns, finRecordDispatchExpected } from "./fin-record-dispatch.mjs";

export const finHostedDirectory = "docs/evidence/fin-native-hosted-20261010";
export const finHostedRevision = "ff71335c762628da47887bfd4f208e62c39b94b7";
export const finHostedReceiptSha256 = "b33ffceea3afbb7584a00a6579f556716ddd3565f9e4707be968f75d95f39a2f";
export const finHostedProfiles = { c: "c", cpp: "cpp", python: "py", rust: "rs", ruby: "rb", dotnet: "cs", java: "java", kotlin: "kt", "php-native": "php", "wit-wasi": "c", perl: "pl" };
export const finHostedFamilies = {
	product: { module: "FinProducts"
		, directory: "native-fin-products"
		, variable: "PRODUCT"
		, targets: finProductTargets
		, columns: finProductDispatchColumns
		, observed: finProductDispatchExpected
		, counts: { c: 2038, cpp: 2039, python: 2038, rust: 2039, ruby: 2039, dotnet: 2039, java: 2039, kotlin: 2039, "php-native": 2039, "wit-wasi": 2037, perl: 2045 } }
	, "product-array": { module: "FinProductArrays"
		, directory: "native-fin-product-arrays"
		, variable: "PRODUCT_ARRAY"
		, targets: finProductArrayTargets
		, columns: finProductArrayDispatchColumns
		, observed: finProductArrayDispatchExpected
		, counts: { c: 2015, cpp: 2010, python: 2014, rust: 2010, ruby: 2010, dotnet: 2010, java: 2010, kotlin: 2010, "php-native": 2010, "wit-wasi": 2021, perl: 2013 } }
	, record: { module: "FinRecords"
		, directory: "native-fin-records"
		, variable: "RECORD"
		, targets: finRecordTargets
		, columns: finRecordDispatchColumns
		, observed: finRecordDispatchExpected
		, counts: { c: 2064, cpp: 2053, python: 2053, rust: 2053, ruby: 2053, dotnet: 2053, java: 2053, kotlin: 2053, "php-native": 2053, "wit-wasi": 2056, perl: 2065 } }
};
const profilesOf = group => group === "c-family" ? ["c", "cpp"] : group === "jvm" ? ["java", "kotlin"] : [group.startsWith("perl-") ? "perl" : group];
const fixtureFiles = family => [`${finHostedFamilies[family].module}.lean`, "LICENSE", "lakefile.toml", "lean-toolchain", "package.json"];
const identityKeys = ["bindingIrSha256", "modelSha256", "receiptSha256", "sourceTreeSha256", "consumerSha256"];
const digest = value => assert.match(value, /^[a-f0-9]{64}$/u);
const cleanLog = text => stripVTControlCharacters(text).replace(/^\d{4}-\d\d-\d\dT[\d:.]+Z /gmu, "");
const escape = text => text.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");

/**
 * Enumerate both routes for each fixture and selected interpreter.
 *
 * @param group - Original native CI group.
 */
export const finHostedSelections = group => Object.entries(finHostedFamilies).flatMap(([family, fixture]) =>
	(group === "python" ? ["python", "python312"] : [profilesOf(group).join("-")]).flatMap(suffix =>
		["ordinary", "reviewed"].map(route => ({ group, family, route, suffix
			, member: `${fixture.directory}/${route === "reviewed" ? "reviewed-" : ""}${suffix}.json` }))));

/**
 * Reconstruct the exact generated config and independent review beside original fixture files.
 *
 * @param selection - Selected group, family and route.
 * @param source - Authenticated historical source text reader.
 */
export const finHostedFixture = (selection, source) => {
	const fixture = finHostedFamilies[selection.family], contract = finPythonRubyFamilies[selection.family];
	const inputs = fixtureFiles(selection.family).map(path => ({ path, sha256: sha256(source(`tests/fixtures/onboarding/${fixture.directory}/${path}`)) }));
	const reviewed = selection.route === "reviewed";
	const config = { schemaVersion: 1
		, modules: [fixture.module]
		, ...reviewed ? {} : { exports: Object.keys(contract.refinements) }
		, targets: Object.fromEntries(profilesOf(selection.group).map(profile => fixture.targets[profile])) };
	inputs.push({ path: "lean-bridge.exports.json", sha256: sha256(canonicalJson(config)) });
	if(reviewed) inputs.push({ path: "api.binding-ir.json", sha256: sha256(canonicalJson(contract.review())) });
	inputs.sort((left, right) => left.path.localeCompare(right.path));
	return sha256(inputs.map(input => `${input.sha256}  ${input.path}\n`).join(""));
};

/**
 * Check report schema, exact consumers/trees, package coordinates and measured dispatch only.
 *
 * @param report - Original report parsed from its ZIP member.
 * @param selection - Expected report selection.
 * @param source - Authenticated historical source text reader.
 */
export const assertFinHostedReport = (report, selection, source) => {
	assert.ok(finHostedSelections(selection.group).some(item => canonicalJson(item) === canonicalJson(selection)));
	const fixture = finHostedFamilies[selection.family], contract = finPythonRubyFamilies[selection.family];
	const profiles = profilesOf(selection.group), reviewed = selection.route === "reviewed", archives = {};
	assert.deepEqual(Object.keys(report).sort(), ["archives", "reports", "reproducible", "schemaVersion"]);
	assert.equal(report.schemaVersion, 1); assert.equal(report.reproducible, true);
	assert.deepEqual(report.reports.map(row => row.profile), profiles);
	const tree = finHostedFixture(selection, source);
	for(const row of report.reports)
	{
		const profile = row.profile;
		assert.deepEqual(Object.keys(row).sort(), [...identityKeys, "checks", "compilerFreePath", "offlineInstall", "packages", "path", "profile", "refinements", "sourceRemovedBeforeInstallation", ...reviewed ? ["reviewedSourceSha256"] : [], ...profile === "c" ? ["dispatch"] : []].sort());
		assert.equal(row.path, reviewed ? "reviewed-ir" : "ordinary-source");
		assert.equal(row.checks, fixture.counts[profile]); assert.deepEqual(row.refinements, contract.refinements);
		for(const flag of ["offlineInstall", "compilerFreePath", "sourceRemovedBeforeInstallation"]) assert.equal(row[flag], true);
		for(const key of identityKeys) digest(row[key]);
		assert.equal(row.sourceTreeSha256, tree);
		assert.equal(row.consumerSha256, sha256(source(`tests/fixtures/fin-${selection.family}-consumers/${profile}.${finHostedProfiles[profile]}`)));
		if(reviewed) assert.equal(row.reviewedSourceSha256, sha256(canonicalJson(contract.review())));
		if(profile === "c") assert.deepEqual(row.dispatch, { columns: fixture.columns, observed: fixture.observed, interposer: "LD_PRELOAD", positiveControl: "valid public and raw calls increment source and adapter counts" });
		const [target, coordinate] = fixture.targets[profile], perl = profile === "perl";
		const name = perl ? coordinate.module.replaceAll("::", "-") : coordinate.name;
		assert.equal(row.packages.length, perl ? 2 : 1);
		const runtime = perl ? row.packages[1] : null;
		if(perl) assert.match(runtime.version, /^0\.00\d+$/u);
		for(const [index, pkg] of row.packages.entries())
		{
			const isRuntime = index === 1;
			const version = isRuntime ? runtime.version : coordinate.version, packageName = isRuntime ? "LeanBridge-Runtime" : name;
			assert.deepEqual({ ...pkg, artifacts: undefined }, {
				target
				, ecosystem: target === "php-native" ? "composer" : target
				, name: packageName
				, version
				, profile: "native-library-v1", role: isRuntime ? "runtime" : "component"
				, runtimeDelivery: isRuntime ? "provided" : perl ? "dependency" : "embedded"
				, runtimeIdentity: "4b5a7fdf0cb11d4bb429181cfd50b330c5622ed8f5f5382a293955a439b595b5"
				, requires: perl && !isRuntime ? [{ ecosystem: "cpan", name: "LeanBridge-Runtime", version: runtime.version }] : []
				, artifacts: undefined
			});
			const base = contract.name;
			const paths = { c: [`${base}-1.0.0-c.tar.gz`], cpp: [`${base}-1.0.0-cpp.tar.gz`], python: [`${base}-1.0.0-py3-none-manylinux_2_38_x86_64.whl`], rust: [`${base}-1.0.0.crate`], ruby: [`${base}-1.0.0-x86_64-linux.gem`], dotnet: [`${name}.1.0.0.nupkg`], java: [`${base}-1.0.0.jar`, `${base}-1.0.0.pom`], kotlin: [`${base}-1.0.0.jar`, `${base}-1.0.0.pom`], "php-native": [`example-${base}-1.0.0-linux-x86_64.zip`], "wit-wasi": [`${base}-1.0.0-wit-wasi.tar.gz`], perl: [`${packageName}-${version}.tar.gz`] };
			assert.deepEqual(pkg.artifacts.map(artifact => artifact.path), paths[profile].map(path => `archives/${path}`));
			for(const artifact of pkg.artifacts)
			{
				assert.deepEqual(Object.keys(artifact).sort(), ["bytes", "path", "sha256"]);
				assert.ok(Number.isSafeInteger(artifact.bytes) && artifact.bytes > 0); digest(artifact.sha256);
				if(Object.hasOwn(archives, artifact.path)) assert.equal(archives[artifact.path], artifact.sha256);
				archives[artifact.path] = artifact.sha256;
			}
		}
	}
	assert.deepEqual(report.archives, archives);
};

/**
 * Pair actual ordered commands, required output files and unskipped TAP in the compare step.
 * The two Python processes have equal report bytes but distinct selected interpreters and TAP.
 *
 * @param group - Native CI group.
 * @param log - Original complete hosted job log.
 */
export const assertFinHostedExecution = (group, log) => {
	const clean = cleanLog(log), profiles = profilesOf(group).join(",");
	assert.doesNotMatch(clean, /LEAN_BRIDGE_(?:NATIVE|PERL)_TEST_GLIBC_FLOOR/u);
	const steps = [...clean.matchAll(/^##\[group\]Run [^\n]*\n([\s\S]*?)^##\[endgroup\]$/gmu)];
	const command = fixture => `LEAN_BRIDGE_FIN_${fixture.variable}_PROFILES=${profiles} LEAN_BRIDGE_REVIEWED_FIN_${fixture.variable}_PROFILES=${profiles} node --test tests/${fixture.directory}.test.mjs`;
	const invocationFor = (fixture, secondPython) => (secondPython ? `LEAN_BRIDGE_PYTHON="/opt/hostedtoolcache/Python/3.12.15/x64/bin/python" LEAN_BRIDGE_FIN_${fixture.variable}_REPORT=build/${fixture.directory}/python312.json LEAN_BRIDGE_REVIEWED_FIN_${fixture.variable}_REPORT=build/${fixture.directory}/reviewed-python312.json ` : "") + command(fixture);
	const invocations = Object.values(finHostedFamilies).flatMap(fixture => (group === "python" ? [false, true] : [false]).map(second => invocationFor(fixture, second)));
	const matches = steps.filter(step => step[1].split("\n").includes(command(finHostedFamilies.product)));
	assert.equal(matches.length, 1, `${group}: one actual compare step`);
	const step = matches[0], header = step[1], start = step.index + step[0].length;
	const next = clean.indexOf("\n##[group]", start), output = clean.slice(start, next < 0 ? undefined : next);
	assert.ok(header.includes("\nshell: /usr/bin/bash -e {0}\n"));
	assert.doesNotMatch(header, /^ {2}LEAN_BRIDGE_(?:REVIEWED_)?FIN_(?:PRODUCT|PRODUCT_ARRAY|RECORD)_(?:PROFILES|REPORT):/mu);
	if(group === "python") assert.ok(header.includes("  LEAN_BRIDGE_PYTHON: /opt/hostedtoolcache/Python/3.11.17/x64/bin/python\n"));
	if(group.startsWith("perl-"))
	{
		assert.ok(header.includes(`  CORPUS_PERL_CONFIGURATION: ${group.slice(5)}\n`));
		assert.ok(header.includes('export LEAN_BRIDGE_CORPUS_PERL="$PWD/.toolchains/perl/$CORPUS_PERL_CONFIGURATION/bin/perl"'));
		assert.ok(clean.includes(`\nPerl ${group.slice(5)}\n`));
	}
	let previousCommand = -1, previousTap = -1;
	for(const [family, fixture] of Object.entries(finHostedFamilies))
	{
		const contract = finPythonRubyFamilies[family];
		const taps = [...output.matchAll(/^TAP version 13\n[\s\S]*?^# duration_ms [^\n]+$/gmu)].filter(match => match[0].includes(` - ${contract.ordinary}\n`));
		assert.equal(taps.length, group === "python" ? 2 : 1, `${group}/${family}: real TAP executions`);
		for(const [index, tap] of taps.entries())
		{
			const suffix = index === 1 ? "python312" : profiles.replaceAll(",", "-");
			const invocation = invocationFor(fixture, index === 1);
			assert.equal(header.split("\n").filter(line => line === invocation).length, 1);
			const at = header.indexOf(invocation); assert.ok(at > previousCommand); previousCommand = at;
			const nextInvocation = invocations[invocations.indexOf(invocation) + 1];
			const until = nextInvocation ? header.indexOf(nextInvocation) : header.length;
			assert.ok(tap.index > previousTap); previousTap = tap.index;
			assert.doesNotMatch(tap[0], /^not ok /mu);
			for(const key of ["fail", "cancelled", "todo"]) assert.match(tap[0], new RegExp(`^# ${key} 0$`, "mu"));
			for(const route of ["ordinary", "reviewed"])
			{
				const required = `test -s build/${fixture.directory}/${route === "reviewed" ? "reviewed-" : ""}${suffix}.json`;
				assert.equal(header.split("\n").filter(line => line === required).length, 1);
				const requiredAt = header.indexOf(required);
				assert.ok(requiredAt > at && requiredAt < until, `${required}: checked after its own invocation`);
				const pass = new RegExp(`^ok \\d+ - ${escape(contract[route])}\\n([\\s\\S]*?)(?=^# Subtest:|^1\\.\\.)`, "mu").exec(tap[0]);
				assert.ok(pass, `${group}/${suffix}/${route}: actual unskipped pass`);
				const diagnostics = pass[1].split("\n").filter(line => line.startsWith("# "));
				assert.deepEqual(diagnostics, [`# build 0: ${profiles.replaceAll(",", ", ")}`, ...profilesOf(group).map(profile => `# installing and checking ${profile}`), `# build 1: ${profiles.replaceAll(",", ", ")}`]);
			}
		}
	}
};

/**
 * Verify an archive already authenticated by its fixed receipt digest, or being newly assembled.
 *
 * @param receipt - Archive manifest.
 * @param read - Repository-relative byte reader.
 */
export const assertFinHostedContents = async (receipt, read = readFile) => {
	assert.deepEqual([receipt.schemaVersion, receipt.kind, receipt.revision, receipt.runId], [1, "native-fin-hosted", finHostedRevision, 37969725049]);
	assert.deepEqual(receipt.archive, { path: `${hostedArrayDirectory}/receipt.json`, sha256: hostedArrayReceiptSha256 });
	const archiveBytes = await read(receipt.archive.path); assert.equal(sha256(archiveBytes), receipt.archive.sha256);
	const arrays = JSON.parse(archiveBytes); await assertHostedArrayArchive(arrays, read);
	const texts = new Map();
	for(const item of receipt.sources)
	{
		assert.ok(!texts.has(item.path));
		const bytes = await read(item.archivePath); assert.equal(bytes.length, item.bytes); assert.equal(sha256(bytes), item.sha256);
		texts.set(item.path, bytes.toString("utf8"));
	}
	const source = path => { assert.ok(texts.has(path), path); return texts.get(path); };
	assert.deepEqual(receipt.reports.map(item => item.selection), arrays.groups.flatMap(group => finHostedSelections(group.name)));
	let observations = 0;
	for(const group of arrays.groups)
	{
		const selected = receipt.reports.filter(item => item.selection.group === group.name);
		const zip = await read(`${hostedArrayDirectory}/${group.name}.zip`);
		const members = strictArtifactZipMembers(zip, selected.map(item => item.selection.member));
		assertFinHostedExecution(group.name, (await read(`${hostedArrayDirectory}/job-${group.jobId}.log`)).toString("utf8"));
		for(const item of selected)
		{
			assert.deepEqual([item.jobId, item.artifactId], [group.jobId, group.artifactId]);
			const bytes = await read(item.path); assert.deepEqual(bytes, members.get(item.selection.member));
			assert.equal(bytes.length, item.bytes); assert.equal(sha256(bytes), item.sha256);
			const report = JSON.parse(bytes); assertFinHostedReport(report, item.selection, source);
			assert.deepEqual(item.checks, report.reports.map(row => [row.profile, row.checks]));
			observations += report.reports.length;
		}
	}
	assert.equal(receipt.reports.length, 78); assert.equal(observations, 90);
	return { reports: receipt.reports.length, observations, sources: texts.size };
};

/**
 * Authenticate the fixed receipt before following any supplied file references.
 *
 * @param receipt - Candidate archive manifest.
 * @param read - Repository-relative byte reader, injectable for corruption controls.
 */
export const assertFinHostedArchive = async (receipt, read = readFile) => {
	assert.equal(sha256(canonicalJson(receipt)), finHostedReceiptSha256, "fixed native Fin hosted receipt before reads");
	return assertFinHostedContents(receipt, read);
};
