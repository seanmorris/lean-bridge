/**
 * Perl's historical evidence must be available before its long installed ABI builds.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const preflight = "      - name: Require source history before the Perl ABI build\n        run: test \"$(git rev-parse --is-shallow-repository)\" = false\n";
const checkout = "      - uses: actions/checkout@v6\n        with:\n          fetch-depth: 0\n          persist-credentials: false\n";
const requireHistory = source => {
	const job = source.split("\n  perl:\n")[1]?.split(/\n {2}[a-z][a-z0-9-]*:\n/u)[0];
	assert.ok(job);
	assert.equal(job.split(checkout + preflight).length, 2);
	assert.ok(job.indexOf(checkout) < job.indexOf("      - uses: actions/setup-node@v6\n"));
	assert.ok(job.indexOf(preflight) < job.indexOf("      - name: Test both install paths on this Perl configuration\n"));
	assert.doesNotMatch(job, /continue-on-error|\n {4}if:/u);
	assert.deepEqual([...job.matchAll(/^ {10}- (5\.\d+\.\d+-(?:un)?threaded)$/gmu)].map(match => match[1]), [
		"5.36.3-threaded", "5.36.3-unthreaded", "5.38.2-threaded", "5.38.2-unthreaded"
	]);
};

test("Perl ABI CI fetches historical sources and checks them before installing tools", async () => {
	requireHistory(await readFile(".github/workflows/perl-consumer.yml", "utf8"));
});

test("Perl ABI CI rejects shallow, absent and bypassed historical-evidence checks", async () => {
	const source = await readFile(".github/workflows/perl-consumer.yml", "utf8");
	for(const changed of [
		source.replace("          fetch-depth: 0\n", "")
		, source.replace("          fetch-depth: 0\n", "          fetch-depth: 1\n")
		, source.replace(checkout, checkout.replace("        with:", "        if: false\n        with:"))
		, source.replace(preflight, "")
		, source.replace(preflight, preflight.replace("        run:", "        if: false\n        run:"))
		, source.replace(preflight, preflight.replace("        run:", "        continue-on-error: true\n        run:"))
		, source.replace(preflight, preflight.replace("= false", "= true"))
		, source.replace(preflight, preflight.replace("= false", "= false || true"))
	]) {
		assert.notEqual(changed, source);
		assert.throws(() => requireHistory(changed));
	}
});
