#!/usr/bin/env node
/**
 * Independently verify original hosted owned Subtype acceptance output.
 *
 * @file
 */
import { readFile } from "node:fs/promises";
import { dirname } from "node:path";
import { canonicalJson } from "../src/capsule/node.mjs";
import {
	ownedSubtypeHostedVerification, parseOwnedSubtypeHostedCiArgs
} from "../tests/helpers/owned-subtype-hosted-ci.mjs";
import {
	verifyOwnedSubtypeRetainedPackages
} from "../tests/helpers/owned-subtype-retained-packages.mjs";

const selected = parseOwnedSubtypeHostedCiArgs(process.argv.slice(2));
const report = JSON.parse(await readFile(selected.report, "utf8"));
process.stdout.write(canonicalJson({
	...ownedSubtypeHostedVerification(selected.lane, selected.producer
		, await readFile(selected.tap, "utf8"), report)
	, retainedPackages: await verifyOwnedSubtypeRetainedPackages(
		dirname(selected.report), report)
}));
