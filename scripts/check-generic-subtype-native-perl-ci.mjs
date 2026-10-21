#!/usr/bin/env node
/**
 * Verify one retained generic Subtype native or Perl route.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { canonicalJson } from "../src/capsule/node.mjs";
import { checkGenericSubtypeNativeReport, checkGenericSubtypePerlReport, genericSubtypeSafePath } from "../tests/helpers/generic-subtype-native-perl-report.mjs";

const values = Object.fromEntries(process.argv.slice(2).reduce((items, value, index, all) => {
	if(index % 2 === 0) items.push([value, all[index + 1]]); return items;
}, []));
assert.deepEqual(Object.keys(values).sort(), ["--directory", "--kind", "--producer", "--route"]);
assert.ok(["native", "perl"].includes(values["--kind"]));
assert.ok(["ordinary", "reviewed"].includes(values["--route"]));
assert.match(values["--producer"] ?? "", /^[a-f0-9]{40}$/u);
assert.equal(execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(), values["--producer"]);
const directory = values["--directory"];
assert.ok(directory && !directory.startsWith("-") && !directory.includes("\0"));
const read = path => readFile(join(directory, genericSubtypeSafePath(path)));
const check = values["--kind"] === "native" ? checkGenericSubtypeNativeReport : checkGenericSubtypePerlReport;
process.stdout.write(canonicalJson(await check(read, {
	route: values["--route"], producerCommit: values["--producer"]
})));
