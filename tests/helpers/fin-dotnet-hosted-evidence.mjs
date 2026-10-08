/**
 * Authenticate the hosted .NET product, array and field executions of run 37736101772 (#1441/#1442).
 *
 * @file
 */
import assert from "node:assert/strict";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { finPythonRubyFamilies } from "./fin-python-ruby-evidence.mjs";
import { finProductTargets } from "./fin-product-install.mjs";
import { finProductArrayTargets } from "./fin-product-array-install.mjs";
import { finRecordTargets } from "./fin-record-install.mjs";

export const finDotnetDirectory = "docs/evidence/fin-dotnet-hosted-20261008";
export const finDotnetRevision = "f9d5ce96eb04ec800209c6a6863092b3bdea6e85";
export const finDotnetHosted = Object.freeze({
	runId: 37736101772, jobId: 113176414688, jobName: "Managed consumer (dotnet)"
	, artifactId: 11538793507
	, artifactName: `type-corpus-dotnet-${finDotnetRevision}`
	, artifactBytes: 1044597
	, artifactSha256: "11ebf1c453875bb0706b89babf0aca2b9cebf3d90f05243f51625f06249bd02d"
	, artifactPath: `build/vo1220-hosted-fin-f9d5ce9/zips/type-corpus-dotnet-${finDotnetRevision}.zip` });
export const finDotnetChecks = Object.freeze({ product: 2039, "product-array": 2010, record: 2053 });
const families = {
	product: { directory: "native-fin-products", root: "tests/fixtures/onboarding/native-fin-products/", module: "FinProducts", targets: finProductTargets }
	, "product-array": { directory: "native-fin-product-arrays", root: "tests/fixtures/onboarding/native-fin-product-arrays/", module: "FinProductArrays", targets: finProductArrayTargets }
	, record: { directory: "native-fin-records", root: "tests/fixtures/onboarding/native-fin-records/", module: "FinRecords", targets: finRecordTargets } };
export const finDotnetRuns = Object.freeze([
	["product", "ordinary", "083b184e5366759b010418e033253a01682d0dbb6846cf1f3a7f00dc9867e233"]
	, ["product", "reviewed", "f6f02915df66747a653ee0dcfa95551ed5006df33a671adc80bea0137ba5224c"]
	, ["product-array", "ordinary", "a44c6e393b6297f6af133bc9bd28fefb8a18491e3d703ba80f347c60b6791097"]
	, ["product-array", "reviewed", "065c130c2a13f19c4389db7aaf37627b411785d16113e223382858c72dea481e"]
	, ["record", "ordinary", "e7958865994be626479401be69f704223bd9622db7f5d4f00591cd36c78a8e52"]
	, ["record", "reviewed", "e576bccc33b4e4e9749bcc9e6d0c5a48d144959c2c1d74593831a83163eb5a44"]
].map(([family, route, reportSha256]) => {
	const member = `${families[family].directory}/${route === "reviewed" ? "reviewed-" : ""}dotnet.json`;
	return { id: `${family}-${route}`, family, route, reportSha256, member };
}));
const hostedRoot = "build/vo1220-hosted-fin-f9d5ce9";
const provenanceFile = (name, directory, sha256) => ({ name, originalPath: `${hostedRoot}/${directory}/${name}`, sha256 });
export const finDotnetProvenance = Object.freeze({
	log: provenanceFile("job-113176414688.log", "logs", "7f3fb1f343d8662152ae4677314b093be300a7fc1f15bd4efa5fb78d245fb9d4")
	, job: provenanceFile("job-113176414688.json", "metadata", "e1606595535cb1e74bb0d90f2a64b4d7f61f490454beabd93c462c4f597c4341")
	, artifact: provenanceFile("artifact-11538793507.json", "metadata", "8faf77d477f88b777a6a70af56912bc1fbd813bda8f064ee3a78823478872329") });
