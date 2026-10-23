/**
 * Independent reconciliation for generic Subtype packages in Python, Ruby and Rust.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { hashBindingIr } from "../../src/binding-ir/canonical.mjs";
import { validateBindingIr } from "../../src/binding-ir/contract.mjs";
import { reviewedContractDifference } from "../../src/analyze/reviewed-source.mjs";
import { genericSubtypeModule, genericSubtypeSource, nominalSubtypeInstalledReview } from "./nominal-subtype-installed-fixture.mjs";
import { nominalSubtypePythonMinors } from "./nominal-subtype-python-fixture.mjs";
import { genericSubtypeRustApiProbe, genericSubtypeRustInputNames } from "./nominal-subtype-rust-install.mjs";
import {
	genericSubtypeLanguageCaller
	, genericSubtypeLanguageConfiguration
	, genericSubtypeLanguageExpected
	, genericSubtypeLanguageRoutes
	, parseGenericSubtypeLanguageResult
} from "./generic-subtype-languages.mjs";

export const genericSubtypeLanguages = Object.freeze(["python", "ruby", "rust"]);
const targets = Object.freeze({ python: "pypi", ruby: "rubygems", rust: "cargo" });
const extensions = Object.freeze({ python: "py", ruby: "rb", rust: "rs" });

/**
 * Refuse absolute paths, empty components and traversal before record reads.
 *
 * @param path - Candidate selection-relative record path.
 */
export const genericSubtypeLanguageSafePath = path => {
	assert.match(path, /^(?:[A-Za-z0-9_@.+-]+\/)*[A-Za-z0-9_@.+-]+$/u);
	assert.ok(path.split("/").every(part => part !== "." && part !== ".."));
	return path;
};

/**
 * Parse the fixed hosted report-checker invocation.
 *
 * @param arguments_ - Command-line arguments after the script name.
 */
export const parseGenericSubtypeLanguageCiArgs = arguments_ => {
	assert.equal(arguments_.length, 10, "Expected five named generic Subtype language arguments");
	const selected = {};
	for(let index = 0; index < arguments_.length; index += 2)
	{
		const flag = arguments_[index], value = arguments_[index + 1];
		assert.ok(["--language", "--route", "--producer", "--directory", "--tap"].includes(flag));
		assert.ok(!Object.hasOwn(selected, flag), `Duplicate ${flag}`);
		assert.ok(value && !/[\0\r\n]/u.test(value)); selected[flag] = value;
	}
	assert.deepEqual(Object.keys(selected).sort(), ["--directory", "--language", "--producer", "--route", "--tap"]);
	assert.ok(genericSubtypeLanguages.includes(selected["--language"]));
	assert.ok(genericSubtypeLanguageRoutes.includes(selected["--route"]));
	assert.match(selected["--producer"], /^[a-f0-9]{40}$/u);
	return {
		language: selected["--language"]
		, route: selected["--route"]
		, producerCommit: selected["--producer"]
		, directory: selected["--directory"]
		, tap: selected["--tap"]
	};
};

/**
 * Require exactly one selected installed-package test and no hidden skips.
 *
 * @param source - Original Node TAP output.
 * @param language - Selected package ecosystem.
 * @param route - Selected author route.
 */
