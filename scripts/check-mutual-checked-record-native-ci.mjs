#!/usr/bin/env node
/**
 * Validate one hosted recursive checked-record C/C++ route.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { canonicalJson } from "../src/capsule/node.mjs";
import {
	checkMutualCheckedRecordNativeCiRecords
	, parseMutualCheckedRecordNativeCiArgs
} from "../tests/helpers/mutual-checked-record-native-ci-report.mjs";

const selected = parseMutualCheckedRecordNativeCiArgs(process.argv.slice(2));
const paths = async (root, prefix = "") => {
	const result = [];
	for(const entry of await readdir(root, { withFileTypes: true }))
	{
		const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
		if(entry.isDirectory()) result.push(...await paths(join(root, entry.name), relative));
		else if(entry.isFile()) result.push(relative);
		else assert.fail(`Unexpected native record entry: ${relative}`);
	}
	return result.sort();
};
const checked = await checkMutualCheckedRecordNativeCiRecords(selected, {
	tap: await readFile(selected.tap, "utf8")
	, read: path => readFile(join(selected.directory, path))
});
assert.deepEqual(await paths(selected.directory), checked.recordPaths);
process.stdout.write(canonicalJson({
	schemaVersion: 1, route: checked.route
	, producerCommit: checked.producerCommit
	, reportSha256: checked.reportSha256
	, bindingIrSha256: checked.bindingIrSha256
	, records: checked.recordPaths.length
	, independentBuilds: checked.independentBuilds
	, profiles: checked.observations.map(item => ({
		profile: item.profile, checks: item.checks
	}) )
}));
