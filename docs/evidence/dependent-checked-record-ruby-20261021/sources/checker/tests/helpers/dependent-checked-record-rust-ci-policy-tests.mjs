/**
 * Cheap hosted-policy controls for the dependent checked-record Rust acceptance lane.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
	assertDependentCheckedRecordRustCiTap, dependentCheckedRecordRustCiTestName
	, parseDependentCheckedRecordRustCiArgs
} from "./dependent-checked-record-rust-ci-report.mjs";

const route = "ordinary-source";
const valid = ["--route", route
	, "--producer", "a".repeat(40)
	, "--directory", "build/records"
	, "--tap", "build/run.tap"
	, "--glibc", "2.38"
	, "--rustc", "/tool/rustc"
	, "--cargo", "/tool/cargo"];

test("dependent checked-record Rust hosted checker closes its route and tool selection", () => {
	assert.deepEqual(parseDependentCheckedRecordRustCiArgs(valid), {
		route
		, producer: "a".repeat(40)
		, directory: "build/records"
		, tap: "build/run.tap"
		, glibc: "2.38"
		, rustc: "/tool/rustc"
		, cargo: "/tool/cargo"
	});
	for(const args of [
		valid.slice(0, -2)
		, [...valid, "--route", route]
		, valid.map(value => value === route ? "ordinary" : value)
		, valid.map(value => value === "/tool/cargo" ? "relative/cargo" : value)
		, valid.map(value => value === "2.38" ? "2.36" : value)
	]) assert.throws(() => parseDependentCheckedRecordRustCiArgs(args));
	const name = dependentCheckedRecordRustCiTestName(route);
	const tap = `TAP version 13\n# Subtest: ${name}\nok 1 - ${name}\n1..1\n# tests 1\n# suites 0\n# pass 1\n# fail 0\n# cancelled 0\n# skipped 0\n# todo 0\n# duration_ms 1\n`;
	assert.doesNotThrow(() => assertDependentCheckedRecordRustCiTap(tap, route));
	assert.throws(() => assertDependentCheckedRecordRustCiTap(tap.replace("# skipped 0", "# skipped 1"), route));
	assert.throws(() => assertDependentCheckedRecordRustCiTap(tap.replace("ok 1", "not ok 1"), route));
});

test("dependent checked-record Rust workflow runs and retains all four closed routes", async () => {
	const shell = await readFile("scripts/run-dependent-checked-record-rust-ci.sh", "utf8");
	assert.match(shell, /for route in ordinary-source reviewed-ir result-only-ordinary-source result-only-reviewed-ir; do/u);
	assert.match(shell, /LEAN_BRIDGE_DEPENDENT_CHECKED_RECORD_RUST_MAX_LOAD=6/u);
	assert.match(shell, /--test-name-pattern="\^\$name\$"/u);
	assert.match(shell, /check-dependent-checked-record-rust-ci\.mjs/u);
	assert.match(shell, /--glibc 2\.38/u);
	const checker = await readFile("scripts/check-dependent-checked-record-rust-ci.mjs", "utf8");
	assert.match(checker, /await realpath\(selected\[name\]\)/u);
	assert.match(checker, /dependentCheckedRecordRustCiReader/u);
	const workflow = await readFile(".github/workflows/dependent-checked-record-rust.yml", "utf8");
	assert.match(workflow, /runs-on: ubuntu-24\.04/u);
	assert.match(workflow, /timeout-minutes: 180/u);
	assert.match(workflow, /bash scripts\/bootstrap-toolchains\.sh --lean-only/u);
	assert.match(workflow, /bash scripts\/bootstrap-rust-ci\.sh/u);
	assert.match(workflow, /if: always\(\)/u);
	assert.match(workflow, /actions\/upload-artifact@v7/u);
	assert.match(workflow, /if: always\(\) && steps\.acceptance\.outcome != 'success'/u);
});
