/** @file Build the ordinary CPAN host worker from the Nix engine's exact file filter. */
import assert from "node:assert/strict";
import { constants } from "node:fs";
import { copyFile, mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { readVerifiedCpanPackage } from "../../src/release/cpan-package.mjs";
import { readVerifiedPackageSetReceipt } from "../../src/release/package-set-receipt.mjs";
import { runNativeTool as run } from "./native-effect-consumers.mjs";
import { preparePerlWorkerProject } from "./perl-worker-project.mjs";

test("filtered and full Perl publishers produce identical CPAN worker and runtime archives", { timeout: 2700000 }, async t => {
	const root = await mkdtemp(join(tmpdir(), "perl-filtered-worker-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const engine = join(root, "filtered"), src = join(root, "source"), out = join(root, "release");
	const { includedFiles } = JSON.parse(await readFile("nix/perl-engine-source-boundary.json"));
	for(const file of includedFiles)
	{
		const dest = join(engine, file);
		await mkdir(dirname(dest), { recursive: true });
		await copyFile(file, dest);
	}
	await preparePerlWorkerProject(src);
	await copyFile("LICENSE", join(src, "LICENSE"));
	const cli = join(engine, "scripts/run-perl-engine.mjs");
	await run(process.execPath, [cli, "--project", src, "--output", out], root, process.env, 1200000);
	await rm(src, { recursive: true });
	const verify = dir => readVerifiedPackageSetReceipt({ receiptPath: join(dir, "package-set-receipt.json") });
	const { receipt, result } = await verify(out);
	assert.deepEqual(result.profiles, ["native-perl-task-v1"]);
	assert.deepEqual(receipt.packages.map(p => p.role).sort(), ["component", "runtime"]);
	const { manifest } = await readVerifiedCpanPackage(join(out, "packages/component"));
	assert.equal(manifest.hostImports.profile, "native-perl-task-v1");
	assert.equal(manifest.prebuilt.length, JSON.parse(process.env.LEAN_BRIDGE_PERLS ?? '["perl"]').length);
	for(const p of receipt.packages)t.diagnostic(p.role + " " + p.artifacts[0].sha256);
	const archive = process.env.LEAN_BRIDGE_PERL_FILTERED_COMPONENT_OUTPUT;
	if(archive)
	{
		const component = receipt.packages.find(p => p.role === "component");
		await copyFile(join(out, component.artifacts[0].path), resolve(archive), constants.COPYFILE_EXCL);
	}
	await rm(out, { recursive: true });
	let reference = process.env.LEAN_BRIDGE_PERL_FILTERED_REFERENCE;
	if(!reference)
	{
		reference = join(root, "unfiltered-release");
		const author = join(root, "independent-author");
		await preparePerlWorkerProject(author);
		await copyFile("LICENSE", join(author, "LICENSE"));
		const args = [resolve("scripts/lean-bridge.mjs"), "build"
			, "--project", author, "--target", "cpan", "--output", reference
			, "--json", "--progress", "none"];
		await run(process.execPath, args, root, process.env, 1200000);
		await rm(author, { recursive: true });
	}
	const other = await verify(resolve(reference));
	assert.deepEqual(receipt, other.receipt);
	assert.equal(result.receiptSha256, other.result.receiptSha256);
	t.diagnostic("matched complete independent handoff " + result.receiptSha256);
});
