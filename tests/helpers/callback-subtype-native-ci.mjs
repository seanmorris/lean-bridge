/**
 * Independently validate installed native callback Subtype acceptance records.
 *
 * @file
 */
import assert from "node:assert/strict";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";

export const callbackSubtypeNativeTestName
	= "ordinary and reviewed C-family callback Subtypes install from source-free archives";
export const callbackSubtypePerlTestName
	= "ordinary and reviewed callback Subtypes run on every prepared Perl ABI";
export const callbackSubtypeLanguageTestName
	= "ordinary and reviewed Python, Ruby and Rust callback Subtypes install offline";

const digest = value => assert.match(value, /^[a-f0-9]{64}$/u);
const exactKeys = (value, keys) => {
	assert.ok(value && typeof value === "object" && !Array.isArray(value));
	assert.deepEqual(Object.keys(value).sort(), [...keys].sort());
};

/**
 * Parse a closed checker command line.
 *
 * @param args - Arguments after the checker script name.
 */
export const parseCallbackSubtypeNativeCiArgs = args => {
	const usage = "Usage: check-callback-subtype-<native|perl|languages>-ci.mjs --producer <commit> --tap <original-tap> --report <original-report>";
	const allowed = ["producer", "tap", "report"], selected = {};
	assert.ok(Array.isArray(args) && args.length === allowed.length * 2, usage);
	for(let index = 0; index < args.length; index += 2)
	{
		const flag = args[index], value = args[index + 1];
		assert.ok(typeof flag === "string" && flag.startsWith("--")
			&& allowed.includes(flag.slice(2)), usage);
		const key = flag.slice(2);
		assert.ok(!Object.hasOwn(selected, key) && typeof value === "string"
			&& value.length > 0 && !value.startsWith("--")
			&& !/[\0\r\n]/u.test(value), usage);
		selected[key] = value;
	}
	assert.match(selected.producer, /^[a-f0-9]{40}$/u);
	return selected;
};

/**
 * Require one successful, terminal and unskipped Node test.
 *
 * @param source - Original combined Node test output.
 * @param name - Exact terminal test name.
 */
