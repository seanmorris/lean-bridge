/**
 * Test the dedicated recursive checked-record native PHP acceptance workflow.
 *
 * @file
 */
import { readFile } from "node:fs/promises";
import test from "node:test";
import { assertRecursiveCheckedRecordPhpWorkflow } from "./recursive-checked-record-php-ci-workflow.mjs";

test("recursive checked-record native PHP workflow requires the complete serial matrix", async () => {
	assertRecursiveCheckedRecordPhpWorkflow(await readFile(".github/workflows/recursive-checked-record-php.yml", "utf8"));
});
