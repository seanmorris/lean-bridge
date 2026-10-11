/**
 * Require the complete installed Perl gate without changing existing consumer jobs.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { beforeCheckedRecordPerlCiSource } from "./checked-record-perl-ci-history.mjs";
import { withoutStructuralSubtypeWorkflow } from "./structural-subtype-ci-workflow.mjs";

const job = "  checked-records:\n    name: Checked records across all four Perl ABIs\n    runs-on: ubuntu-24.04\n    timeout-minutes: 120\n    steps:\n      - uses: actions/checkout@v6\n        with:\n          persist-credentials: false\n      - uses: actions/setup-node@v6\n        with:\n          node-version: \"22\"\n          cache: npm\n      - name: Install the checkout dependencies\n        run: npm ci --ignore-scripts --no-audit --no-fund\n      - name: Bound apt network waits\n        uses: ./.github/actions/bounded-apt\n        timeout-minutes: 1\n      - name: Install the native build tools\n        timeout-minutes: 20\n        run: sudo apt-get update && sudo apt-get install -y build-essential curl zstd\n      - name: Install only the pinned Lean compiler\n        run: bash scripts/bootstrap-toolchains.sh --lean-only\n      - name: Restore the complete checksummed Perl toolchain matrix\n        uses: actions/cache@v4\n        with:\n          path: .toolchains/perl\n          key: perl-checked-record-abi-v1-${{ runner.os }}-${{ hashFiles('scripts/build-perl-toolchains.mjs') }}\n      - name: Build or verify every pinned Perl interpreter\n        run: |\n          node scripts/build-perl-toolchains.mjs 5.36.3 threaded\n          node scripts/build-perl-toolchains.mjs 5.36.3 unthreaded\n          node scripts/build-perl-toolchains.mjs 5.38.2 threaded\n          node scripts/build-perl-toolchains.mjs 5.38.2 unthreaded\n      - name: Require four source routes and both CPAN installation modes\n        env:\n          LEAN_NUM_THREADS: \"2\"\n        run: |\n          source scripts/env.sh\n          bash scripts/run-checked-record-perl-ci.sh\n      - name: Preserve complete and partial Perl checked-record observations\n        if: always()\n        uses: actions/upload-artifact@v7\n        with:\n          name: checked-record-perl-${{ github.sha }}\n          path: build/checked-record-perl-ci/\n          if-no-files-found: error\n\n";
const requireJob = source => {
	source = withoutStructuralSubtypeWorkflow(source, "perl-consumer.yml");
	assert.equal(source.split(job).length, 2);
	const actual = source.split("  checked-records:\n")[1]?.split(/\n {2}[a-z][a-z0-9-]*:\n/u)[0];
	assert.equal("  checked-records:\n" + actual + "\n", job);
	const summary = source.split("\n  perl-summary:\n")[1];
	assert.ok(summary.includes("    needs:\n      - checked-records\n      - compiler-checks\n"));
	assert.ok(summary.includes("PERL_ACCEPTED: ${{ needs.checked-records.result == 'success' && needs.compiler-checks.result == 'success'"));
};

test("Perl checked records require all four toolchains, every route and unconditional original uploads", async () => {
	const path = ".github/workflows/perl-consumer.yml";
	const source = withoutStructuralSubtypeWorkflow(await readFile(path, "utf8"), "perl-consumer.yml");
	requireJob(source);
	const previous = source.replace(job, "")
		.replace("      - checked-records\n", "")
		.replace("needs.checked-records.result == 'success' && ", "");
	assert.equal(previous, beforeCheckedRecordPerlCiSource(path, source));
	const caller = await readFile(".github/workflows/consumer-matrix.yml", "utf8");
	const perl = caller.split("\n  perl-consumer:\n")[1].split(/\n {2}[a-z][a-z0-9-]*:\n/u)[0];
	assert.equal(perl.trim(), "name: Perl\n    uses: ./.github/workflows/perl-consumer.yml");
	const summary = caller.split("\n  support-summary:\n")[1];
	assert.match(summary, /^ {6}- perl-consumer$/mu);
});

test("Perl checked-record workflow rejects skipped lanes, missing tools and tolerated failures", async () => {
	const source = withoutStructuralSubtypeWorkflow(await readFile(".github/workflows/perl-consumer.yml", "utf8"), "perl-consumer.yml");
	for(const altered of [
		job.replace("    runs-on:", "    if: false\n    runs-on:")
		, job.replace("    runs-on:", "    continue-on-error: true\n    runs-on:")
		, job.replace("          bash scripts/run-checked-record-perl-ci.sh", "          bash scripts/run-checked-record-perl-ci.sh || true")
		, job.replace("        if: always()", "        if: success()")
		, job.replace("          if-no-files-found: error", "          if-no-files-found: ignore")
		, job.replace("          path: build/checked-record-perl-ci/", "          path: build/checked-record-perl-ci/*/report.json")
		, ...["5.36.3 threaded", "5.36.3 unthreaded", "5.38.2 threaded", "5.38.2 unthreaded"].map(configuration => job.replace(`          node scripts/build-perl-toolchains.mjs ${configuration}\n`, ""))
		, job.replace("          LEAN_NUM_THREADS:", "          LEAN_BRIDGE_PERL_TEST_GLIBC_FLOOR: 2.36\n          LEAN_NUM_THREADS:")
		, job.replace("          bash scripts/run-checked-record-perl-ci.sh", "          set +e\n          bash scripts/run-checked-record-perl-ci.sh")
	]) {
		const changed = source.replace(job, altered);
		assert.notEqual(changed, source);
		assert.throws(() => requireJob(changed));
	}
	for(const fragment of ["      - checked-records\n", "needs.checked-records.result == 'success' && "])
		assert.throws(() => requireJob(source.replace(fragment, "")));
});
