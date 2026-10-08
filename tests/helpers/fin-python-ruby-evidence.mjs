/**
 * Authenticate the local Python/Ruby product, array and field executions (#1441/#1442).
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { beforeFinRefinementSource } from "./fin-refinement-source-history.mjs";
import { finProductRefinements } from "./fin-product-install.mjs";
import { finProductArrayRefinements } from "./fin-product-array-install.mjs";
import { finRecordRefinements } from "./fin-record-install.mjs";
import { finProductReviewedIr } from "./reviewed-fin-product-fixture.mjs";
import { finProductArrayReviewedIr } from "./reviewed-fin-product-array-fixture.mjs";
import { finRecordReviewedIr } from "./reviewed-fin-record-fixture.mjs";

export const finPythonRubyDirectory = "docs/evidence/fin-python-ruby-20261008";
export const finPythonRubyRevision = "72c5e27e62bf5676c29a24174cad7ff35b39c447";
export const finPythonRubyFamilies = {
	product: { name: "finproducts", refinements: finProductRefinements
		, review: finProductReviewedIr
		, checks: { python: 2038, ruby: 2039 }
		, ordinary: "relocated source-free native packages check Fin inside products and the active Except branch"
		, reviewed: "independently reviewed native packages check product and Except bounds after source-free installation" }
	, "product-array": { name: "finproductarrays"
		, refinements: finProductArrayRefinements
		, review: finProductArrayReviewedIr
		, checks: { python: 2014, ruby: 2010 }
		, ordinary: "relocated source-free native packages check Fin inside every element of an array of products"
		, reviewed: "independently reviewed native packages check array-of-product bounds after source-free installation" }
	, record: { name: "finrecords", refinements: finRecordRefinements
		, review: finRecordReviewedIr
		, checks: { python: 2053, ruby: 2053 }
		, ordinary: "relocated source-free native packages check Fin inside record fields and the active variant case"
		, reviewed: "independently reviewed native packages check record and variant field bounds after source-free installation" }
};
const pythonReports = [
	"2a9defd9aa832997234dfcdd4ad1fb531eebc1ce70992cde4295f8ef634fafd2"
	, "44ac21d4c82b603eadb1d81ccd7c4184566a4036d9c4064a08e4f3a5f3ad2aa4"
	, "40dba27871c2395b5a8a50c023f1f3f33bb58098bb71c3b756a0a0cd38c997bb"
	, "bc77b3f6fcc945000fe93d5dc8c084660d545d1c6f320163bee3d57a447a791b"
	, "0b80b9a83098cd0add13efb41de7d1d7e7d6acff031760a6c0022fb676010499"
	, "6482e7bd8d48125a8ae6ff21009c1f7e91c510d2929642948dec223d3a10e475"
];
export const finPythonRubyRuntimes = [
	{ id: "python311", profile: "python", version: "3.11.16"
		, identity: "python=Python 3.11.16", reports: pythonReports
		, tap: "fd9e1255ea09d0bc092b2184af9bd243e0b1d9d234a0d836897b91bc78c3a032"
		, queue: "c658261a0d78409128006efd301fd4d66b624db673428ab9442c24ce22269de6"
		, runner: "c93e96f2235e9563ab6600a281b121c421c3506d5d0af33b73838cc89e7ae133" }
	, { id: "python312", profile: "python", version: "3.12.14"
		, identity: "python=Python 3.12.14", reports: pythonReports
		, tap: "a69a8ee0f8be196e539de2551282a86acde7b5ff8bf4d16eec492b6fba427f30"
		, queue: "3602e98f11fdd36318cc40dc6f30d30a3bcf6f7670c9721477662aee6d5873e9"
		, runner: "e4558c8c5510c5956a6830e548620a78e1af4d8d6adde1fcd4f53f0cb2ea4604" }
	, { id: "ruby33", profile: "ruby", version: "3.3.12"
		, identity: "ruby=ruby 3.3.12 (2026-07-16 revision 0581089df9) [x86_64-linux]"
		, reports: ["d438632a39fa4e5ad00511e2468bc7071eceb890001bc2dffeaccd53b90d39db"
			, "1dd941f024308c817b79681966473c1c97bea73dc1b5a62dacc0d8a9ed281d56"
			, "ffb1bd48174877112e512b1512ae798bad32bfde8e9e22df9efbb241ddbc9854"
			, "5918c79cb897714e28600b2652b42dc0507d83a4735388f9e8e9a87b0dede8ca"
			, "a01bfc93ff0fee2b4444812e8dae5ead16b2aad32c4cba836f4db53c27114906"
			, "3d714804129befe675d6ff345594d15c3908c4eb86a450b38b2cc29c4c86f214"]
		, tap: "81adf6f61d8fb8bbb8b098d4666768f3a35dc2a0112470c7c3b2987e57d8c395"
		, queue: "86af869c5c968c19183719b6ab7a866364794ec794b329fd387bfc062705dcee"
		, runner: "65c38ee8623feaccd3c198e00237a9e00dd1e19b8060921f3c4f2ec417b8925b" }
];
export const finPythonRubySteps = Object.keys(finPythonRubyFamilies).flatMap(family =>
	["ordinary", "reviewed"].map(route => ({ id: `${family}-${route}`, family, route })));
export const finPythonRubySourcePaths = [
	"src/analyze/NativeExports.lean"
	, "src/analyze/native-types.mjs"
	, "src/analyze/reviewed-source.mjs"
	, "src/analyze/reviewed-refinements.mjs"
	, "src/build/native-model.mjs"
	, "src/build/native-c-projection.mjs"
	, "src/backends/c/native-copied-values.mjs"
	, "src/backends/native/fin-refinements.mjs"
	, "src/backends/python/copied-values.mjs"
	, "src/backends/python/refinements.mjs"
	, "src/backends/ruby/copied-values.mjs"
	, "src/release/native-pypi.mjs"
	, "src/release/native-rubygems.mjs"
	, "tests/native-fin-products.test.mjs"
	, "tests/native-fin-product-arrays.test.mjs"
	, "tests/native-fin-records.test.mjs"
	, "tests/helpers/copied-fixture-install.mjs"
	, "tests/helpers/fin-product-install.mjs"
	, "tests/helpers/fin-product-array-install.mjs"
	, "tests/helpers/fin-record-install.mjs"
	, "tests/helpers/reviewed-fin-product-fixture.mjs"
	, "tests/helpers/reviewed-fin-product-array-fixture.mjs"
	, "tests/helpers/reviewed-fin-record-fixture.mjs"
	, "tests/fixtures/onboarding/native-fin-products/FinProducts.lean"
	, "tests/fixtures/onboarding/native-fin-product-arrays/FinProductArrays.lean"
	, "tests/fixtures/onboarding/native-fin-records/FinRecords.lean"
	, ...Object.keys(finPythonRubyFamilies).flatMap(family => ["python.py", "ruby.rb"].map(file => `tests/fixtures/fin-${family}-consumers/${file}`))
];
const identityKeys = ["bindingIrSha256", "modelSha256", "receiptSha256", "sourceTreeSha256", "consumerSha256"];

/**
 * Collect the immutable package and model identities in an already hash-checked original.
 *
 * @param report - Original installed consumer report.
 */
