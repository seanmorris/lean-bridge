#!/usr/bin/env node
/**
 * Verify one hosted installed callback checked-record lane.
 *
 * @file
 */
import { readFile } from "node:fs/promises";
import { canonicalJson } from "../src/capsule/node.mjs";
import {
	callbackCheckedRecordRemainingVerification
	, parseCallbackCheckedRecordRemainingCiArgs
} from "../tests/helpers/callback-checked-record-remaining-ci.mjs";

const selected = parseCallbackCheckedRecordRemainingCiArgs(process.argv.slice(2));
const tap = await readFile(selected.tap, "utf8");
const report = JSON.parse(await readFile(selected.report, "utf8"));
process.stdout.write(canonicalJson(callbackCheckedRecordRemainingVerification(
	selected.producer, selected.profiles, tap, report
)));
