/**
 * Authenticate the first local checked-record acceptance slice (#1446): C/C++ and npm packages.
 *
 * @file
 */
import assert from "node:assert/strict";
import { assertCheckedRecordReport } from "./checked-record-packages.mjs";

export const checkedRecordEvidenceDirectory = "docs/evidence/checked-records-20261008";
export const checkedRecordEvidenceRevision = "78a4d3da45754f3e425faafdadc9e959cee65bc5";
const titles = {
	"c-cpp": {
		ordinary: "relocated source-free C and C++ packages build checked records only through each site's constructor"
		, reviewed: "independently reviewed C and C++ packages name each checked parameter by its reviewed name"
		, "result-only": "a relocated C and C++ package whose only checked record is a Lean-produced result returns its payload" }
	, npm: {
		ordinary: "a relocated source-free npm package builds checked records only through each site's constructor"
		, reviewed: "an independently reviewed npm package builds checked records only through each site's constructor"
		, "result-only": "a relocated npm package whose only checked record is a Lean-produced result returns its payload" }
};
const variables = {
	"c-cpp": { ordinary: "LEAN_BRIDGE_CHECKED_RECORD_REPORT", reviewed: "LEAN_BRIDGE_CHECKED_RECORD_REVIEWED_REPORT", "result-only": "LEAN_BRIDGE_CHECKED_RECORD_RESULT_ONLY_REPORT" }
	, npm: { ordinary: "LEAN_BRIDGE_CHECKED_RECORD_NPM_REPORT", reviewed: "LEAN_BRIDGE_CHECKED_RECORD_REVIEWED_NPM_REPORT", "result-only": "LEAN_BRIDGE_CHECKED_RECORD_RESULT_ONLY_NPM_REPORT" }
};
export const checkedRecordEvidenceHosts = Object.freeze({
	"c-cpp": { queue: "0dd52036e1520a3e4dad3503a23984e0e612d3c74abc5f705e1c7874f9ad589d"
		, reports: { ordinary: "6fc2634cc43d31f2f8877e17de539d8b3710882d97fb8838b18f695fea06c2a9"
			, reviewed: "85ac7f42829a019472e44fce5e59125999693e122ae67b53139e1e299cb1ae60"
			, "result-only": "da46d46aee766be0b4d008dc8187d71ecf93929a3f0a34874ab95cac9878bb72" }
		, taps: { ordinary: "ce316be693f483c0be7f28d48b8e947912d2e3fa3a93cdac2aea81aa3af34e76"
			, reviewed: "7c661307067d074815f8e2178a83a74078f94f48f0a81579fb9cc4c4f96033bb"
			, "result-only": "7ab019d6b6fc55bc3646cdba49ed6a191159074ca78e7f4587d95275b0d24113" } }
	, npm: { queue: "b305e21d3948ab161650d12b2eab2f9639219c2fdbd00db4997465a280a55321"
		, reports: { ordinary: "2ba16c62f27b80c0115f0736e002c33bffda1dd33e9789a1a1e1958b7a06329e"
			, reviewed: "6dde48ce36afe0fec5b4f33640bb6360580ff7b4184e066633aeabdb92b59857"
			, "result-only": "038ad5d36be10620e0b3b35e2db64fd81abffaf866b80bee09ab55a3dbf550c0" }
		, taps: { ordinary: "30f4dab74aa47073bee1e2cdf6602099db32232ca17e4169a80bf41d3c985a3f"
			, reviewed: "acb8be6175b314fdfecbdfb38657a7867f0e1b33ba5367cf614831c49cf8b343"
			, "result-only": "24ef4fe5a0d081f8f92e468b1cb4073611475aed50aac8522afcdfe84a5a7dcd" } }
});
export const checkedRecordEvidenceRoutes = ["ordinary", "reviewed", "result-only"];
export const checkedRecordEvidenceSelections = Object.keys(checkedRecordEvidenceHosts).flatMap(host =>
	checkedRecordEvidenceRoutes.map(route => ({ id: `${route}-${host}`, host, route })));
