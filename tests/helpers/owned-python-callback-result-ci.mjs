/**
 * Require the exact callback-result suite, installed reports and summary gate.
 *
 * @file
 */
import assert from "node:assert/strict";

export const ownedPythonCallbackResultTestNames = [
	"owned-python-callback-results", "owned-python-callback-result-runtime"
	, "owned-python-callback-result-packaging"
	, "owned-python-callback-result-combined-packaging"
];
export const ownedPythonCallbackResultScript = "LEAN_BRIDGE_OWNED_PYTHON_CALLBACK_RESULT_TEST=1 node --test --test-concurrency=1 "
	+ ownedPythonCallbackResultTestNames.map(name => `tests/${name}.test.mjs`).join(" ");
export const ownedPythonCallbackResultReports = [
	"typing.json"
	, ...["ordinary", "reviewed"].flatMap(mode => [
		`runtime-${mode}-no-host.json`, `runtime-${mode}-host.json`
		, `runtime-${mode}-combined.json`, `${mode}-no-host-package.json`
		, `${mode}-combined-package.json`, `${mode}-combined-release.json`
	])
].map(path => "build/owned-python-callback-results/" + path);

/**
 * Reject omitted cases, skipped execution, missing artifacts and optional jobs.
 *
 * @param workflow - Complete consumer workflow source.
 * @param manifest - Repository package scripts.
 */
export const assertOwnedPythonCallbackResultCi = (workflow, manifest) => {
	assert.equal(manifest.scripts["test:owned-python-callback-results"], ownedPythonCallbackResultScript);
	const job = workflow.split("  owned-python-callback-results:\n")[1]?.split(/\n {2}[a-z][a-z0-9-]*:\n/u)[0];
	assert.ok(job); assert.doesNotMatch(job, /^ {4}(?:if|continue-on-error):/mu);
	assert.match(job, /^ {4}runs-on: ubuntu-24\.04$/mu);
	assert.match(job, /^ {4}timeout-minutes: 180$/mu);
	assert.match(job, /sudo apt-get install -y [^\n]*\bm4\b[^\n]*\bripgrep\b/u);
	assert.match(job, /bash scripts\/bootstrap-toolchains\.sh/u);
	assert.match(job, /bash scripts\/bootstrap-rust-ci\.sh/u);
	assert.match(job, /bash scripts\/build-lean-link-spike\.sh/u);
	assert.match(job, /bash scripts\/install-playwright-browsers\.sh chromium firefox webkit/u);
	for(const [id, version] of [["callback_python311", "3.11"], ["callback_python312", "3.12"]])
		assert.ok(job.includes(`        id: ${id}\n        uses: actions/setup-python@v7\n        with:\n          python-version: "${version}"\n`));
	for(const dependency of ["mypy==2.3.1", "typing_extensions==4.6.0", "typing_extensions==4.16.0"])
		assert.ok(job.includes(dependency));
	const step = job.split("      - name: Verify Python callback-result lifetimes\n")[1]?.split("      - name: ")[0];
	assert.ok(step); assert.doesNotMatch(step, /^ {8}(?:if|continue-on-error):/mu);
	assert.ok(step.includes('          LEAN_BRIDGE_COLLECTION_PYTHONS: \'["${{ steps.callback_python311.outputs.python-path }}", "${{ steps.callback_python312.outputs.python-path }}"]\'\n'));
	assert.match(step, /^ {8}shell: bash$/mu);
	const lines = step.split("        run: |\n")[1]?.trim().replace(/^ {10}/gmu, "");
	assert.equal(lines, ["set -euo pipefail", "source scripts/env.sh"
		, "npm run test:owned-python-callback-results 2>&1 | tee build/owned-python-callback-results.log"
		, ...["tests 13", "pass 13", "fail 0", "cancelled 0", "skipped 0"].map(value => `rg '^# ${value}$' build/owned-python-callback-results.log`)
		, ...ownedPythonCallbackResultReports.map(path => "test -s " + path)].join("\n"));
	const upload = job.split("      - name: Preserve Python callback-result acceptance\n")[1];
	assert.match(upload, /^ {8}if: always\(\)$/mu);
	assert.match(upload, /^ {10}if-no-files-found: error$/mu);
	for(const path of ["build/owned-python-callback-results/", "build/owned-python-callback-results.log", "build/owned-python-callback-result-runtime.log"])
		assert.ok(upload.includes("            " + path + "\n"), path);
	const summary = workflow.split("  support-summary:\n")[1];
	assert.match(summary, /^ {6}- owned-python-callback-results$/mu);
	assert.ok(summary.includes("        if: needs.owned-python-callback-results.result != 'success'\n        run: exit 1\n"));
	return { tests: 13, testFiles: 4, reports: 13, failurePropagated: true };
};
