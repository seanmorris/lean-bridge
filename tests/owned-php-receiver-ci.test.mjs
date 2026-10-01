/**
 * Missing, skipped or nonblocking receiver CI must fail the contract.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { assertOwnedPhpReceiverCi, ownedPhpReceiverReports } from "./helpers/owned-php-receiver-ci.mjs";

test("Native PHP receiver CI requires sixteen tests and thirteen reports", async () => {
	const workflow = await readFile(".github/workflows/consumer-matrix.yml", "utf8");
	const manifest = JSON.parse(await readFile("package.json", "utf8"));
	assertOwnedPhpReceiverCi(workflow, manifest);
	for(const before of [
		"          npm run test:owned-php-receivers > build/owned-php-receivers.log 2>&1\n"
		, ...["tests 16", "pass 16", "fail 0", "cancelled 0", "skipped 0"].map(value => `          rg '^# ${value}$' build/owned-php-receivers.log\n`)
		, ...ownedPhpReceiverReports.map(path => `          test -s ${path}\n`)
		, "            build/owned-php-receivers/\n"
		, "            build/owned-php-receiver-packaging/\n"
		, "            build/owned-php-receivers.log\n"
		, "      - php-receivers\n"
		, "      - name: Enforce native PHP receiver acceptance\n        if: needs.php-receivers.result != 'success'\n        run: exit 1\n"
	]) {
		assert.equal(workflow.split(before).length, 2);
		assert.throws(() => assertOwnedPhpReceiverCi(workflow.replace(before, ""), manifest), undefined, before);
	}
	for(const line of ["    if: false\n", "    continue-on-error: true\n"])
		assert.throws(() => assertOwnedPhpReceiverCi(workflow.replace("  php-receivers:\n", "  php-receivers:\n" + line), manifest));
	for(const line of ["        if: false\n", "        continue-on-error: true\n"])
		assert.throws(() => assertOwnedPhpReceiverCi(workflow.replace("      - name: Verify receiver lifetimes and installed Composer releases\n", "      - name: Verify receiver lifetimes and installed Composer releases\n" + line), manifest));
	const changed = structuredClone(manifest);
	changed.scripts["test:owned-php-receivers"] += " --test-name-pattern=core";
	assert.throws(() => assertOwnedPhpReceiverCi(workflow, changed));
});