export const assertGenericSubtypeLanguageTap = (source, language, route) => {
	assert.equal(typeof source, "string"); assert.ok(source.startsWith("TAP version 13\n"));
	assert.doesNotMatch(source, /^not ok |^Bail out!|# SKIP|# TODO/gmu);
	assert.doesNotMatch(source, /^[ \t]+(?:ok |not ok |# Subtest:|Bail out!)/gmu);
	const label = `installed generic Subtype ${language[0].toUpperCase() + language.slice(1)} compositions reproduce and relocate ${route} full`;
	assert.match(source, new RegExp(`^# Subtest: ${label.replaceAll(/[.*+?^${}()|[\]\\]/gu, "\\$&")}$`, "mu"));
	assert.match(source, /\n1\.\.1\n# tests 1\n# suites 0\n# pass 1\n# fail 0\n# cancelled 0\n# skipped 0\n# todo 0\n# duration_ms [0-9]+(?:\.[0-9]+)?\n$/u);
};

const jsonReader = read => async path => {
	genericSubtypeLanguageSafePath(path);
	const bytes = Buffer.from(await read(path)), value = JSON.parse(bytes);
	assert.equal(bytes.toString(), canonicalJson(value), `Noncanonical record: ${path}`);
	return { bytes, value };
};

const checkBuilds = async ({ read, json, report, expected, route, language }) => {
	assert.equal(report.independentBuilds, 2); assert.equal(report.builds.length, 2);
	assert.deepEqual(report.builds[1], report.builds[0]);
	const genericSource = await readFile(genericSubtypeSource);
	for(const attempt of [0, 1])
	{
		const prefix = `build-${attempt}/`, modelRecord = await json(prefix + "model.json");
		const model = modelRecord.value; validateBindingIr(model.bindingIr);
		assert.equal(reviewedContractDifference(expected, model.bindingIr), null);
		assert.equal(report.builds[attempt].bindingIrSha256, hashBindingIr(model.bindingIr));
		assert.equal(report.builds[attempt].modelSha256, sha256(modelRecord.bytes));
		if(route === "reviewed") assert.equal(model.sourceIdentity.reviewedBindingIr.source, canonicalJson(expected));
		else assert.equal(model.sourceIdentity.reviewedBindingIr, undefined);
		const receiptRecord = await json(prefix + "package-set-receipt.json");
		assert.equal(report.builds[attempt].receiptSha256, sha256(receiptRecord.bytes));
		assert.deepEqual(receiptRecord.value.packages.map(pkg => [pkg.target, pkg.role]), [[targets[language], "component"]]);
		assert.deepEqual(report.builds[attempt].archives
			, Object.fromEntries(receiptRecord.value.packages.flatMap(pkg =>
				pkg.artifacts.map(artifact => [artifact.path, artifact.sha256]))));
		assert.deepEqual(Buffer.from(await read(`${prefix}${genericSubtypeModule}.lean`)), genericSource);
	}
};

const commonReport = async (read, { language, route, producerCommit }) => {
	assert.ok(genericSubtypeLanguages.includes(language)); assert.ok(genericSubtypeLanguageRoutes.includes(route));
	assert.match(producerCommit, /^[a-f0-9]{40}$/u);
	const json = jsonReader(read), expected = nominalSubtypeInstalledReview(false, { genericCompositions: true });
	const configuration = genericSubtypeLanguageConfiguration(language, route);
	const report = (await json("report.json")).value;
	assert.equal(report.schemaVersion, 1); assert.equal(report.route, route); assert.equal(report.mode, "full");
	assert.equal(report.producerCommit, producerCommit); assert.equal(report.genericCompositions, true);
	assert.equal(report.expectedBindingIrSha256, hashBindingIr(expected));
	assert.deepEqual((await json("expected.binding-ir.json")).value, expected);
	assert.deepEqual((await json("configuration.json")).value, configuration);
	assert.deepEqual(report.runtime, (await json("runtime.json")).value);
	assert.equal(report.runtime.platform, "linux"); assert.equal(report.runtime.arch, "x64");
	assert.match(report.runtime.glibc.stdout, /^glibc 2\.[0-9]+\n$/u);
	for(const key of ["reproducible", "authorInputsUnchanged", "sourceRemovedBeforeInstallation"])
		assert.equal(report[key], true, key);
	await checkBuilds({ read, json, report, expected, route, language });
	const caller = await genericSubtypeLanguageCaller(language, route);
	assert.equal((await read(`consumer.${extensions[language]}`)).toString(), caller);
	return { json, report, caller };
};

const checkPython = async (read, selected) => {
	const { json, report, caller } = await commonReport(read, selected);
	assert.deepEqual(report.minors, nominalSubtypePythonMinors);
	assert.deepEqual(report.reports.map(item => item.minor), nominalSubtypePythonMinors);
	for(const item of report.reports)
	{
		assert.equal(item.genericCompositions, true); assert.equal(item.route, selected.route); assert.equal(item.mode, "full");
		assert.deepEqual(item.arguments, ["consumer.py"]); assert.equal(item.consumerSha256, sha256(caller));
		const flags = ["offlineInstall", "compilerFreeExecution"
			, "relocatedInstallation", "installedBytesUnchanged"
			, "sourceUnchangedAfterReplay"];
		for(const key of flags)
			assert.equal(item[key], true, key);
		assert.deepEqual((await json(`${item.minor}/report.json`)).value, item);
		assert.equal(item.observations.length, 2);
		for(const [index, stage] of ["installed", "relocated"].entries())
		{
			const observation = (await json(`${item.minor}/${stage}.json`)).value;
			assert.deepEqual(observation, item.observations[index]);
			assert.deepEqual(observation.counts, genericSubtypeLanguageExpected);
			assert.equal(observation.run.code, 0); assert.equal(observation.run.stderr, "");
			parseGenericSubtypeLanguageResult(observation.run.stdout);
		}
	}
	return { executions: 4, interpreters: nominalSubtypePythonMinors };
};

const checkRuby = async (read, selected) => {
	const { json, report, caller } = await commonReport(read, selected);
	assert.equal(report.observations.length, 2);
	assert.equal(report.gemReceiptSha256.length, 64);
	for(const [index, stage] of ["installed", "relocated"].entries())
	{
		const observation = (await json(`${stage}.json`)).value;
		assert.deepEqual(observation, report.observations[index]);
		assert.deepEqual(observation.args, ["consumer.rb"]);
		assert.deepEqual(observation.counts, genericSubtypeLanguageExpected);
		assert.equal(observation.run.code, 0); assert.equal(observation.run.stderr, "");
		parseGenericSubtypeLanguageResult(observation.run.stdout);
	}
	assert.equal(sha256(caller).length, 64);
	for(const key of ["offlineInstall", "compilerFreeReplay", "relocatedInstallation"])
		assert.equal(report[key], true, key);
	return { executions: 2 };
};

const checkRust = async (read, selected) => {
	const { json, report } = await commonReport(read, selected);
	assert.equal(report.observations.length, 3);
	assert.deepEqual(report.installation, (await json("installation.json")).value);
	assert.deepEqual(report.installation.api, { absent: [], present: [...genericSubtypeRustInputNames] });
	assert.equal((await read("api-probe.rs")).toString(), genericSubtypeRustApiProbe);
	for(const [index, stage] of ["installed", "relocated", "source-free"].entries())
	{
		const observation = (await json(`${stage}.json`)).value;
		assert.deepEqual(observation, report.observations[index]);
		assert.deepEqual(observation.counts, genericSubtypeLanguageExpected);
		assert.equal(observation.run.code, 0); assert.equal(observation.run.stderr, "");
		parseGenericSubtypeLanguageResult(observation.run.stdout);
	}
	for(const key of ["offlineInstall", "compilerFreeReplay", "relocatedInstallation", "sourceFreeExecutable"])
		assert.equal(report[key], true, key);
	return { executions: 3, sourceFree: true };
};

/**
 * Reconcile one complete language/route record tree.
 *
 * @param read - Selection-relative original byte reader.
 * @param selected - Fixed language, route and producer revision.
 */
export const checkGenericSubtypeLanguageReport = async (read, selected) => {
	const result = selected.language === "python"
		? await checkPython(read, selected)
		: selected.language === "ruby"
			? await checkRuby(read, selected)
			: await checkRust(read, selected);
	return { kind: `generic-subtype-${selected.language}-installed-v1`
		, language: selected.language
		, route: selected.route
		, producerCommit: selected.producerCommit
		, counts: genericSubtypeLanguageExpected, ...result };
};
