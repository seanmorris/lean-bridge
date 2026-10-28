/**
 * Independently validate managed-host and WIT callback Fin evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";

export const callbackFinRemainingTestName
	= "ordinary and reviewed remaining callback Fin packages install offline";
export const callbackFinRemainingProfiles = Object.freeze([
	"dotnet", "java", "kotlin", "php-native", "wit-wasi"
]);
export const callbackFinRemainingChecks = Object.freeze({
	dotnet: 19, java: 19, kotlin: 19, "php-native": 19, "wit-wasi": 18
});

const digest = value => assert.match(value, /^[a-f0-9]{64}$/u);
const exactKeys = (value, keys) => {
	assert.ok(value && typeof value === "object" && !Array.isArray(value));
	assert.deepEqual(Object.keys(value).sort(), [...keys].sort());
};

/**
 * Parse a closed remaining-host checker command line.
 *
 * @param args - Arguments after the checker script name.
 */
export const parseCallbackFinRemainingCiArgs = args => {
	const usage = "Usage: check-callback-fin-remaining-ci.mjs --producer <commit> --profiles <profile,...> --tap <tap> --report <json>";
	const allowed = ["producer", "profiles", "tap", "report"], selected = {};
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
	const profiles = selected.profiles.split(",").sort();
	const validProfiles = profiles.length > 0
		&& profiles.length === new Set(profiles).size
		&& profiles.every(profile => callbackFinRemainingProfiles.includes(profile));
	assert.ok(validProfiles, usage);
	return { ...selected, profiles };
};

/**
 * Require the exact successful, terminal and unskipped Node test.
 *
 * @param source - Original terminal TAP bytes.
 */
export const assertCallbackFinRemainingTap = source => {
	assert.equal(typeof source, "string");
	assert.doesNotMatch(source, /(?:^|\n)(?:not ok |Bail out!|[ \t]+not ok )/u);
	const escaped = callbackFinRemainingTestName.replaceAll(" ", "\\s");
	assert.match(source, new RegExp(`^TAP version 13\\n# Subtest: ${escaped}`, "u"));
	assert.match(source, new RegExp(`\\nok 1 - ${escaped}\\n`, "u"));
	assert.doesNotMatch(source, /# SKIP|# TODO/u);
	assert.match(source, /\n1\.\.1\n# tests 1\n# suites 0\n# pass 1\n# fail 0\n# cancelled 0\n# skipped 0\n# todo 0\n# duration_ms [0-9]+(?:\.[0-9]+)?\n$/u);
};

/**
 * Validate both author routes for an exact selected host lane.
 *
 * @param report - Original producer report.
 * @param selectedProfiles - Exact profiles the lane was required to run.
 */
export const checkCallbackFinRemainingReport = (report, selectedProfiles) => {
	const profiles = [...selectedProfiles].sort();
	assert.ok(profiles.length > 0 && profiles.length === new Set(profiles).size
		&& profiles.every(profile => callbackFinRemainingProfiles.includes(profile)));
	exactKeys(report, ["reports", "schemaVersion"]);
	assert.equal(report.schemaVersion, 1);
	assert.equal(report.reports.length, profiles.length * 2);
	const exact = ["bindingIrSha256", "checks", "compilerFreePath"
		, "consumerSha256", "offlineInstall", "profile", "receiptSha256"
		, "route", "sourceRemovedBeforeInstallation"];
	const cells = new Set();
	for(const item of report.reports)
	{
		const jvmKeys = ["componentSha256", "dependencyClosureSha256"
			, "offlineMaven", "repeatExecution", "runtimeOnly"];
		const dotnetKeys = ["installedAssemblySha256", "repeatExecution"
			, "runtimeVersion", "sdkFreeRuntime", "sourceFreeExecution"];
		const phpKeys = ["closedComposerInstall", "packageFileSetSha256"
			, "relocatedReplay", "repeatExecution", "vendorFilesSha256"];
		const witKeys = ["handoffRemovedBeforeReplay", "libraryClosureSha256"
			, "packageFileSetSha256", "relocatedReplay", "repeatExecution"
			, "runtimeOnly", "sourceFreeExecution"];
		exactKeys(item, [...exact
			, ...["java", "kotlin"].includes(item.profile) ? jvmKeys : []
			, ...item.profile === "dotnet" ? dotnetKeys : []
			, ...item.profile === "php-native" ? phpKeys : []
			, ...item.profile === "wit-wasi" ? witKeys : []]);
		assert.ok(profiles.includes(item.profile));
		assert.ok(["ordinary", "reviewed"].includes(item.route));
		assert.equal(item.checks, callbackFinRemainingChecks[item.profile]);
		for(const flag of ["compilerFreePath", "offlineInstall"
			, "sourceRemovedBeforeInstallation"])
			assert.equal(item[flag], true);
		if(["java", "kotlin"].includes(item.profile))
		{
			for(const flag of ["offlineMaven", "repeatExecution", "runtimeOnly"])
				assert.equal(item[flag], true);
			for(const field of ["componentSha256", "dependencyClosureSha256"])
				digest(item[field]);
		}
		if(item.profile === "dotnet")
		{
			for(const flag of ["repeatExecution", "sdkFreeRuntime", "sourceFreeExecution"])
				assert.equal(item[flag], true);
			digest(item.installedAssemblySha256);
			assert.match(item.runtimeVersion, /^8\.0\./u);
		}
		if(item.profile === "php-native")
		{
			for(const flag of ["closedComposerInstall", "relocatedReplay"
				, "repeatExecution"])
				assert.equal(item[flag], true);
			for(const field of ["packageFileSetSha256", "vendorFilesSha256"])
				digest(item[field]);
		}
		if(item.profile === "wit-wasi")
		{
			for(const flag of ["handoffRemovedBeforeReplay", "relocatedReplay"
				, "repeatExecution", "runtimeOnly", "sourceFreeExecution"])
				assert.equal(item[flag], true);
			for(const field of ["libraryClosureSha256", "packageFileSetSha256"])
				digest(item[field]);
		}
		for(const field of ["bindingIrSha256", "consumerSha256", "receiptSha256"])
			digest(item[field]);
		const cell = `${item.route}/${item.profile}`;
		assert.equal(cells.has(cell), false); cells.add(cell);
	}
	assert.deepEqual([...cells].sort(), ["ordinary", "reviewed"]
		.flatMap(route => profiles.map(profile => `${route}/${profile}`)).sort());
	return { profiles, routes: ["ordinary", "reviewed"]
		, reports: report.reports.length };
};

/**
 * Bind independently checked output to its producer revision.
 *
 * @param producer - Exact producer commit.
 * @param profiles - Exact profiles selected for the hosted lane.
 * @param tap - Original terminal TAP.
 * @param report - Original producer report.
 */
export const callbackFinRemainingVerification
	= (producer, profiles, tap, report) => {
		assert.match(producer, /^[a-f0-9]{40}$/u);
		assertCallbackFinRemainingTap(tap);
		return { schemaVersion: 1, producerCommit: producer
			, kind: "callback-fin-remaining"
			, reportSha256: sha256(canonicalJson(report))
			, ...checkCallbackFinRemainingReport(report, profiles) };
	};
