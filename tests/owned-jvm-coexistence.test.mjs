/**
 * Installed owned and copied Maven packages share dependencies and retirement.
 *
 * @file
 */
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { canonicalJson } from "../src/capsule/node.mjs";
import { checkOwnedJvmComposition } from "./helpers/jvm-graph-loading.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";

test("owned JVM packages coexist with copied and recursive packages after offline installation", {
	skip: process.env.LEAN_BRIDGE_OWNED_NATIVE_TEST !== "1", timeout: 1200000
}, async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-owned-jvm-coexistence-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const report = await checkOwnedJvmComposition(root, message => t.diagnostic(message));
	await saveLakeFile("build/owned-jvm-packaging", "coexistence.json", canonicalJson(report));
});
