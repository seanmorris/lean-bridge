/**
 * Reproduce an ordinary CPAN IO release with an offline-installed CLI in a new directory.
 *
 * @file
 */
import assert from "node:assert/strict";
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import test from "node:test";
import { canonicalJson } from "../../src/capsule/node.mjs";
import { buildCliNpmPackage } from "../../src/release/cli-npm-package.mjs";
import { readVerifiedPackageSetReceipt } from "../../src/release/package-set-receipt.mjs";
import { runNativeTool as run } from "./native-effect-consumers.mjs";

const env = { ...process.env, LEAN_NUM_THREADS: "1" }, dest = env.LEAN_BRIDGE_PERL_IO_REPRO;
test("a separately installed CLI reproduces the original Perl IO component and runtime archives", { skip: !dest, timeout: 3_600_000 }, async () => {
	const root = resolve(dest), original = join(resolve(env.LEAN_BRIDGE_PERL_IO_ORIGINAL),"ordinary");
	await mkdir(root); const src = join(root,"project"), tools = join(root,"installed-cli");
	await cp(join(original,"source"),src,{ recursive: true });
	const packed = await buildCliNpmPackage({ outputRoot: join(root,"cli-feed") });
	await run("npm",["install","--prefix",tools,"--offline","--ignore-scripts","--no-audit","--no-fund","--cache",join(root,"npm-cache"),packed.archive],root,env);
	await rm(packed.output,{ recursive: true });
	const cli=join(tools,"node_modules/.bin/lean-bridge"), out=join(root,"handoff"), path=join(out,"package-set-receipt.json");
	await run(process.execPath,[cli,"build","--project",src,"--target","cpan","--output",out,"--format","json"],root,env,1_800_000);
	const verify=JSON.parse(await run(process.execPath,[cli,"verify","--receipt",path,"--format","json"],root,env));
	assert.equal(verify.result.archives,2);
	const a=await readVerifiedPackageSetReceipt({ receiptPath: join(original,"handoff/package-set-receipt.json") });
	const b=await readVerifiedPackageSetReceipt({ receiptPath: path });
	assert.deepEqual(a.receipt,b.receipt); assert.equal(a.result.receiptSha256,b.result.receiptSha256);
	for(const f of ["host-export-evidence.json","binding-ir.json","native-release.json","packages/runtime/lean-bridge-package.json","packages/component/lean-bridge-package.json"])
		assert.deepEqual(await readFile(join(original,"handoff",f)),await readFile(join(out,f)));
	await writeFile(join(root,"reproduction.json"),canonicalJson({ cliArchiveSha256: packed.report.archive.sha256
		, receiptSha256: b.result.receiptSha256
		, artifacts: b.receipt.packages.flatMap(p => p.artifacts) }),{ flag: "wx" });
});
