/**
 * Authenticate local ordinary/reviewed WIT record executions without relabeling hosted failures.
 *
 * @file
 */
import assert from "node:assert/strict";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { finRecordRefinements, finRecordTargets } from "./fin-record-install.mjs";
import { finRecordReviewedIr } from "./reviewed-fin-record-fixture.mjs";

export const finWitRecordDirectory = "docs/evidence/fin-wit-records-20261008";
export const finWitRecordRevision = "738d41764dcaa3f689a628ea18f7c292b2f2e8bd";
export const finWitRecordFixtureFiles = ["FinRecords.lean", "LICENSE", "lakefile.toml", "lean-toolchain", "package.json"];
const fixtureRoot = "tests/fixtures/onboarding/native-fin-records/";
export const finWitRecordConsumer = "tests/fixtures/fin-record-consumers/wit-wasi.c";
export const finWitRecordSourcePaths = [
	"src/analyze/NativeExports.lean"
	, "src/analyze/native-types.mjs"
	, "src/analyze/reviewed-source.mjs"
	, "src/analyze/reviewed-refinements.mjs"
	, "src/analyze/lean-project.mjs"
	, "src/build/native-model.mjs"
	, "src/build/native-c-projection.mjs"
	, "src/build/native-wit-projection.mjs"
	, "src/build/native-wit-artifacts.mjs"
	, "src/backends/native/fin-refinements.mjs"
	, "src/backends/wit/copied-model.mjs"
	, "src/backends/wit/fin-refinements.mjs"
	, "src/backends/wit/copied-host.mjs"
	, "src/backends/wit/copied-component.mjs"
	, "tests/native-fin-records.test.mjs"
	, "tests/helpers/fin-fixture-installed.mjs"
	, "tests/helpers/copied-fixture-install.mjs"
	, "tests/helpers/fin-record-install.mjs"
	, "tests/helpers/reviewed-fin-record-fixture.mjs"
	, ...finWitRecordFixtureFiles.map(path => fixtureRoot + path)
	, finWitRecordConsumer
];
export const finWitRecordRuns = [
	{ id: "ordinary", route: "ordinary-source"
		, reportSha256: "885534859c25d9380b5434eeeabfd051a10fd0d6ad34b1b2d1df713ac73f6910"
		, title: "relocated source-free native packages check Fin inside record fields and the active variant case"
		, pattern: "^relocated source-free native packages check Fin inside record fields" }
	, { id: "reviewed", route: "reviewed-ir"
		, reportSha256: "e9919ffabe7840b17e7ad7723a44e7cd6d2a8df9ecd228ee77b4149aa719a5e5"
		, title: "independently reviewed native packages check record and variant field bounds after source-free installation"
		, pattern: "^independently reviewed native packages check record and variant field bounds" }
];
export const finWitRecordArtifacts = [
	...finWitRecordRuns.map(run => ({ name: `${run.id}.json`
		, originalPath: `build/vo1448-wit-records-738d417-${run.id}.json`
		, sha256: run.reportSha256 }))
	, { name: "execution.tap", originalPath: "build/vo1448-wit-records-738d417.tap"
		, sha256: "771f161a60c7f6da6c42dcc91709b9a8c61fa8a1d3c90f209a5ee0cd7020d269" }
	, { name: "execution.queue"
		, originalPath: "build/vo1448-wit-records-738d417.queue"
		, sha256: "793a1dfbd9db6c9b9583161a21f5b46943389db7800c39a74138f78f23a6ffc2" }
	, { name: "execution.runner.mjs.txt"
		, originalPath: "build/vo1448-wit-records-queue-738d417.mjs"
		, sha256: "dc21a0311702c57a4f2dfdb95502351a9683836dc84b53807c6725364e6576f6" }
	, { name: "canonical-wit-baseline.log"
		, originalPath: "build/vo1448-wit-format-baseline-retry.log"
		, sha256: "b6316e8928404c98dbf3d8bcc766cf14eb53dd5331ae8edc09103121f7b196ac" }
	, { name: "hosted-f9d5ce9-failure.log"
		, originalPath: "build/vo1220-wit-f9d5ce9-failed.log"
		, sha256: "54979a3114c03c40a6d6764cc5a18616cd250c808aa6311b70945f651bf6ec6f" }
];
export const finWitRecordEnvironment = {
	nodeVersion: "v22.23.2", nodeVersionSource: "runner process.version"
	, hostGlibcVersion: "2.36"
	, hostGlibcVersionSource: "runner getconf GNU_LIBC_VERSION"
	, nativeGlibcFloor: "2.36"
	, floorSource: "explicit LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR"
	, leanVersion: "4.32.2", leanCommit: "f3b06c705e6c85f5314019d5d3baab0fec5b580c"
	, leanVersionSource: "runner invoked the selected Lean executable with --version"
	, wasmToolsVersion: "1.245.1", wasmToolsCommit: "76927bf4b"
	, wasmToolsVersionSource: "runner invoked the selected wasm-tools executable with --version"
	, wasmtimeLibrarySha256: "566e57cfeabafd6d44fab1b5e6660b4569a71aae4cff2e4d89563a424ee799f3"
	, wasmtimeLibrarySource: "runner hashed /app/.toolchains/wasmtime42/lib/libwasmtime.so"
	, wasmtimeVersionMeasured: false, versionsPrintedByConsumer: false
	// Limits below are runner configuration, not independently measured process affinity or thread counts.
	, cpu: 3
	, concurrency: 1
	, minimumFreeMiB: 2048
	, leanThreads: 1
	, ompThreads: 1
	, makeJobs: 1
};
export const finWitRecordScope = {
	profiles: ["wit-wasi"]
	, sourcePaths: ["ordinary-source", "reviewed-ir"]
	, family: "record"
	, checksPerRoute: 2056, exports: 13, dispatchObserved: false
	, hostedCi: false, binaryArchivesRetained: false
	, compilerFreePathMeaning: "The consumer PATH excludes Lean and producer tools. Absolute system C compiler/linker paths build the C host caller; wasm-tools validates and prints the installed component before execution."
};
const identityKeys = ["bindingIrSha256", "modelSha256", "receiptSha256", "sourceTreeSha256", "consumerSha256"];

