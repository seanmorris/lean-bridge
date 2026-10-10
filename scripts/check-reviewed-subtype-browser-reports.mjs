/**
 * Verify required reviewed browser records without opening deleted author projects.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { parseReviewedSubtypePackageArgs, assertReviewedSubtypePackageTap } from "../tests/helpers/reviewed-subtype-package-ci-common.mjs";
import { assertReviewedSubtypeBrowserRecords } from "../tests/helpers/reviewed-subtype-browser-report.mjs";

const options = parseReviewedSubtypePackageArgs(["--lane", "npm", ...process.argv.slice(2)]);
assertReviewedSubtypePackageTap("npm", await readFile(options.tap, "utf8"));
const read = path => {
	assert.match(path, /^(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_.-]+$/u);
	assert.ok(path.split("/").every(part => part !== "." && part !== ".."));
	return readFile(join(options.directory, path));
};
await assertReviewedSubtypeBrowserRecords(read);
process.stdout.write("Verified reviewed Subtype browsers: 12 engine/build executions, 51 lifecycle observations, all three engines; original npm and strict TypeScript records verified.\n");