// Selected compiler, package, harness, fixture and caller sources, not a dependency closure.
export const checkedRecordEvidenceSourcePaths = [
	"src/analyze/NativeExports.lean"
	, "src/analyze/native-types.mjs"
	, "src/analyze/elaborated-metadata.mjs"
	, "src/analyze/reviewed-source.mjs"
	, "src/analyze/reviewed-refinements.mjs"
	, "src/analyze/reviewed-instantiation.mjs"
	, "src/analyze/semantic-model.mjs"
	, "src/abi/refinements.mjs"
	, "src/abi/component-records.mjs"
	, "src/abi/component-recursive.mjs"
	, "src/build/native-model.mjs"
	, "src/build/component-refinements.mjs"
	, "src/build/component-callable-adapters.mjs"
	, "src/build/component-recursive-lean.mjs"
	, "src/build/compiler-adapters.mjs"
	, "src/build/native-artifacts.mjs"
	, "src/build/native-c-projection.mjs"
	, "src/release/native-c-family.mjs"
	, "src/backends/c/native-copied-values.mjs"
	, "src/backends/javascript/generate.mjs"
	, "src/backends/native/fin-refinements.mjs"
	, "schema/compiler-adapter-plan.schema.json"
	, "schema/elaborated-export-metadata.schema.json"
	, "schema/native-metadata-type.schema.json"
	, "tests/checked-records.test.mjs"
	, "tests/helpers/checked-record-fixture.mjs"
	, "tests/helpers/checked-record-packages.mjs"
	, "tests/helpers/checked-record-dispatch.mjs"
	, "tests/helpers/copied-fixture-install.mjs"
	, "tests/fixtures/onboarding/checked-records/CheckedRecords.lean"
	, ...["c.c", "cpp.cpp", "result-only-c.c", "result-only-cpp.cpp"]
		.map(name => `tests/fixtures/checked-record-consumers/${name}`)
];

/**
 * Collect the immutable identities of one already hash-checked original report.
 *
 * @param report - Original installed report.
 */
export const checkedRecordEvidenceIdentities = report => {
	if(!report.reports)
	{
		const keys = ["bindingIrSha256", "bindingIrFileSha256", "archiveSha256"
			, "runtimeArchiveSha256", "receiptSha256", "consumerSha256", "typescript"];
		return Object.fromEntries(keys.map(key => [key, report[key]]));
	}
	const keys = ["profile", "bindingIrSha256", "modelSha256", "receiptSha256"
		, "consumerSha256", "packages"];
	const installs = report.reports.map(item => Object.fromEntries(keys.map(key => [key, item[key]])));
	return { archives: report.archives, installs };
};

/**
 * Validate one original report semantically and against the identities its receipt records.
 *
 * @param report - Candidate installed report.
 * @param run - Expected host, route and identities from the authenticated archive receipt.
 */
export const assertCheckedRecordEvidenceReport = (report, run) => {
	assert.ok(checkedRecordEvidenceRoutes.includes(run.route));
	assert.equal(report.schemaVersion, 1);
	assert.equal(report.route, run.route);
	// The shared acceptance validator binds callers, counts, contracts or review, flags and dispatch rows.
	assertCheckedRecordReport(report);
	if(run.host === "c-cpp")
	{
		assert.deepEqual(report.reports.map(item => item.profile), ["c", "cpp"]);
		assert.equal(Object.hasOwn(report, "profile"), false);
		// The C interposer counts dispatch for ordinary and reviewed packages only; C++ and result-only are unmeasured.
		assert.equal(Object.hasOwn(report, "dispatch"), run.route !== "result-only");
		if(report.dispatch) assert.deepEqual(report.dispatch.unmeasured, ["C++ dispatch (it calls the same C entries)", "resident memory"]);
	}
	else
	{
		assert.equal(run.host, "npm");
		assert.equal(report.profile, "npm");
		assert.equal(Object.hasOwn(report, "reports"), false);
		assert.equal(report.dispatch, "not measured");
		assert.deepEqual([report.typescript.strict, report.typescript.skipLibCheck], [true, false]);
	}
	assert.deepEqual(checkedRecordEvidenceIdentities(report), run.identities);
};

const time = "(\\d{4}-\\d\\d-\\d\\dT\\d\\d:\\d\\d:\\d\\dZ)";

/**
 * Validate one host's sequential queue and its three TAP documents.
 *
 * @param host - "c-cpp" or "npm".
 * @param queue - Original queue text.
 * @param taps - TAP text by route.
 */
