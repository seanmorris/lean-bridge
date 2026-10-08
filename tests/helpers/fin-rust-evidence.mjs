/**
 * Authenticate the local Rust product, array and field executions (#1441/#1442).
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { beforeFinRefinementSource } from "./fin-refinement-source-history.mjs";
import { finPythonRubyFamilies } from "./fin-python-ruby-evidence.mjs";
import { finProductTargets } from "./fin-product-install.mjs";
import { finProductArrayTargets } from "./fin-product-array-install.mjs";
import { finRecordTargets } from "./fin-record-install.mjs";

export const finRustDirectory = "docs/evidence/fin-rust-20261008";
export const finRustRevision = "78a4d3da45754f3e425faafdadc9e959cee65bc5";
// The Rust consumer runs the same fixtures and assertions as the other native hosts.
export const finRustChecks = Object.freeze({ product: 2039, "product-array": 2010, record: 2053 });
export const finRustSteps = Object.keys(finPythonRubyFamilies).flatMap(family =>
	["ordinary", "reviewed"].map(route => ({ id: `${family}-${route}`, family, route })));
export const finRustRuntime = Object.freeze({
	id: "rust190", profile: "rust"
	, reports: ["0b03b8d917018933f947372d0e7cb7e391a55df2c373c380859ed43bf3877709"
		, "e59a8fab193d7b4bb9ae63e7d30faa67843e99718a9cbeebb2eb97a903b38b6e"
		, "1295e9288b6ebc2b9e5ee86ab0e342d68be4a1234cbce6761c7fa085ae44b232"
		, "a9f938ef745033df114ddd35b7f89a67f9be3bbfc3cceba580c7a084f17c4113"
		, "bc3ac9eecd57100e52ffd27cd6acc932f1646208d1d959331779df719983d297"
		, "31964c8c3a4534cad7fb9a3bb7560a440bb80ceed0194d5ece8726d6eb90852a"]
	, tap: "add05b3f44d246a6673e604e6c7878a008b93a5f83ae474d901ff5c665a6ecaf"
	, queue: "260bc81f036e57f232e9566e6667ef42fe328000a4567c3c098a3afac4de3e02"
	, runner: "ecef73d33964fead60311b769461ad9ae72c0f2871ea44262172549da6a8e0a7" });
// Versions the runner measured with --version on the configured executables before any selection.
export const finRustMeasured = Object.freeze({
	node: "v22.23.3"
	, cargo: "cargo 1.90.0 (840b83a10 2025-07-30)"
	, rustc: "rustc 1.90.0 (1159e78c4 2025-09-14)"
	, lean: "Lean (version 4.32.2, x86_64-unknown-linux-gnu, commit f3b06c705e6c85f5314019d5d3baab0fec5b580c, Release)"
	, glibc: "ldd (Debian GLIBC 2.36-9+deb12u14) 2.36"
	, cc: "cc (Debian 12.2.0-14+deb12u1) 12.2.0" });
// Each fixture's tracked inputs; the runner added lean-bridge.exports.json and, for reviewed runs, api.binding-ir.json.
export const finRustFixtures = Object.freeze({
	product: { root: "tests/fixtures/onboarding/native-fin-products/", module: "FinProducts", targets: finProductTargets }
	, "product-array": { root: "tests/fixtures/onboarding/native-fin-product-arrays/", module: "FinProductArrays", targets: finProductArrayTargets }
	, record: { root: "tests/fixtures/onboarding/native-fin-records/", module: "FinRecords", targets: finRecordTargets } });
const fixtureFiles = family => [`${finRustFixtures[family].module}.lean`, "LICENSE", "lakefile.toml", "lean-toolchain", "package.json"];
export const finRustSourcePaths = [
	"src/analyze/NativeExports.lean"
	, "src/analyze/native-types.mjs"
	, "src/analyze/reviewed-source.mjs"
	, "src/analyze/reviewed-refinements.mjs"
	, "src/analyze/lean-project.mjs"
	, "src/build/native-model.mjs"
	, "src/build/native-c-projection.mjs"
	, "src/build/native-rust-projection.mjs"
	, "src/build/native-rust-artifacts.mjs"
	, "src/backends/c/native-copied-values.mjs"
	, "src/backends/native/fin-refinements.mjs"
	, "src/backends/rust/copied-values.mjs"
	, "src/backends/rust/generate.mjs"
	, "src/backends/rust/dependencies.lock"
	, "src/release/native-cargo.mjs"
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
	, ...Object.keys(finRustFixtures).flatMap(family => fixtureFiles(family).map(path => finRustFixtures[family].root + path))
	, ...Object.keys(finRustChecks).map(family => `tests/fixtures/fin-${family}-consumers/rust.rs`)
];
const identityKeys = ["bindingIrSha256", "modelSha256", "receiptSha256", "sourceTreeSha256", "consumerSha256"];

/**
 * Rebuild one run's analyzed source tree from the fixture bytes and the inputs its runner generated,
 * using the source-tree formula of src/analyze/lean-project.mjs.
 *
 * @param family - Key of finRustFixtures: product, product-array or record.
 * @param route - "ordinary" or "reviewed".
 * @param readSource - Reader of original, hash-checked source bytes by repository path.
 */