export const finPythonRubyIdentities = report => {
	const item = report.reports[0];
	return { ...Object.fromEntries(identityKeys.map(key => [key, item[key]])), packages: item.packages };
};

/**
 * Validate the report's independent fixture, route, exact counts and pinned package identities.
 *
 * @param report - Candidate installed report.
 * @param run - Expected route and identities from the authenticated archive receipt.
 */
export const assertFinPythonRubyReport = async (report, run) => {
	const family = finPythonRubyFamilies[run.family];
	assert.ok(family);
	assert.ok(["ordinary", "reviewed"].includes(run.route));
	assert.ok(["python", "ruby"].includes(run.profile));
	assert.equal(report.schemaVersion, 1);
	assert.equal(report.reproducible, true);
	assert.deepEqual(report.reports.map(item => item.profile), [run.profile]);
	assert.equal(Object.hasOwn(report, "dispatch"), false);
	const item = report.reports[0];
	assert.equal(item.path, run.route === "reviewed" ? "reviewed-ir" : "ordinary-source");
	assert.equal(item.checks, family.checks[run.profile]);
	assert.deepEqual(item.refinements, family.refinements);
	for(const flag of ["offlineInstall", "compilerFreePath", "sourceRemovedBeforeInstallation"])
		assert.equal(item[flag], true, flag);
	assert.equal(Object.hasOwn(item, "dispatch"), false, "No dispatch was measured for these Python/Ruby reports");
	for(const key of identityKeys) assert.match(item[key], /^[a-f0-9]{64}$/u, key);
	assert.deepEqual(finPythonRubyIdentities(report), run.identities);
	const consumer = `tests/fixtures/fin-${run.family}-consumers/${run.profile}.${run.profile === "python" ? "py" : "rb"}`;
	assert.equal(sha256(beforeFinRefinementSource(consumer, await readFile(consumer), item.consumerSha256)), item.consumerSha256);
	if(run.route === "reviewed") assert.equal(item.reviewedSourceSha256, sha256(canonicalJson(family.review())));
	else assert.equal(Object.hasOwn(item, "reviewedSourceSha256"), false);
	assert.equal(item.packages.length, 1);
	const pkg = item.packages[0], target = run.profile === "python" ? "pypi" : "rubygems";
	assert.deepEqual({ ...pkg, artifacts: undefined }, {
		target, ecosystem: target, name: family.name, version: "1.0.0"
		, profile: "native-library-v1", role: "component"
		, runtimeDelivery: "embedded", requires: [], artifacts: undefined
		, runtimeIdentity: "137cb2975ffded21021afe95f6e4cd7d33d6c5d9e605a9e0f28fd950136decdf"
	});
	assert.equal(pkg.artifacts.length, 1);
	const artifact = pkg.artifacts[0];
	assert.equal(artifact.path, `archives/${family.name}-1.0.0${run.profile === "python" ? "-py3-none-manylinux_2_36_x86_64.whl" : "-x86_64-linux.gem"}`);
	assert.ok(Number.isSafeInteger(artifact.bytes) && artifact.bytes > 0);
	assert.match(artifact.sha256, /^[a-f0-9]{64}$/u);
	assert.deepEqual(report.archives, { [artifact.path]: artifact.sha256 });
};

