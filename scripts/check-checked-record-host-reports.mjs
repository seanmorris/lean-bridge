/**
 * Validate one original installed checked-record native route and its zero-skip TAP.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { parseCheckedRecordHostCiArgs, assertCheckedRecordHostCiRecords } from "../tests/helpers/checked-record-host-ci-report.mjs";

const options = parseCheckedRecordHostCiArgs(process.argv.slice(2));
const report = await assertCheckedRecordHostCiRecords({ ...options, tap: await readFile(options.tap, "utf8")
	, read: path => {
		assert.match(path, /^(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_.-]+$/u);
		assert.ok(path.split("/").every(part => part !== "." && part !== ".."));
		return readFile(join(options.directory, path));
	}
});
process.stdout.write(`Verified ${options.route}: ${report.reports.map(item => `${item.profile} ${item.checks} checks`).join(", ")}; two reproduced builds, source-free offline installation and relocated replay. Entry counts are unmeasured.\n`);