export const assertCheckedRecordEvidenceExecution = (host, queue, taps) => {
	const lines = queue.trimEnd().split("\n");
	assert.equal(lines[0], `sha ${checkedRecordEvidenceRevision}`);
	assert.ok(lines.includes("lean Lean (version 4.32.2, x86_64-unknown-linux-gnu, commit f3b06c705e6c85f5314019d5d3baab0fec5b580c, Release)"));
	assert.ok(lines.includes("glibc ldd (Debian GLIBC 2.36-9+deb12u14) 2.36"));
	assert.ok(lines.some(line => /^node v22\.23\.3 \(/u.test(line)), "measured Node");
	assert.ok(lines.includes("cpu 3 concurrency 1 LEAN_NUM_THREADS=1 OMP_NUM_THREADS=1"));
	const free = lines.map(line => /^(?:\S+ )?free_mib_(?:after_setup|before|end) (\d+)$/u.exec(line)?.[1]).filter(Boolean).map(Number);
	assert.ok(free.length >= 2 && free.every(value => value >= 2048), "free space");
	if(host === "c-cpp")
	{
		assert.ok(lines.includes("profiles c,cpp"));
		// The override was unset, so the packages declare the default minimum 2.38 on a glibc 2.36 host.
		assert.ok(lines.includes("  LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR unset; effective default 2.38 (src/build/native-c-projection.mjs:138) on a glibc 2.36 host"));
		assert.ok(lines.some(line => line.startsWith("correction ") && line.includes("default declared minimum 2.38")));
	}
	else
	{
		assert.ok(lines.includes("typescript Version 5.9.3 at /app/node_modules/typescript"));
		assert.ok(lines.includes("npm 10.9.9"));
		assert.ok(lines.some(line => line.startsWith("engine: local pinned engine from this frozen tree") && line.includes("LEAN_BRIDGE_LAKE_ENGINE unset")));
	}
	let previous = 0;
	for(const route of checkedRecordEvidenceRoutes)
	{
		const command = lines.find(line => line.startsWith(`${route} command: `));
		assert.ok(command, route);
		const report = `/app/build/vo1446-checked-records-${route}-${host}-78a4d3d.json`;
		assert.ok(command.includes(` ${variables[host][route]}=${report} taskset -c 3 node --test --test-concurrency=1 --test-reporter=tap `), route);
		assert.ok(command.includes(host === "c-cpp" ? " LEAN_BRIDGE_CHECKED_RECORD_PROFILES=c,cpp " : " LEAN_BRIDGE_CHECKED_RECORD_NPM_TEST=1 "), route);
		assert.ok(command.endsWith(` tests/checked-records.test.mjs > ${report.replace(/\.json$/u, ".tap")}`), route);
		const pattern = /--test-name-pattern='\^([^']+)'/u.exec(command)?.[1];
		assert.ok(pattern && titles[host][route].startsWith(pattern), route);
		const start = new RegExp(`^${route} start ${time}$`, "u").exec(lines.find(line => line.startsWith(`${route} start `)) ?? "");
		const end = new RegExp(`^${route} end ${time} exit 0 # pass 1 # fail 0 # skipped 0 $`, "u").exec(lines.find(line => line.startsWith(`${route} end `)) ?? "");
		assert.ok(start && end, route);
		assert.ok(Date.parse(start[1]) >= previous && Date.parse(end[1]) > Date.parse(start[1]), route);
		previous = Date.parse(end[1]);
		const tap = taps[route].split("\n");
		assert.equal(tap[0], "TAP version 13");
		assert.equal(tap.filter(line => line === `ok 1 - ${titles[host][route]}`).length, 1, route);
		for(const [key, value] of [["tests", 1], ["pass", 1], ["fail", 0], ["cancelled", 0], ["skipped", 0], ["todo", 0]])
			assert.deepEqual(tap.filter(line => line.startsWith(`# ${key} `)), [`# ${key} ${value}`], `${route} ${key}`);
		assert.ok(!tap.some(line => line.startsWith("not ok ")));
		if(host === "c-cpp")
			for(const line of [`# ${route} build 0: c, cpp`, `# ${route}: installing and checking c`, `# ${route}: installing and checking cpp`, `# ${route} build 1: c, cpp`])
				assert.equal(tap.filter(item => item === line).length, 1, line);
	}
	const complete = new RegExp(`^queue complete ${time}$`, "u").exec(lines.find(line => line.startsWith("queue ")) ?? "");
	assert.ok(complete && Date.parse(complete[1]) >= previous, "queue complete");
	assert.ok(!lines.some(line => line.startsWith("queue stopped")));
};
