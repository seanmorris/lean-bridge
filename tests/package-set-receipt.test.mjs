/**
 * Closed package identities, safe archive hashing and Node-only CLI verification.
 *
 * @file
 */
import assert from "node:assert/strict";
import { copyFile, mkdir, readFile, readdir, rename, rm, symlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { packageSetReceiptName, readReceiptBytes, validatePackageSetReceipt, verifyPackageSetReceipt, writePackageSetReceipt } from "../src/release/package-set-receipt.mjs";
import { writeCombinedPackageSet } from "../src/release/package-set-assembly.mjs";
import { runCli } from "../src/cli/run.mjs";
import { verificationHandler } from "../src/cli/verify.mjs";
import { assertJsonSchema } from "./helpers/json-schema.mjs";
import { copyPackageSetHandoff, createPackageSetHandoff } from "./helpers/package-set.mjs";

test("one closed receipt covers every ordinary package ecosystem and deterministically records its archives", async t => {
	const handoff = await createPackageSetHandoff(t);
	await assertJsonSchema("package-set-receipt", handoff.receipt);
	assert.equal(validatePackageSetReceipt(handoff.receipt), true);
	const displayName = structuredClone(handoff.receipt);
	displayName.component.name = "Willow Δ";
	assert.equal(validatePackageSetReceipt(displayName), true, "Display names are independent of canonical component IDs");
	await assertJsonSchema("package-set-receipt", displayName);
	const result = await verifyPackageSetReceipt({ receiptPath: handoff.receiptPath });
	assert.equal(result.verified, true); assert.equal(result.archives, 17); assert.equal(result.packages.length, 16);
	const moved = join(handoff.root, "relocated");
	await copyPackageSetHandoff(handoff.root, moved);
	await rm(join(moved, packageSetReceiptName)); await rm(join(moved, `${packageSetReceiptName}.sha256`));
	const rebuilt = await writePackageSetReceipt({ root: moved, ...handoff.receipt, profiles: [...handoff.receipt.profiles].reverse(), packages: [...handoff.receipt.packages].reverse() });
	assert.deepEqual(rebuilt, handoff.receipt);
	assert.deepEqual(await readFile(join(moved, packageSetReceiptName)), await readFile(handoff.receiptPath));
});

test("receipt validation rejects metadata drift, incompatible runtimes, dependency cycles and coordinate collisions", async t => {
	const { receipt } = await createPackageSetHandoff(t);
	const npm = value => value.packages.find(pkg => pkg.target === "npm" && pkg.role === "component");
	const php = value => value.packages.find(pkg => pkg.target === "php-wasm" && pkg.role === "component");
	for(const change of [
		value => { value.schemaVersion = 2; }
		, value => { value.extra = true; }
		, value => { value.component.id = "elsewhere@1.0.0"; }
		, value => { value.component.name = ""; }
		, value => { value.component.id = "Willow@2.0.0"; }
		, value => { value.source.treeSha256 += "\n"; }
		, value => { value.profiles.push(value.profiles[0]); }
		, value => { npm(value).runtimeIdentity = "0".repeat(64); }
		, value => { npm(value).requires[0].version = "2.0.0"; }
		, value => { php(value).name = npm(value).name; }
		, value => { php(value).name = npm(value).name; php(value).version = "9.0.0"; }
		, value => { npm(value).requires = [{ ecosystem: "npm", name: npm(value).name, version: npm(value).version }]; }
		, value => { npm(value).runtimeDelivery = "embedded"; }
		, value => { npm(value).target = "php-wasm"; }
		, value => { npm(value).requires = [null]; }
		, value => { npm(value).requires.push(npm(value).requires[0]); }
		, value => { npm(value).requires[0].extra = true; }
		, value => { npm(value).version = "latest"; }
		, value => { npm(value).artifacts[0].bytes = -1; }
		, value => { npm(value).artifacts[0].sha256 = "bad"; }
		, value => { npm(value).artifacts.push(npm(value).artifacts[0]); }
	]) {
		const changed = structuredClone(receipt); change(changed);
		assert.throws(() => validatePackageSetReceipt(changed));
	}
	for(const target of ["nuget", "pypi"])
	{
		const changed = structuredClone(receipt), original = changed.packages.find(pkg => pkg.target === target);
		const alias = { ...original, name: original.name.toUpperCase(), version: "7.0.0" };
		changed.packages.push(alias);
		assert.throws(() => validatePackageSetReceipt(changed), { code: "package-set-coordinate-conflict" });
	}
	for(const path of ["../escape", "/absolute", "nested/../../escape", "a\\b", "a\0b", "a\nb", "a//b", "a/./b", packageSetReceiptName, `${packageSetReceiptName}.sha256`])
	{
		const changed = structuredClone(receipt); npm(changed).artifacts[0].path = path;
		assert.throws(() => validatePackageSetReceipt(changed));
	}
});

test("verification rejects corrupt archives, missing sidecars, symlinks and non-regular inputs without changing files", async t => {
	for(const label of ["archive", "same-size-archive", "missing-archive", "sidecar", "receipt", "missing-sidecar", "symlink", "receipt-link", "sidecar-link", "directory-link", "directory", "oversize"])
	await t.test(label, async child => {
		const handoff = await createPackageSetHandoff(child);
		const artifact = join(handoff.root, handoff.receipt.packages[0].artifacts[0].path);
		if(label === "archive") await writeFile(artifact, "changed");
		if(label === "same-size-archive")
		{ const bytes = await readFile(artifact); bytes[0] ^= 1; await writeFile(artifact, bytes); }
		if(label === "missing-archive") await rm(artifact);
		if(label === "sidecar") await writeFile(`${handoff.receiptPath}.sha256`, "changed");
		if(label === "missing-sidecar") await rm(`${handoff.receiptPath}.sha256`);
		if(label === "receipt") await writeFile(handoff.receiptPath, JSON.stringify(handoff.receipt));
		if(label === "oversize") await writeFile(handoff.receiptPath, Buffer.alloc(4 * 1024 ** 2 + 1));
		if(label === "symlink")
		{ await rename(artifact, `${artifact}.outside`); await symlink(`${artifact}.outside`, artifact); }
		if(label === "receipt-link" || label === "sidecar-link")
		{
			const path = `${handoff.receiptPath}${label === "sidecar-link" ? ".sha256" : ""}`;
			await rename(path, `${path}.outside`); await symlink(`${path}.outside`, path);
		}
		if(label === "directory-link")
		{ await rename(join(handoff.root, "archives"), join(handoff.root, "outside")); await symlink(join(handoff.root, "outside"), join(handoff.root, "archives")); }
		if(label === "directory")
		{ await rm(artifact); await mkdir(artifact); }
		await assert.rejects(verifyPackageSetReceipt({ receiptPath: handoff.receiptPath }));
	});
});

test("receipt assembly preserves an existing receipt or sidecar without creating its missing companion", async t => {
	for(const suffix of ["", ".sha256"])
	{
		const handoff = await createPackageSetHandoff(t);
		const kept = `${handoff.receiptPath}${suffix}`, removed = `${handoff.receiptPath}${suffix ? "" : ".sha256"}`;
		const before = await readFile(kept);
		await rm(removed);
		await assert.rejects(writePackageSetReceipt({ root: handoff.root, ...handoff.receipt }), { code: "package-set-output-exists" });
		assert.deepEqual(await readFile(kept), before);
		await assert.rejects(readFile(removed), { code: "ENOENT" });
	}
});

test("automatic CLI selection retains unsigned status, supports separated archives and preserves cancellation", async t => {
	const handoff = await createPackageSetHandoff(t), headers = join(handoff.root, "headers");
	await mkdir(headers);
	for(const suffix of ["", ".sha256"]) await copyFile(`${handoff.receiptPath}${suffix}`, join(headers, `${packageSetReceiptName}${suffix}`));
	const args = ["verify", "--receipt", join(headers, packageSetReceiptName), "--artifacts", handoff.root];
	const outcome = await runCli({ argv: [...args, "--json"], handlers: { verify: verificationHandler }, environment: { LEAN_BRIDGE_PROJECT: "/missing", LEAN_BRIDGE_CONFIG: "/missing" } });
	assert.equal(outcome.exitCode, 0); assert.equal(outcome.response.project, null);
	assert.equal(outcome.response.result.verificationType, "local-package-set"); assert.equal(outcome.response.result.authenticated, false);
	const human = await runCli({ argv: args, handlers: { verify: verificationHandler }, environment: {} });
	assert.match(human.stdout, /local package-set consistency \(unsigned receipt\)/); assert.doesNotMatch(human.stdout, /runtime: undefined/);
	const controller = new AbortController(); controller.abort();
	await assert.rejects(readReceiptBytes("/does-not-exist", controller.signal), { name: "AbortError" });
	const cancelled = await runCli({ argv: args, handlers: { verify: verificationHandler }, signal: controller.signal, environment: {} });
	assert.equal(cancelled.exitCode, 130);
	const changed = { ...handoff.receipt, profiles: handoff.receipt.profiles.map(value => ({ ...value, runtimeIdentity: "0".repeat(64) })) };
	await writeFile(handoff.receiptPath, canonicalJson(changed));
	await writeFile(`${handoff.receiptPath}.sha256`, `${sha256(canonicalJson(changed))}  ${packageSetReceiptName}\n`);
	await assert.rejects(verifyPackageSetReceipt({ receiptPath: handoff.receiptPath }), { code: "package-set-runtime-mismatch" });
});

test("combined receipts reject cross-profile npm and Composer name collisions before exposing a new receipt", async t => {
	const handoff = await createPackageSetHandoff(t);
	for(const ecosystem of ["npm", "composer"])
	{
		const root = join(handoff.root, `combined-${ecosystem}`);
		const receipt = structuredClone(handoff.receipt);
		const original = receipt.packages.find(pkg => pkg.ecosystem === ecosystem && pkg.target !== "php-wasm" && pkg.role === "component");
		const renamed = receipt.packages.find(pkg => pkg.ecosystem === ecosystem && pkg.target === "php-wasm" && pkg.role !== "runtime");
		for(const item of receipt.packages.filter(pkg => pkg.target === "php-wasm"))
			for(const dependency of item.requires) if(dependency.ecosystem === ecosystem && dependency.name === renamed.name) dependency.name = original.name;
		renamed.name = original.name;
		const roots = [];
		for(const profile of receipt.profiles)
		{
			const prefix = profile.id; roots.push(prefix);
			await copyPackageSetHandoff(handoff.root, join(root, prefix));
			await rm(join(root, prefix, packageSetReceiptName)); await rm(join(root, prefix, `${packageSetReceiptName}.sha256`));
			await writePackageSetReceipt({ root: join(root, prefix), ...receipt, profiles: [profile], packages: receipt.packages.filter(pkg => pkg.profile === profile.id) });
		}
		await assert.rejects(writeCombinedPackageSet({ root, roots, component: receipt.component, source: receipt.source }), { code: "package-set-coordinate-conflict" });
		assert.deepEqual((await readdir(root)).sort(), roots.sort());
	}
});
