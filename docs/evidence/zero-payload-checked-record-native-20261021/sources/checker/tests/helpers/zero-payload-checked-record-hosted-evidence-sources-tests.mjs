/**
 * Authenticate the closed source and input boundaries used to freeze hosted
 * zero-payload npm/browser evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import test from "node:test";
import {
	zeroPayloadBrowserEvidenceSources, zeroPayloadHostedOriginal
	, zeroPayloadDotnetEvidenceSources
	, zeroPayloadNativeEvidenceSources
} from "./zero-payload-checked-record-hosted-evidence-sources.mjs";
import {
	parseZeroPayloadHostedArchiveArgs, zeroPayloadHostedSafeZipPath
} from "./zero-payload-checked-record-hosted-archive.mjs";

const revision = () => execFileSync("git", ["rev-parse", "HEAD"], {
	encoding: "utf8"
}).trim();

test("zero-payload browser evidence closes every hosted source role", {
	timeout: 120_000
}, () => {
	const head = revision();
	const sources = zeroPayloadBrowserEvidenceSources({
		producer: head, npmChecker: head, consumer: head, checker: head
		, archiver: head
	});
	assert.ok(sources.length > 100);
	assert.equal(new Set(sources.map(item =>
		`${item.role}:${item.path}`)).size, sources.length);
	assert.deepEqual([...new Set(sources.map(item => item.role))].sort(), [
		"archiver", "checker", "consumer", "npm-checker", "producer"
	]);
	for(const item of sources)
	{
		assert.equal(item.revision, head);
		assert.ok(zeroPayloadHostedOriginal(item.revision, item.path).length > 0
			, `${item.role}:${item.path}`);
	}
	for(const [role, path] of [
		["producer", "tests/fixtures/onboarding/zero-payload-checked-records/ZeroPayloadCheckedRecords.lean"]
		, ["consumer", "tests/fixtures/zero-payload-checked-record-browser/javascript.mjs"]
		, ["checker", ".github/workflows/zero-payload-checked-record-browser.yml"]
		, ["checker", "scripts/check-zero-payload-checked-record-browser-ci.mjs"]
		, ["archiver", "scripts/archive-zero-payload-checked-record-browser-evidence.mjs"]
		, ["archiver", "tests/helpers/zero-payload-checked-record-hosted-archive.mjs"]
	]) assert.ok(sources.some(item => item.role === role && item.path === path)
		, `${role}:${path}`);
});

test("zero-payload native evidence closes every hosted source role", {
	timeout: 120_000
}, () => {
	const head = revision();
	const sources = zeroPayloadNativeEvidenceSources({
		producer: head, consumer: head, checker: head, archiver: head
	});
	assert.ok(sources.length > 80);
	assert.equal(new Set(sources.map(item =>
		`${item.role}:${item.path}`)).size, sources.length);
	assert.deepEqual([...new Set(sources.map(item => item.role))].sort(), [
		"archiver", "checker", "consumer", "producer"
	]);
	for(const item of sources)
	{
		assert.equal(item.revision, head);
		assert.ok(zeroPayloadHostedOriginal(item.revision, item.path).length > 0
			, `${item.role}:${item.path}`);
	}
	for(const [role, path] of [
		["producer", "tests/fixtures/onboarding/zero-payload-checked-records/ZeroPayloadCheckedRecords.lean"]
		, ["consumer", "tests/fixtures/zero-payload-checked-record-native/c.c"]
		, ["checker", ".github/workflows/zero-payload-checked-record-native.yml"]
		, ["checker", "scripts/check-zero-payload-checked-record-native-ci.mjs"]
		, ["archiver", "scripts/archive-zero-payload-checked-record-native-evidence.mjs"]
		, ["archiver", "tests/helpers/zero-payload-checked-record-hosted-archive.mjs"]
	]) assert.ok(sources.some(item => item.role === role && item.path === path)
		, `${role}:${path}`);
});

test("zero-payload .NET evidence closes every hosted source role", {
	timeout: 120_000
}, () => {
	const head = revision();
	const sources = zeroPayloadDotnetEvidenceSources({
		producer: head, consumer: head, checker: head, archiver: head
	});
	assert.ok(sources.length > 80);
	assert.equal(new Set(sources.map(item =>
		`${item.role}:${item.path}`)).size, sources.length);
	assert.deepEqual([...new Set(sources.map(item => item.role))].sort(), [
		"archiver", "checker", "consumer", "producer"
	]);
	for(const item of sources)
	{
		assert.equal(item.revision, head);
		assert.ok(zeroPayloadHostedOriginal(item.revision, item.path).length > 0
			, `${item.role}:${item.path}`);
	}
	for(const [role, path] of [
		["producer", "tests/fixtures/onboarding/zero-payload-checked-records/ZeroPayloadCheckedRecords.lean"]
		, ["consumer", "tests/fixtures/zero-payload-checked-record-dotnet/dotnet.cs"]
		, ["checker", ".github/workflows/zero-payload-checked-record-dotnet.yml"]
		, ["checker", "scripts/check-zero-payload-checked-record-dotnet-ci.mjs"]
		, ["archiver", "scripts/archive-zero-payload-checked-record-dotnet-evidence.mjs"]
		, ["archiver", "tests/helpers/zero-payload-checked-record-hosted-archive.mjs"]
	]) assert.ok(sources.some(item => item.role === role && item.path === path)
		, `${role}:${path}`);
});

test("zero-payload hosted evidence accepts only closed absolute selections", () => {
	const usage = "closed usage";
	const selected = {
		"artifact-zip": "/tmp/artifact.zip", "run-json": "/tmp/run.json"
		, "job-json": "/tmp/job.json", "artifact-json": "/tmp/artifact.json"
	};
	const args = Object.entries(selected)
		.flatMap(([name, value]) => [`--${name}`, value]);
	assert.deepEqual(parseZeroPayloadHostedArchiveArgs(args, usage), selected);
	for(const changed of [
		args.slice(1), [...args, "--run-json", "/tmp/other.json"]
		, args.map(value => value === "/tmp/run.json" ? "relative.json" : value)
	]) assert.throws(() => parseZeroPayloadHostedArchiveArgs(changed, usage));
	for(const path of [
		"records/report.json", "hosted/artifact.zip.parts/0000.part"
	]) assert.equal(zeroPayloadHostedSafeZipPath(path), true, path);
	for(const path of [
		"/absolute", "../outside", "records/../../outside", "records//file"
	]) assert.equal(zeroPayloadHostedSafeZipPath(path), false, path);
});
