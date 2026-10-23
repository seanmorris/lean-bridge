/**
 * Independent reconciliation for generic Subtype packages in .NET, JVM, native PHP and WIT.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { hashBindingIr } from "../../src/binding-ir/canonical.mjs";
import { validateBindingIr } from "../../src/binding-ir/contract.mjs";
import { reviewedContractDifference } from "../../src/analyze/reviewed-source.mjs";
import { genericSubtypeModule, genericSubtypeSource } from "./nominal-subtype-installed-fixture.mjs";
import {
	genericSubtypeJvmProfiles
	, genericSubtypeManagedWitCaller
	, genericSubtypeManagedWitConfiguration
	, genericSubtypeManagedWitExpected
	, genericSubtypeManagedWitHosts
	, genericSubtypeManagedWitReview
	, genericSubtypeManagedWitRoutes
	, parseGenericSubtypeManagedWitResult
} from "./generic-subtype-managed-wit.mjs";

const targets = Object.freeze({ dotnet: "nuget", jvm: "maven", php: "php-native", wit: "wit-wasi" });
const labels = Object.freeze({ dotnet: "C#", jvm: "JVM", php: "PHP", wit: "WIT" });

/**
 * Refuse absolute, empty and traversing selection-relative paths.
 *
 * @param path - Candidate selection-relative path.
 */
export const genericSubtypeManagedWitSafePath = path => {
	assert.match(path, /^(?:[A-Za-z0-9_@.+-]+\/)*[A-Za-z0-9_@.+-]+$/u);
	assert.ok(path.split("/").every(part => part !== "." && part !== "..")); return path;
};

/**
 * Parse one fixed hosted report-checker invocation.
 *
 * @param arguments_ - Arguments after the script name.
 */
export const parseGenericSubtypeManagedWitCiArgs = arguments_ => {
	assert.equal(arguments_.length, 10, "Expected five named generic Subtype host arguments");
	const selected = {};
	for(let index = 0; index < arguments_.length; index += 2)
	{
		const flag = arguments_[index], value = arguments_[index + 1];
		assert.ok(["--host", "--route", "--producer", "--directory", "--tap"].includes(flag));
		assert.ok(!Object.hasOwn(selected, flag), `Duplicate ${flag}`);
		assert.ok(value && !/[\0\r\n]/u.test(value)); selected[flag] = value;
	}
	assert.deepEqual(Object.keys(selected).sort(), ["--directory", "--host", "--producer", "--route", "--tap"]);
	assert.ok(genericSubtypeManagedWitHosts.includes(selected["--host"]));
	assert.ok(genericSubtypeManagedWitRoutes.includes(selected["--route"]));
	assert.match(selected["--producer"], /^[a-f0-9]{40}$/u);
	return { host: selected["--host"], route: selected["--route"]
		, producerCommit: selected["--producer"]
		, directory: selected["--directory"], tap: selected["--tap"] };
};

/**
 * Require exactly one selected installed-package test and no hidden skips.
 *
 * @param source - Original TAP bytes.
 * @param host - Closed host identity.
 * @param route - Ordinary or reviewed route.
 */
