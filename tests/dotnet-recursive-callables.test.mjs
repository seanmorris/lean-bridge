/**
 * Original NuGet installs, recursive callback probes and SDK-free consumers.
 *
 * @file
 */
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { canonicalJson } from "../src/capsule/node.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";
import { checkDotnetRecursiveCallables } from "./helpers/dotnet-recursive-callable-acceptance.mjs";

test("original recursive NuGet archives preserve typed callbacks and owned closures without producer tools", {
	skip: process.env.LEAN_BRIDGE_DOTNET_RECURSIVE_CALLABLE_TEST !== "1"
	, timeout: 1_800_000
}, async t => {
	const directory = await mkdtemp(join(tmpdir(), "lean-bridge-dotnet-recursive-callables-"));
	t.after(() => rm(directory, { recursive: true, force: true }));
	const diagnostic = message => t.diagnostic(message);
	const report = await checkDotnetRecursiveCallables(join(directory, "recursive"), diagnostic);
	const mixed = await checkDotnetRecursiveCallables(join(directory, "mixed"), diagnostic, true);
	await saveLakeFile("build/recursive-callables", "dotnet.json", canonicalJson({ ...report, mixedReports: mixed.reports }));
});
