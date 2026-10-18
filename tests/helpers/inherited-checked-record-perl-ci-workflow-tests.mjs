/**
 * Source-only controls for the inherited checked-record Perl workflow.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
	assertInheritedCheckedRecordPerlWorkflow
} from "./inherited-checked-record-perl-ci-workflow.mjs";

const path = ".github/workflows/inherited-checked-record-perl.yml";

test("inherited checked-record Perl workflow requires all four ABI selections", async () => {
	assertInheritedCheckedRecordPerlWorkflow(await readFile(path, "utf8"));
});

test("inherited checked-record Perl workflow refuses narrowed or optional gates", async () => {
	const source = await readFile(path, "utf8");
	for(const mutate of [
		value => value.replace("actions/checkout@v6", "actions/checkout@main")
		, value => value.replace("cancel-in-progress: true"
			, "cancel-in-progress: false")
		, value => value.replace("5.38.2 unthreaded\n", "")
		, value => value.replace("id: acceptance\n", "")
		, value => value.replace("if-no-files-found: error"
			, "if-no-files-found: ignore")
		, value => value.replace("steps.acceptance.outcome != 'success'"
			, "failure()")
		, value => value.replace(
			"bash scripts/run-inherited-checked-record-perl-ci.sh"
			, "bash scripts/run-recursive-checked-record-perl-ci.sh"
		)
		, value => value.replace("    steps:\n"
			, "    env:\n      LEAN_BRIDGE_INHERITED_CHECKED_RECORD_PERL_MODES: full\n    steps:\n")
	]) assert.throws(() =>
		assertInheritedCheckedRecordPerlWorkflow(mutate(source)));
});
