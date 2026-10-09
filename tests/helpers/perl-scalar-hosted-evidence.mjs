/**
 * Preserve the four hosted Perl XS configurations' scalar Fin acceptance at 046ced0 (VO #1425): both ordinary and
 * reviewed reports per ABI, from relocated installed trees with real source-counter rows, inside their original
 * GitHub artifacts, jobs and logs. A configured glibc floor is recorded, not a run on a minimum-libc machine.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { stripVTControlCharacters } from "node:util";
import { sha256 } from "../../src/capsule/node.mjs";
import { strictArtifactZipMembers } from "./hosted-specialization-evidence.mjs";

export const perlScalarDirectory = "docs/evidence/perl-scalar-hosted-20261009";
export const perlScalarOriginals = "build/vo1425-perl-scalar-046ced0";
export const perlScalarRevision = "046ced089cd007d10ce91b66a69c461321c808ca";
export const perlScalarRunId = 37897964965;
// The relocation commit every selected report must postdate.
export const perlScalarRelocationFix = "63ae7b1";
/** Each hosted configuration's job and artifact identities, from its capture. */
export const perlScalarConfigurations = Object.freeze([
	{ name: "5.36.3-unthreaded", job: 113713586092, corpus: 11610422596, abi: 11610207539 }
	, { name: "5.36.3-threaded", job: 113713586009, corpus: 11610726080, abi: 11611150841 }
	, { name: "5.38.2-unthreaded", job: 113713586090, corpus: 11611950446, abi: 11611870446 }
	, { name: "5.38.2-threaded", job: 113713586060, corpus: 11607767471, abi: 11607558341 }
]);
/** Producer sources at 046ced0 that select, run and report these tests. */
export const perlScalarSources = Object.freeze({
	"tests/perl-fin.test.mjs": "db9417bcdb8cf599252681d4893fc418ca00f907b38d0772a97cd16171fba0bf"
	, "tests/helpers/perl-relocated-consumer.mjs": "9c9d10cafe51d829958d825defed98344fda692e4002b71c9863109d644c6acb"
	, ".github/workflows/perl-consumer.yml": "9b560a9976cb967ab2d717bcf8cf656ca47d9b11f2e8d89e5b6ad0bfd3d8a5bc"
	, "tests/helpers/copied-fixture-install.mjs": "4b7065d87cfc18be27bdf9a78a8ed1f207b30c528dcd00a44b077e4d21de4227"
	, "tests/helpers/reviewed-scalar-host-fixture.mjs": "88fe947a03cde2c0356e67cc13e875120f3813baf3f5b119a8e4852b8015678c"
	, "tests/fixtures/onboarding/native-fin/NativeFin.lean": "7399d8119ceced0dca35994130e85636025cb2340d7265dff9dd9062e4e17c3b"
	, "src/backends/perl/generate.mjs": "c7ad599484f0afaf3d7f46886635ac7f203d2653a62a36ff46a540ffb4e6af5d"
	, "src/build/native-model.mjs": "aa8cd31583063c8a1d3fdc1aeba71d7cc46aaf21dbe4ff270318d5b646106a13"
	, "src/build/native-project.mjs": "b941e848c291a05a4fab3e93f2d9f5d3a5c9380f9a290c5668378c05ae5b5cf7"
	, "src/release/package-set-receipt.mjs": "d0b945554b03e9d0f93149b12ddf808c33243cbb0ff5495a7a8a68e683fc71ed"
});
const routes = Object.freeze({ ordinary: "ordinary-source", reviewed: "reviewed-ir" });
const testNames = Object.freeze([
	"relocated source-free CPAN packages check Fin bounds before Lean dispatch on every selected ABI"
	, "independently reviewed Perl packages check scalar Fin through installed consumers"
]);
const columns = Object.freeze(["l_NativeFin_mirror", "l_NativeFin_impossible", "l_NativeFin_label"]);
// The four real source-counter rows each relocated consumer must report.
const observed = Object.freeze([["valid-mirror", [1, 0, 0]], ["invalid-only", [0, 0, 0]], ["valid-label", [0, 0, 1]], ["invalid-then-valid", [1, 0, 0]]]);
const consumerSha256 = "a939676bc4bd5d545079a56f70f2160be3b383375aec2471290e7c052f2e5f36";
const members = Object.freeze({
	corpus: { "native-fin/perl.json": "ordinary.json", "native-fin/perl-reviewed.json": "reviewed.json" }
	, abi: configuration => ({ [`${configuration}/acceptance.json`]: "abi-acceptance.json", [`${configuration}/perl.json`]: "abi-perl.json" })
});
const provenance = Object.freeze(["fetched-at.txt", "capture.json", "job.json", "job.log", "corpus-artifact.json", "abi-artifact.json", "corpus.zip", "abi.zip"]);
const extracted = Object.freeze(["ordinary.json", "reviewed.json", "abi-acceptance.json", "abi-perl.json"]);
const archived = name => `${perlScalarDirectory}/${name}`;
const interpreter = name => `/home/runner/work/lean-bridge/lean-bridge/.toolchains/perl/${name}/bin/perl`;
const hash = value => assert.match(value, /^[a-f0-9]{64}$/u);
/**
 * Archive path of one producer source as Git held it at 046ced0.
 *
 * @param path - Repository path.
 */
