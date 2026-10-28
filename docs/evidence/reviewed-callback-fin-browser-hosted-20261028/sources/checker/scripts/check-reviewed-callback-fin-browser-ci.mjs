#!/usr/bin/env node
/**
 * Verify original hosted reviewed callback-Fin browser output.
 *
 * @file
 */
import { readFile } from "node:fs/promises";
import { canonicalJson } from "../src/capsule/node.mjs";
import {
	checkReviewedCallbackFinBrowserCi, parseReviewedCallbackFinBrowserCiArgs
} from "../tests/helpers/reviewed-callback-fin-browser-ci.mjs";

const selected = parseReviewedCallbackFinBrowserCiArgs(process.argv.slice(2));
const json = async path => JSON.parse(await readFile(path, "utf8"));
process.stdout.write(canonicalJson(checkReviewedCallbackFinBrowserCi(selected, {
	tap: await readFile(selected.tap, "utf8")
	, runtime: await json(selected.runtime)
	, r1: await json(selected.r1)
	, r2: await json(selected.r2)
})));