export const assertGenericSubtypeManagedWitTap = (source, host, route) => {
	assert.equal(typeof source, "string"); assert.ok(source.startsWith("TAP version 13\n"));
	assert.doesNotMatch(source, /^not ok |^Bail out!|# SKIP|# TODO/gmu);
	assert.doesNotMatch(source, /^[ \t]+(?:ok |not ok |# Subtest:|Bail out!)/gmu);
	const label = `installed generic Subtype ${labels[host]} compositions reproduce and relocate ${route} full`;
	assert.match(source, new RegExp(`^# Subtest: ${label.replaceAll(/[.*+?^${}()|[\]\\]/gu, "\\$&")}$`, "mu"));
	assert.match(source, /\n1\.\.1\n# tests 1\n# suites 0\n# pass 1\n# fail 0\n# cancelled 0\n# skipped 0\n# todo 0\n# duration_ms [0-9]+(?:\.[0-9]+)?\n$/u);
};

const jsonReader = read => async path => {
	genericSubtypeManagedWitSafePath(path);
	const bytes = Buffer.from(await read(path)), value = JSON.parse(bytes);
	assert.equal(bytes.toString(), canonicalJson(value), `Noncanonical record: ${path}`); return { bytes, value };
};

const assertObservation = observation => {
	assert.deepEqual(observation.counts, genericSubtypeManagedWitExpected);
	assert.equal(observation.run.code, 0); assert.equal(observation.run.stderr, "");
	parseGenericSubtypeManagedWitResult(observation.run.stdout);
};

/**
 * Reconcile one complete host/route record tree.
 *
 * @param read - Selection-relative original byte reader.
 * @param selected - Fixed host, route and producer revision.
 */
export const checkGenericSubtypeManagedWitReport = async (read, selected) => {
	const { host, route, producerCommit } = selected;
	assert.ok(genericSubtypeManagedWitHosts.includes(host)); assert.ok(genericSubtypeManagedWitRoutes.includes(route));
	assert.match(producerCommit, /^[a-f0-9]{40}$/u);
	const json = jsonReader(read), expected = genericSubtypeManagedWitReview(host);
	const configuration = genericSubtypeManagedWitConfiguration(host, route);
	const report = (await json("report.json")).value;
	assert.equal(report.schemaVersion, 1); assert.equal(report.route, route); assert.equal(report.mode, "full");
	assert.equal(report.producerCommit, producerCommit); assert.equal(report.genericCompositions, true);
	assert.equal(report.expectedBindingIrSha256, hashBindingIr(expected));
	assert.deepEqual((await json("expected.binding-ir.json")).value, expected);
	assert.deepEqual((await json("configuration.json")).value, configuration);
	assert.deepEqual(report.runtime, (await json("runtime.json")).value);
	assert.equal(report.runtime.platform, "linux"); assert.equal(report.runtime.arch, "x64");
	assert.equal(report.independentBuilds, 2); assert.equal(report.builds.length, 2);
	assert.deepEqual(report.builds[1], report.builds[0]);
	for(const key of ["reproducible", "authorInputsUnchanged", "sourceRemovedBeforeInstallation", "offlineInstall", "compilerFreeReplay", "relocatedInstallation"])
		assert.equal(report[key], true, key);
	const genericSource = await readFile(genericSubtypeSource);
	for(const attempt of [0, 1])
	{
		const prefix = `build-${attempt}/`, modelRecord = await json(prefix + "model.json");
		const model = modelRecord.value; validateBindingIr(model.bindingIr);
		assert.equal(reviewedContractDifference(expected, model.bindingIr), null);
		assert.equal(report.builds[attempt].bindingIrSha256, hashBindingIr(model.bindingIr));
		assert.equal(report.builds[attempt].modelSha256, sha256(modelRecord.bytes));
		const receiptRecord = await json(prefix + "package-set-receipt.json");
		assert.equal(report.builds[attempt].receiptSha256, sha256(receiptRecord.bytes));
		assert.deepEqual(receiptRecord.value.packages.map(pkg => [pkg.target, pkg.role]), [[targets[host], "component"]]);
		assert.deepEqual(Buffer.from(await read(`${prefix}${genericSubtypeModule}.lean`)), genericSource);
	}
	let executions = 0;
	if(host === "jvm")
	{
		assert.deepEqual(report.consumers.map(item => item.profile), genericSubtypeJvmProfiles);
		for(const consumer of report.consumers)
		{
			assert.equal((await read(`consumer.${consumer.profile === "java" ? "java" : "kt"}`)).toString()
				, await genericSubtypeManagedWitCaller(host, route, consumer.profile));
			assert.equal(consumer.observations.length, 3);
			for(const observation of consumer.observations) assertObservation(observation);
			executions += consumer.observations.length;
		}
	}
	else
	{
		const extension = { dotnet: "cs", php: "php", wit: "c" }[host];
		assert.equal((await read(`consumer.${extension}`)).toString(), await genericSubtypeManagedWitCaller(host, route));
		assert.equal(report.observations.length, host === "dotnet" ? 3 : host === "php" ? 4 : 2);
		for(const observation of report.observations) assertObservation(observation);
		executions = report.observations.length;
	}
	return { kind: `generic-subtype-${host}-installed-v1`
		, host, route, producerCommit
		, counts: genericSubtypeManagedWitExpected, executions };
};
