/**
 * Independently replay the retained output of every generic-Subtype producer.
 * This module never rebuilds a package and never trusts a producer's own
 * verification JSON without reconstructing it from the retained record tree.
 *
 * @file
 */
import assert from "node:assert/strict";
import { lstat, readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { canonicalJson } from "../../src/capsule/node.mjs";
import {
	genericSubtypeHostedContract
} from "./generic-subtype-hosted-contracts.mjs";
import {
	checkGenericSubtypeLanguageReport, genericSubtypeLanguageSafePath
	, assertGenericSubtypeLanguageTap
} from "./generic-subtype-language-report.mjs";
import {
	assertGenericSubtypeManagedWitTap, checkGenericSubtypeManagedWitReport
	, genericSubtypeManagedWitSafePath
} from "./generic-subtype-managed-wit-report.mjs";
import {
	checkGenericSubtypeNativeReport, checkGenericSubtypePerlReport
	, genericSubtypeSafePath
} from "./generic-subtype-native-perl-report.mjs";
import {
	validateGenericSubtypeEvidence
} from "./generic-subtype-npm-browser.mjs";

const routes = Object.freeze(["ordinary", "reviewed"]);

/**
 * Refuse traversal and platform-specific path syntax.
 *
 * @param path - Artifact-relative path.
 */
export const genericSubtypeHostedSafePath = path => {
	assert.match(path, /^(?:[A-Za-z0-9_@.+-]+\/)*(?:[A-Za-z0-9_@.+-]+|\[Content_Types\]\.xml)$/u);
	assert.ok(path.split("/").every(part => part !== "." && part !== ".."));
	return path;
};

const regularFiles = async (root, prefix = "") => {
	const files = [];
	for(const entry of await readdir(join(root, prefix), { withFileTypes: true }))
	{
		const path = prefix ? `${prefix}/${entry.name}` : entry.name;
		genericSubtypeHostedSafePath(path);
		const information = await lstat(join(root, path));
		if(information.isDirectory()) files.push(...await regularFiles(root, path));
		else
		{
			assert.ok(information.isFile(), `Hosted output must be regular: ${path}`);
			files.push(path);
		}
	}
	return files.toSorted();
};

/**
 * Require one complete top-level Node TAP test and no hidden disposition.
 *
 * @param source - Original TAP output.
 * @param label - Exact selected test label.
 */
export const assertGenericSubtypeHostedTap = (source, label) => {
	assert.equal(typeof source, "string");
	assert.ok(source.startsWith("TAP version 13\n"));
	assert.doesNotMatch(source, /^not ok |^Bail out!|# SKIP|# TODO/gmu);
	assert.doesNotMatch(source, /^[ \t]+(?:ok |not ok |# Subtest:|Bail out!)/gmu);
	const quoted = label.replaceAll(/[.*+?^${}()|[\]\\]/gu, "\\$&");
	assert.match(source, new RegExp(`^# Subtest: ${quoted}$`, "mu"));
	assert.match(source, /\n1\.\.1\n# tests 1\n# suites 0\n# pass 1\n# fail 0\n# cancelled 0\n# skipped 0\n# todo 0\n# duration_ms [0-9]+(?:\.[0-9]+)?\n$/u);
};

const assertFoundationTap = source => {
	assert.equal(typeof source, "string");
	assert.ok(source.startsWith("TAP version 13\n"));
	assert.doesNotMatch(source, /^not ok |^Bail out!|# SKIP|# TODO/gmu);
	assert.doesNotMatch(source, /^# fail [1-9][0-9]*$/gmu);
	for(const label of [
		"nominal selection syntax names every field and case in source order"
		, "nominal native admission preserves callback direction, generic Fin and nested-site gates"
		, "dependent generic Subtype history restores every source"
		, "fresh Lean preserves nominal constructor selections and rejects false source decisions"
	]) assert.match(source, new RegExp(label.replaceAll(/[.*+?^${}()|[\]\\]/gu
		, "\\$&"), "u"));
	const tests = [...source.matchAll(/^# tests ([0-9]+)$/gmu)]
		.map(match => Number(match[1]));
	const passes = [...source.matchAll(/^# pass ([0-9]+)$/gmu)]
		.map(match => Number(match[1]));
	assert.ok(tests.length >= 2);
	assert.deepEqual(passes, tests);
	assert.ok(tests.every(count => count > 0));
};

const nonempty = async path => assert.ok((await readFile(path)).length > 0, path);
const json = async path => {
	const bytes = await readFile(path), value = JSON.parse(bytes);
	assert.equal(bytes.toString(), canonicalJson(value), `Noncanonical JSON: ${path}`);
	return value;
};

const expectedPrefix = lane => lane === "php-native" ? "php"
	: lane === "wit-wasi" ? "wit" : lane;

const allowed = (files, prefixes) => {
	for(const path of files)
		assert.ok(prefixes.some(prefix => path === prefix
			|| path.startsWith(`${prefix}/`)), `Unexpected hosted output: ${path}`);
};

const replayNpm = async (root, contract, files) => {
	const route = contract.routes[0];
	const report = `generic-subtype-npm-browser/${route}.json`;
	const logs = [`generic-subtype-engine-${route}.log`
		, `generic-subtype-runtime-${route}.log`];
	assert.deepEqual(files, [report, ...logs].toSorted());
	for(const path of logs) await nonempty(join(root, path));
	const evidence = await json(join(root, report));
	validateGenericSubtypeEvidence(evidence, [route]);
	assert.equal(evidence.observations[0].producerCommit.length, 40);
	return evidence.observations;
};

const replayFoundation = async (root, files, producerCommit) => {
	assert.deepEqual(files, ["dependent-generic-subtype-toolchain.log"
		, "dependent-generic-subtype.tap"]);
	await nonempty(join(root, files[0]));
	const tap = await readFile(join(root, files[1]), "utf8");
	assertFoundationTap(tap);
	return [{ kind: "dependent-generic-subtype-foundation-v1", producerCommit
		, tests: [...tap.matchAll(/^# tests ([0-9]+)$/gmu)]
			.reduce((sum, match) => sum + Number(match[1]), 0) }];
};

const replayNativePerl = async (lane, root, contract, files, producerCommit) => {
	const prefix = `generic-subtype-${lane}-ci`;
	const toolchain = `generic-subtype-${lane}-toolchain.log`;
	allowed(files, [prefix, toolchain]);
	assert.ok(files.includes(toolchain)); await nonempty(join(root, toolchain));
	const accepted = [];
	for(const route of routes)
	{
		const selected = `${prefix}/${route}`;
		const tap = await readFile(join(root, selected, "run.tap"), "utf8");
		const name = lane === "native" ? "native generic Subtype"
			: "generic Subtype Perl";
		assertGenericSubtypeHostedTap(tap
			, `installed ${name} compositions reproduce and relocate ${route} full`);
		const base = join(root, selected, "records", route, "full");
		const read = path => readFile(join(base, genericSubtypeSafePath(path)));
		const result = lane === "native"
			? await checkGenericSubtypeNativeReport(read, { route, producerCommit })
			: await checkGenericSubtypePerlReport(read, { route, producerCommit });
		assert.deepEqual(await json(join(root, selected, "verification.json")), result);
		accepted.push(result);
	}
	return accepted;
};

const replayLanguage = async (lane, root, files, producerCommit) => {
	const prefix = `generic-subtype-${lane}-ci`;
	const toolchain = `generic-subtype-${lane}-toolchain.log`;
	allowed(files, [prefix, toolchain]);
	assert.ok(files.includes(toolchain)); await nonempty(join(root, toolchain));
	const accepted = [];
	for(const route of routes)
	{
		const selected = `${prefix}/${route}`;
		const tap = await readFile(join(root, selected, "run.tap"), "utf8");
		assertGenericSubtypeLanguageTap(tap, lane, route);
		const base = join(root, selected, "records", route, "full");
		const result = await checkGenericSubtypeLanguageReport(path =>
			readFile(join(base, genericSubtypeLanguageSafePath(path)))
		, { language: lane, route, producerCommit });
		assert.deepEqual(await json(join(root, selected, "verification.json")), result);
		accepted.push(result);
	}
	return accepted;
};

const replayManagedWit = async (lane, root, files, producerCommit) => {
	const host = expectedPrefix(lane), prefix = `generic-subtype-${host}-ci`;
	const toolchain = `generic-subtype-${host}-toolchain.log`;
	allowed(files, [prefix, toolchain]);
	assert.ok(files.includes(toolchain)); await nonempty(join(root, toolchain));
	const accepted = [];
	for(const route of routes)
	{
		const selected = `${prefix}/${route}`;
		const tap = await readFile(join(root, selected, "run.tap"), "utf8");
		assertGenericSubtypeManagedWitTap(tap, host, route);
		const base = join(root, selected, "records", route, "full");
		const result = await checkGenericSubtypeManagedWitReport(path =>
			readFile(join(base, genericSubtypeManagedWitSafePath(path)))
		, { host, route, producerCommit });
		assert.deepEqual(await json(join(root, selected, "verification.json")), result);
		accepted.push(result);
	}
	return accepted;
};

/**
 * Replay one extracted hosted artifact through independent live validators.
 *
 * @param lane - Closed hosted lane name.
 * @param root - Extracted artifact directory.
 * @param producerCommit - Exact workflow revision.
 */
export const replayGenericSubtypeHostedOutput = async (
	lane, root, producerCommit
) => {
	const contract = genericSubtypeHostedContract(lane);
	assert.match(producerCommit, /^[a-f0-9]{40}$/u);
	const files = await regularFiles(root);
	assert.ok(files.length > 0);
	const accepted = contract.outputKind === "npm-browser"
		? await replayNpm(root, contract, files)
		: contract.outputKind === "foundation"
			? await replayFoundation(root, files, producerCommit)
			: contract.outputKind === "native" || contract.outputKind === "perl"
				? await replayNativePerl(lane, root, contract, files, producerCommit)
				: contract.outputKind === "language"
					? await replayLanguage(lane, root, files, producerCommit)
					: await replayManagedWit(lane, root, files, producerCommit);
	assert.deepEqual(accepted.map(item => item.producerCommit)
		.filter(Boolean), accepted.map(() => producerCommit));
	return {
		kind: `generic-subtype-${lane}-hosted-output-v1`, lane
		, profiles: [...contract.profiles], routes: [...contract.routes]
		, accepted, files
	};
};
