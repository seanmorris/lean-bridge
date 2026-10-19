/**
 * Authenticate the source closures and closed input parser used by hosted
 * value-index browser and native evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import test from "node:test";
import {
	checkedRecordValueIndexBrowserEvidenceSources
	, checkedRecordValueIndexHostedOriginal
	, checkedRecordValueIndexNativeEvidenceSources
} from "./checked-record-value-index-hosted-evidence-sources.mjs";
import {
	parseCheckedRecordValueIndexHostedArchiveArgs
} from "./checked-record-value-index-hosted-archive.mjs";

const revision = () => execFileSync("git", ["rev-parse", "HEAD"], {
	encoding: "utf8"
}).trim();
const authenticate = (sources, roles, required) => {
	assert.ok(sources.length > 100);
	assert.equal(new Set(sources.map(item =>
		`${item.role}:${item.path}`)).size, sources.length);
	assert.deepEqual([...new Set(sources.map(item => item.role))].sort()
		, [...roles].sort());
	for(const item of sources)
	{
		assert.match(item.revision, /^[a-f0-9]{40}$/u);
		assert.ok(checkedRecordValueIndexHostedOriginal(
			item.revision, item.path).length > 0, `${item.role}:${item.path}`);
	}
	for(const [role, path] of required)
		assert.ok(sources.some(item => item.role === role && item.path === path)
			, `${role}:${path}`);
};

test("value-index browser evidence closes producer, consumer, checker and archiver sources", {
	timeout: 120_000
}, () => {
	const head = revision();
	const sources = checkedRecordValueIndexBrowserEvidenceSources({
		producer: head, npmChecker: head, consumer: head, checker: head
		, archiver: head
	});
	authenticate(sources, [
		"producer", "npm-checker", "consumer", "checker", "archiver"
	], [
		["producer", "tests/fixtures/onboarding/checked-record-value-indices/CheckedRecordValueIndices.lean"]
		, ["consumer", "tests/fixtures/checked-record-value-index-browser/javascript.mjs"]
		, ["checker", ".github/workflows/checked-record-value-index-browser.yml"]
		, ["checker", "scripts/check-checked-record-value-index-browser-ci.mjs"]
		, ["archiver", "scripts/archive-checked-record-value-index-browser-evidence.mjs"]
		, ["archiver", "tests/helpers/checked-record-value-index-hosted-archive.mjs"]
	]);
});

test("value-index native evidence closes C/C++ production, consumption and checking sources", {
	timeout: 120_000
}, () => {
	const head = revision();
	const sources = checkedRecordValueIndexNativeEvidenceSources({
		producer: head, consumer: head, checker: head, archiver: head
	});
	authenticate(sources, [
		"producer", "consumer", "checker", "archiver"
	], [
		["producer", "src/backends/c/gmp.source.tar.xz"]
		, ["producer", "src/backends/cpp/boost.source.json"]
		, ["consumer", "tests/fixtures/checked-record-value-index-native/c.c"]
		, ["consumer", "tests/fixtures/checked-record-value-index-native/cpp.cpp"]
		, ["checker", ".github/workflows/checked-record-value-index-native.yml"]
		, ["checker", "scripts/check-checked-record-value-index-native-ci.mjs"]
		, ["archiver", "scripts/archive-checked-record-value-index-native-evidence.mjs"]
		, ["archiver", "tests/helpers/checked-record-value-index-hosted-archive.mjs"]
	]);
});

test("value-index hosted archivers accept only four explicit absolute inputs", () => {
	const values = [
		"--artifact-zip", "/evidence/artifact.zip"
		, "--run-json", "/evidence/run.json"
		, "--job-json", "/evidence/job.json"
		, "--artifact-json", "/evidence/artifact.json"
	];
	assert.deepEqual(parseCheckedRecordValueIndexHostedArchiveArgs(
		values, "usage"), {
		"artifact-zip": "/evidence/artifact.zip"
		, "run-json": "/evidence/run.json"
		, "job-json": "/evidence/job.json"
		, "artifact-json": "/evidence/artifact.json"}
	);
	for(const invalid of [
		values.slice(2), [...values, "--run-json", "/other.json"]
		, values.map(value => value === "/evidence/run.json" ? "run.json" : value)
		, values.map(value => value === "--run-json" ? "--unknown" : value)
	]) assert.throws(() => parseCheckedRecordValueIndexHostedArchiveArgs(
		invalid, "usage"), /usage/u);
});
