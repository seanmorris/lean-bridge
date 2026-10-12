/**
 * Require new nominal acceptance while preserving all earlier Perl CI work.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { nominalSubtypePerlCiBlock, enableNominalSubtypePerlWorkflow, disableNominalSubtypePerlWorkflow, assertNominalSubtypePerlWorkflow } from "./nominal-subtype-perl-ci-workflow.mjs";
import { assertStructuralSubtypeWorkflow } from "./structural-subtype-ci-workflow.mjs";

const path = ".github/workflows/perl-consumer.yml";
const predecessor = "7c9fbfee9c31b60dc7433ca6945be62e39810754";

test("nominal CPAN CI preserves all existing jobs and requires four selections with complete uploads", async () => {
	const source = await readFile(path, "utf8");
	assertNominalSubtypePerlWorkflow(source);
	const previous = execFileSync("git", ["show", `${predecessor}:${path}`], { encoding: "utf8" });
	assert.equal(disableNominalSubtypePerlWorkflow(source), previous);
	assert.equal(enableNominalSubtypePerlWorkflow(previous), source);
	assertStructuralSubtypeWorkflow(previous, "perl-consumer.yml");
	const parent = await readFile(".github/workflows/consumer-matrix.yml", "utf8");
	assert.match(parent, /\n {2}perl-consumer:\n {4}name: Perl\n {4}uses: \.\/\.github\/workflows\/perl-consumer\.yml\n/u);
	assert.match(parent.split("\n  support-summary:\n")[1], /^ {6}- perl-consumer$/mu);
});

test("nominal CPAN CI rejects missing gates, skipped jobs, custom ABIs and partial uploads", async t => {
	const source = await readFile(path, "utf8"), block = nominalSubtypePerlCiBlock;
	const replacements = [
		[block, ""]
		, [block, block.replace("        run: |", "        if: false\n        run: |")]
		, [block, block.replace("        run: |", "        continue-on-error: true\n        run: |")]
		, [block, block.replace("-perl-ci.sh\n", "-perl-ci.sh || true\n")]
		, [block, block.replace("        if: always()", "        if: success()")]
		, [block, block.replace("          if-no-files-found: error", "          if-no-files-found: ignore")]
		, [block, block.replace("          path: build/nominal-subtype-perl-ci/", "          path: build/nominal-subtype-perl-ci/*/report.json")]
		, [block, block.replace("          source scripts/env.sh", "          set +e\n          source scripts/env.sh")]
		, ["  checked-records:\n", "  checked-records:\n    if: false\n"]
		, ["    name: Checked records across all four Perl ABIs\n", "    name: Checked records across all four Perl ABIs\n    if: false\n"]
		, ["  checked-records:\n", "  checked-records:\n    continue-on-error: true\n"]
		, ["    timeout-minutes: 120\n", "    timeout-minutes: 20\n"]
		, ["      - checked-records\n", ""]
		, ["needs.checked-records.result == 'success' && ", ""]
		, ...["5.36.3 threaded", "5.36.3 unthreaded", "5.38.2 threaded", "5.38.2 unthreaded"].map(configuration => [`          node scripts/build-perl-toolchains.mjs ${configuration}\n`, ""])
		, ...["LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR", "LEAN_BRIDGE_PERL_TEST_GLIBC_FLOOR", "LEAN_BRIDGE_NOMINAL_SUBTYPE_PERLS", "LEAN_BRIDGE_PERLS", "LEAN_BRIDGE_CORPUS_PERL"].map(name => [block, block.replace("          LEAN_NUM_THREADS:", `          ${name}: override\n          LEAN_NUM_THREADS:`)])
	];
	for(const [index, [from, to]] of replacements.entries())
	{
		const changed = source.replace(from, () => to); assert.notEqual(changed, source);
		assert.throws(() => assertNominalSubtypePerlWorkflow(changed), assert.AssertionError, `workflow mutation ${index}: ${from}`);
		if(from === "  checked-records:\n")
			assert.throws(() => assertStructuralSubtypeWorkflow(changed, "perl-consumer.yml"), assert.AssertionError, `shared job mutation ${index}`);
	}
	t.diagnostic(`${replacements.length} missing, skipped, weakened or narrowed workflow controls`);
});