export const finRustFixture = async (family, route, readSource) => {
	const fixture = finRustFixtures[family], reviewed = route === "reviewed";
	assert.ok(fixture && ["ordinary", "reviewed"].includes(route));
	const inputs = await Promise.all(fixtureFiles(family).map(async path => ({ path, sha256: sha256(await readSource(fixture.root + path)) })));
	const config = { schemaVersion: 1, modules: [fixture.module]
		, ...reviewed ? {} : { exports: Object.keys(finPythonRubyFamilies[family].refinements) }
		, targets: Object.fromEntries([fixture.targets.rust]) };
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
export const finRustIdentities = report => {
	const item = report.reports[0];
	return { ...Object.fromEntries(identityKeys.map(key => [key, item[key]])), packages: item.packages };
};

/**
 * Validate the report's independent fixture, route, exact counts and pinned package identities.
 *
 * @param report - Candidate installed report.
 * @param run - Expected route and identities from the authenticated archive receipt.
 * @param readSource - Reader of original, hash-checked source bytes by repository path.
 */
export const assertFinRustReport = async (report, run, readSource) => {
	const family = finPythonRubyFamilies[run.family];
	assert.ok(family);
	assert.ok(["ordinary", "reviewed"].includes(run.route));
	assert.equal(run.profile, "rust");
	assert.equal(report.schemaVersion, 1);
	assert.equal(report.reproducible, true);
	assert.deepEqual(report.reports.map(item => item.profile), ["rust"]);
	assert.equal(Object.hasOwn(report, "dispatch"), false);
	const item = report.reports[0];
	assert.equal(item.path, run.route === "reviewed" ? "reviewed-ir" : "ordinary-source");
	assert.equal(item.checks, finRustChecks[run.family]);
	assert.deepEqual(item.refinements, family.refinements);
	for(const flag of ["offlineInstall", "compilerFreePath", "sourceRemovedBeforeInstallation"])
		assert.equal(item[flag], true, flag);
	assert.equal(Object.hasOwn(item, "dispatch"), false, "No dispatch was measured for these Rust reports");
	for(const key of identityKeys) assert.match(item[key], /^[a-f0-9]{64}$/u, key);
	assert.deepEqual(finRustIdentities(report), run.identities);
	// The analyzed tree is rebuilt independently, not only compared with the report's own value.
	assert.equal(item.sourceTreeSha256, (await finRustFixture(run.family, run.route, readSource)).sha256, "source tree");
	const consumer = `tests/fixtures/fin-${run.family}-consumers/rust.rs`;
	assert.equal(sha256(beforeFinRefinementSource(consumer, await readFile(consumer), item.consumerSha256)), item.consumerSha256);
	if(run.route === "reviewed") assert.equal(item.reviewedSourceSha256, sha256(canonicalJson(family.review())));
	else assert.equal(Object.hasOwn(item, "reviewedSourceSha256"), false);
	assert.equal(item.packages.length, 1);
	const pkg = item.packages[0];
	assert.deepEqual({ ...pkg, artifacts: undefined }, {
		target: "cargo", ecosystem: "cargo", name: family.name, version: "1.0.0"
		, profile: "native-library-v1", role: "component"
		, runtimeDelivery: "embedded", requires: [], artifacts: undefined
		, runtimeIdentity: "137cb2975ffded21021afe95f6e4cd7d33d6c5d9e605a9e0f28fd950136decdf"
	});
	assert.equal(pkg.artifacts.length, 1);
	const artifact = pkg.artifacts[0];
	assert.equal(artifact.path, `archives/${family.name}-1.0.0.crate`);
	assert.ok(Number.isSafeInteger(artifact.bytes) && artifact.bytes > 0);
	assert.match(artifact.sha256, /^[a-f0-9]{64}$/u);
	assert.deepEqual(report.archives, { [artifact.path]: artifact.sha256 });
};

const timestamp = "(\\d{4}-\\d\\d-\\d\\dT\\d\\d:\\d\\d:\\d\\d\\.\\d{3}Z)";
const families = { product: ["PRODUCT", "native-fin-products"], "product-array": ["PRODUCT_ARRAY", "native-fin-product-arrays"], record: ["RECORD", "native-fin-records"] };

/**
 * Validate the Rust runner's measured tools, configured environment and six sequential selections.
 *
 * @param queue - Original sequential execution log.
 * @param tap - Six original TAP documents in execution order.
 */
export const assertFinRustExecution = (queue, tap) => {
	const lines = queue.trimEnd().split("\n");
	assert.equal(lines.length, 23);
	assert.equal(lines[0], `revision=${finRustRevision} cwd=/app/build/worktrees/checked-records-vo1220 runner=/app/build/vo1441-rust-queue-78a4d3d.mjs`);
	const measured = finRustMeasured;
	assert.equal(lines[1], `node=${measured.node} cargo=${measured.cargo} rustc=${measured.rustc} lean=${measured.lean} glibc=${measured.glibc} cc=${measured.cc}`);
	assert.equal(lines[2], "env LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR=2.36 LEAN_BRIDGE_CARGO=/app/.toolchains/rust-1.90.0/bin/cargo LEAN_BRIDGE_RUSTC=/app/.toolchains/rust-1.90.0/bin/rustc LEAN_BRIDGE_LEAN_PREFIX=/app/.toolchains/elan/toolchains/leanprover--lean4---v4.32.2 LEAN_NUM_THREADS=1 OMP_NUM_THREADS=1 MAKEFLAGS=-j1; all inherited LEAN_BRIDGE_* removed; cpu=3 concurrency=1");
	const start = new RegExp(`^start=${timestamp} freeMiB=(\\d+)$`, "u").exec(lines[3]);
	assert.ok(start); assert.ok(Number(start[2]) >= 2048);
	let previous = Date.parse(start[1]);
	const sections = tap.split(/^# step /mu);
	assert.equal(sections.shift(), ""); assert.equal(sections.length, 6);
	for(const [index, step] of finRustSteps.entries())
	{
		const family = finPythonRubyFamilies[step.family], [variable, file] = families[step.family];
		const selected = `LEAN_BRIDGE_${step.route === "reviewed" ? "REVIEWED_" : ""}FIN_${variable}`;
		const report = `/app/build/vo1441-rust-${step.id}-78a4d3d.json`;
		const begin = new RegExp(`^start ${step.id} ${timestamp} freeMiB=(\\d+) file=tests/${file}\\.test\\.mjs pattern=\\^(.+) ${selected}_PROFILES=rust ${selected}_REPORT=${report}$`, "u").exec(lines[4 + index * 3]);
		const end = new RegExp(`^end ${step.id} ${timestamp} exit=0 pass=1 fail=0 skipped=0 freeMiB=(\\d+)$`, "u").exec(lines[5 + index * 3]);
		assert.ok(begin, step.id); assert.ok(end, step.id);
		assert.ok(Number(begin[2]) >= 2048 && Number(end[2]) >= 2048);
		assert.ok(family[step.route].startsWith(begin[3]), step.id);
		assert.ok(Date.parse(begin[1]) >= previous); assert.ok(Date.parse(end[1]) > Date.parse(begin[1]));
		previous = Date.parse(end[1]);
		assert.equal(lines[6 + index * 3], `report ${step.id} sha256=${finRustRuntime.reports[index]} checks=${finRustChecks[step.family]} dispatch=null`);
		const log = sections[index];
		assert.equal(log.split("\n")[0], step.id);
		assert.ok(log.includes(`ok 1 - ${family[step.route]}\n`));
		for(const line of ["TAP version 13", "1..1", "exit=0", "# build 0: rust", "# installing and checking rust", "# build 1: rust"])
			assert.equal(log.split("\n").filter(item => item === line).length, 1, line);
		for(const [key, value] of [["tests", 1], ["pass", 1], ["fail", 0], ["cancelled", 0], ["skipped", 0], ["todo", 0]])
			assert.deepEqual(log.split("\n").filter(line => line.startsWith(`# ${key} `)), [`# ${key} ${value}`]);
		assert.doesNotMatch(log, /^not ok /mu);
	}
	const finish = new RegExp(`^all steps passed ${timestamp}$`, "u").exec(lines[22]);
	assert.ok(finish); assert.ok(Date.parse(finish[1]) >= previous);
};
