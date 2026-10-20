#!/usr/bin/env node
/**
 * Verify one hosted installed callback Subtype lane.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { assertCallbackSubtypeNativeTap } from "../tests/helpers/callback-subtype-native-ci.mjs";

const usage = "Usage: check-callback-subtype-remaining-ci.mjs --producer <commit> --profiles <profile,...> --tap <tap> --report <json>";
const keys = ["producer", "profiles", "tap", "report"], selected = {};
assert.equal(process.argv.length, 2 + keys.length * 2, usage);
for(let index = 2; index < process.argv.length; index += 2)
{
	const flag = process.argv[index], key = flag?.slice(2), value = process.argv[index + 1];
	assert.ok(flag?.startsWith("--") && keys.includes(key) && !Object.hasOwn(selected, key)
		&& value && !value.startsWith("--") && !/[\0\r\n]/u.test(value), usage);
	selected[key] = value;
}
assert.match(selected.producer, /^[a-f0-9]{40}$/u);
const profiles = selected.profiles.split(",").sort(), allowed = ["dotnet", "java", "kotlin", "php-native", "wit-wasi"];
assert.ok(profiles.length > 0 && profiles.length === new Set(profiles).size
	&& profiles.every(profile => allowed.includes(profile)), usage);
const testName = "ordinary and reviewed remaining managed callback Subtypes install offline";
assertCallbackSubtypeNativeTap(await readFile(selected.tap, "utf8"), testName);
const report = JSON.parse(await readFile(selected.report, "utf8"));
assert.deepEqual(Object.keys(report).sort(), ["reports", "schemaVersion"]);
assert.equal(report.schemaVersion, 1); assert.equal(report.reports.length, profiles.length * 2);
const exact = ["bindingIrSha256", "checks", "compilerFreePath", "consumerSha256"
	, "offlineInstall"
	, "profile"
	, "receiptSha256"
	, "route"
	, "sourceRemovedBeforeInstallation"];
const cells = new Set();
for(const item of report.reports)
{
	const jvmKeys = ["componentSha256", "dependencyClosureSha256", "offlineMaven", "repeatExecution", "runtimeOnly"];
	const dotnetKeys = ["installedAssemblySha256", "repeatExecution", "runtimeVersion", "sdkFreeRuntime", "sourceFreeExecution"];
	assert.deepEqual(Object.keys(item).sort(), [
		...exact
		, ...["java", "kotlin"].includes(item.profile) ? jvmKeys : []
		, ...item.profile === "dotnet" ? dotnetKeys : []
	].sort());
	assert.ok(profiles.includes(item.profile)); assert.ok(["ordinary", "reviewed"].includes(item.route));
	assert.equal(item.checks, item.profile === "wit-wasi" ? 26 : 14);
	for(const flag of ["compilerFreePath", "offlineInstall", "sourceRemovedBeforeInstallation"])
		assert.equal(item[flag], true);
	if(["java", "kotlin"].includes(item.profile))
	{
		for(const flag of ["offlineMaven", "repeatExecution", "runtimeOnly"]) assert.equal(item[flag], true);
		for(const field of ["componentSha256", "dependencyClosureSha256"])
			assert.match(item[field], /^[a-f0-9]{64}$/u);
	}
	if(item.profile === "dotnet")
	{
		for(const flag of ["repeatExecution", "sdkFreeRuntime", "sourceFreeExecution"])
			assert.equal(item[flag], true);
		assert.match(item.installedAssemblySha256, /^[a-f0-9]{64}$/u);
		assert.match(item.runtimeVersion, /^8\.0\./u);
	}
	for(const field of ["bindingIrSha256", "consumerSha256", "receiptSha256"])
		assert.match(item[field], /^[a-f0-9]{64}$/u);
	const cell = `${item.route}/${item.profile}`; assert.equal(cells.has(cell), false); cells.add(cell);
}
assert.deepEqual([...cells].sort(), ["ordinary", "reviewed"].flatMap(route => profiles.map(profile => `${route}/${profile}`)).sort());
process.stdout.write(canonicalJson({ schemaVersion: 1
	, producerCommit: selected.producer
	, kind: "callback-subtype-remaining"
	, profiles
	, routes: ["ordinary", "reviewed"]
	, reports: report.reports.length
	, reportSha256: sha256(canonicalJson(report)) }));
