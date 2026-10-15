/**
 * Test the dedicated primitive-base native PHP acceptance workflow.
 *
 * @file
 */
import { readFile } from "node:fs/promises";
import test from "node:test";
import { assertNominalPrimitiveSubtypePhpWorkflow } from "./nominal-primitive-subtype-php-ci-workflow.mjs";

test("primitive-base native PHP workflow requires the complete serial matrix", async () => {
	assertNominalPrimitiveSubtypePhpWorkflow(await readFile(".github/workflows/nominal-primitive-subtype-php.yml", "utf8"));
});
