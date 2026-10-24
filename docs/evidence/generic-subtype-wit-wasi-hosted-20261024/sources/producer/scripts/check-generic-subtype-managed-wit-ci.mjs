/**
 * Check retained generic Subtype .NET, JVM, native PHP or WIT records.
 *
 * @file
 */
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { canonicalJson } from "../src/capsule/node.mjs";
import {
	assertGenericSubtypeManagedWitTap
	, checkGenericSubtypeManagedWitReport
	, genericSubtypeManagedWitSafePath
	, parseGenericSubtypeManagedWitCiArgs
} from "../tests/helpers/generic-subtype-managed-wit-report.mjs";

const selected = parseGenericSubtypeManagedWitCiArgs(process.argv.slice(2));
const tap = await readFile(selected.tap, "utf8");
assertGenericSubtypeManagedWitTap(tap, selected.host, selected.route);
const result = await checkGenericSubtypeManagedWitReport(path =>
	readFile(join(selected.directory, genericSubtypeManagedWitSafePath(path))), selected);
process.stdout.write(canonicalJson(result));
