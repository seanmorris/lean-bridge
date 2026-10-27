/**
 * Refuse missing Perl ABIs, skipped installed matrices and narrowed failure evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { assertNominalPrimitiveSubtypePerlWorkflow, nominalPrimitiveSubtypePerlToolchains } from "./nominal-primitive-subtype-perl-ci-workflow.mjs";

test("primitive-base Perl workflow requires four source/API selections on all four pinned ABIs", async () => {
	const source = await readFile(".github/workflows/nominal-primitive-subtype-perl.yml", "utf8");
	assertNominalPrimitiveSubtypePerlWorkflow(source);
	const shell = await readFile("scripts/run-nominal-primitive-subtype-perl-ci.sh", "utf8");
	for(const command of [
		"for route in ordinary reviewed; do", "for mode in full result-only; do"
		, "export LEAN_BRIDGE_NOMINAL_PRIMITIVE_SUBTYPE_PERL_TEST=1"
		, "export LEAN_BRIDGE_PERL_TEST_GLIBC_FLOOR=2.38"
		, "node scripts/check-nominal-primitive-subtype-perl-ci.mjs"
		, "export LEAN_NUM_THREADS=1 OMP_NUM_THREADS=1 MAKEFLAGS=-j1 CMAKE_BUILD_PARALLEL_LEVEL=1"
		, "tests/helpers/nominal-primitive-subtype-perl-installed-tests.mjs"
	]) assert.ok(shell.includes(command), command);
	assert.ok(shell.indexOf('mkdir "$output_root"') < shell.indexOf("export LEAN_BRIDGE_NOMINAL_PRIMITIVE_SUBTYPE_PERL_TEST=1"));
	// The same checksummed four-ABI toolchain matrix as the existing Perl consumer workflow.
	const consumer = await readFile(".github/workflows/perl-consumer.yml", "utf8");
	assert.ok(consumer.includes("          key: perl-checked-record-abi-v1-${{ runner.os }}-${{ hashFiles('scripts/build-perl-toolchains.mjs') }}\n"));
	for(const configuration of nominalPrimitiveSubtypePerlToolchains) assert.ok(consumer.includes(`          node scripts/build-perl-toolchains.mjs ${configuration}\n`));
});

test("primitive-base Perl workflow rejects missing ABIs and acceptance bypasses", async t => {
	const source = await readFile(".github/workflows/nominal-primitive-subtype-perl.yml", "utf8");
	const replacements = [
		["  workflow_dispatch:\n", "  push:\n  workflow_dispatch:\n"]
		, ["  workflow_dispatch:\n", "  pull_request:\n  workflow_dispatch:\n"]
		, ["contents: read", "contents: write"]
		, ["fetch-depth: 0", "fetch-depth: 1"]
		, ["persist-credentials: false", "persist-credentials: true"]
		, ['node-version: "22"', 'node-version: "latest"']
		, ["npm ci --ignore-scripts", "npm install"]
		, ["bash scripts/bootstrap-toolchains.sh --lean-only", "true missing-lean"]
		, ["perl-checked-record-abi-v1", "perl-other-cache-v1"]
		, ...nominalPrimitiveSubtypePerlToolchains.map(configuration => [`          node scripts/build-perl-toolchains.mjs ${configuration}\n`, ""])
		, ["        id: acceptance\n", "        id: acceptance\n        if: false\n"]
		, ["        id: acceptance\n", "        id: acceptance\n        continue-on-error: true\n"]
		, ["run-nominal-primitive-subtype-perl-ci.sh", "missing-matrix.sh"]
		, ["run-nominal-primitive-subtype-perl-ci.sh\n", "run-nominal-primitive-subtype-perl-ci.sh || true\n"]
		, ["source scripts/env.sh", "set +e"]
		, ["if: always()\n", "if: success()\n"]
		, ["build/nominal-primitive-subtype-perl-ci/\n", "build/nominal-primitive-subtype-perl-ci/ordinary-full/records/report.json\n"]
		, ["if-no-files-found: error", "if-no-files-found: ignore"]
		, ["steps.acceptance.outcome", "steps.unmeasured.outcome"]
		, ["run: exit 1", "run: exit 0"]
		, ["timeout-minutes: 180", "timeout-minutes: 360"]
		, ["        id: acceptance\n        timeout-minutes: 150", "        id: acceptance\n        timeout-minutes: 1"]
		, ["      LEAN_NUM_THREADS:", "      LEAN_BRIDGE_PERL_TEST_GLIBC_FLOOR: 2.36\n      LEAN_NUM_THREADS:"]
		, ["      LEAN_NUM_THREADS:", "      LEAN_BRIDGE_NOMINAL_PRIMITIVE_SUBTYPE_PERLS: override\n      LEAN_NUM_THREADS:"]
		, ["      LEAN_NUM_THREADS:", "      LEAN_BRIDGE_PERLS: override\n      LEAN_NUM_THREADS:"]
	];
	for(const [before, after] of replacements)
	{
		const changed = source.replace(before, () => after);
		assert.notEqual(changed, source); assert.throws(() => assertNominalPrimitiveSubtypePerlWorkflow(changed), before);
	}
	assert.equal(replacements.length, 28); t.diagnostic("Twenty-eight workflow bypasses refused");
});
