#!/usr/bin/env node
/**
 * Verify one hosted installed callback Subtype lane.
 *
 * @file
 */
import { readFile } from "node:fs/promises";
import { canonicalJson } from "../src/capsule/node.mjs";
import {
	callbackSubtypeRemainingVerification
	, parseCallbackSubtypeRemainingCiArgs
} from "../tests/helpers/callback-subtype-remaining-ci.mjs";

const selected = parseCallbackSubtypeRemainingCiArgs(process.argv.slice(2));
process.stdout.write(canonicalJson(callbackSubtypeRemainingVerification(
	selected.producer, selected.profiles
	, await readFile(selected.tap, "utf8")
	, JSON.parse(await readFile(selected.report, "utf8"))
)));