const fixtureFiles = family => [`${families[family].module}.lean`, "LICENSE", "lakefile.toml", "lean-toolchain", "package.json"];
export const finDotnetSourcePaths = [
	"src/analyze/NativeExports.lean"
	, "src/analyze/native-types.mjs"
	, "src/analyze/reviewed-source.mjs"
	, "src/analyze/reviewed-refinements.mjs"
	, "src/analyze/lean-project.mjs"
	, "src/build/native-model.mjs"
	, "src/build/native-c-projection.mjs"
	, "src/build/native-dotnet-projection.mjs"
	, "src/build/native-dotnet-artifacts.mjs"
	, "src/backends/c/native-copied-values.mjs"
	, "src/backends/native/fin-refinements.mjs"
	, "src/backends/dotnet/copied-values.mjs"
	, "src/backends/dotnet/generate.mjs"
	, "src/release/native-nuget.mjs"
	, "tests/native-fin-products.test.mjs"
	, "tests/native-fin-product-arrays.test.mjs"
	, "tests/native-fin-records.test.mjs"
	, "tests/helpers/copied-fixture-install.mjs"
	, "tests/helpers/fin-fixture-installed.mjs"
	, "tests/helpers/fin-product-install.mjs"
	, "tests/helpers/fin-product-array-install.mjs"
	, "tests/helpers/fin-record-install.mjs"
	, "tests/helpers/reviewed-fin-product-fixture.mjs"
	, "tests/helpers/reviewed-fin-product-array-fixture.mjs"
	, "tests/helpers/reviewed-fin-record-fixture.mjs"
	, ".github/workflows/consumer-matrix.yml"
	, ...Object.keys(families).flatMap(family => fixtureFiles(family).map(path => families[family].root + path))
	, ...Object.keys(families).map(family => `tests/fixtures/fin-${family}-consumers/dotnet.cs`)
];
const identityKeys = ["bindingIrSha256", "modelSha256", "receiptSha256", "sourceTreeSha256", "consumerSha256"];

/**
 * Rebuild one run's analyzed source tree from original fixture bytes and the inputs the harness generated.
 *
 * @param family - Key of the fixture families: product, product-array or record.
 * @param route - "ordinary" or "reviewed".
 * @param readSource - Reader of original, hash-checked source bytes by repository path.
 */
export const finDotnetFixture = async (family, route, readSource) => {
	const fixture = families[family], reviewed = route === "reviewed";
	assert.ok(fixture && ["ordinary", "reviewed"].includes(route));
	const inputs = await Promise.all(fixtureFiles(family).map(async path => ({ path, sha256: sha256(await readSource(fixture.root + path)) })));
	const config = { schemaVersion: 1, modules: [fixture.module]
		, ...reviewed ? {} : { exports: Object.keys(finPythonRubyFamilies[family].refinements) }
		, targets: Object.fromEntries([fixture.targets.dotnet]) };
	inputs.push({ path: "lean-bridge.exports.json", sha256: sha256(canonicalJson(config)) });
	if(reviewed) inputs.push({ path: "api.binding-ir.json", sha256: sha256(canonicalJson(finPythonRubyFamilies[family].review())) });
	inputs.sort((left, right) => left.path.localeCompare(right.path));
	return { inputs, sha256: sha256(inputs.map(input => `${input.sha256}  ${input.path}\n`).join("")) };
};

/**
 * Collect the immutable package and model identities in an already hash-checked original.
 *
 * @param report - Original installed consumer report.
 */
export const finDotnetIdentities = report => {
	const item = report.reports[0];
	return { ...Object.fromEntries(identityKeys.map(key => [key, item[key]])), packages: item.packages };
};

/**
 * Validate one hosted report's fixture, route, counts, caller, rebuilt tree and pinned package identities.
 *
 * @param report - Candidate installed report.
 * @param run - Expected family, route and identities from the authenticated archive receipt.
 * @param readSource - Reader of original, hash-checked source bytes by repository path.
 */
