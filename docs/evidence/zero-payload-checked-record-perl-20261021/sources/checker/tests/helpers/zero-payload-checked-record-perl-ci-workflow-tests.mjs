/**
 * Validate hosted zero-payload Perl workflow policy.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { assertZeroPayloadPerlWorkflow } from "./zero-payload-checked-record-perl-ci-workflow.mjs";

test("zero-payload Perl has one complete dedicated hosted gate", async () => {
	const source = await readFile(".github/workflows/zero-payload-checked-record-perl.yml", "utf8");
	assert.doesNotThrow(() => assertZeroPayloadPerlWorkflow(source));
	for(const changed of [
		source.replace("    runs-on:", "    continue-on-error: true\n    runs-on:")
		, source.replace("    runs-on:", "    if: false\n    runs-on:")
		, source.replace("          fetch-depth: 0\n", "")
		, source.replace("        if: always()\n", "        if: success()\n")
		, source.replace("          if-no-files-found: error\n", "          if-no-files-found: ignore\n")
		, source.replace("          bash scripts/run-zero-payload-checked-record-perl-ci.sh"
			, "          bash scripts/run-zero-payload-checked-record-perl-ci.sh || true")
		, source.replace("          node scripts/build-perl-toolchains.mjs 5.38.2 unthreaded\n", "")
		, source.replace("    timeout-minutes: 240", "    timeout-minutes: 60")
	]) {
		assert.notEqual(changed, source);
		assert.throws(() => assertZeroPayloadPerlWorkflow(changed));
	}
});

