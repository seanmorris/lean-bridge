/**
 * Package the CLI as a downstream producer would receive it and check the
 * rebuilt native Composer distribution against the independently built one.
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

const env = { ...process.env, LEAN_NUM_THREADS: "1" }, task = env.LEAN_BRIDGE_PHP_TASK_REPRO;
const dest = task ?? env.LEAN_BRIDGE_PHP_IO_REPRO;
test("offline-installed CLI rebuilds the native Composer ZIP and its exact receipts"
	, { skip: !dest, timeout: 3_600_000 }
	, async () => {
	const root = resolve(dest), ordinary = resolve(task ? env.LEAN_BRIDGE_PHP_TASK_ORIGINAL : env.LEAN_BRIDGE_PHP_IO_ORIGINAL, "ordinary");
	await mkdir(root);
	const cliHome = join(root,"installed"), project = join(root,"project"), output = join(root,"handoff");
	const packed = await buildCliNpmPackage({ outputRoot: join(root,"cli-feed") });
	await run("npm",["install","--prefix",cliHome,"--offline","--ignore-scripts","--no-audit","--no-fund","--cache",join(root,"cache"),packed.archive],root,env);
	await rm(packed.output, { recursive: true });
	await cp(join(ordinary,"source"), project, { recursive: true });
	const cli = join(cliHome,"node_modules/.bin/lean-bridge"), file = "package-set-receipt.json";
	await run(process.execPath,[cli,"build","--project",project,"--target","php-native","--output",output,"--format","json"],root,env,1_800_000);
	const verify = JSON.parse(await run(process.execPath,[cli,"verify","--receipt",join(output,file),"--format","json"],root,env));
	assert.equal(verify.result.archives,1);
	const a = await readVerifiedPackageSetReceipt({ receiptPath: join(ordinary,"handoff",file) });
	const b = await readVerifiedPackageSetReceipt({ receiptPath: join(output,file) });
	assert.equal(b.receipt.profiles[0].id,task ? "native-php-task-v1" : "native-php-io-v1");
	assert.deepEqual(a.receipt,b.receipt); assert.equal(a.result.receiptSha256,b.result.receiptSha256);
	for(const name of ["binding-ir.json","host-export-evidence.json","native-release.json","packages/php-native/composer/lean-bridge/package-receipt.json"])
		assert.deepEqual(await readFile(join(ordinary,"handoff",name)),await readFile(join(output,name)));
	const record = { cliArchiveSha256: packed.report.archive.sha256, receiptSha256: b.result.receiptSha256, archive: b.receipt.packages[0].artifacts[0] };
		await writeFile(join(root,"reproduction.json"),canonicalJson(record),{ flag: "wx" });}
);
