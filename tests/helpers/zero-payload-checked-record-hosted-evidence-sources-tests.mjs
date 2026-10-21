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
	, zeroPayloadJvmEvidenceSources
	, zeroPayloadNativeEvidenceSources
	, zeroPayloadPerlEvidenceSources
	, zeroPayloadPhpEvidenceSources
	, zeroPayloadPythonEvidenceSources
	, zeroPayloadRubyEvidenceSources
	, zeroPayloadRustEvidenceSources
	, zeroPayloadWitEvidenceSources
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

test("zero-payload JVM evidence closes every hosted source role", {
	timeout: 120_000
}, () => {
	const head = revision();
	const sources = zeroPayloadJvmEvidenceSources({
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
		, ["consumer", "tests/fixtures/zero-payload-checked-record-jvm/java.java"]
		, ["checker", ".github/workflows/zero-payload-checked-record-jvm.yml"]
		, ["checker", "scripts/check-zero-payload-checked-record-jvm-ci.mjs"]
		, ["archiver", "scripts/archive-zero-payload-checked-record-jvm-evidence.mjs"]
		, ["archiver", "tests/helpers/zero-payload-checked-record-hosted-archive.mjs"]
	]) assert.ok(sources.some(item => item.role === role && item.path === path)
		, `${role}:${path}`);
});

test("zero-payload Rust evidence closes every hosted source role", {
	timeout: 120_000
}, () => {
	const head = revision();
	const sources = zeroPayloadRustEvidenceSources({
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
		, ["consumer", "tests/fixtures/zero-payload-checked-record-rust/rust.rs"]
		, ["checker", ".github/workflows/zero-payload-checked-record-rust.yml"]
		, ["checker", "scripts/check-zero-payload-checked-record-rust-ci.mjs"]
		, ["archiver", "scripts/archive-zero-payload-checked-record-rust-evidence.mjs"]
		, ["archiver", "tests/helpers/zero-payload-checked-record-hosted-archive.mjs"]
	]) assert.ok(sources.some(item => item.role === role && item.path === path)
		, `${role}:${path}`);
});

test("zero-payload Perl evidence closes every hosted source role", {
	timeout: 120_000
}, () => {
	const head = revision();
	const sources = zeroPayloadPerlEvidenceSources({
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
		, ["consumer", "tests/fixtures/zero-payload-checked-record-perl/perl.pl"]
		, ["checker", ".github/workflows/zero-payload-checked-record-perl.yml"]
		, ["checker", "scripts/check-zero-payload-checked-record-perl-ci.mjs"]
		, ["archiver", "scripts/archive-zero-payload-checked-record-perl-evidence.mjs"]
		, ["archiver", "tests/helpers/zero-payload-checked-record-hosted-archive.mjs"]
	]) assert.ok(sources.some(item => item.role === role && item.path === path)
		, `${role}:${path}`);
});

test("zero-payload native-PHP evidence closes every hosted source role", {
	timeout: 120_000
}, () => {
	const head = revision();
	const sources = zeroPayloadPhpEvidenceSources({
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
		, ["consumer", "tests/fixtures/zero-payload-checked-record-php/php.php"]
		, ["checker", ".github/workflows/zero-payload-checked-record-php.yml"]
		, ["checker", "scripts/check-zero-payload-checked-record-php-ci.mjs"]
		, ["archiver", "scripts/archive-zero-payload-checked-record-php-evidence.mjs"]
		, ["archiver", "tests/helpers/zero-payload-checked-record-hosted-archive.mjs"]
	]) assert.ok(sources.some(item => item.role === role && item.path === path)
		, `${role}:${path}`);
});

test("zero-payload native-PHP archiving replays every retained Composer record", () => {
	const source = readFileSync(
		"scripts/archive-zero-payload-checked-record-php-evidence.mjs", "utf8");
	assert.equal(source.split("await checkZeroPayloadPhpCiRecords(args, {").length, 2);
	for(const field of [
		"tap: await readFile(tap, \"utf8\")"
		, "read: path => readFile(join(records, path))"
		, "runtime: observed.runtime, tools"
		, "assert.deepEqual(paths, rechecked.records"
	]) assert.ok(source.includes(field), field);
});

test("zero-payload Python evidence closes every hosted source role", {
	timeout: 120_000
}, () => {
	const head = revision();
	const sources = zeroPayloadPythonEvidenceSources({
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
		, ["consumer", "tests/fixtures/zero-payload-checked-record-python/python.py"]
		, ["checker", ".github/workflows/zero-payload-checked-record-python.yml"]
		, ["checker", "scripts/check-zero-payload-checked-record-python-ci.mjs"]
		, ["checker", "flake.lock"]
		, ["archiver", "scripts/archive-zero-payload-checked-record-python-evidence.mjs"]
		, ["archiver", "tests/helpers/zero-payload-checked-record-hosted-archive.mjs"]
	]) assert.ok(sources.some(item => item.role === role && item.path === path)
		, `${role}:${path}`);
});

test("zero-payload Python archiving replays retained wheel records", () => {
	const source = readFileSync(
		"scripts/archive-zero-payload-checked-record-python-evidence.mjs", "utf8");
	assert.equal(source.split("await checkZeroPayloadPythonCiRecords(args, {").length, 2);
	for(const field of [
		"tap: await readFile(tap, \"utf8\")"
		, "read: path => readFile(join(records, path))"
		, "runtime: observed.runtime"
		, "assert.ok(paths.length >= rechecked.records"
	]) assert.ok(source.includes(field), field);
});

test("zero-payload Ruby evidence closes every hosted source role", {
	timeout: 120_000
}, () => {
	const head = revision();
	const sources = zeroPayloadRubyEvidenceSources({
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
		, ["consumer", "tests/fixtures/zero-payload-checked-record-ruby/ruby.rb"]
		, ["checker", ".github/workflows/zero-payload-checked-record-ruby.yml"]
		, ["checker", "scripts/check-zero-payload-checked-record-ruby-ci.mjs"]
		, ["archiver", "scripts/archive-zero-payload-checked-record-ruby-evidence.mjs"]
		, ["archiver", "tests/helpers/zero-payload-checked-record-hosted-archive.mjs"]
	]) assert.ok(sources.some(item => item.role === role && item.path === path)
		, `${role}:${path}`);
});

test("zero-payload Ruby archiving replays retained gem records", () => {
	const source = readFileSync(
		"scripts/archive-zero-payload-checked-record-ruby-evidence.mjs", "utf8");
	const marker = "const checked = await checkZeroPayloadRubyCiRecords(args, {";
	assert.equal(source.split(marker).length, 2);
	const replay = source.split(marker)[1].split("\n\t\tassert.equal", 1)[0];
	for(const field of [
		"tap: tap.toString()"
		, "read: path => readFile(join(recordsRoot, path))"
		, "runtime, interpreter"
	]) assert.ok(replay.includes(field), field);
});

test("zero-payload WIT evidence closes every hosted source role", {
	timeout: 120_000
}, () => {
	const head = revision();
	const sources = zeroPayloadWitEvidenceSources({
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
		, ["consumer", "tests/fixtures/zero-payload-checked-record-wit/wit-wasi.c"]
		, ["consumer", "tests/fixtures/zero-payload-checked-record-wit/wit-values.h"]
		, ["checker", ".github/workflows/zero-payload-checked-record-wit.yml"]
		, ["checker", "scripts/check-zero-payload-checked-record-wit-ci.mjs"]
		, ["checker", "flake.lock"]
		, ["archiver", "scripts/archive-zero-payload-checked-record-wit-evidence.mjs"]
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
