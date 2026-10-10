/**
 * Check selected reviewed C/C++ or npm installed records without opening author paths.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { parseReviewedSubtypePackageArgs, assertReviewedSubtypePackageTap } from "../tests/helpers/reviewed-subtype-package-ci-common.mjs";
import { assertReviewedSubtypeCFamilyRecords } from "../tests/helpers/reviewed-subtype-c-family-report.mjs";
import { assertReviewedSubtypeNpmRecords } from "../tests/helpers/reviewed-subtype-npm-report.mjs";

const options = parseReviewedSubtypePackageArgs(process.argv.slice(2));
assertReviewedSubtypePackageTap(options.lane, await readFile(options.tap, "utf8"));
const read = path => {
	assert.match(path, /^(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_.-]+$/u);
	assert.ok(path.split("/").every(part => part !== "." && part !== ".."));
	return readFile(join(options.directory, path));
};
const report = await (options.lane === "c-cpp" ? assertReviewedSubtypeCFamilyRecords : assertReviewedSubtypeNpmRecords)(read);
const rows = options.lane === "c-cpp" ? report.reports : [report];
process.stdout.write(`Verified reviewed package run: ${rows.map(item => `${item.profile} ${item.checks} checks`).join(", ")}; two reproduced builds and source-free offline installation${options.lane === "npm" ? ", including strict TypeScript" : ""}.\n`);
