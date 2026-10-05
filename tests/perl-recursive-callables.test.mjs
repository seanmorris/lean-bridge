/**
 * Source-free original CPAN installations for finite recursive callbacks.
 *
 * @file
 */
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { canonicalJson } from "../src/capsule/node.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";
import { checkPerlRecursiveCallables } from "./helpers/perl-recursive-callable-acceptance.mjs";

test("original recursive CPAN archives preserve callbacks and closures after producer removal", {
	skip: process.env.LEAN_BRIDGE_PERL_RECURSIVE_CALLABLE_TEST !== "1"
	, timeout: 1_800_000
}, async t => {
	const directory = await mkdtemp(join(tmpdir(), "lean-bridge-perl-recursive-callables-"));
	t.after(() => rm(directory, { recursive: true, force: true }));
	const report = await checkPerlRecursiveCallables(directory, message => t.diagnostic(message));
	await saveLakeFile("build/recursive-callables", "perl.json", canonicalJson(report));
});
