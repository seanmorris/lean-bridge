/**
 * Require fresh four-ABI Perl callback execution and source-bound verification.
 *
 * @file
 */
import assert from "node:assert/strict";

const helper = name => `tests/helpers/owned-perl-callback-result-${name}.mjs`;
const command = paths => "node --test --test-concurrency=1 " + paths.join(" ");
export const ownedPerlCallbackExecutionPaths = [
	"tests/owned-perl-callback-result-contract.test.mjs"
	, ...["factory", "xs", "runtime", "fault", "lifetime", "mutant", "sanitizer", "packaging", "combined-packaging"]
		.map(name => helper(name + "-tests"))
	, helper("variant-packaging-tests")
];
export const ownedPerlCallbackEvidencePaths = ["runtime", "fault", "lifetime", "mutant", "sanitizer", "package", "combined"]
	.map(name => helper(name + "-evidence-tests")).concat(helper("variant-evidence-tests"));
export const ownedPerlCallbackResultScript = "LEAN_BRIDGE_OWNED_NATIVE_TEST=1 "
	+ "LEAN_BRIDGE_OWNED_PERL_CALLBACK_RESULT_TEST=1 "
	+ "LEAN_BRIDGE_OWNED_PERL_CALLBACK_RESULT_MUTANT_TEST=1 "
	+ "LEAN_BRIDGE_OWNED_PERL_CALLBACK_RESULT_PACKAGE_TEST=1 "
	+ "LEAN_BRIDGE_OWNED_PERL_CALLBACK_RESULT_VARIANT_PACKAGE_TEST=1 "
	+ command(ownedPerlCallbackExecutionPaths);
export const ownedPerlCallbackEvidenceScript = "LEAN_BRIDGE_OWNED_PERL_CALLBACK_RESULT_EVIDENCE_TEST=1 "
	+ command(ownedPerlCallbackEvidencePaths);
export const ownedPerlCallbackResultReports = [
	...["ordinary", "reviewed"].flatMap(mode => ["no-host", "host", "combined", "combined-package", "combined-release"]
		.map(variant => `build/owned-perl-callback-results/${mode}-${variant}.json`))
	, ...["faults", "lifetime", "mutants", "sanitizers"].flatMap(kind => ["ordinary", "reviewed"]
		.map(mode => `build/owned-perl-callback-result-${kind}/${mode}.json`))
	, ...["ordinary", "reviewed"].flatMap(mode => ["no-host", "host"]
		.map(variant => `build/owned-perl-callback-result-variants/${mode}-${variant}-package.json`))
];
const tools = ["build-essential", "cmake", "libgmp-dev", "libuv1-dev"
	, "m4", "maven", "ripgrep"
	, "mypy==2.3.1", "typing_extensions==4.6.0", "typing_extensions==4.16.0"];
const setup = ["java-version: '22.0.2'", "python-version: \"3.11\""
	, "python-version: \"3.12\"", "ruby-version: '3.3.12'"
	, "dotnet-version: '8.0.424'", "kotlin-compiler-2.2.0.zip"
	, "bash scripts/bootstrap-toolchains.sh", "bash scripts/bootstrap-rust-ci.sh"
	, "bash scripts/build-lean-link-spike.sh"];

/**
 * Reject optional execution, narrowed matrices, missing reports and skipped tests.
 *
 * @param workflow - Complete downstream workflow source.
 * @param manifest - Repository package manifest.
 * @param legacy - Check only the immutable predecessor's combined-only gate.
 */