export const assertCallbackSubtypeNativeTap = (source, name) => {
	assert.equal(typeof source, "string");
	assert.doesNotMatch(source, /(?:^|\n)(?:not ok |Bail out!|[ \t]+not ok )/u);
	assert.match(source, new RegExp(`^TAP version 13\\n# Subtest: ${name.replaceAll(" ", "\\s")}`, "u"));
	assert.match(source, new RegExp(`\\nok 1 - ${name.replaceAll(" ", "\\s")}\\n`, "u"));
	assert.doesNotMatch(source, /# SKIP|# TODO/u);
	assert.match(source, /\n1\.\.1\n# tests 1\n# suites 0\n# pass 1\n# fail 0\n# cancelled 0\n# skipped 0\n# todo 0\n# duration_ms [0-9]+(?:\.[0-9]+)?\n$/u);
};

/**
 * Validate the complete C and C++ report.
 *
 * @param report - Original producer report.
 */
export const checkCallbackSubtypeNativeReport = report => {
	exactKeys(report, ["schemaVersion", "reports"]); assert.equal(report.schemaVersion, 1);
	assert.equal(report.reports.length, 4);
	const cells = new Set();
	for(const item of report.reports)
	{
		exactKeys(item, ["bindingIrSha256", "checks", "compilerFreePath"
			, "consumerSha256", "offlineInstall", "profile", "receiptSha256"
			, "route", "sourceRemovedBeforeInstallation"]);
		assert.ok(["ordinary", "reviewed"].includes(item.route));
		assert.ok(["c", "cpp"].includes(item.profile));
		assert.equal(item.checks, item.profile === "c" ? 16 : 13);
		for(const flag of ["compilerFreePath", "offlineInstall", "sourceRemovedBeforeInstallation"])
			assert.equal(item[flag], true);
		for(const field of ["bindingIrSha256", "consumerSha256", "receiptSha256"])
			digest(item[field]);
		assert.equal(cells.has(`${item.route}/${item.profile}`), false);
		cells.add(`${item.route}/${item.profile}`);
	}
	assert.deepEqual([...cells].sort(), ["ordinary/c", "ordinary/cpp", "reviewed/c", "reviewed/cpp"]);
	return { routes: ["ordinary", "reviewed"], profiles: ["c", "cpp"], reports: 4 };
};

/**
 * Validate every CPAN route, install mode and pinned interpreter cell.
 *
 * @param report - Original producer report.
 */
export const checkCallbackSubtypePerlReport = report => {
	exactKeys(report, ["schemaVersion", "reports"]); assert.equal(report.schemaVersion, 1);
	assert.equal(report.reports.length, 16);
	const cells = new Set(), interpreters = new Set();
	for(const item of report.reports)
	{
		exactKeys(item, ["bindingIrSha256", "calls", "checks"
			, "handoffRemovedBeforeExecution", "hostVersion", "installedFiles"
			, "mode", "packages", "perlSha256", "rejected", "relocated"
			, "repeated", "route", "schemaVersion", "sourceRemovedBeforeInstallation"]);
		assert.equal(item.schemaVersion, 1); assert.equal(item.checks, 34);
		assert.equal(item.calls, 5); assert.equal(item.rejected, 6);
		assert.ok(["ordinary", "reviewed"].includes(item.route));
		assert.ok(["prebuilt-only", "build-xs"].includes(item.mode));
		assert.match(item.hostVersion, /^v5\.(?:36\.3|38\.2)$/u);
		for(const flag of ["handoffRemovedBeforeExecution", "relocated", "repeated", "sourceRemovedBeforeInstallation"])
			assert.equal(item[flag], true);
		digest(item.bindingIrSha256); digest(item.perlSha256);
		interpreters.add(item.perlSha256);
		assert.ok(Object.keys(item.installedFiles).length > 10);
		for(const file of Object.values(item.installedFiles))
		{
			exactKeys(file, ["bytes", "sha256"]);
			assert.ok(Number.isSafeInteger(file.bytes) && file.bytes >= 0); digest(file.sha256);
		}
		assert.deepEqual(item.packages.map(pkg => pkg.role).sort(), ["component", "runtime"]);
		for(const pkg of item.packages) for(const artifact of pkg.artifacts)
		{
			assert.ok(Number.isSafeInteger(artifact.bytes) && artifact.bytes > 0);
			digest(artifact.sha256); assert.match(artifact.path, /^archives\/[A-Za-z0-9_.+-]+\.tar\.gz$/u);
		}
		const cell = `${item.route}/${item.mode}/${item.perlSha256}`;
		assert.equal(cells.has(cell), false); cells.add(cell);
	}
	assert.equal(interpreters.size, 4);
	assert.equal(cells.size, 16);
	return { routes: ["ordinary", "reviewed"], modes: ["prebuilt-only", "build-xs"]
		, interpreterCount: 4, reports: 16 };
};

/**
 * Validate both author routes in every prepared language package.
 *
 * @param report - Original producer report.
 */
export const checkCallbackSubtypeLanguageReport = report => {
	exactKeys(report, ["schemaVersion", "reports"]); assert.equal(report.schemaVersion, 1);
	assert.equal(report.reports.length, 6);
	const cells = new Set();
	for(const item of report.reports)
	{
		exactKeys(item, ["bindingIrSha256", "checks", "compilerFreePath"
			, "consumerSha256", "offlineInstall", "profile", "receiptSha256"
			, "route", "sourceRemovedBeforeInstallation"]);
		assert.ok(["ordinary", "reviewed"].includes(item.route));
		assert.ok(["python", "ruby", "rust"].includes(item.profile));
		assert.equal(item.checks, item.profile === "rust" ? 17 : 15);
		for(const flag of ["compilerFreePath", "offlineInstall", "sourceRemovedBeforeInstallation"])
			assert.equal(item[flag], true);
		for(const field of ["bindingIrSha256", "consumerSha256", "receiptSha256"])
			digest(item[field]);
		const cell = `${item.route}/${item.profile}`;
		assert.equal(cells.has(cell), false); cells.add(cell);
	}
	const expected = ["ordinary/python", "ordinary/ruby"
		, "ordinary/rust", "reviewed/python"
		, "reviewed/ruby", "reviewed/rust"];
	assert.deepEqual([...cells].sort(), expected);
	return { routes: ["ordinary", "reviewed"], profiles: ["python", "ruby", "rust"], reports: 6 };
};

/**
 * Bind independently checked output to its producer revision.
 *
 * @param kind - Native or Perl acceptance kind.
 * @param producer - Exact producer commit.
 * @param tap - Original terminal TAP.
 * @param report - Original producer report.
 */
export const callbackSubtypeNativeVerification = (kind, producer, tap, report) => {
	assert.match(producer, /^[a-f0-9]{40}$/u);
	assert.ok(["native", "perl", "language"].includes(kind));
	const name = kind === "native" ? callbackSubtypeNativeTestName
		: kind === "perl" ? callbackSubtypePerlTestName : callbackSubtypeLanguageTestName;
	assertCallbackSubtypeNativeTap(tap, name);
	const checked = kind === "native"
		? checkCallbackSubtypeNativeReport(report)
		: kind === "perl" ? checkCallbackSubtypePerlReport(report)
			: checkCallbackSubtypeLanguageReport(report);
	return { schemaVersion: 1, producerCommit: producer, kind
		, reportSha256: sha256(canonicalJson(report)), ...checked };
};
