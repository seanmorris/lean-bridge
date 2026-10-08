/**
 * Require executed JVM callback probes and independently reconstructed reports.
 *
 * @file
 */
import assert from "node:assert/strict";

const executionNames = ["owned-jvm-callback-results"
	, "owned-jvm-callback-mixed-signatures"
	, "owned-jvm-callback-result-packaging", "owned-jvm-callback-result-faults"
	, "owned-jvm-callback-result-gc", "owned-jvm-callback-result-process"
	, "owned-jvm-callback-result-sanitizers"
	, "owned-jvm-callback-result-combined-packaging"];
const evidenceNames = ["runtime", "package", "lifetime", "combined"]
	.map(name => "owned-jvm-callback-result-" + name + "-evidence");
const command = names => "node --test --test-concurrency=1 "
	+ names.map(name => `tests/${name}.test.mjs`).join(" ");
export const ownedJvmCallbackResultScript = "LEAN_BRIDGE_OWNED_JVM_CALLBACK_RESULT_TEST=1 "
	+ "LEAN_BRIDGE_OWNED_JVM_CALLBACK_RESULT_PACKAGE_TEST=1 "
	+ "LEAN_BRIDGE_OWNED_JVM_CALLBACK_RESULT_PROCESS_TEST=1 " + command(executionNames);
export const ownedJvmCallbackEvidenceScript = "LEAN_BRIDGE_OWNED_JVM_CALLBACK_RESULT_TEST=1 "
	+ command(evidenceNames);
export const ownedJvmCallbackResultReports = [
	...["ordinary", "reviewed"].flatMap(mode => ["no-host", "combined"]
		.map(variant => `build/owned-jvm-callback-results/${mode}-${variant}-package.json`))
	, ...["faults", "gc"].flatMap(kind => ["ordinary", "reviewed"]
		.map(mode => `build/owned-jvm-callback-result-${kind}/${mode}.json`))
	, ...["ordinary", "reviewed"].flatMap(mode => ["host", "no-host", "combined"]
		.map(variant => `build/owned-jvm-callback-results/${mode}-${variant}-runtime.json`))
	, ...["", "-no-host"].flatMap(variant => ["ordinary", "reviewed"]
		.map(mode => `build/owned-jvm-callback-results/${mode}${variant}-process.json`))
	, ...["ordinary", "reviewed"].flatMap(mode => ["no-host", "combined"]
		.map(variant => `build/owned-jvm-callback-results/${mode}-${variant}-sanitizers.json`))
	, ...["ordinary", "reviewed"].map(mode => `build/owned-jvm-callback-results/${mode}-combined-release.json`)
];

/**
 * Reject optional jobs, skipped probes, missing reports and unchecked evidence.
 *
 * @param workflow - Complete downstream workflow source.
 * @param manifest - Repository package manifest.
 */
export const assertOwnedJvmCallbackResultCi = (workflow, manifest) => {
	assert.equal(manifest.scripts["test:owned-jvm-callback-results"], ownedJvmCallbackResultScript);
	assert.equal(manifest.scripts["test:owned-jvm-callback-evidence"], ownedJvmCallbackEvidenceScript);
	const job = workflow.split("  owned-jvm-callback-results:\n")[1]?.split(/\n {2}[a-z][a-z0-9-]*:\n/u)[0];
	assert.ok(job); assert.doesNotMatch(job, /^ {4}(?:if|continue-on-error):/mu);
	assert.match(job, /^ {4}runs-on: ubuntu-24\.04$/mu);
	assert.match(job, /^ {4}timeout-minutes: 240$/mu);
	for(const dependency of ["build-essential", "maven", "m4", "ripgrep"
		, "mypy==2.3.1", "typing_extensions==4.6.0", "typing_extensions==4.16.0"])
		assert.ok(job.includes(dependency), dependency);
	for(const setup of ["java-version: '22.0.2'", "python-version: \"3.11\""
		, "python-version: \"3.12\"", "ruby-version: '3.3.12'"
		, "dotnet-version: '8.0.424'", "kotlin-compiler-2.2.0.zip"
		, "bash scripts/bootstrap-toolchains.sh", "bash scripts/bootstrap-rust-ci.sh"
		, "bash scripts/build-lean-link-spike.sh"
		, "bash scripts/install-playwright-browsers.sh chromium firefox webkit"])
		assert.ok(job.includes(setup), setup);
	const runtime = job.split("      - name: Verify JVM callback-result lifetimes and installed consumers\n")[1]?.split("      - name: ")[0];
	const evidence = job.split("      - name: Reconstruct JVM callback execution evidence\n")[1]?.split("      - name: ")[0];
	for(const [step, count, kind] of [[runtime, 28, "results"], [evidence, 10, "evidence"]])
	{
		assert.ok(step); assert.doesNotMatch(step, /^ {8}(?:if|continue-on-error):/mu);
		assert.match(step, /^ {8}shell: bash$/mu);
		const environment = kind === "results" ? ["source scripts/env.sh"
			, 'export LEAN_BRIDGE_JAVAC="$JAVA_HOME/bin/javac"'
			, 'export LEAN_BRIDGE_JAVA="$JAVA_HOME/bin/java"'
			, 'export LEAN_BRIDGE_MAVEN="$(command -v mvn)"'
			, 'export LEAN_BRIDGE_KOTLINC="$PWD/build/kotlin-tools/kotlinc/bin/kotlinc"'
			, 'export LEAN_BRIDGE_DOTNET="$(command -v dotnet)"'
			, 'export LEAN_BRIDGE_RUBY="$(command -v ruby)"'
			, 'export LEAN_BRIDGE_GEM="$(command -v gem)"'] : [];
		const log = `build/owned-jvm-callback-${kind}.log`;
		const lines = ["set -euo pipefail", ...environment
			, `npm run test:owned-jvm-callback-${kind} 2>&1 | tee ${log}`
			, ...[`tests ${count}`, `pass ${count}`, "fail 0", "cancelled 0", "skipped 0"]
				.map(value => `rg '^# ${value}$' ${log}`)
			, ...kind === "results" ? ownedJvmCallbackResultReports.map(path => "test -s " + path) : []];
		assert.equal(step.split("        run: |\n")[1]?.trim().replace(/^ {10}/gmu, ""), lines.join("\n"));
	}
	assert.ok(runtime.includes('          LEAN_BRIDGE_COLLECTION_PYTHONS: \'["${{ steps.jvm_callback_python311.outputs.python-path }}", "${{ steps.jvm_callback_python312.outputs.python-path }}"]\'\n'));
	const upload = job.split("      - name: Preserve JVM callback-result acceptance\n")[1];
	assert.match(upload, /^ {8}if: always\(\)$/mu);
	assert.match(upload, /^ {10}if-no-files-found: error$/mu);
	for(const path of ["owned-jvm-callback-results/"
		, "owned-jvm-callback-result-faults/"
		, "owned-jvm-callback-result-gc/", "owned-jvm-callback-results.log"
		, "owned-jvm-callback-evidence.log", "owned-jvm-callback-result-runtime.log"])
		assert.ok(upload.includes("            build/" + path + "\n"), path);
	const summary = workflow.split("  support-summary:\n")[1];
	assert.match(summary, /^ {6}- owned-jvm-callback-results$/mu);
	assert.ok(summary.includes("        if: needs.owned-jvm-callback-results.result != 'success'\n        run: exit 1\n"));
	return { tests: 28, evidenceTests: 10, reports: 24, failurePropagated: true };
};
