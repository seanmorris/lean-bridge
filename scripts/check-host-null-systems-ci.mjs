#!/usr/bin/env node
/**
 * Independently verify retained C, C++, Rust and WIT/WASI HostNull acceptance.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import {
	hostNullSystemsChecks, hostNullSystemsProfiles
} from "../tests/helpers/host-null-systems-installed.mjs";

const values = Object.fromEntries(process.argv.slice(2).reduce(
	(items, item, index, all) => {
		if(index % 2 === 0)
		{
			assert.match(item, /^--(?:producer|directory|tap)$/u);
			assert.ok(all[index + 1] && !all[index + 1].startsWith("--"));
			items.push([item.slice(2), all[index + 1]]);
		}
		return items;
	}, []));
assert.deepEqual(Object.keys(values).sort(), ["directory", "producer", "tap"]);
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
const digest = value => assert.match(value, /^[a-f0-9]{64}$/u);
const sourceAt = path => execFileSync("git", ["show", `${values.producer}:${path}`]);
const summary = (await json("summary.json")).value;
assert.equal(summary.schemaVersion, 1);
assert.equal(summary.producerCommit, values.producer);
assert.deepEqual(summary.routes.map(item => item.route), ["ordinary", "reviewed"]);
assert.equal(summary.cells.length, 40);
const positions = ["parameter", "result", "field", "callback-parameter", "callback-result"];
assert.deepEqual(summary.cells, summary.routes.flatMap(route =>
	hostNullSystemsProfiles.flatMap(profile => positions.map(position => ({
		route: route.route, profile, position
	})))
));
assert.equal(new Set(summary.routes.map(route => route.bindingIrSha256)).size, 1);
const targets = {
	c: { name: "host-null-demo", version: "1.0.0" }
	, cpp: { name: "host-null-demo", version: "1.0.0" }
	, cargo: { name: "host-null-demo", version: "1.0.0" }
	, "wit-wasi": { name: "host-null-demo", version: "1.0.0" }
};
const targetByProfile = { c: "c", cpp: "cpp", rust: "cargo", "wit-wasi": "wit-wasi" };
const extensionByProfile = { c: "c", cpp: "cpp", rust: "rs", "wit-wasi": "c" };
for(const report of summary.routes)
{
	assert.equal(report.schemaVersion, 1);
	assert.equal(report.producerCommit, values.producer);
	assert.deepEqual(report.profiles, hostNullSystemsProfiles);
	for(const key of [
		"sourceRemovedBeforeInstallation"
		, "consumerSourceRemovedBeforeRelocatedExecution"
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
	assert.deepEqual(configuration.targets, targets);
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
	assert.deepEqual(report.observations.map(item => item.profile), hostNullSystemsProfiles);
	for(const pkg of report.packages)
	{
		assert.ok(Object.values(targetByProfile).includes(pkg.target));
		for(const artifact of pkg.artifacts) digest(artifact.sha256);
	}
	for(const observation of report.observations)
	{
		const checks = hostNullSystemsChecks[observation.profile];
		assert.equal(observation.checks, checks);
		for(const key of [
			"offlineInstall", "compilerFreePath", "nestedOptionDistinct"
			, "invalidRepresentationRejected", "ownershipCleanup"
			, "sourceFreeRelocatedExecution"
		]) assert.equal(observation[key], true, key);
		assert.ok(["runtime-validation", "typed-public-carrier"]
			.includes(observation.invalidRepresentationEnforcement));
		assert.deepEqual(observation.positions, positions);
		assert.deepEqual(observation.executions, [
			{ checks, relocated: false }, { checks, relocated: true }
		]);
		digest(observation.receiptSha256);
		digest(observation.packageFileSetSha256);
		assert.deepEqual(observation.packages
			, report.packages.filter(pkg => pkg.target === targetByProfile[observation.profile]));
		const extension = extensionByProfile[observation.profile];
		const fixturePath = `tests/fixtures/host-null-consumers/${observation.profile}.${extension}`;
		const retainedSource = await readFile(join(directory, report.route
			, observation.profile, `consumer.${extension}`));
		assert.deepEqual(retainedSource, sourceAt(fixturePath));
		assert.equal(observation.consumerSha256, sha256(retainedSource));
		for(const [key, value] of Object.entries(observation))
			if(key.endsWith("Sha256")) digest(value);
	}
	assert.deepEqual(await readFile(join(directory, report.route
		, "HostNullDemo.lean")), sourceAt(
		"tests/fixtures/onboarding/host-null/HostNullDemo.lean"));
	digest(report.rustDependencies.sha256);
	digest(report.rustDependencies.lockSha256);
	assert.ok(report.rustDependencies.packages.length > 0);
}
process.stdout.write(canonicalJson({
	producerCommit: values.producer, routes: summary.routes.map(item => item.route)
	, profiles: hostNullSystemsProfiles, cells: summary.cells.length
	, checks: summary.routes.reduce((total, route) => total
		+ route.observations.reduce((sum, item) => sum + item.checks * 2, 0), 0)
	, executions: summary.routes.length * hostNullSystemsProfiles.length * 2
}));
