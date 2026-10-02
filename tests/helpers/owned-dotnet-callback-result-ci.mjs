/**
 * Require live .NET callback execution, report reconstruction and failure gates.
 *
 * @file
 */
import assert from "node:assert/strict";

const names = ["owned-dotnet-callback-results", "owned-dotnet-callback-lifetime"
	, "owned-dotnet-callback-process", "owned-dotnet-callback-sanitizers"
	, "owned-dotnet-callback-result-packaging"
	, "owned-dotnet-callback-result-combined-packaging"];
const evidenceNames = ["owned-dotnet-callback-runtime-evidence"
	, "owned-dotnet-callback-package-evidence"
	, "owned-dotnet-callback-combined-evidence"];
const script = values => "LEAN_BRIDGE_OWNED_DOTNET_CALLBACK_RESULT_TEST=1 node --test --test-concurrency=1 "
	+ values.map(name => `tests/${name}.test.mjs`).join(" ");
export const ownedDotnetCallbackResultScript = script(names);
export const ownedDotnetCallbackEvidenceScript = script(evidenceNames);
export const ownedDotnetCallbackResultReports = ["ordinary", "reviewed"].flatMap(mode => [
	...["no-host", "host", "combined"].flatMap(variant => [`${mode}-${variant}.json`, `${mode}-${variant}-lifetime.json`])
	, ...["no-host", "combined"].flatMap(variant => ["process", "sanitizers", "package"].map(kind => `${mode}-${variant}-${kind}.json`))
	, `${mode}-combined-release.json`
]).map(name => "build/owned-dotnet-callback-results/" + name);

/**
 * Prevent skipped tests, missing reports or optional callback jobs in CI.
 *
 * @param workflow - Complete downstream workflow.
 * @param manifest - Repository package scripts.
 */
export const assertOwnedDotnetCallbackResultCi = (workflow, manifest) => {
	assert.equal(manifest.scripts["test:owned-dotnet-callback-results"], ownedDotnetCallbackResultScript);
	assert.equal(manifest.scripts["test:owned-dotnet-callback-evidence"], ownedDotnetCallbackEvidenceScript);
	const job = workflow.split("  owned-dotnet-callback-results:\n")[1]?.split(/\n {2}[a-z][a-z0-9-]*:\n/u)[0];
	assert.ok(job); assert.doesNotMatch(job, /^ {4}(?:if|continue-on-error):/mu);
	assert.match(job, /^ {4}runs-on: ubuntu-24\.04$/mu);
	assert.match(job, /^ {4}timeout-minutes: 240$/mu);
	assert.match(job, /uses: actions\/setup-dotnet@v6\n {8}with:\n {10}dotnet-version: '8\.0\.424'/u);
	assert.match(job, /uses: ruby\/setup-ruby@v1\n {8}with:\n {10}ruby-version: '3\.3\.12'/u);
	for(const version of ["3.11", "3.12"]) assert.ok(job.includes(`python-version: "${version}"`));
	for(const dependency of ["build-essential", "m4", "ripgrep", "mypy==2.3.1", "typing_extensions==4.6.0", "typing_extensions==4.16.0"])
		assert.ok(job.includes(dependency), dependency);
	for(const command of ["bash scripts/bootstrap-toolchains.sh"
		, "bash scripts/bootstrap-rust-ci.sh", "bash scripts/build-lean-link-spike.sh"
		, "npx playwright install --with-deps chromium firefox webkit"])
		assert.ok(job.includes(command), command);
	const runtime = job.split("      - name: Verify .NET callback-result lifetimes\n")[1]?.split("      - name: ")[0];
	const evidence = job.split("      - name: Reconstruct .NET callback execution evidence\n")[1]?.split("      - name: ")[0];
	for(const [step, count, command] of [[runtime, 26, "results"], [evidence, 8, "evidence"]])
	{
		assert.ok(step); assert.doesNotMatch(step, /^ {8}(?:if|continue-on-error):/mu);
		assert.match(step, /^ {8}shell: bash$/mu);
		const path = `build/owned-dotnet-callback-${command}.log`;
		const execution = command === "results" ? "test:owned-dotnet-callback-results" : "test:owned-dotnet-callback-evidence";
		const environment = command === "results" ? ["source scripts/env.sh"
			, 'export LEAN_BRIDGE_DOTNET="$(command -v dotnet)"'
			, 'export LEAN_BRIDGE_RUBY="$(command -v ruby)"'
			, 'export LEAN_BRIDGE_GEM="$(command -v gem)"'] : [];
		const lines = ["set -euo pipefail", ...environment
			, `npm run ${execution} 2>&1 | tee ${path}`
			, ...[`tests ${count}`, `pass ${count}`, "fail 0", "cancelled 0", "skipped 0"].map(value => `rg '^# ${value}$' ${path}`)
			, ...command === "results" ? ownedDotnetCallbackResultReports.map(file => "test -s " + file) : []];
		assert.equal(step.split("        run: |\n")[1]?.trim().replace(/^ {10}/gmu, ""), lines.join("\n"));
	}
	assert.ok(runtime.includes('          LEAN_BRIDGE_COLLECTION_PYTHONS: \'["${{ steps.callback_python311.outputs.python-path }}", "${{ steps.callback_python312.outputs.python-path }}"]\'\n'));
	const upload = job.split("      - name: Preserve .NET callback-result acceptance\n")[1];
	assert.match(upload, /^ {8}if: always\(\)$/mu);
	assert.match(upload, /^ {10}if-no-files-found: error$/mu);
	for(const file of ["owned-dotnet-callback-results/"
		, "owned-dotnet-callback-results.log", "owned-dotnet-callback-evidence.log"
		, "owned-dotnet-callback-result-runtime.log"])
		assert.ok(upload.includes("            build/" + file + "\n"), file);
	const summary = workflow.split("  support-summary:\n")[1];
	assert.match(summary, /^ {6}- owned-dotnet-callback-results$/mu);
	assert.ok(summary.includes("        if: needs.owned-dotnet-callback-results.result != 'success'\n        run: exit 1\n"));
	return { tests: 26, evidenceTests: 8, testFiles: 9, reports: 26, failurePropagated: true };
};
