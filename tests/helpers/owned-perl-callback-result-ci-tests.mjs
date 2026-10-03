/**
 * Require the full Perl callback matrix in the downstream CI acceptance gate.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { assertOwnedPerlCallbackResultCi, ownedPerlCallbackResultReports } from "./owned-perl-callback-result-ci.mjs";

test("CI requires four-ABI Perl callback execution and reconstructed reports", async () => {
	const workflow = await readFile(".github/workflows/consumer-matrix.yml", "utf8");
	const manifest = JSON.parse(await readFile("package.json", "utf8"));
	assert.deepEqual(assertOwnedPerlCallbackResultCi(workflow, manifest), {
		tests: 41, evidenceTests: 16, reports: 22, perls: 4, failurePropagated: true
	});
	for(const line of [
		...ownedPerlCallbackResultReports.map(path => "          test -s " + path)
		, ...["results", "evidence"].flatMap(kind => [
			`          npm run test:owned-perl-callback-${kind} 2>&1 | tee build/owned-perl-callback-${kind}.log`
			, ...["tests", "pass", "fail", "cancelled", "skipped"].map(summary =>
				`          rg '^# ${summary} ${["tests", "pass"].includes(summary) ? kind === "results" ? 41 : 16 : 0}$' build/owned-perl-callback-${kind}.log`)
		])
		, ...["5.36.3", "5.38.2"].flatMap(version => ["threaded", "unthreaded"]
			.map(mode => `          node scripts/build-perl-toolchains.mjs ${version} ${mode}`))
		, "            build/owned-perl-callback-results/"
		, "            build/owned-perl-callback-result-variants/"
		, "            build/owned-perl-callback-evidence.log"
		, "      - owned-perl-callback-results"
	]) {
		assert.equal(workflow.split(line + "\n").length, 2, line);
		assert.throws(() => assertOwnedPerlCallbackResultCi(workflow.replace(line + "\n", ""), manifest), undefined, line);
	}
	for(const [before, after] of [
		["  owned-perl-callback-results:\n", "  owned-perl-callback-results:\n    continue-on-error: true\n"]
		, ["      - name: Verify Perl callback-result lifetimes and installed consumers\n"
			, "      - name: Verify Perl callback-result lifetimes and installed consumers\n        if: false\n"]
		, ["      - name: Reconstruct Perl callback execution evidence\n"
			, "      - name: Reconstruct Perl callback execution evidence\n        if: false\n"]
		, ["        if: needs.owned-perl-callback-results.result != 'success'\n        run: exit 1\n", "        run: true\n"]
	]) {
		assert.equal(workflow.split(before).length, 2);
		assert.throws(() => assertOwnedPerlCallbackResultCi(workflow.replace(before, after), manifest));
	}
	for(const name of ["test:owned-perl-callback-results", "test:owned-perl-callback-evidence"])
	{
		const disabled = structuredClone(manifest);
		disabled.scripts[name] = disabled.scripts[name].replace("_TEST=1", "_TEST=0");
		assert.throws(() => assertOwnedPerlCallbackResultCi(workflow, disabled));
	}
	for(const suffix of ["REPORTS", "FAULT_REPORTS", "LIFETIME_REPORTS", "MUTANT_REPORTS", "SANITIZER_REPORTS", "PACKAGE_REPORTS", "VARIANT_PACKAGE_REPORTS"])
	{
		const variable = "LEAN_BRIDGE_OWNED_PERL_CALLBACK_RESULT_" + suffix;
		for(const [before, after] of [
			["env:\n", `env:\n  ${variable}: old/reports\n`]
			, ["  owned-perl-callback-results:\n", `  owned-perl-callback-results:\n    env:\n      ${variable}: old/reports\n`]
			, ["      - name: Reconstruct Perl callback execution evidence\n"
				, `      - name: Reconstruct Perl callback execution evidence\n        env:\n          ${variable}: old/reports\n`]
		]) {
			assert.ok(workflow.includes(before));
			assert.throws(() => assertOwnedPerlCallbackResultCi(workflow.replace(before, after), manifest), undefined, variable);
		}
	}
	const abiStep = "      - name: Build every pinned Perl ABI\n";
	for(const bypass of ["        if: false\n", "        continue-on-error: true\n"])
		assert.throws(() => assertOwnedPerlCallbackResultCi(workflow.replace(abiStep, abiStep + bypass), manifest));
	const abiStart = abiStep + "        shell: bash\n        run: |\n          set -euo pipefail\n";
	assert.ok(workflow.includes(abiStart));
	assert.throws(() => assertOwnedPerlCallbackResultCi(workflow.replace(abiStart, abiStart + "          exit 0\n"), manifest));
	const upload = "      - name: Preserve Perl callback-result acceptance\n        if: always()\n        uses: actions/upload-artifact@v7\n";
	assert.ok(workflow.includes(upload));
	for(const replacement of ["        uses: actions/checkout@v6\n", ""])
		assert.throws(() => assertOwnedPerlCallbackResultCi(workflow.replace(upload
			, upload.replace("        uses: actions/upload-artifact@v7\n", replacement)), manifest));
});
