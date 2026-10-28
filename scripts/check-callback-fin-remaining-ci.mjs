#!/usr/bin/env node
/**
 * Verify one hosted installed callback Fin remaining-host lane.
 *
 * @file
 */
import { readFile } from "node:fs/promises";
import { dirname } from "node:path";
import { canonicalJson } from "../src/capsule/node.mjs";
import {
	callbackFinRemainingVerification, parseCallbackFinRemainingCiArgs
} from "../tests/helpers/callback-fin-remaining-ci.mjs";
import {
	verifyCallbackFinRetainedPackages
} from "../tests/helpers/callback-fin-retained-packages.mjs";

const selected = parseCallbackFinRemainingCiArgs(process.argv.slice(2));
const tap = await readFile(selected.tap, "utf8");
const report = JSON.parse(await readFile(selected.report, "utf8"));
process.stdout.write(canonicalJson({
	...callbackFinRemainingVerification(
		selected.producer, selected.profiles, tap, report)
	, retainedPackages: await verifyCallbackFinRetainedPackages(
		dirname(selected.report), report)
}));
