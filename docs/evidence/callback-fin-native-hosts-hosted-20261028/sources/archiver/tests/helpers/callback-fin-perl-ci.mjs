/**
 * Independently validate hosted callback Fin Perl acceptance records.
 *
 * @file
 */
import assert from "node:assert/strict";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { parseCallbackFinLanguageCiArgs } from "./callback-fin-language-ci.mjs";

export const callbackFinPerlTestName
	= "ordinary and reviewed callback Fin packages run on every prepared Perl ABI";
export const callbackFinPerlExpected = Object.freeze({
	checks: 31, calls: 5, rejected: 5
});
export const parseCallbackFinPerlCiArgs = parseCallbackFinLanguageCiArgs;

const digest = value => assert.match(value, /^[a-f0-9]{64}$/u);
const exactKeys = (value, keys) => {
	assert.ok(value && typeof value === "object" && !Array.isArray(value));
	assert.deepEqual(Object.keys(value).sort(), [...keys].sort());
};

/**
 * Require the exact successful, terminal and unskipped Node test.
 *
 * @param source - Original terminal TAP bytes.
 */
export const assertCallbackFinPerlTap = source => {
	assert.equal(typeof source, "string");
	assert.doesNotMatch(source, /(?:^|\n)(?:not ok |Bail out!|[ \t]+not ok )/u);
	const escaped = callbackFinPerlTestName.replaceAll(" ", "\\s");
	assert.match(source, new RegExp(`^TAP version 13\\n# Subtest: ${escaped}`, "u"));
	assert.match(source, new RegExp(`\\nok 1 - ${escaped}\\n`, "u"));
	assert.doesNotMatch(source, /# SKIP|# TODO/u);
	assert.match(source, /\n1\.\.1\n# tests 1\n# suites 0\n# pass 1\n# fail 0\n# cancelled 0\n# skipped 0\n# todo 0\n# duration_ms [0-9]+(?:\.[0-9]+)?\n$/u);
};

/**
 * Require every route, install mode and pinned interpreter observation.
 *
 * @param report - Original producer report.
 */
export const checkCallbackFinPerlReport = report => {
	exactKeys(report, ["schemaVersion", "reports"]);
	assert.equal(report.schemaVersion, 1);
	assert.equal(report.reports.length, 16);
	const cells = new Set(), interpreters = new Set();
	for(const item of report.reports)
	{
		exactKeys(item, ["bindingIrSha256", "calls", "checks"
			, "handoffRemovedBeforeExecution", "hostVersion", "installedFiles"
			, "mode", "packages", "perlSha256", "rejected", "relocated"
			, "repeated", "route", "schemaVersion", "sourceRemovedBeforeInstallation"]);
		assert.equal(item.schemaVersion, 1);
		assert.deepEqual({ checks: item.checks, calls: item.calls
			, rejected: item.rejected }, callbackFinPerlExpected);
		assert.ok(["ordinary", "reviewed"].includes(item.route));
		assert.ok(["prebuilt-only", "build-xs"].includes(item.mode));
		assert.match(item.hostVersion, /^v5\.(?:36\.3|38\.2)$/u);
		for(const flag of ["handoffRemovedBeforeExecution", "relocated", "repeated"
			, "sourceRemovedBeforeInstallation"])
			assert.equal(item[flag], true);
		digest(item.bindingIrSha256); digest(item.perlSha256);
		interpreters.add(item.perlSha256);
		assert.ok(Object.keys(item.installedFiles).length > 10);
		for(const file of Object.values(item.installedFiles))
		{
			exactKeys(file, ["bytes", "sha256"]);
			assert.ok(Number.isSafeInteger(file.bytes) && file.bytes >= 0);
			digest(file.sha256);
		}
		assert.deepEqual(item.packages.map(pkg => pkg.role).sort()
			, ["component", "runtime"]);
		for(const pkg of item.packages) for(const artifact of pkg.artifacts)
		{
			assert.ok(Number.isSafeInteger(artifact.bytes) && artifact.bytes > 0);
			digest(artifact.sha256);
			assert.match(artifact.path, /^archives\/[A-Za-z0-9_.+-]+\.tar\.gz$/u);
		}
		const cell = `${item.route}/${item.mode}/${item.perlSha256}`;
		assert.equal(cells.has(cell), false); cells.add(cell);
	}
	assert.equal(interpreters.size, 4); assert.equal(cells.size, 16);
	return { routes: ["ordinary", "reviewed"]
		, modes: ["prebuilt-only", "build-xs"], interpreterCount: 4, reports: 16 };
};

/**
 * Bind checked original output to the exact producer revision.
 *
 * @param producer - Exact producer commit.
 * @param tap - Original terminal TAP bytes.
 * @param report - Original producer report.
 */
export const callbackFinPerlVerification = (producer, tap, report) => {
	assert.match(producer, /^[a-f0-9]{40}$/u);
	assertCallbackFinPerlTap(tap);
	return { schemaVersion: 1, producerCommit: producer, kind: "perl"
		, reportSha256: sha256(canonicalJson(report))
		, ...checkCallbackFinPerlReport(report) };
};
