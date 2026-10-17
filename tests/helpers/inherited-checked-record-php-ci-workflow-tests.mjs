/**
 * Test the dedicated inherited checked-record native PHP acceptance workflow.
 *
 * @file
 */
import { readFile } from "node:fs/promises";
import test from "node:test";
import { assertInheritedCheckedRecordPhpWorkflow } from "./inherited-checked-record-php-ci-workflow.mjs";

test("inherited checked-record native PHP workflow requires the complete serial matrix", async () => {
	assertInheritedCheckedRecordPhpWorkflow(await readFile(".github/workflows/inherited-checked-record-php.yml", "utf8"));
});
