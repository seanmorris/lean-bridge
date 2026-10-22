#!/usr/bin/env node
/**
 * Verify original installed C/C++ callback Subtype output.
 *
 * @file
 */
import { readFile } from "node:fs/promises";
import { dirname } from "node:path";
import { canonicalJson } from "../src/capsule/node.mjs";
import { verifyCallbackSubtypeRetainedPackages } from "../tests/helpers/callback-subtype-retained-packages.mjs";
import { callbackSubtypeNativeVerification, parseCallbackSubtypeNativeCiArgs } from "../tests/helpers/callback-subtype-native-ci.mjs";

const selected = parseCallbackSubtypeNativeCiArgs(process.argv.slice(2));
const report = JSON.parse(await readFile(selected.report, "utf8"));
process.stdout.write(canonicalJson({
	...callbackSubtypeNativeVerification("native", selected.producer
		, await readFile(selected.tap, "utf8"), report)
	, retainedPackages: await verifyCallbackSubtypeRetainedPackages(
		dirname(selected.report), report)
}));
