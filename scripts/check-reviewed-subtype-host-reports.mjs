/**
 * Check the original installed native Subtype records and their selected CI run.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { parseReviewedSubtypeHostCiArgs, assertReviewedSubtypeHostCiRecords } from "../tests/helpers/reviewed-subtype-host-ci-report.mjs";

const options = parseReviewedSubtypeHostCiArgs(process.argv.slice(2));
const report = await assertReviewedSubtypeHostCiRecords({ ...options, tap: await readFile(options.tap, "utf8")
	, read: path => {
		assert.match(path, /^(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_.-]+$/u);
		assert.ok(path.split("/").every(part => part !== "." && part !== ".."));
		return readFile(join(options.directory, path));
	}
});
process.stdout.write(`Verified reviewed native Subtype run: ${report.reports.map(item => `${item.profile} ${item.checks} checks`).join(", ")}; two reproduced builds, source-free offline installation and relocated replay.\n`);
