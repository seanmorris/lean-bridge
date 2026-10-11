/**
 * Validate all four Perl ABIs and both install modes in one zero-skip installed route.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { assertCheckedRecordPerlCiRecords, parseCheckedRecordPerlCiArgs } from "../tests/helpers/checked-record-perl-ci-report.mjs";

const options = parseCheckedRecordPerlCiArgs(process.argv.slice(2));
const report = await assertCheckedRecordPerlCiRecords({ ...options, tap: await readFile(options.tap, "utf8")
	, read: path => {
		assert.ok(/^(?:[A-Za-z0-9_.:-]+\/)*[A-Za-z0-9_.:-]+$/u.test(path));
		assert.ok(path.split("/").every(part => part !== "." && part !== ".."));
		return readFile(join(options.directory, path));
	}
});
process.stdout.write(`Accepted ${report.route}: ${report.configurations.length} Perl ABIs, ${report.modes.length} install modes, glibc ${report.glibcMinimumVersion}.\n`);
