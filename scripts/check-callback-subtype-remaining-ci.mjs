#!/usr/bin/env node
/**
 * Verify one hosted installed callback Subtype lane.
 *
 * @file
 */
import { readFile } from "node:fs/promises";
import { dirname } from "node:path";
import { canonicalJson } from "../src/capsule/node.mjs";
import { verifyCallbackSubtypeRetainedPackages } from "../tests/helpers/callback-subtype-retained-packages.mjs";
import {
	callbackSubtypeRemainingVerification
	, parseCallbackSubtypeRemainingCiArgs
} from "../tests/helpers/callback-subtype-remaining-ci.mjs";

const selected = parseCallbackSubtypeRemainingCiArgs(process.argv.slice(2));
const report = JSON.parse(await readFile(selected.report, "utf8"));
process.stdout.write(canonicalJson({
	...callbackSubtypeRemainingVerification(
		selected.producer, selected.profiles
		, await readFile(selected.tap, "utf8"), report)
	, retainedPackages: await verifyCallbackSubtypeRetainedPackages(
		dirname(selected.report), report)
}));
