/**
 * Independent reconciliation for installed generic Subtype native and Perl reports.
 *
 * @file
 */
import assert from "node:assert/strict";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { hashBindingIr } from "../../src/binding-ir/canonical.mjs";
import { validateBindingIr } from "../../src/binding-ir/contract.mjs";
import { reviewedContractDifference } from "../../src/analyze/reviewed-source.mjs";
import { checkedRecordPerlConfigurations, checkedRecordPerlModes } from "./checked-record-perl-install.mjs";
import { nominalSubtypeInstalledConfiguration, nominalSubtypeInstalledReview } from "./nominal-subtype-installed-fixture.mjs";
import {
	genericSubtypeNativeCaller
	, genericSubtypeNativeExpected
	, genericSubtypeNativeProfiles
	, genericSubtypePerlCaller
	, genericSubtypePerlConfiguration
	, genericSubtypePerlExpected
	, genericSubtypeRoutes
	, parseGenericSubtypePerlResult
} from "./generic-subtype-native-perl.mjs";

const digest = value => assert.match(value, /^[a-f0-9]{64}$/u);
const jsonReader = read => async path => {
	const bytes = Buffer.from(await read(path)), value = JSON.parse(bytes);
	assert.equal(bytes.toString(), canonicalJson(value), `Noncanonical record: ${path}`);
	return value;
};

/**
 * Refuse absolute paths and traversal before reading a retained record.
 *
 * @param path - Candidate record-relative path.
 */
export const genericSubtypeSafePath = path => {
	assert.match(path, /^(?:[A-Za-z0-9_@.+-]+\/)*[A-Za-z0-9_@.+-]+$/u);
	assert.ok(path.split("/").every(part => part !== "." && part !== ".."));
	return path;
};

const checkBuilds = async ({ report, json, expected }) => {
	assert.equal(report.independentBuilds, 2); assert.equal(report.builds.length, 2);
	assert.deepEqual(report.builds[1], report.builds[0]);
	for(const attempt of [0, 1])
	{
		const prefix = `build-${attempt}/`, model = await json(prefix + "model.json");
		validateBindingIr(model.bindingIr);
		assert.equal(reviewedContractDifference(expected, model.bindingIr), null);
		assert.equal(report.builds[attempt].bindingIrSha256, hashBindingIr(model.bindingIr));
		assert.equal(report.builds[attempt].modelSha256, sha256(canonicalJson(model)));
		const receipt = await json(prefix + "package-set-receipt.json");
		assert.equal(report.builds[attempt].receiptSha256, sha256(canonicalJson(receipt)));
		assert.deepEqual(report.builds[attempt].archives
			, Object.fromEntries(receipt.packages.flatMap(pkg =>
				pkg.artifacts.map(artifact => [artifact.path, artifact.sha256]))));
		for(const value of Object.values(report.builds[attempt].archives)) digest(value);
	}
};

/**
 * Reconcile one installed C/C++ generic-composition report.
 *
 * @param read - Original record reader rooted at one route.
 * @param options - Independently fixed selection.
 * @param options.route - Ordinary or reviewed author route.
 * @param options.producerCommit - Exact producer revision.
 */
export const checkGenericSubtypeNativeReport = async (read, { route, producerCommit }) => {
	assert.ok(genericSubtypeRoutes.includes(route)); assert.match(producerCommit, /^[a-f0-9]{40}$/u);
	const json = jsonReader(read), expected = nominalSubtypeInstalledReview(false, { genericCompositions: true });
	const configuration = nominalSubtypeInstalledConfiguration(route, genericSubtypeNativeProfiles, false, { genericCompositions: true });
	const report = await json("report.json");
	assert.equal(report.schemaVersion, 1); assert.equal(report.route, route); assert.equal(report.mode, "full");
	assert.equal(report.producerCommit, producerCommit); assert.equal(report.genericCompositions, true);
	assert.deepEqual(report.profiles, genericSubtypeNativeProfiles);
	assert.deepEqual(report.configuration, configuration);
	assert.deepEqual(await json("configuration.json"), configuration);
	assert.deepEqual(await json("expected.binding-ir.json"), expected);
	assert.equal(report.expectedBindingIrSha256, hashBindingIr(expected));
	for(const key of ["reproducible", "authorInputsUnchanged"]) assert.equal(report[key], true, key);
	await checkBuilds({ report, json, expected });
	assert.equal(report.reports.length, genericSubtypeNativeProfiles.length);
	for(const [index, profile] of genericSubtypeNativeProfiles.entries())
	{
		const item = report.reports[index], caller = await genericSubtypeNativeCaller(profile, route);
		assert.equal(item.profile, profile); assert.equal(item.checks, genericSubtypeNativeExpected[profile]);
		assert.equal(item.sourceSha256, sha256(caller)); assert.equal(item.consumerSha256, sha256(caller));
		assert.equal((await read(`consumers/${profile}.${profile}`)).toString(), caller);
		for(const key of ["compilerFreePath", "compilerFreeReplay", "offlineInstall"
			, "relocatedInstallation", "sourceRemovedBeforeInstallation"])
			assert.equal(item[key], true, key);
		assert.equal(item.runs.length, 2);
		for(const [position, run] of item.runs.entries())
		{
			assert.equal(run.code, 0); assert.equal(run.stderr, "");
			assert.equal(run.stdout, `generic-subtype-ok:${genericSubtypeNativeExpected[profile]}\n`);
			assert.equal(run.relocated, position === 1);
		}
		assert.deepEqual(await json(`${profile}/report.json`), item);
	}
	return { kind: "generic-subtype-native-installed-v1", route, producerCommit
		, profiles: genericSubtypeNativeProfiles, executions: 4 };
};