/**
 * Collect identities from a report whose original byte digest has already been authenticated.
 *
 * @param report - Original installed report.
 */
export const finWitRecordIdentities = report => ({
	...Object.fromEntries(identityKeys.map(key => [key, report.reports[0][key]]))
	, packages: report.reports[0].packages
});

/**
 * Rebuild the exact fixture input tree from original source bytes and the independent review.
 *
 * @param route - Ordinary-source or reviewed-ir.
 * @param readSource - Reader that authenticates each selected source's original identity.
 */
export const finWitRecordFixture = async (route, readSource) => {
	assert.ok(finWitRecordRuns.some(run => run.route === route));
	const reviewed = route === "reviewed-ir";
	const inputs = await Promise.all(finWitRecordFixtureFiles.map(async path => ({ path, sha256: sha256(await readSource(fixtureRoot + path)) })));
	const config = { schemaVersion: 1, modules: ["FinRecords"]
		, ...reviewed ? {} : { exports: Object.keys(finRecordRefinements) }
		, targets: Object.fromEntries([finRecordTargets["wit-wasi"]]) };
	inputs.push({ path: "lean-bridge.exports.json", sha256: sha256(canonicalJson(config)) });
	if(reviewed) inputs.push({ path: "api.binding-ir.json", sha256: sha256(canonicalJson(finRecordReviewedIr())) });
	inputs.sort((left, right) => left.path.localeCompare(right.path));
	return { inputs, sha256: sha256(inputs.map(input => `${input.sha256}  ${input.path}\n`).join("")) };
};

/**
 * Check report semantics independently of the pinned byte digest used by the archive loader.
 *
 * @param report - Candidate report, including mutation controls.
 * @param run - Authenticated receipt entry for this source route.
 * @param readSource - Reader of original hash-checked source bytes.
 */
