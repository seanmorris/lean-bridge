#!/usr/bin/env node
/**
 * Verify original installed C/C++ callback checked-record output.
 *
 * @file
 */
import { readFile } from "node:fs/promises";
import { canonicalJson } from "../src/capsule/node.mjs";
import { callbackCheckedRecordNativeVerification, parseCallbackCheckedRecordNativeCiArgs } from "../tests/helpers/callback-checked-record-native-ci.mjs";

const selected = parseCallbackCheckedRecordNativeCiArgs(process.argv.slice(2));
process.stdout.write(canonicalJson(callbackCheckedRecordNativeVerification("native", selected.producer
	, await readFile(selected.tap, "utf8"), JSON.parse(await readFile(selected.report, "utf8")))));
