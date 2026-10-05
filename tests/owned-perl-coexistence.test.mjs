/**
 * Install two owned components beside recursive copied and primitive packages.
 *
 * @file
 */
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { canonicalJson } from "../src/capsule/node.mjs";
import { checkOwnedPerlCoexistence } from "./helpers/owned-perl-coexistence.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";

test("installed owned Perl components coexist, reject foreign owners and reproduce independently", {
	skip: process.env.LEAN_BRIDGE_OWNED_NATIVE_TEST !== "1", timeout: 1200000
}, async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-owned-perl-coexistence-"));
	t.after(async () => {
		if(process.env.LEAN_BRIDGE_KEEP_OWNED_PERL_COEXISTENCE === "1")
			t.diagnostic(`Owned Perl coexistence artifacts: ${root}`);
		else await rm(root, { recursive: true, force: true });
	});
	const report = await checkOwnedPerlCoexistence(root, message => t.diagnostic(message));
	await saveLakeFile("build/owned-perl-package", "coexistence.json", canonicalJson(report));
});
