/**
 * Independently validate hosted callback Fin language acceptance records.
 *
 * @file
 */
import assert from "node:assert/strict";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";

export const callbackFinLanguageTestName
	= "ordinary and reviewed Python, Ruby and Rust callback Fin packages install offline";
export const callbackFinLanguageChecks = Object.freeze({
	python: 19, ruby: 19, rust: 15
});

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
export const parseCallbackFinLanguageCiArgs = args => {
	const usage = "Usage: check-callback-fin-languages-ci.mjs --producer <commit> --tap <original-tap> --report <original-report>";
	const allowed = ["producer", "tap", "report"], selected = {};
	assert.equal(args.length, allowed.length * 2, usage);
	for(let index = 0; index < args.length; index += 2)
	{
		const flag = args[index], value = args[index + 1];
		assert.ok(flag?.startsWith("--") && allowed.includes(flag.slice(2)), usage);
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
 * Require the exact successful, terminal and unskipped Node test.
 *
 * @param source - Original terminal TAP bytes.
 */
export const assertCallbackFinLanguageTap = source => {
	assert.equal(typeof source, "string");
	assert.doesNotMatch(source, /(?:^|\n)(?:not ok |Bail out!|[ \t]+not ok )/u);
	const escaped = callbackFinLanguageTestName.replaceAll(" ", "\\s");
	assert.match(source, new RegExp(`^TAP version 13\\n# Subtest: ${escaped}`, "u"));
	assert.match(source, new RegExp(`\\nok 1 - ${escaped}\\n`, "u"));
	assert.doesNotMatch(source, /# SKIP|# TODO/u);
	assert.match(source, /\n1\.\.1\n# tests 1\n# suites 0\n# pass 1\n# fail 0\n# cancelled 0\n# skipped 0\n# todo 0\n# duration_ms [0-9]+(?:\.[0-9]+)?\n$/u);
};

/**
 * Require all six route/language observations and their exact invariants.
 *
 * @param report - Original producer report.
 */
export const checkCallbackFinLanguageReport = report => {
	exactKeys(report, ["schemaVersion", "reports"]);
	assert.equal(report.schemaVersion, 1);
	assert.equal(report.reports.length, 6);
	const cells = new Set();
	for(const item of report.reports)
	{
		exactKeys(item, ["bindingIrSha256", "checks", "compilerFreePath"
			, "consumerSha256", "offlineInstall", "profile", "receiptSha256"
			, "route", "sourceRemovedBeforeInstallation"]);
		assert.ok(["ordinary", "reviewed"].includes(item.route));
		assert.ok(["python", "ruby", "rust"].includes(item.profile));
		assert.equal(item.checks, callbackFinLanguageChecks[item.profile]);
		for(const flag of ["compilerFreePath", "offlineInstall"
			, "sourceRemovedBeforeInstallation"])
			assert.equal(item[flag], true);
		for(const field of ["bindingIrSha256", "consumerSha256", "receiptSha256"])
			digest(item[field]);
		const cell = `${item.route}/${item.profile}`;
		assert.equal(cells.has(cell), false); cells.add(cell);
	}
	assert.deepEqual([...cells].sort(), ["ordinary/python", "ordinary/ruby"
		, "ordinary/rust", "reviewed/python", "reviewed/ruby", "reviewed/rust"]);
	return { routes: ["ordinary", "reviewed"]
		, profiles: ["python", "ruby", "rust"], reports: 6 };
};

/**
 * Bind checked original output to the exact producer revision.
 *
 * @param producer - Exact producer commit.
 * @param tap - Original terminal TAP bytes.
 * @param report - Original producer report.
 */
export const callbackFinLanguageVerification = (producer, tap, report) => {
	assert.match(producer, /^[a-f0-9]{40}$/u);
	assertCallbackFinLanguageTap(tap);
	return { schemaVersion: 1, producerCommit: producer, kind: "language"
		, reportSha256: sha256(canonicalJson(report))
		, ...checkCallbackFinLanguageReport(report) };
};
