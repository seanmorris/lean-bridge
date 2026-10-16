/**
 * Test the dedicated nested checked-record native PHP acceptance workflow.
 *
 * @file
 */
import { readFile } from "node:fs/promises";
import test from "node:test";
import { assertNestedCheckedRecordPhpWorkflow } from "./nested-checked-record-php-ci-workflow.mjs";

test("nested checked-record native PHP workflow requires the complete serial matrix", async () => {
	assertNestedCheckedRecordPhpWorkflow(await readFile(".github/workflows/nested-checked-record-php.yml", "utf8"));
});
