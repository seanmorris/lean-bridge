/**
 * Closed verifier contract for hosted callback Fin remaining-host evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
	callbackFinRemainingChecks, callbackFinRemainingProfiles
	, callbackFinRemainingTestName, callbackFinRemainingVerification
	, checkCallbackFinRemainingReport, parseCallbackFinRemainingCiArgs
} from "./helpers/callback-fin-remaining-ci.mjs";

const digest = "a".repeat(64);
const tap = `TAP version 13
# Subtest: ${callbackFinRemainingTestName}
ok 1 - ${callbackFinRemainingTestName}
  ---
  duration_ms: 1
  type: 'test'
  ...
1..1
# tests 1
# suites 0
# pass 1
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 2
`;
const extra = profile => profile === "dotnet" ? {
	installedAssemblySha256: digest, repeatExecution: true
	, runtimeVersion: "8.0.24"
	, sdkFreeRuntime: true, sourceFreeExecution: true
} : ["java", "kotlin"].includes(profile) ? {
	componentSha256: digest, dependencyClosureSha256: digest, offlineMaven: true
	, repeatExecution: true, runtimeOnly: true
} : profile === "php-native" ? {
	closedComposerInstall: true, packageFileSetSha256: digest
	, relocatedReplay: true
	, repeatExecution: true, vendorFilesSha256: digest
} : {
	handoffRemovedBeforeReplay: true, libraryClosureSha256: digest
	, packageFileSetSha256: digest, relocatedReplay: true, repeatExecution: true
	, runtimeOnly: true, sourceFreeExecution: true
};
const observations = route => callbackFinRemainingProfiles.map(profile => ({
	route, profile, checks: callbackFinRemainingChecks[profile]
	, bindingIrSha256: digest, consumerSha256: digest, receiptSha256: digest
	, compilerFreePath: true, offlineInstall: true
	, sourceRemovedBeforeInstallation: true, ...extra(profile)
}));
const report = () => ({
	schemaVersion: 1
	, reports: ["ordinary", "reviewed"].flatMap(observations)
});

test("callback Fin remaining verifier closes selected host lanes", () => {
	const checked = checkCallbackFinRemainingReport(
		report(), callbackFinRemainingProfiles);
	assert.deepEqual(checked, {
		profiles: [...callbackFinRemainingProfiles].sort()
		, routes: ["ordinary", "reviewed"], reports: 10
	});
	const verified = callbackFinRemainingVerification(
		"b".repeat(40), callbackFinRemainingProfiles, tap, report());
	assert.equal(verified.kind, "callback-fin-remaining");
	assert.deepEqual(parseCallbackFinRemainingCiArgs([
		"--producer", "b".repeat(40), "--profiles", "java,kotlin"
		, "--tap", "run.tap", "--report", "report.json"
	]).profiles, ["java", "kotlin"]);
	const incomplete = report(); incomplete.reports.pop();
	assert.throws(() => checkCallbackFinRemainingReport(
		incomplete, callbackFinRemainingProfiles));
});