export const assertFinDotnetReport = async (report, run, readSource) => {
	const family = finPythonRubyFamilies[run.family], fixture = families[run.family], reviewed = run.route === "reviewed";
	assert.ok(family && fixture && ["ordinary", "reviewed"].includes(run.route));
	assert.deepEqual(Object.keys(report).sort(), ["archives", "reports", "reproducible", "schemaVersion"]);
	assert.equal(report.schemaVersion, 1); assert.equal(report.reproducible, true);
	assert.deepEqual(report.reports.map(item => item.profile), ["dotnet"]);
	const item = report.reports[0];
	// An exact key set leaves no room for a dispatch or measurement claim.
	assert.deepEqual(Object.keys(item).sort(), [...identityKeys, "checks", "compilerFreePath", "offlineInstall", "packages", "path", "profile", "refinements", "sourceRemovedBeforeInstallation", ...reviewed ? ["reviewedSourceSha256"] : []].sort());
	assert.equal(item.path, reviewed ? "reviewed-ir" : "ordinary-source");
	assert.equal(item.checks, finDotnetChecks[run.family]);
	assert.deepEqual(item.refinements, family.refinements);
	for(const flag of ["offlineInstall", "compilerFreePath", "sourceRemovedBeforeInstallation"]) assert.equal(item[flag], true, flag);
	for(const key of identityKeys) assert.match(item[key], /^[a-f0-9]{64}$/u, key);
	assert.deepEqual(finDotnetIdentities(report), run.identities);
	assert.equal(item.consumerSha256, sha256(await readSource(`tests/fixtures/fin-${run.family}-consumers/dotnet.cs`)), "caller");
	assert.equal(item.sourceTreeSha256, (await finDotnetFixture(run.family, run.route, readSource)).sha256, "source tree");
	if(reviewed) assert.equal(item.reviewedSourceSha256, sha256(canonicalJson(family.review())));
	assert.equal(item.packages.length, 1);
	const pkg = item.packages[0], name = `${fixture.module}.Api`;
	assert.deepEqual({ ...pkg, artifacts: undefined }, {
		target: "nuget", ecosystem: "nuget", name, version: "1.0.0"
		, profile: "native-library-v1", role: "component"
		, runtimeDelivery: "embedded", requires: [], artifacts: undefined
		, runtimeIdentity: "4b5a7fdf0cb11d4bb429181cfd50b330c5622ed8f5f5382a293955a439b595b5"
	});
	assert.equal(pkg.artifacts.length, 1);
	const artifact = pkg.artifacts[0];
	assert.equal(artifact.path, `archives/${name}.1.0.0.nupkg`);
	assert.ok(Number.isSafeInteger(artifact.bytes) && artifact.bytes > 0);
	assert.match(artifact.sha256, /^[a-f0-9]{64}$/u);
	assert.deepEqual(report.archives, { [artifact.path]: artifact.sha256 });
};

const titles = {
	product: ["relocated source-free native packages check Fin inside products and the active Except branch"
		, "independently reviewed native packages check product and Except bounds after source-free installation"
		, "the independent product review passes reviewed admission, and changed bounds are refused against fresh Lean"]
	, "product-array": ["relocated source-free native packages check Fin inside every element of an array of products"
		, "independently reviewed native packages check array-of-product bounds after source-free installation"
		, "changed array-of-product reviews are refused against fresh Lean before any output"]
	, record: ["relocated source-free native packages check Fin inside record fields and the active variant case"
		, "independently reviewed native packages check record and variant field bounds after source-free installation"
		, "changed record and variant reviews are refused against fresh Lean before any output"] };
const summaries = { product: 27, "product-array": 13, record: 27 };

/**
 * Validate the completed job's metadata and the original log's tools and Fin selections.
 *
 * @param job - GitHub job metadata.
 * @param artifact - GitHub artifact metadata.
 * @param log - Original job log.
 */
