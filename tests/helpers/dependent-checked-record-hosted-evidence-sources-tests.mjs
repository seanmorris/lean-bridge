/**
 * Authenticate the closed source roles and hosted-artifact input boundary for
 * dependent checked-record Python, Ruby and Rust evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
	dependentCheckedRecordDotnetEvidenceSources
	, dependentCheckedRecordHostedOriginal
	, dependentCheckedRecordJvmEvidenceSources
	, dependentCheckedRecordPerlEvidenceSources
	, dependentCheckedRecordPhpEvidenceSources
	, dependentCheckedRecordPhpWasmEvidenceSources
	, dependentCheckedRecordPythonEvidenceSources
	, dependentCheckedRecordRubyEvidenceSources
	, dependentCheckedRecordRustEvidenceSources
	, dependentCheckedRecordWitEvidenceSources
} from "./dependent-checked-record-hosted-evidence-sources.mjs";
import {
	dependentCheckedRecordHostedSafeZipPath
	, parseDependentCheckedRecordHostedArchiveArgs
} from "./dependent-checked-record-hosted-archive.mjs";

const revision = () => execFileSync("git", ["rev-parse", "HEAD"], {
	encoding: "utf8"
}).trim();
const authenticate = (sources, required) => {
	assert.ok(sources.length > 100);
	assert.equal(new Set(sources.map(item =>
		`${item.role}:${item.path}`)).size, sources.length);
	assert.deepEqual([...new Set(sources.map(item => item.role))].sort()
		, ["archiver", "checker", "consumer", "producer"]);
	for(const item of sources)
	{
		assert.match(item.revision, /^[a-f0-9]{40}$/u);
		assert.ok(dependentCheckedRecordHostedOriginal(
			item.revision, item.path).length > 0, `${item.role}:${item.path}`);
	}
	for(const [role, path] of required)
		assert.ok(sources.some(item => item.role === role && item.path === path)
			, `${role}:${path}`);
};
const select = fn => {
	const head = revision();
	return fn({ producer: head, consumer: head, checker: head, archiver: head });
};

test("dependent Python evidence closes wheel production, consumption and checking sources", {
	timeout: 120_000
}, () => authenticate(select(dependentCheckedRecordPythonEvidenceSources), [
	["producer", "tests/fixtures/onboarding/dependent-checked-records/DependentRecords.lean"]
	, ["consumer", "tests/fixtures/dependent-checked-record-consumers/python.py"]
	, ["checker", ".github/workflows/dependent-checked-record-python.yml"]
	, ["checker", "scripts/check-dependent-checked-record-python-ci.mjs"]
	, ["archiver", "scripts/archive-dependent-checked-record-python-evidence.mjs"]
	, ["archiver", "tests/helpers/dependent-checked-record-hosted-archive.mjs"]
]));

test("dependent Ruby evidence closes gem production, consumption and checking sources", {
	timeout: 120_000
}, () => authenticate(select(dependentCheckedRecordRubyEvidenceSources), [
	["producer", "tests/fixtures/onboarding/dependent-checked-records/DependentRecords.lean"]
	, ["consumer", "tests/fixtures/dependent-checked-record-consumers/ruby.rb"]
	, ["checker", ".github/workflows/dependent-checked-record-ruby.yml"]
	, ["checker", "scripts/check-dependent-checked-record-ruby-ci.mjs"]
	, ["archiver", "scripts/archive-dependent-checked-record-ruby-evidence.mjs"]
	, ["archiver", "tests/helpers/dependent-checked-record-hosted-archive.mjs"]
]));

test("dependent Rust evidence closes crate production, consumption and checking sources", {
	timeout: 120_000
}, () => authenticate(select(dependentCheckedRecordRustEvidenceSources), [
	["producer", "tests/fixtures/onboarding/dependent-checked-records/DependentRecords.lean"]
	, ["consumer", "tests/fixtures/dependent-checked-record-consumers/rust.rs"]
	, ["checker", ".github/workflows/dependent-checked-record-rust.yml"]
	, ["checker", "scripts/check-dependent-checked-record-rust-ci.mjs"]
	, ["checker", "scripts/bootstrap-rust-ci.sh"]
	, ["archiver", "scripts/archive-dependent-checked-record-rust-evidence.mjs"]
	, ["archiver", "tests/helpers/dependent-checked-record-hosted-archive.mjs"]
]));

test("dependent Perl evidence closes CPAN production, consumption and checking sources", {
	timeout: 120_000
}, () => authenticate(select(dependentCheckedRecordPerlEvidenceSources), [
	["producer", "tests/fixtures/onboarding/dependent-checked-records/DependentRecords.lean"]
	, ["consumer", "tests/fixtures/dependent-checked-record-consumers/perl.pl"]
	, ["checker", ".github/workflows/dependent-checked-record-perl.yml"]
	, ["checker", "scripts/check-dependent-checked-record-perl-ci.mjs"]
	, ["checker", "scripts/build-perl-toolchains.mjs"]
	, ["archiver", "scripts/archive-dependent-checked-record-perl-evidence.mjs"]
	, ["archiver", "tests/helpers/dependent-checked-record-hosted-archive.mjs"]
]));

test("dependent .NET evidence closes NuGet production, consumption and checking sources", {
	timeout: 120_000
}, () => authenticate(select(dependentCheckedRecordDotnetEvidenceSources), [
	["producer", "tests/fixtures/onboarding/dependent-checked-records/DependentRecords.lean"]
	, ["consumer", "tests/fixtures/dependent-checked-record-consumers/dotnet.cs"]
	, ["checker", ".github/workflows/dependent-checked-record-dotnet.yml"]
	, ["checker", "scripts/check-dependent-checked-record-dotnet-ci.mjs"]
	, ["archiver", "scripts/archive-dependent-checked-record-dotnet-evidence.mjs"]
	, ["archiver", "tests/helpers/dependent-checked-record-hosted-archive.mjs"]
]));

test("dependent JVM evidence closes Maven production, consumption and checking sources", {
	timeout: 120_000
}, () => authenticate(select(dependentCheckedRecordJvmEvidenceSources), [
	["producer", "tests/fixtures/onboarding/dependent-checked-records/DependentRecords.lean"]
	, ["consumer", "tests/fixtures/dependent-checked-record-consumers/java.java"]
	, ["consumer", "tests/fixtures/dependent-checked-record-consumers/kotlin.kt"]
	, ["checker", ".github/workflows/dependent-checked-record-jvm.yml"]
	, ["checker", "scripts/check-dependent-checked-record-jvm-ci.mjs"]
	, ["archiver", "scripts/archive-dependent-checked-record-jvm-evidence.mjs"]
	, ["archiver", "tests/helpers/dependent-checked-record-hosted-archive.mjs"]
]));

test("dependent native-PHP evidence closes Composer production, consumption and checking sources", {
	timeout: 120_000
}, () => authenticate(select(dependentCheckedRecordPhpEvidenceSources), [
	["producer", "tests/fixtures/onboarding/dependent-checked-records/DependentRecords.lean"]
	, ["consumer", "tests/fixtures/dependent-checked-record-consumers/php.php"]
	, ["checker", ".github/workflows/dependent-checked-record-php.yml"]
	, ["checker", "scripts/check-dependent-checked-record-php-ci.mjs"]
	, ["checker", "scripts/select-nominal-subtype-php-ci-tools.mjs"]
	, ["archiver", "scripts/archive-dependent-checked-record-php-evidence.mjs"]
	, ["archiver", "tests/helpers/dependent-checked-record-hosted-archive.mjs"]
]));

test("dependent WIT evidence closes component production, consumption and checking sources", {
	timeout: 120_000
}, () => authenticate(select(dependentCheckedRecordWitEvidenceSources), [
	["producer", "tests/fixtures/onboarding/dependent-checked-records/DependentRecords.lean"]
	, ["consumer", "tests/fixtures/dependent-checked-record-consumers/wit-wasi.c"]
	, ["consumer", "tests/fixtures/dependent-checked-record-consumers/wit-values.h"]
	, ["checker", ".github/workflows/dependent-checked-record-wit.yml"]
	, ["checker", "scripts/check-dependent-checked-record-wit-ci.mjs"]
	, ["checker", "scripts/select-nominal-subtype-wit-ci-tools.mjs"]
	, ["archiver", "scripts/archive-dependent-checked-record-wit-evidence.mjs"]
	, ["archiver", "tests/helpers/dependent-checked-record-hosted-archive.mjs"]
]));

test("dependent PHP-Wasm evidence closes package-set production, consumption and checking sources", {
	timeout: 120_000
}, () => authenticate(select(dependentCheckedRecordPhpWasmEvidenceSources), [
	["producer", "tests/fixtures/onboarding/dependent-checked-records/DependentRecords.lean"]
	, ["consumer", "tests/fixtures/dependent-checked-record-consumers/php.php"]
	, ["checker", ".github/workflows/dependent-checked-record-php-wasm.yml"]
	, ["checker", "scripts/check-dependent-checked-record-php-wasm-ci.mjs"]
	, ["checker", "scripts/check-dependent-checked-record-php-wasm-compiler-ci.mjs"]
	, ["checker", "scripts/bootstrap-php-wasm-ci.sh"]
	, ["archiver", "scripts/archive-dependent-checked-record-php-wasm-evidence.mjs"]
	, ["archiver", "tests/helpers/dependent-checked-record-hosted-archive.mjs"]
]));

test("dependent Rust archiving replays TAP and records through the dependency-aware reader", () => {
	const source = readFileSync(
		"scripts/archive-dependent-checked-record-rust-evidence.mjs", "utf8");
	const marker = "const checked = await checkDependentCheckedRecordRustCiRecords({";
	assert.equal(source.split(marker).length, 2);
	const replay = source.split(marker)[1].split("\n\t\tassert.equal", 1)[0];
	for(const field of [
		"route, producer: revision, directory: recordsRoot"
		, "tap: join(cell, \"run.tap\"), glibc: observed.floor"
		, "rustc: toolchain.rustc.command, cargo: toolchain.cargo.command"
		, "tap: tap.toString(), read, runtime, toolchain"
	]) assert.ok(replay.includes(field), field);
	assert.equal(source.split("await dependentCheckedRecordRustCiReader(").length, 2);
});

test("dependent hosted archivers accept only four explicit absolute inputs", () => {
	const values = [
		"--artifact-zip", "/evidence/artifact.zip"
		, "--run-json", "/evidence/run.json"
		, "--job-json", "/evidence/job.json"
		, "--artifact-json", "/evidence/artifact.json"
	];
	assert.deepEqual(parseDependentCheckedRecordHostedArchiveArgs(
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
	]) assert.throws(() => parseDependentCheckedRecordHostedArchiveArgs(
		invalid, "usage"), /usage/u);
});

test("dependent hosted archivers reject ZIP traversal", () => {
	assert.ok(dependentCheckedRecordHostedSafeZipPath(
		"records/rust/api-probe/classes/Probe$Inner.class"
	));
	for(const path of ["/absolute", "records/../outside", "records//empty"
		, "records\\windows", "records/space name"])
		assert.equal(dependentCheckedRecordHostedSafeZipPath(path), false, path);
});