/**
 * Validate each interpreter's own six-step execution, independently of identical report bytes.
 *
 * @param runtime - Expected interpreter and original report digests.
 * @param queue - Original sequential execution log.
 * @param tap - Six original TAP documents in execution order.
 */
export const assertFinPythonRubyExecution = (runtime, queue, tap) => {
	const lines = queue.trimEnd().split("\n");
	assert.equal(lines.length, 21);
	assert.equal(lines[0], `revision=${finPythonRubyRevision} node=v22.23.2 ${runtime.identity} cpu=3 concurrency=1 glibc=2.36`);
	const start = /^start=(\S+) freeMiB=(\d+)$/u.exec(lines[1]);
	assert.ok(start); assert.ok(Number(start[2]) >= 2048);
	let previous = Date.parse(start[1]); assert.ok(Number.isFinite(previous));
	const sections = tap.split(/^# step /mu);
	assert.equal(sections.shift(), ""); assert.equal(sections.length, 6);
	for(const [index, step] of finPythonRubySteps.entries())
	{
		const family = finPythonRubyFamilies[step.family];
		const begin = /^start (\S+) (\S+) freeMiB=(\d+) pattern=(.+) report=(\S+)$/u.exec(lines[2 + index * 3]);
		const end = /^end (\S+) (\S+) exit=0 freeMiB=(\d+)$/u.exec(lines[3 + index * 3]);
		assert.ok(begin); assert.ok(end);
		assert.equal(begin[1], step.id); assert.equal(end[1], step.id);
		assert.ok(Number(begin[3]) >= 2048);
		assert.ok(begin[4].startsWith("^") && family[step.route].startsWith(begin[4].slice(1)));
		assert.equal(begin[5], `/app/build/vo1441-${runtime.id}-${step.id}-72c5e27.json`);
		assert.ok(Date.parse(begin[2]) >= previous); assert.ok(Date.parse(end[2]) > Date.parse(begin[2]));
		previous = Date.parse(end[2]);
		assert.equal(lines[4 + index * 3], `report ${step.id} sha256=${runtime.reports[index]} checks=${family.checks[runtime.profile]}`);
		const log = sections[index];
		assert.equal(log.split("\n")[0], step.id);
		assert.ok(log.includes(`ok 1 - ${family[step.route]}\n`));
		for(const line of ["TAP version 13", "1..1", "exit=0"
			, `# build 0: ${runtime.profile}`
			, `# installing and checking ${runtime.profile}`
			, `# build 1: ${runtime.profile}`])
			assert.equal(log.split("\n").filter(item => item === line).length, 1, line);
		for(const [key, value] of [["tests", 1], ["pass", 1], ["fail", 0], ["cancelled", 0], ["skipped", 0], ["todo", 0]])
			assert.deepEqual(log.split("\n").filter(line => line.startsWith(`# ${key} `)), [`# ${key} ${value}`]);
		assert.doesNotMatch(log, /^not ok /mu);
	}
	const finish = /^all steps passed (\S+)$/u.exec(lines[20]);
	assert.ok(finish); assert.ok(Date.parse(finish[1]) >= previous);
};
