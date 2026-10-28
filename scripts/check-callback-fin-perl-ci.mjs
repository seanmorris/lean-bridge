#!/usr/bin/env node
/**
 * Verify original installed Perl callback Fin output.
 *
 * @file
 */
import { readFile } from "node:fs/promises";
import { dirname } from "node:path";
import { canonicalJson } from "../src/capsule/node.mjs";
import {
	callbackFinPerlVerification, parseCallbackFinPerlCiArgs
} from "../tests/helpers/callback-fin-perl-ci.mjs";
import {
	verifyCallbackFinRetainedPackages
} from "../tests/helpers/callback-fin-retained-packages.mjs";

const selected = parseCallbackFinPerlCiArgs(process.argv.slice(2));
const report = JSON.parse(await readFile(selected.report, "utf8"));
process.stdout.write(canonicalJson({
	...callbackFinPerlVerification(selected.producer
		, await readFile(selected.tap, "utf8"), report)
	, retainedPackages: await verifyCallbackFinRetainedPackages(
		dirname(selected.report), report)
}));
