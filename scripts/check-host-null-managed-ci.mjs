#!/usr/bin/env node
/**
 * Independently verify retained .NET/Java/Kotlin HostNull acceptance.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { verifyPackageSetReceipt } from "../src/release/package-set-receipt.mjs";
import {
	hostNullManagedChecks, hostNullManagedGroups
} from "../tests/helpers/host-null-managed-installed.mjs";

const values = Object.fromEntries(process.argv.slice(2).reduce(
	(items, item, index, all) => {
		if(index % 2 === 0)
		{
			assert.match(item, /^--(?:group|producer|directory|tap)$/u);
			assert.ok(all[index + 1] && !all[index + 1].startsWith("--"));
			items.push([item.slice(2), all[index + 1]]);
		}
		return items;
	}, []));
assert.deepEqual(Object.keys(values).sort()
	, ["directory", "group", "producer", "tap"]);
assert.ok(Object.hasOwn(hostNullManagedGroups, values.group));
assert.match(values.producer, /^[a-f0-9]{40}$/u);
const directory = resolve(values.directory);
const tap = await readFile(resolve(values.tap), "utf8");
assert.match(tap, /^1\.\.1$/mu);
assert.match(tap, /^# pass 1$/mu);
assert.match(tap, /^# fail 0$/mu);
const json = async path => {
	assert.match(path, /^(?:[A-Za-z0-9_@.+-]+\/)*[A-Za-z0-9_@.+-]+$/u);
	assert.ok(path.split("/").every(part => part !== "." && part !== ".."));
	const bytes = await readFile(join(directory, path));
	const value = JSON.parse(bytes);
	assert.equal(bytes.toString(), canonicalJson(value), path);
	return { bytes, value };
};
const summary = (await json("summary.json")).value;
assert.equal(summary.schemaVersion, 1);
assert.equal(summary.group, values.group);
assert.equal(summary.producerCommit, values.producer);
assert.deepEqual(summary.routes.map(item => item.route), ["ordinary", "reviewed"]);
const profiles = hostNullManagedGroups[values.group];
const sourceAt = path => execFileSync("git", ["show", `${values.producer}:${path}`]);
const digest = value => assert.match(value, /^[a-f0-9]{64}$/u);
for(const report of summary.routes)
{
	assert.equal(report.schemaVersion, 1);
	assert.equal(report.group, values.group);
	assert.equal(report.producerCommit, values.producer);
	assert.deepEqual(report.profiles, profiles);
	for(const key of [
		"sourceRemovedBeforeInstallation"
		, "installationHandoffRemovedBeforeRelocatedExecution"
		, "offlineInstall", "compilerFreePath", "relocatedInstallation"
	]) assert.equal(report[key], true, key);
	for(const key of [
		"receiptSha256", "bindingIrSha256", "sourceTreeSha256", "modelSha256"
	]) digest(report[key]);
	const retained = (await json(`${report.route}/report.json`)).value;
	assert.deepEqual(retained, report);
	const configuration = (await json(`${report.route}/configuration.json`)).value;
	assert.equal(configuration.schemaVersion, 1);
	assert.deepEqual(configuration.modules, ["HostNullDemo"]);
	assert.deepEqual(configuration.hostProjections, [{
		name: "HostNullDemo.HostNull"
		, nullConstructor: "HostNullDemo.HostNull.null"
		, valueConstructor: "HostNullDemo.HostNull.value"
	}]);
	assert.deepEqual(configuration.targets, values.group === "dotnet"
		? { nuget: { name: "HostNullDemo.Api", version: "1.0.0" } }
		: { maven: { name: "org.leanbridge:host-null-demo", version: "1.0.0" } });
	if(report.route === "ordinary")
	{
		assert.deepEqual(configuration.exports, [
			"HostNullDemo.echo", "HostNullDemo.nullableOption"
			, "HostNullDemo.optionalNullable", "HostNullDemo.echoPacket"
			, "HostNullDemo.callHost", "HostNullDemo.makeClosure"
		]);
		assert.deepEqual(configuration.arities, { "HostNullDemo.makeClosure": 1 });
	}
	else
	{
		assert.equal(Object.hasOwn(configuration, "exports"), false);
		assert.equal(Object.hasOwn(configuration, "arities"), false);
	}
	const receiptPath = `${report.route}/handoff/package-set-receipt.json`;
	await verifyPackageSetReceipt({ receiptPath: join(directory, receiptPath) });
	const receipt = await json(receiptPath);
	assert.equal(sha256(receipt.bytes), report.receiptSha256);
	assert.deepEqual(receipt.value.packages, report.packages);
	assert.deepEqual(report.observations.map(item => item.profile), profiles);
	for(const observation of report.observations)
	{
		assert.equal(observation.checks, hostNullManagedChecks);
		assert.equal(observation.offlineInstall, true);
		assert.equal(observation.compilerFreePath, true);
		assert.equal(observation.nestedOptionDistinct, true);
		assert.deepEqual(observation.positions, [
			"parameter", "result", "field", "callback-parameter", "callback-result"
		]);
		assert.deepEqual(observation.executions, [
			{ checks: hostNullManagedChecks, relocated: false }
			, { checks: hostNullManagedChecks, relocated: true }
		]);
		const extension = observation.profile === "dotnet" ? "cs"
			: observation.profile === "java" ? "java" : "kt";
		const fixturePath = `tests/fixtures/host-null-consumers/${extension}`;
		const retainedSource = await readFile(join(directory
			, report.route, observation.profile, `consumer.${extension}`));
		assert.deepEqual(retainedSource, sourceAt(fixturePath));
		assert.equal(observation.consumerSha256, sha256(retainedSource));
		for(const [key, value] of Object.entries(observation))
			if(key.endsWith("Sha256")) digest(value);
	}
	assert.deepEqual(await readFile(join(directory, report.route
		, "HostNullDemo.lean")), sourceAt(
		"tests/fixtures/onboarding/host-null/HostNullDemo.lean"));
}
process.stdout.write(canonicalJson({
	group: values.group, producerCommit: values.producer
	, routes: summary.routes.map(item => item.route), profiles
	, checks: summary.routes.length * profiles.length * hostNullManagedChecks
	, executions: summary.routes.length * profiles.length * 2
}));