export const perlScalarSnapshot = path => archived(`sources/046ced0/${path}.txt`);
export const perlScalarPaths = Object.freeze([
	...perlScalarConfigurations.flatMap(configuration => [...provenance, ...extracted].map(name => archived(`${configuration.name}/${name}`)))
	, ...Object.keys(perlScalarSources).map(perlScalarSnapshot)
]);

/**
 * The installed consumer the producer ran: its frozen factory is a template literal without substitutions, so
 * reading it executes nothing.
 *
 * @param test - The archived 046ced0 perl-fin test source.
 */
export const perlScalarConsumer = test => {
	const factory = test.match(/const perlFinConsumer = \(\) => (`[^`]*`);/u);
	assert.ok(factory, "the consumer factory");
	assert.ok(!factory[1].includes("${"), "a literal without substitutions");
	return new Function(`return ${factory[1]};`)();
};

/**
 * Bind both selected tests to a successful job at 046ced0 and its two artifacts.
 *
 * @param configuration - Pinned hosted configuration.
 * @param records - Original capture, job, artifact metadata and log.
 * @param records.capture - Codex's capture record.
 * @param records.job - Original GitHub job metadata.
 * @param records.artifacts - Original corpus and ABI artifact metadata.
 * @param records.log - Full original job log.
 * @param records.zips - Original artifact ZIP bytes by kind.
 */
export const assertPerlScalarExecution = (configuration, { capture, job, artifacts, log, zips }) => {
	assert.deepEqual([capture.revision, capture.run, capture.configuration, capture.job], [perlScalarRevision, perlScalarRunId, configuration.name, configuration.job]);
	assert.deepEqual([job.id, job.run_id, job.head_sha, job.name, job.status, job.conclusion]
		, [configuration.job, perlScalarRunId, perlScalarRevision, `Perl / Perl XS (${configuration.name})`, "completed", "success"]);
	for(const [number, name] of [[9, "Test both install paths on this Perl configuration"], [10, "Compare installed Perl corpus packages with fresh Lean results"], [11, "Verify owned Perl values and installed CPAN archives"]])
	{
		const step = job.steps.find(item => item.name === name);
		assert.deepEqual([step?.number, step?.status, step?.conclusion], [number, "completed", "success"], name);
	}
	assert.deepEqual(capture.artifacts.map(item => item.kind), ["corpus", "abi"]);
	for(const kind of ["corpus", "abi"])
	{
		const artifact = artifacts[kind], record = capture.artifacts.find(item => item.kind === kind), zip = zips[kind];
		assert.deepEqual([artifact.id, artifact.workflow_run.id, artifact.workflow_run.head_sha, artifact.name, record.id]
			, [configuration[kind], perlScalarRunId, perlScalarRevision, `${kind === "corpus" ? "type-corpus-perl" : "perl-abi"}-${configuration.name}-${perlScalarRevision}`, configuration[kind]]);
		assert.deepEqual([artifact.digest, artifact.size_in_bytes, record.sha256, record.bytes], [`sha256:${sha256(zip)}`, zip.length, sha256(zip), zip.length], kind);
	}
	const lines = stripVTControlCharacters(log).split("\n").map(line => line.replace(/^\d{4}-\d\d-\d\dT[\d:.]+Z /u, ""));
	for(const line of [`  CORPUS_PERL_CONFIGURATION: ${configuration.name}`, "LEAN_BRIDGE_PERL_FIN_TEST=1 node --test tests/perl-fin.test.mjs", "test -s build/native-fin/perl.json", "test -s build/native-fin/perl-reviewed.json"])
		assert.ok(lines.some(item => item.trim() === line.trim()), line);
	for(const name of testNames) assert.equal(lines.filter(line => /^ok \d+ - /u.test(line) && line.endsWith(` - ${name}`)).length, 1, name);
	const at = lines.findIndex(line => /^ok \d+ - /u.test(line) && line.endsWith(` - ${testNames[1]}`));
	const next = lines.findIndex((line, index) => index > at && line === "TAP version 13");
	const tail = lines.slice(at, next < 0 ? undefined : next);
	for(const line of ["# tests 9", "# pass 9", "# fail 0", "# cancelled 0", "# skipped 0", "# todo 0"]) assert.ok(tail.includes(line), `${configuration.name}: ${line}`);
	const start = lines.lastIndexOf("TAP version 13", at);
	assert.ok(start >= 0 && !lines.slice(start, next < 0 ? undefined : next).some(line => /^not ok /u.test(line) || / # (?:SKIP|TODO)\b/u.test(line)), "every selected test passed unskipped");
};

/**
 * One route's report: 2024 checks from the exact producer consumer, every installed-tree flag, the four source
 * counter rows and the component's runtime relationship.
 *
 * @param document - Parsed report file.
 * @param route - Route key: ordinary or reviewed.
 * @param configuration - Pinned hosted configuration.
 * @param consumer - The archived producer consumer.
 */
export const assertPerlScalarReport = (document, route, configuration, consumer) => {
	assert.deepEqual([document.schemaVersion, document.reproducible, document.reports.length], [1, true, 1]);
	const report = document.reports[0];
	assert.deepEqual([report.profile, report.path, report.perl, report.checks, report.consumerSha256], ["perl", routes[route], interpreter(configuration.name), 2024, sha256(consumer)]);
	assert.equal(report.consumerSha256, consumerSha256);
	for(const flag of ["offlineInstall", "compilerFreePath", "sourceRemovedBeforeInstallation", "relocatedInstallation", "repeatExecution"]) assert.equal(report[flag], true, flag);
	assert.deepEqual(report.dispatch, { columns: [...columns], interposer: "LD_PRELOAD", observed: observed.map(([row, counts]) => [row, [...counts]]), positiveControl: "valid public calls increment their source count" });
	for(const key of ["bindingIrSha256", "sourceTreeSha256", "modelSha256", "receiptSha256"]) hash(report[key]);
	assert.equal(Object.hasOwn(report, "reviewedSourceSha256"), route === "reviewed");
	if(route === "reviewed") hash(report.reviewedSourceSha256);
	const [component, runtime] = ["component", "runtime"].map(role => report.packages.find(item => item.role === role));
	assert.deepEqual(report.packages.map(item => item.role).sort(), ["component", "runtime"]);
	assert.deepEqual([component.name, runtime.name, component.ecosystem, runtime.ecosystem, runtime.requires], ["LeanBridge-NativeFin", "LeanBridge-Runtime", "cpan", "cpan", []]);
	assert.deepEqual(component.requires, [{ ecosystem: "cpan", name: runtime.name, version: runtime.version }], "the component requires this exact runtime");
	assert.equal(component.runtimeIdentity, runtime.runtimeIdentity);
	assert.deepEqual(document.archives, Object.fromEntries(report.packages.flatMap(pkg => pkg.artifacts.map(artifact => [artifact.path, artifact.sha256]))));
	return report;
};

/**
 * Fixed hosted scope, with every archived identity supplied by the writer.
 *
 * @param files - Exact archived file descriptors.
 */
export const perlScalarReceipt = files => ({ schemaVersion: 1
	, planNode: 1425
	, execution: "hosted"
	, revision: perlScalarRevision
	, runId: perlScalarRunId
	, relocationFix: perlScalarRelocationFix
	, configurations: perlScalarConfigurations
	, scope: {
		profile: "perl"
		, ecosystem: "cpan"
		, routes: Object.values(routes)
		, checks: 2024
		, sourceCounterRows: observed.length
		, selection: "LEAN_BRIDGE_PERL_FIN_TEST=1 node --test tests/perl-fin.test.mjs, nine unskipped tests including both selected routes"
		, relocation: "Each consumer's installed tree moves after its first full run and the unchanged consumer reruns from the moved tree; the source counters run there"
		, glibc: "Each package records its configured glibc 2.38 floor. No run on a minimum-libc machine is claimed"
		, identities: "Model, Binding IR, source-tree and package-set receipt digests are those the reports carry. The full build documents are not present, so they are not recomputed"
		, sources: "Selected producer sources are exact 046ced0 snapshots, which include the 63ae7b1 relocation of scalar consumers"
		, binaryArchivesRetained: false
		, artifactZipsRetained: true
		, supportPromotion: false
	}
	, files });

/**
 * Authenticate every path and byte, then each configuration's execution, ZIP membership and both reports.
 *
 * @param receipt - Parsed, digest-pinned receipt.
 * @param read - Read a repository-relative archived path.
 */
export const assertPerlScalarArchive = async (receipt, read = readFile) => {
	assert.equal(perlScalarConfigurations.length, 4);
	assert.ok(perlScalarConfigurations.every(item => Number.isSafeInteger(item.job) && Number.isSafeInteger(item.corpus) && Number.isSafeInteger(item.abi)), "all four configurations are captured");
	assert.deepEqual(receipt, perlScalarReceipt(receipt.files));
	assert.deepEqual(receipt.files.map(item => item.path), perlScalarPaths, "exact ordered archive paths");
	const files = new Map();
	for(const file of receipt.files)
	{
		assert.deepEqual(Object.keys(file).sort(), ["bytes", "originalPath", "path", "sha256"]);
		const path = file.path.slice(perlScalarDirectory.length + 1);
		const [configuration, name] = path.split("/");
		const zip = Object.entries({ corpus: members.corpus, abi: members.abi(configuration) }).find(([, map]) => Object.values(map).includes(name));
		const originalPath = path.startsWith("sources/") ? `git:${perlScalarRevision}:${path.slice("sources/046ced0/".length, -".txt".length)}`
			: zip ? `${perlScalarOriginals}/${configuration}/${zip[0]}.zip!${Object.keys(zip[1]).find(member => zip[1][member] === name)}` : `${perlScalarOriginals}/${configuration}/${name}`;
		assert.equal(file.originalPath, originalPath, file.path);
		const bytes = await read(file.path); assert.ok(Buffer.isBuffer(bytes));
		assert.equal(bytes.length, file.bytes, file.path); assert.equal(sha256(bytes), file.sha256, file.path);
		if(path.startsWith("sources/")) assert.equal(file.sha256, perlScalarSources[path.slice("sources/046ced0/".length, -".txt".length)], file.path);
		files.set(path, bytes);
	}
	const source = path => files.get(`sources/046ced0/${path}.txt`).toString("utf8");
	const test = source("tests/perl-fin.test.mjs");
	assert.ok(test.includes("const moved = await relocatePerlConsumer(") && test.includes("relocatedInstallation: moved.relocatedInstallation"), "the 63ae7b1 relocation");
	const consumer = perlScalarConsumer(test);
	const contexts = new Set(), runs = [];
	for(const configuration of perlScalarConfigurations)
	{
		const get = name => files.get(`${configuration.name}/${name}`), json = name => JSON.parse(get(name));
		assert.match(get("fetched-at.txt").toString("utf8"), /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z\n?$/u);
		const capture = json("capture.json"), zips = { corpus: get("corpus.zip"), abi: get("abi.zip") };
		assert.deepEqual([capture.jobSha256, capture.logSha256], [sha256(get("job.json")), sha256(get("job.log"))]);
		assertPerlScalarExecution(configuration, { capture, job: json("job.json"), artifacts: { corpus: json("corpus-artifact.json"), abi: json("abi-artifact.json") }, log: get("job.log").toString("utf8"), zips });
		// Each extracted report is the CRC-checked member of its strictly read original ZIP.
		for(const [kind, map] of [["corpus", members.corpus], ["abi", members.abi(configuration.name)]])
		{
			const found = strictArtifactZipMembers(zips[kind], Object.keys(map));
			const record = capture.artifacts.find(item => item.kind === kind);
			assert.deepEqual(record.reports.map(item => [item.member, item.path]), Object.entries(map));
			for(const [member, name] of Object.entries(map))
			{
				assert.ok(found.get(member).equals(get(name)), `${configuration.name}/${name} is its ZIP member`);
				assert.deepEqual([record.reports.find(item => item.member === member).sha256, record.reports.find(item => item.member === member).bytes], [sha256(get(name)), get(name).length]);
			}
		}
		const context = json("abi-acceptance.json");
		assert.deepEqual([context.schemaVersion, context.perl, context.glibcMinimumVersion], [1, interpreter(configuration.name), "2.38"]);
		hash(context.nativeLibrarySha256);
		const fingerprint = context.packages[0].abiVariants[0]; hash(fingerprint);
		assert.ok(!contexts.has(fingerprint), "four distinct base ABI contexts"); contexts.add(fingerprint);
		for(const pkg of context.packages) assert.deepEqual([pkg.abiVariants, pkg.compilerAccess, pkg.runtimeIdentity], [[fingerprint], false, context.packages[0].runtimeIdentity]);
		for(const route of Object.keys(routes))
		{
			const report = assertPerlScalarReport(json(`${route}.json`), route, configuration, consumer);
			runs.push([configuration.name, report.path, report.checks]);
		}
	}
	return { runs };
};

/**
 * Keep original bytes once; never overwrite a different artifact or receipt.
 *
 * @param path - Exact destination.
 * @param bytes - Original bytes to retain.
 */
export const writePerlScalarArtifact = async (path, bytes) => {
	await mkdir(dirname(path), { recursive: true });
	try
	{ await writeFile(path, bytes, { flag: "wx" }); }
	catch(error)
	{
		if(error.code !== "EEXIST") throw error;
		assert.ok((await readFile(path)).equals(bytes), `${path} already holds different bytes`);
	}
};
