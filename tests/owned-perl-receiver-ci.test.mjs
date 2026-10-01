/**
 * Reject missing ABIs, skipped receiver suites and discarded installed evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { assertOwnedPerlReceiverCi, ownedPerlReceiverReports } from "./helpers/owned-perl-receiver-ci.mjs";

test("Perl receiver CI requires four complete ABI runs and thirteen reports", async () => {
	const workflow = await readFile(".github/workflows/perl-consumer.yml", "utf8");
	const manifest = JSON.parse(await readFile("package.json", "utf8"));
	assertOwnedPerlReceiverCi(workflow, manifest);
	const [prefix, suffix] = workflow.split("  perl-receivers:\n");
	for(const before of [
		... ["5.36.3-threaded", "5.36.3-unthreaded", "5.38.2-threaded", "5.38.2-unthreaded"].map(abi => "          - " + abi + "\n")
		, "          npm run test:owned-perl-receivers > build/owned-perl-receivers.log 2>&1\n"
		, ...["tests 16", "pass 16", "fail 0", "cancelled 0", "skipped 0"].map(value => `          rg '^# ${value}$' build/owned-perl-receivers.log\n`)
		, ...ownedPerlReceiverReports.map(path => `          test -s ${path}\n`)
		, "            build/owned-perl-receiver-core/\n"
		, "            build/owned-perl-receivers.log\n"
	]) {
		assert.equal(suffix.split(before).length, 2);
		assert.throws(() => assertOwnedPerlReceiverCi(prefix + "  perl-receivers:\n" + suffix.replace(before, ""), manifest), undefined, before);
	}
	for(const line of ["    if: false\n", "    continue-on-error: true\n"])
		assert.throws(() => assertOwnedPerlReceiverCi(prefix + "  perl-receivers:\n" + line + suffix, manifest));
	const changed = structuredClone(manifest);
	changed.scripts["test:owned-perl-receivers"] += " --test-name-pattern=core";
	assert.throws(() => assertOwnedPerlReceiverCi(workflow, changed));
});
