/**
 * Independently validate hosted owned Subtype acceptance reports.
 *
 * @file
 */
import assert from "node:assert/strict";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";

export const ownedSubtypeHostedLanes = Object.freeze([
	"native", "perl", "languages", "dotnet", "jvm", "php-native", "wit-wasi"
]);

const laneProfiles = Object.freeze({
	native: ["c", "cpp"]
	, perl: ["perl"]
	, languages: ["python", "ruby", "rust"]
	, dotnet: ["dotnet"]
	, jvm: ["java", "kotlin"]
	, "php-native": ["php-native"]
	, "wit-wasi": ["wit-wasi"]
});
const terminalTests = Object.freeze({
	native: { count: 4
		, names: [
			"installed ordinary owned Subtypes execute through C and C++ archives"
			, "installed reviewed owned Subtypes execute through C and C++ archives"
		]
	}
	, perl: { count: 4
		, names: [
			"installed ordinary owned Subtypes execute through CPAN archives"
			, "installed reviewed owned Subtypes execute through CPAN archives"
		]
	}
	, languages: { count: 4
		, names: [
			"installed ordinary owned Subtypes execute through wheel, gem and crate archives"
			, "installed reviewed owned Subtypes execute through wheel, gem and crate archives"
		]
	}
});

const exactKeys = (value, keys, message) => {
	assert.ok(value && typeof value === "object" && !Array.isArray(value)
		, message);
	assert.deepEqual(Object.keys(value).toSorted(), [...keys].toSorted()
		, message);
};
const digest = (value, message) => assert.match(value, /^[a-f0-9]{64}$/u
	, message);
const routes = report => report.reports.map(item => item.route
	?? (item.reviewed ? "reviewed" : "ordinary"));
const receiptTargets = item => item.packageSetReceipt.packages
	.map(pkg => pkg.target).toSorted();

/**
 * Parse one closed checker invocation.
 *
 * @param args - Arguments after the script name.
 */
export const parseOwnedSubtypeHostedCiArgs = args => {
	const usage = "Usage: check-owned-subtype-ci.mjs --lane <native|perl|languages|dotnet|jvm|php-native|wit-wasi> --producer <commit> --tap <original-tap> --report <original-report>";
	const keys = ["lane", "producer", "tap", "report"], selected = {};
	assert.ok(Array.isArray(args) && args.length === keys.length * 2, usage);
	for(let index = 0; index < args.length; index += 2)
	{
		const flag = args[index], key = flag?.slice(2), value = args[index + 1];
		assert.ok(flag?.startsWith("--") && keys.includes(key)
			&& !Object.hasOwn(selected, key) && typeof value === "string"
			&& value.length > 0 && !value.startsWith("--")
			&& !/[\0\r\n]/u.test(value), usage);
		selected[key] = value;
	}
	assert.ok(ownedSubtypeHostedLanes.includes(selected.lane), usage);
	assert.match(selected.producer, /^[a-f0-9]{40}$/u, usage);
	return selected;
};

const tapSpec = lane => terminalTests[lane] ?? {
	count: 5
	, names: [
		`installed ordinary checked owned Subtypes execute in ${lane}`
		, `installed reviewed checked owned Subtypes execute in ${lane}`
	]
};

/**
 * Require terminal, successful, unskipped execution of both author routes.
 *
 * @param source - Original Node TAP.
 * @param lane - Selected hosted lane.
 */