export const assertFinWitRecordReport = async (report, run, readSource) => {
	const expected = finWitRecordRuns.find(item => item.id === run.id);
	assert.ok(expected); assert.equal(run.route, expected.route);
	assert.deepEqual(Object.keys(report).sort(), ["archives", "reports", "reproducible", "schemaVersion"]);
	assert.equal(report.schemaVersion, 1); assert.equal(report.reproducible, true);
	assert.equal(report.reports.length, 1);
	const item = report.reports[0], reviewed = run.route === "reviewed-ir";
	assert.deepEqual(Object.keys(item).sort(), [...identityKeys, "checks", "compilerFreePath", "offlineInstall", "packages", "path", "profile", "refinements", "sourceRemovedBeforeInstallation", ...reviewed ? ["reviewedSourceSha256"] : []].sort());
	assert.equal(item.profile, "wit-wasi"); assert.equal(item.path, run.route); assert.equal(item.checks, 2056);
	assert.deepEqual(item.refinements, finRecordRefinements);
	for(const flag of ["offlineInstall", "compilerFreePath", "sourceRemovedBeforeInstallation"]) assert.equal(item[flag], true, flag);
	for(const key of identityKeys) assert.match(item[key], /^[a-f0-9]{64}$/u, key);
	assert.deepEqual(finWitRecordIdentities(report), run.identities);
	assert.equal(item.consumerSha256, sha256(await readSource(finWitRecordConsumer)));
	assert.deepEqual(run.fixture, await finWitRecordFixture(run.route, readSource));
	assert.equal(item.sourceTreeSha256, run.fixture.sha256);
	if(reviewed) assert.equal(item.reviewedSourceSha256, sha256(canonicalJson(finRecordReviewedIr())));
	assert.equal(item.packages.length, 1);
	const pkg = item.packages[0];
	assert.deepEqual({ ...pkg, artifacts: undefined }, {
		target: "wit-wasi"
		, ecosystem: "wit-wasi"
		, name: "finrecords"
		, version: "1.0.0"
		, profile: "native-library-v1"
		, role: "component"
		, runtimeDelivery: "embedded"
		, requires: []
		, artifacts: undefined
		, runtimeIdentity: "137cb2975ffded21021afe95f6e4cd7d33d6c5d9e605a9e0f28fd950136decdf"
	});
	assert.equal(pkg.artifacts.length, 1);
	const artifact = pkg.artifacts[0];
	assert.equal(artifact.path, "archives/finrecords-1.0.0-wit-wasi.tar.gz");
	assert.ok(Number.isSafeInteger(artifact.bytes) && artifact.bytes > 0);
	assert.match(artifact.sha256, /^[a-f0-9]{64}$/u);
	assert.deepEqual(report.archives, { [artifact.path]: artifact.sha256 });
};

/**
 * Require both actual selected runs, exact runtime observations and successful terminal records.
 *
 * @param queue - Original sequential producer log.
 * @param tap - Original two-selection TAP log.
 */
export const assertFinWitRecordExecution = (queue, tap) => {
	const lines = queue.trimEnd().split("\n");
	assert.equal(lines.length, 13);
	assert.deepEqual(lines.slice(0, 6), [
		`revision=${finWitRecordRevision} node=v22.23.2 cpu=3 concurrency=1`
		, "hostGlibc=glibc 2.36"
		, "lean=Lean (version 4.32.2, x86_64-unknown-linux-gnu, commit f3b06c705e6c85f5314019d5d3baab0fec5b580c, Release)"
		, "wasmTools=wasm-tools 1.245.1 (76927bf4b 2026-02-12)"
		, `wasmtimeLibrary=/app/.toolchains/wasmtime42/lib/libwasmtime.so sha256=${finWitRecordEnvironment.wasmtimeLibrarySha256}`
		, "declaredGlibcFloor=2.36 leanThreads=1 ompThreads=1 makeJobs=1"
	]);
	const sections = tap.split(/^# step /mu);
	assert.equal(sections.shift(), ""); assert.equal(sections.length, 2);
	let previous = 0;
	for(const [index, run] of finWitRecordRuns.entries())
	{
		const begin = /^start (\S+) (\S+) freeMiB=(\d+) pattern=(.+) report=(\S+)$/u.exec(lines[6 + index * 3]);
		const end = /^end (\S+) (\S+) exit=0 freeMiB=(\d+)$/u.exec(lines[7 + index * 3]);
		assert.ok(begin); assert.ok(end);
		assert.equal(begin[1], run.id); assert.equal(end[1], run.id);
		assert.ok(Number(begin[3]) >= 2048); assert.ok(Number(end[3]) >= 2048);
		assert.equal(begin[4], run.pattern);
		assert.equal(begin[5], `/app/build/vo1448-wit-records-738d417-${run.id}.json`);
		assert.ok(Date.parse(begin[2]) >= previous); assert.ok(Date.parse(end[2]) > Date.parse(begin[2]));
		previous = Date.parse(end[2]);
		assert.equal(lines[8 + index * 3], `report ${run.id} sha256=${run.reportSha256} checks=2056`);
		const log = sections[index], entries = log.split("\n");
		assert.equal(entries[0], run.id);
		for(const line of ["TAP version 13", `# Subtest: ${run.title}`, `ok 1 - ${run.title}`, "1..1", "exit=0", "# build 0: wit-wasi", "# installing and checking wit-wasi", "# build 1: wit-wasi"])
			assert.equal(entries.filter(item => item === line).length, 1, line);
		for(const [key, value] of [["tests", 1], ["pass", 1], ["fail", 0], ["cancelled", 0], ["skipped", 0], ["todo", 0]])
			assert.deepEqual(entries.filter(line => line.startsWith(`# ${key} `)), [`# ${key} ${value}`]);
		assert.doesNotMatch(log, /^not ok /mu);
	}
	const finish = /^all steps passed (\S+)$/u.exec(lines[12]);
	assert.ok(finish); assert.ok(Date.parse(finish[1]) >= previous);
};
