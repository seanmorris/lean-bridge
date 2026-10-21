/**
 * Check retained generic Subtype Python, Ruby or Rust installed-package records.
 *
 * @file
 */
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { canonicalJson } from "../src/capsule/node.mjs";
import {
	assertGenericSubtypeLanguageTap
	, checkGenericSubtypeLanguageReport
	, genericSubtypeLanguageSafePath
	, parseGenericSubtypeLanguageCiArgs
} from "../tests/helpers/generic-subtype-language-report.mjs";

const selected = parseGenericSubtypeLanguageCiArgs(process.argv.slice(2));
const tap = await readFile(selected.tap, "utf8");
assertGenericSubtypeLanguageTap(tap, selected.language, selected.route);
const result = await checkGenericSubtypeLanguageReport(path =>
	readFile(join(selected.directory, genericSubtypeLanguageSafePath(path))), selected);
process.stdout.write(canonicalJson(result));
