/**
 * Authenticate the source closures and closed input parser used by hosted
 * value-index browser and native evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
	checkedRecordValueIndexBrowserEvidenceSources
	, checkedRecordValueIndexHostedOriginal
	, checkedRecordValueIndexJvmEvidenceSources
	, checkedRecordValueIndexNativeEvidenceSources
	, checkedRecordValueIndexPerlEvidenceSources, checkedRecordValueIndexPhpEvidenceSources
	, checkedRecordValueIndexPythonEvidenceSources
	, checkedRecordValueIndexRubyEvidenceSources
	, checkedRecordValueIndexRustEvidenceSources
	, checkedRecordValueIndexWitEvidenceSources
} from "./checked-record-value-index-hosted-evidence-sources.mjs";
import {
	checkedRecordValueIndexHostedSafeZipPath
	, parseCheckedRecordValueIndexHostedArchiveArgs
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

test("value-index JVM evidence closes Java/Kotlin production, consumption and checking sources", {
	timeout: 120_000
}, () => {
	const head = revision();
	const sources = checkedRecordValueIndexJvmEvidenceSources({
		producer: head, consumer: head, checker: head, archiver: head
	});
	authenticate(sources, ["producer", "consumer", "checker", "archiver"], [
		["producer", "tests/fixtures/checked-record-value-index-jvm/java.java"]
		, ["producer", "tests/fixtures/checked-record-value-index-jvm/kotlin.kt"]
		, ["consumer", "tests/helpers/checked-record-value-index-jvm-fixture.mjs"]
		, ["checker", ".github/workflows/checked-record-value-index-jvm.yml"]
		, ["checker", "scripts/check-checked-record-value-index-jvm-ci.mjs"]
		, ["archiver", "scripts/archive-checked-record-value-index-jvm-evidence.mjs"]
		, ["archiver", "tests/helpers/checked-record-value-index-hosted-archive.mjs"]
	]);
});

test("value-index Perl evidence closes CPAN production, consumption and checking sources", {
	timeout: 120_000
}, () => {
	const head = revision();
	const sources = checkedRecordValueIndexPerlEvidenceSources({
		producer: head, consumer: head, checker: head, archiver: head
	});
	authenticate(sources, ["producer", "consumer", "checker", "archiver"], [
		["producer", "tests/fixtures/checked-record-value-index-perl/perl.pl"]
		, ["consumer", "tests/helpers/checked-record-value-index-perl-fixture.mjs"]
		, ["checker", ".github/workflows/checked-record-value-index-perl.yml"]
		, ["checker", "scripts/check-checked-record-value-index-perl-ci.mjs"]
		, ["archiver", "scripts/archive-checked-record-value-index-perl-evidence.mjs"]
		, ["archiver", "tests/helpers/checked-record-value-index-hosted-archive.mjs"]
	]);
});

test("value-index Perl archiving replays the retained TAP and records in one closed checker input", () => {
	const source = readFileSync(
		"scripts/archive-checked-record-value-index-perl-evidence.mjs", "utf8");
	const marker = "const checked = await checkCheckedRecordValueIndexPerlCiRecords({";
	assert.equal(source.split(marker).length, 2);
	const replay = source.split(marker)[1].split("\n\t\t});", 1)[0];
	for(const field of [
		"route, producer: revision, directory: recordsRoot"
		, "tap: tap.toString()"
		, "read: path => readFile(join(recordsRoot, path))"
		, "paths, runtime, interpreters"
	]) assert.ok(replay.includes(field), field);
	assert.doesNotMatch(replay, /\}\s*,\s*\{/u);
});

test("value-index native-PHP evidence closes Composer production, consumption and checking sources", {
	timeout: 120_000
}, () => {
	const head = revision();
	const sources = checkedRecordValueIndexPhpEvidenceSources({
		producer: head, consumer: head, checker: head, archiver: head
	});
	authenticate(sources, ["producer", "consumer", "checker", "archiver"], [
		["producer", "src/backends/php/brick-math.source.json"]
		, ["consumer", "tests/fixtures/checked-record-value-index-php/php.php"]
		, ["checker", ".github/workflows/checked-record-value-index-php.yml"]
		, ["checker", "scripts/check-checked-record-value-index-php-ci.mjs"]
		, ["checker", "scripts/select-nominal-subtype-php-ci-tools.mjs"]
		, ["archiver", "scripts/archive-checked-record-value-index-php-evidence.mjs"]
		, ["archiver", "tests/helpers/checked-record-value-index-php-controls.mjs"]
		, ["archiver", "tests/helpers/checked-record-value-index-hosted-archive.mjs"]
	]);
});

test("value-index Python evidence closes wheel production, consumption and checking sources", {
	timeout: 120_000
}, () => {
	const head = revision();
	const sources = checkedRecordValueIndexPythonEvidenceSources({
		producer: head, consumer: head, checker: head, archiver: head
	});
	authenticate(sources, ["producer", "consumer", "checker", "archiver"], [
		["producer", "tests/fixtures/checked-record-value-index-python/python.py"]
		, ["consumer", "tests/helpers/checked-record-value-index-python-fixture.mjs"]
		, ["checker", ".github/workflows/checked-record-value-index-python.yml"]
		, ["checker", "scripts/check-checked-record-value-index-python-ci.mjs"]
		, ["archiver", "scripts/archive-checked-record-value-index-python-evidence.mjs"]
		, ["archiver", "tests/helpers/checked-record-value-index-hosted-archive.mjs"]
	]);
});

test("value-index Ruby evidence closes gem production, consumption and checking sources", {
	timeout: 120_000
}, () => {
	const head = revision();
	const sources = checkedRecordValueIndexRubyEvidenceSources({
		producer: head, consumer: head, checker: head, archiver: head
	});
	authenticate(sources, ["producer", "consumer", "checker", "archiver"], [
		["producer", "tests/fixtures/checked-record-value-index-ruby/ruby.rb"]
		, ["consumer", "tests/helpers/checked-record-value-index-ruby-fixture.mjs"]
		, ["checker", ".github/workflows/checked-record-value-index-ruby.yml"]
		, ["checker", "scripts/check-checked-record-value-index-ruby-ci.mjs"]
		, ["archiver", "scripts/archive-checked-record-value-index-ruby-evidence.mjs"]
		, ["archiver", "tests/helpers/checked-record-value-index-hosted-archive.mjs"]
	]);
});

test("value-index Rust evidence closes crate production, consumption and checking sources", {
	timeout: 120_000
}, () => {
	const head = revision();
	const sources = checkedRecordValueIndexRustEvidenceSources({
		producer: head, consumer: head, checker: head, archiver: head
	});
	authenticate(sources, ["producer", "consumer", "checker", "archiver"], [
		["producer", "tests/fixtures/checked-record-value-index-rust/rust.rs"]
		, ["consumer", "tests/helpers/checked-record-value-index-rust-fixture.mjs"]
		, ["checker", ".github/workflows/checked-record-value-index-rust.yml"]
		, ["checker", "scripts/check-checked-record-value-index-rust-ci.mjs"]
		, ["checker", "scripts/bootstrap-rust-ci.sh"]
		, ["archiver", "scripts/archive-checked-record-value-index-rust-evidence.mjs"]
		, ["archiver", "tests/helpers/checked-record-value-index-hosted-archive.mjs"]
	]);
});

test("value-index Rust archiving replays the retained TAP and records through the dependency-aware reader", () => {
	const source = readFileSync(
		"scripts/archive-checked-record-value-index-rust-evidence.mjs", "utf8");
	const marker = "const checked = await checkCheckedRecordValueIndexRustCiRecords({";
	assert.equal(source.split(marker).length, 2);
	const replay = source.split(marker)[1].split("\n\t\t\tassert.equal", 1)[0];
	for(const field of [
		"route, producer: revision, directory: recordsRoot"
		, "tap: join(cell, \"run.tap\"), glibc: observed.floor"
		, "rustc: toolchain.rustc.command, cargo: toolchain.cargo.command"
		, "tap: tap.toString(), read, runtime, toolchain"
	]) assert.ok(replay.includes(field), field);
	assert.equal(source.split("await checkedRecordValueIndexRustCiReader(").length, 2);
});

test("value-index WIT evidence closes component production, consumption and checking sources", {
	timeout: 120_000
}, () => {
	const head = revision();
	const sources = checkedRecordValueIndexWitEvidenceSources({
		producer: head, consumer: head, checker: head, archiver: head
	});
	authenticate(sources, ["producer", "consumer", "checker", "archiver"], [
		["producer", "tests/fixtures/checked-record-value-index-wit/wit-wasi.c"]
		, ["consumer", "tests/helpers/checked-record-value-index-wit-fixture.mjs"]
		, ["checker", ".github/workflows/checked-record-value-index-wit.yml"]
		, ["checker", "scripts/check-checked-record-value-index-wit-ci.mjs"]
		, ["checker", "flake.lock"]
		, ["archiver", "scripts/archive-checked-record-value-index-wit-evidence.mjs"]
		, ["archiver", "tests/helpers/checked-record-value-index-hosted-archive.mjs"]
	]);
});

test("value-index WIT archiving replays retained TAP through the archive-derived component", () => {
	const source = readFileSync(
		"scripts/archive-checked-record-value-index-wit-evidence.mjs", "utf8");
	const marker = "const checked = await checkCheckedRecordValueIndexWitCiRecords({";
	assert.equal(source.split(marker).length, 2);
	const replay = source.split(marker)[1].split("\n\t\t\tassert.equal", 1)[0];
	for(const field of [
		"route, mode, producer: revision, directory: recordsRoot"
		, "tap: join(cell, \"run.tap\"), glibc: observed.floor"
		, "tap: tap.toString(), runtime: observed.runtime"
		, "tools: observed.tools, archiveSha256: original.archiveSha256"
	]) assert.ok(replay.includes(field), field);
	assert.equal(source.split("await inspectCheckedRecordValueIndexWitHandoff(").length, 2);
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

test("value-index hosted archivers accept JVM inner classes without allowing ZIP traversal", () => {
	assert.ok(checkedRecordValueIndexHostedSafeZipPath(
		"records/kotlin/api-probe/classes/ProbeKt$probeWideNatIndex$1.class"
	));
	for(const path of ["/absolute", "records/../outside", "records//empty"
		, "records\\windows", "records/space name"])
		assert.equal(checkedRecordValueIndexHostedSafeZipPath(path), false, path);
});