export const assertFinDotnetExecution = (job, artifact, log) => {
	assert.deepEqual([job.id, job.run_id, job.head_sha, job.name, job.status, job.conclusion]
		, [finDotnetHosted.jobId, finDotnetHosted.runId, finDotnetRevision, finDotnetHosted.jobName, "completed", "success"]);
	const step = job.steps.find(item => item.number === 15);
	assert.deepEqual([step.name, step.status, step.conclusion], ["Compare installed NuGet corpus packages with fresh Lean results", "completed", "success"]);
	assert.equal(job.steps.find(item => item.number === 16).conclusion, "success");
	const observed = [artifact.id, artifact.name, artifact.size_in_bytes
		, artifact.digest, artifact.workflow_run.id, artifact.workflow_run.head_sha];
	const { artifactId, artifactName, artifactBytes, artifactSha256, runId } = finDotnetHosted;
	const expected = [artifactId, artifactName, artifactBytes
		, `sha256:${artifactSha256}`, runId, finDotnetRevision];
	assert.deepEqual(observed, expected);
	const lines = log.split("\n").map(line => line.replace(/^\d{4}-\d\d-\d\dT[\d:.]+Z /u, ""));
	const index = (text, from = 0) => { const at = lines.indexOf(text, from); assert.ok(at >= 0, text); return at; };
	// Versions printed by the hosted run, as opposed to inputs it was configured with.
	const printed = ["Image: ubuntu-24.04", "Version: 20260927.320.1"
		, "Found in cache @ /opt/hostedtoolcache/node/22.23.3/x64"
		, "leanprover/lean4:v4.32.2 installed - Lean (version 4.32.2, x86_64-unknown-linux-gnu, commit f3b06c705e6c85f5314019d5d3baab0fec5b580c, Release)"
		, "dotnet-install: Installed version is 8.0.424"
		, "ruby 3.3.12 (2026-07-16 revision 0581089df9) [x86_64-linux]"];
	for(const text of printed) index(text);
	// No floor override appears, so the packages carry the default declared minimum; host glibc is never printed.
	assert.ok(!log.includes("LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR"));
	assert.ok(!/GLIBC|getconf GNU_LIBC_VERSION|ldd \(/u.test(log));
	let previous = 0;
	for(const family of Object.keys(families))
	{
		const [ordinary, reviewed, skipped] = titles[family];
		const variable = { product: "PRODUCT", "product-array": "PRODUCT_ARRAY", record: "RECORD" }[family];
		index(`\u001b[36;1mLEAN_BRIDGE_FIN_${variable}_PROFILES=dotnet LEAN_BRIDGE_REVIEWED_FIN_${variable}_PROFILES=dotnet node --test tests/${families[family].directory}.test.mjs\u001b[0m`);
		const first = lines.findIndex((line, at) => at > previous && new RegExp(`^ok \\d+ - ${ordinary.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")}$`, "u").test(line));
		assert.ok(first > previous, ordinary);
		const second = lines.findIndex((line, at) => at > first && line.endsWith(` - ${reviewed}`));
		assert.ok(second > first && lines[second].startsWith("ok "), reviewed);
		for(const at of [first, second])
			assert.deepEqual(lines.slice(at + 5, at + 8), ["# build 0: dotnet", "# installing and checking dotnet", "# build 1: dotnet"], `${family} diagnostics`);
		assert.match(lines[second + 9] ?? "", new RegExp(`^ok \\d+ - ${skipped.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")} # SKIP$`, "u"), `${family} only skipped Lean-gated review refusal`);
		const summary = index(`# tests ${summaries[family]}`, second);
		assert.deepEqual(lines.slice(summary, summary + 7).filter(line => !line.startsWith("# suites")), [`# tests ${summaries[family]}`, `# pass ${summaries[family] - 1}`, "# fail 0", "# cancelled 0", "# skipped 1", "# todo 0"], family);
		assert.ok(!lines.slice(previous, summary).some(line => line.startsWith("not ok ")), family);
		previous = summary;
	}
};
