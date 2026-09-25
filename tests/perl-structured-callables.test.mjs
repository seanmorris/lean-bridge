/**
 * Installed structured CPAN callbacks and closures on each pinned Perl ABI.
 *
 * @file
 */
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { canonicalJson } from "../src/capsule/node.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";
import { checkPerlStructuredCallables } from "./helpers/perl-structured-callable-acceptance.mjs";

const enabled = process.env.LEAN_BRIDGE_PERL_STRUCTURED_CALLABLE_TEST === "1";
test("Perl original CPAN archives execute structured callbacks and closures on both source paths", { skip: !enabled, timeout: 1_800_000 }, async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-perl-structured-callables-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const report = await checkPerlStructuredCallables(root, message => t.diagnostic(message));
	await saveLakeFile("build/structured-callables", "perl.json", canonicalJson(report));
});
