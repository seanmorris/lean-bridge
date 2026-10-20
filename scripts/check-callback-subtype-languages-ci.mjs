#!/usr/bin/env node
/**
 * Verify original installed Python, Ruby and Rust callback Subtype output.
 *
 * @file
 */
import { readFile } from "node:fs/promises";
import { canonicalJson } from "../src/capsule/node.mjs";
import { callbackSubtypeNativeVerification, parseCallbackSubtypeNativeCiArgs } from "../tests/helpers/callback-subtype-native-ci.mjs";

const selected = parseCallbackSubtypeNativeCiArgs(process.argv.slice(2));
process.stdout.write(canonicalJson(callbackSubtypeNativeVerification("language", selected.producer
	, await readFile(selected.tap, "utf8"), JSON.parse(await readFile(selected.report, "utf8")))));
