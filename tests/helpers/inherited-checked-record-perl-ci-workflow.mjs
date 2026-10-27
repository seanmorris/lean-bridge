/**
 * Require a dedicated, bounded inherited checked-record Perl workflow.
 *
 * @file
 */
import assert from "node:assert/strict";
import {
	assertWorkflowRunBudget, workflowRunScalars
} from "./native-observation-split.mjs";

/**
 * Check the workflow without weakening or sharing another Perl gate.
 *
 * @param source - Complete workflow source.
 */
export const assertInheritedCheckedRecordPerlWorkflow = source => {
	assert.ok(source.startsWith(
		"name: Installed inherited checked records in Perl\n"
	));
	assert.ok(source.includes(
		"on:\n  workflow_dispatch:\n"
	));
	assert.ok(source.includes("permissions:\n  contents: read\n"));
	assert.ok(source.includes(
		"concurrency:\n  group: inherited-checked-record-perl-${{ github.ref }}\n  cancel-in-progress: true\n"
	));
	assert.deepEqual([...source.matchAll(/^ {2}([a-z][a-z0-9_-]*):\n/gmu)]
		.map(match => match[1]), [
		"workflow_dispatch"
		, "schedule"
		, "inherited-checked-record-perl"]
	);
	assert.doesNotMatch(source
		, /continue-on-error:|needs:|strategy:|defaults:|set \+e|\|\| true/u);
	assert.doesNotMatch(source, /^ {4}if:/mu);
	assert.doesNotMatch(source
		, /LEAN_BRIDGE_(?:PERL_TEST_GLIBC_FLOOR|INHERITED_CHECKED_RECORD_PERL_)/u);
	assert.ok(source.includes("    runs-on: ubuntu-24.04\n"));
	assert.ok(source.includes("    timeout-minutes: 180\n"));
	const names = [...source.matchAll(/^ {6}- name: (.+)$/gmu)]
		.map(match => match[1]);
	assert.deepEqual(names, [
		"Check out the exact revision and original evidence history"
		, "Install Node.js", "Bound apt network waits"
		, "Install compiler and archive dependencies"
		, "Install dependencies and the pinned Lean compiler"
		, "Restore the checksummed Perl ABI matrix"
		, "Build or verify every pinned Perl interpreter"
		, "Require both source routes and API modes across every Perl ABI"
		, "Preserve original and partial installed records"
		, "Enforce installed inherited checked-record Perl acceptance"
	]);
	const step = name => source.split("      - name: " + name + "\n")[1]
		.split("      - name: ")[0];
	assert.ok(step(names[0]).includes("uses: actions/checkout@v6\n"));
	assert.ok(step(names[0]).includes("fetch-depth: 0\n"));
	assert.ok(step(names[0]).includes("persist-credentials: false\n"));
	assert.ok(step(names[1]).includes("uses: actions/setup-node@v6\n"));
	assert.ok(step(names[2]).includes(
		"uses: ./.github/actions/bounded-apt\n"
	));
	assert.ok(step(names[3]).includes(
		"sudo apt-get install -y build-essential curl git libgmp-dev libuv1-dev zstd\n"
	));
	assert.ok(step(names[4]).includes(
		"npm ci --ignore-scripts --no-audit --no-fund\n"
	));
	assert.ok(step(names[4]).includes(
		"bash scripts/bootstrap-toolchains.sh --lean-only"
	));
	assert.ok(step(names[5]).includes("uses: actions/cache@v4\n"));
	assert.ok(step(names[5]).includes("path: .toolchains/perl\n"));
	for(const selection of [
		"5.36.3 threaded", "5.36.3 unthreaded"
		, "5.38.2 threaded", "5.38.2 unthreaded"
	]) assert.equal((step(names[6]).match(new RegExp(
		`node scripts/build-perl-toolchains\\.mjs ${selection}`, "gu"
	)) ?? []).length, 1, selection);
	assert.ok(step(names[7]).includes("id: acceptance\n"));
	assert.ok(step(names[7]).includes("source scripts/env.sh\n"));
	assert.ok(step(names[7]).includes(
		"bash scripts/run-inherited-checked-record-perl-ci.sh\n"
	));
	assert.ok(step(names[8]).includes("if: always()\n"));
	assert.ok(step(names[8]).includes("uses: actions/upload-artifact@v7\n"));
	assert.ok(step(names[8]).includes(
		"build/inherited-checked-record-perl-ci/\n"
	));
	assert.ok(step(names[8]).includes("if-no-files-found: error\n"));
	assert.ok(step(names[8]).includes("retention-days: 30\n"));
	assert.equal(step(names[9]).trimEnd()
		, "        if: always() && steps.acceptance.outcome != 'success'\n        run: exit 1");
	const commands = workflowRunScalars(source).map(run => run.source.trim());
	assert.ok(commands.some(command => command.includes(
		"bash scripts/run-inherited-checked-record-perl-ci.sh"
	)));
	assert.equal(assertWorkflowRunBudget(source), commands.length);
};