export const assertOwnedSubtypeHostedTap = (source, lane) => {
	assert.equal(typeof source, "string");
	const spec = tapSpec(lane);
	assert.doesNotMatch(source
		, /(?:^|\n)(?:not ok |Bail out!|[ \t]+not ok )/u);
	assert.doesNotMatch(source, /# SKIP|# TODO/u);
	for(const name of spec.names)
		assert.match(source, new RegExp(`^# Subtest: ${name.replaceAll(
			/[.*+?^${}()|[\]\\]/gu, "\\$&")}$`, "mu"));
	assert.match(source, new RegExp(
		`\\n1\\.\\.${spec.count}\\n# tests ${spec.count}\\n# suites 0\\n# pass ${spec.count}\\n# fail 0\\n# cancelled 0\\n# skipped 0\\n# todo 0\\n# duration_ms [0-9]+(?:\\.[0-9]+)?\\n$`, "u"));
};

const assertReportEnvelope = (report, lane) => {
	const remaining = !["native", "perl", "languages"].includes(lane);
	exactKeys(report, remaining
		? ["lane", "profile", "reports", "schemaVersion"]
		: ["profile", "reports", "schemaVersion"], `${lane}: report envelope`);
	assert.equal(report.schemaVersion, 1);
	assert.equal(report.profile, remaining ? "installed-owned-subtype-remaining"
		: `installed-owned-subtype-${lane}`);
	assert.equal(report.reports.length, 2);
	assert.deepEqual(routes(report).toSorted(), ["ordinary", "reviewed"]);
	if(remaining) assert.equal(report.lane, lane);
};

const assertNative = report => {
	assertReportEnvelope(report, "native");
	for(const item of report.reports)
	{
		for(const flag of ["sourceUnchanged", "sourceFreeInstallation"
			, "relocatedInstallation", "deterministicReassembly"
			, "transferredInputCheckedBeforeHandoff", "callbackCoexistence"])
			assert.equal(item[flag], true, `native: ${flag}`);
		assert.deepEqual(item.lifecycle
			, { c: "manual-owner-release", cpp: "raii-plus-sanitizers" });
		assert.deepEqual(receiptTargets(item), ["c", "cpp"]);
		assert.deepEqual(Object.keys(item.observed).toSorted(), ["c", "cpp"]);
		assert.equal(item.observed.c.checks, 149);
		assert.equal(item.observed.cpp.checks, 79);
		assert.ok(item.relocated.cpp.sanitizer);
		assert.equal(item.relocated.c.sanitizer, null);
	}
	return { profiles: laneProfiles.native, reports: 2 };
};

const assertPerl = report => {
	assertReportEnvelope(report, "perl");
	for(const item of report.reports)
	{
		for(const flag of ["sourceUnchanged", "sourceFreeInstallation"
			, "relocatedInstallation", "deterministicReassembly"
			, "compilerSelectedConstructors"
			, "transferredInputCheckedBeforeHandoff", "callbackCoexistence"])
			assert.equal(item[flag], true, `perl: ${flag}`);
		assert.deepEqual(item.lifecycle, { fallback: "perl-destruction"
			, observation: "native-identity-baseline-restored" });
		assert.deepEqual(receiptTargets(item), ["cpan", "cpan"]);
		assert.equal(item.observations.length, 8);
		const interpreters = new Set(), cells = new Set();
		for(const observation of item.observations)
		{
			assert.ok(["prebuilt-only", "build-xs"].includes(observation.mode));
			assert.equal(observation.runtimeOnlyRuns, 2);
			assert.ok(observation.observed.checks >= 72);
			assert.equal(observation.observed.live_identities, 0);
			assert.ok(typeof observation.perl === "string"
				&& observation.perl.length > 0);
			interpreters.add(observation.perl);
			cells.add(`${observation.perl}/${observation.mode}`);
		}
		assert.equal(interpreters.size, 4); assert.equal(cells.size, 8);
		digest(item.consumerSha256, "perl consumer digest");
	}
	return { profiles: laneProfiles.perl, reports: 2 };
};

const assertLanguages = report => {
	assertReportEnvelope(report, "languages");
	for(const item of report.reports)
	{
		for(const flag of ["sourceUnchanged", "sourceFreeInstallation"
			, "relocatedInstallation", "handoffRemovedBeforeRelocatedExecution"
			, "deterministicReassembly", "compilerSelectedConstructors"
			, "transferredInputCheckedBeforeHandoff"])
			assert.equal(item[flag], true, `languages: ${flag}`);
		assert.deepEqual(receiptTargets(item), ["cargo", "pypi", "rubygems"]);
		assert.deepEqual(Object.keys(item.observations).toSorted()
			, laneProfiles.languages);
		for(const profile of laneProfiles.languages)
		{
			const observation = item.observations[profile];
			assert.ok(observation.checks >= 100);
			assert.equal(observation.relocatedChecks, observation.checks);
			digest(observation.consumerSha256, `${profile} consumer digest`);
		}
		assert.equal(item.lifecycle.python.observation
			, "owning-slot-baseline-restored");
		assert.equal(item.lifecycle.ruby.observation, "queued-owner-drained");
		assert.equal(item.lifecycle.rust.fallback, "drop");
	}
	return { profiles: laneProfiles.languages, reports: 2 };
};

const assertRemaining = (report, lane) => {
	assertReportEnvelope(report, lane);
	for(const item of report.reports)
	{
		for(const flag of ["sourceUnchanged", "sourceFreeInstallation"
			, "relocatedInstallation", "handoffRemovedBeforeRelocatedExecution"
			, "deterministicReassembly", "compilerSelectedConstructors"
			, "transferredInputCheckedBeforeHandoff", "immutableInstalledInputs"])
			assert.equal(item[flag], true, `${lane}: ${flag}`);
		digest(item.packageSetReceiptSha256, `${lane}: retained receipt digest`);
		assert.deepEqual(Object.keys(item.observations).toSorted()
			, laneProfiles[lane]);
		assert.deepEqual(Object.keys(item.repeated).toSorted()
			, laneProfiles[lane]);
		for(const profile of laneProfiles[lane])
		{
			assert.ok(item.observations[profile].checks >= 100);
			assert.equal(item.repeated[profile].checks
				, item.observations[profile].checks);
			digest(item.observations[profile].consumerSha256
				, `${profile}: consumer digest`);
			assert.ok(item.lifecycle[profile]);
		}
	}
	return { profiles: laneProfiles[lane], reports: 2 };
};

/**
 * Bind independently checked lane output to its producer revision.
 *
 * @param lane - Selected hosted lane.
 * @param producer - Exact producer commit.
 * @param tap - Original terminal TAP.
 * @param report - Original semantic report.
 */
export const ownedSubtypeHostedVerification = (
	lane, producer, tap, report
) => {
	assert.ok(ownedSubtypeHostedLanes.includes(lane));
	assert.match(producer, /^[a-f0-9]{40}$/u);
	assertOwnedSubtypeHostedTap(tap, lane);
	const checked = lane === "native" ? assertNative(report)
		: lane === "perl" ? assertPerl(report)
			: lane === "languages" ? assertLanguages(report)
				: assertRemaining(report, lane);
	return { schemaVersion: 1, kind: `owned-subtype-${lane}`
		, producerCommit: producer, routes: ["ordinary", "reviewed"]
		, reportSha256: sha256(canonicalJson(report)), ...checked };
};