export const assertOwnedPerlCallbackResultCi = (workflow, manifest, legacy = false) => {
	assert.equal(typeof legacy, "boolean");
	const resultScript = legacy ? ownedPerlCallbackResultScript
		.replace("LEAN_BRIDGE_OWNED_PERL_CALLBACK_RESULT_VARIANT_PACKAGE_TEST=1 ", "")
		.replace(" " + helper("variant-packaging-tests"), "") : ownedPerlCallbackResultScript;
	const evidenceScript = legacy ? ownedPerlCallbackEvidenceScript.replace(" " + helper("variant-evidence-tests"), "") : ownedPerlCallbackEvidenceScript;
	const reports = legacy ? ownedPerlCallbackResultReports.filter(path => !path.startsWith("build/owned-perl-callback-result-variants/")) : ownedPerlCallbackResultReports;
	assert.equal(manifest.scripts["test:owned-perl-callback-results"], resultScript);
	assert.equal(manifest.scripts["test:owned-perl-callback-evidence"], evidenceScript);
	const job = workflow.split("  owned-perl-callback-results:\n")[1]?.split(/\n {2}[a-z][a-z0-9-]*:\n/u)[0];
	assert.ok(job); assert.doesNotMatch(job, /^ {4}(?:if|continue-on-error):/mu);
	assert.match(job, /^ {4}runs-on: ubuntu-24\.04$/mu);
	assert.match(job, /^ {4}timeout-minutes: 240$/mu);
	const environment = workflow.split(/^jobs:\n/mu)[0] + job;
	assert.doesNotMatch(environment, /LEAN_BRIDGE_(?:CORPUS_PERL|PERLS|OWNED_PERL_CALLBACK_RESULT_\w*REPORTS)\b/u);
	// The hash-checked archived workflow predates the bounded installer; current CI must use it.
	const browsers = legacy ? "npx playwright install --with-deps chromium firefox webkit"
		: "bash scripts/install-playwright-browsers.sh chromium firefox webkit";
	for(const value of [...tools, ...setup, browsers]) assert.ok(job.includes(value), value);
	const abi = job.split("      - name: Build every pinned Perl ABI\n")[1]?.split("      - name: ")[0];
	assert.ok(abi); assert.doesNotMatch(abi, /^ {8}(?:if|continue-on-error):/mu);
	assert.match(abi, /^ {8}shell: bash$/mu);
	const abiCommands = [
		"set -euo pipefail"
		, ...["5.36.3", "5.38.2"].flatMap(version => ["threaded", "unthreaded"]
			.map(mode => `node scripts/build-perl-toolchains.mjs ${version} ${mode}`))
	];
	assert.equal(abi.split("        run: |\n")[1]?.trim().replace(/^ {10}/gmu, ""), abiCommands.join("\n"));
	assert.ok(job.includes("key: perl-callback-abis-v1-${{ runner.os }}-${{ hashFiles('scripts/build-perl-toolchains.mjs') }}"));
	const runtime = job.split("      - name: Verify Perl callback-result lifetimes and installed consumers\n")[1]?.split("      - name: ")[0];
	const evidence = job.split("      - name: Reconstruct Perl callback execution evidence\n")[1]?.split("      - name: ")[0];
	for(const [step, count, kind] of [[runtime, legacy ? 37 : 41, "results"], [evidence, legacy ? 14 : 16, "evidence"]])
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
		const log = `build/owned-perl-callback-${kind}.log`;
		const lines = ["set -euo pipefail", ...environment
			, `npm run test:owned-perl-callback-${kind} 2>&1 | tee ${log}`
			, ...[`tests ${count}`, `pass ${count}`, "fail 0", "cancelled 0", "skipped 0"]
				.map(value => `rg '^# ${value}$' ${log}`)
			, ...kind === "results" ? reports.map(path => "test -s " + path) : []];
		assert.equal(step.split("        run: |\n")[1]?.trim().replace(/^ {10}/gmu, ""), lines.join("\n"));
	}
	assert.ok(runtime.includes('          LEAN_BRIDGE_COLLECTION_PYTHONS: \'["${{ steps.perl_callback_python311.outputs.python-path }}", "${{ steps.perl_callback_python312.outputs.python-path }}"]\'\n'));
	const upload = job.split("      - name: Preserve Perl callback-result acceptance\n")[1]?.split("      - name: ")[0];
	assert.ok(upload);
	assert.match(upload, /^ {8}if: always\(\)$/mu);
	assert.match(upload, /^ {8}uses: actions\/upload-artifact@v7$/mu);
	assert.match(upload, /^ {10}if-no-files-found: error$/mu);
	const reportPaths = ["owned-perl-callback-results/"
		, ...["faults", "lifetime", "mutants", "sanitizers"]
		.map(name => `owned-perl-callback-result-${name}/`)
		, ...legacy ? [] : ["owned-perl-callback-result-variants/"]
		, "owned-perl-callback-results.log", "owned-perl-callback-evidence.log"
		, "owned-perl-callback-result-runtime.log"];
	for(const path of reportPaths)
		assert.ok(upload.includes("            build/" + path + "\n"), path);
	const summary = workflow.split("  support-summary:\n")[1];
	assert.match(summary, /^ {6}- owned-perl-callback-results$/mu);
	assert.ok(summary.includes("        if: needs.owned-perl-callback-results.result != 'success'\n        run: exit 1\n"));
	return { tests: legacy ? 37 : 41, evidenceTests: legacy ? 14 : 16
		, reports: reports.length, perls: 4, failurePropagated: true };
};