/**
 * Reconcile one installed four-ABI Perl generic-composition report.
 *
 * @param read - Original record reader rooted at one route.
 * @param options - Independently fixed selection.
 * @param options.route - Ordinary or reviewed author route.
 * @param options.producerCommit - Exact producer revision.
 */
export const checkGenericSubtypePerlReport = async (read, { route, producerCommit }) => {
	assert.ok(genericSubtypeRoutes.includes(route)); assert.match(producerCommit, /^[a-f0-9]{40}$/u);
	const json = jsonReader(read), expected = nominalSubtypeInstalledReview(false, { genericCompositions: true });
	const configuration = genericSubtypePerlConfiguration(route), report = await json("report.json");
	assert.equal(report.schemaVersion, 1); assert.equal(report.route, route); assert.equal(report.mode, "full");
	assert.equal(report.producerCommit, producerCommit); assert.equal(report.genericCompositions, true);
	assert.deepEqual(report.configurations, checkedRecordPerlConfigurations);
	assert.deepEqual(report.deliveryModes, checkedRecordPerlModes);
	assert.deepEqual(await json("configuration.json"), configuration);
	assert.deepEqual(await json("expected.binding-ir.json"), expected);
	assert.equal(report.expectedBindingIrSha256, hashBindingIr(expected));
	for(const key of ["reproducible", "authorInputsUnchanged", "sourceRemovedBeforeInstallation"])
		assert.equal(report[key], true, key);
	await checkBuilds({ report, json, expected });
	const caller = await genericSubtypePerlCaller(route);
	assert.equal((await read("consumer.pl")).toString(), caller);
	const matrix = checkedRecordPerlConfigurations.flatMap(configurationName =>
		checkedRecordPerlModes.map(delivery => [configurationName, delivery]));
	assert.deepEqual(report.reports.map(item => [item.configuration, item.delivery]), matrix);
	for(const item of report.reports)
	{
		assert.equal(item.route, route); assert.equal(item.mode, "full");
		assert.equal(item.genericCompositions, true); assert.equal(item.checks, genericSubtypePerlExpected.checks);
		assert.equal(item.rejections, genericSubtypePerlExpected.rejections);
		assert.equal(item.consumerSha256, sha256(caller)); assert.deepEqual(item.arguments, ["consumer.pl"]);
		const flags = ["offlineInstall", "compilerFreeExecution"
			, "leanCompilerUnavailable", "extractedDistributionsRemoved"
			, "nativePayloadUnchanged", "installedBytesUnchanged"
			, "relocatedInstallation", "compilerFreeReplay"
			, "sourceUnchangedAfterReplay"];
		for(const key of flags)
			assert.equal(item[key], true, key);
		for(const name of ["first.json", "repeated.json"])
		{
			const run = await json(`${item.configuration}/${item.delivery}/${name}`);
			assert.equal(run.code, 0); assert.equal(run.stderr, ""); parseGenericSubtypePerlResult(run.stdout);
		}
		assert.deepEqual(await json(`${item.configuration}/${item.delivery}/report.json`), item);
	}
	return { kind: "generic-subtype-perl-installed-v1", route, producerCommit
		, configurations: checkedRecordPerlConfigurations
		, deliveryModes: checkedRecordPerlModes
		, executions: report.reports.length * 2 };
};
