/**
 * Verify local Composer distributions and relocate an offline installation.
 *
 * @file
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { readVerifiedPackageSetReceipt } from "../../src/release/package-set-receipt.mjs";
import { brickMathRepository, composerFileUrl } from "./brick-math.mjs";
import { runNativeTool as run } from "./native-effect-consumers.mjs";

const env = process.env, load = async p => JSON.parse(await readFile(p, "utf8"));
const repo = async (handoff, stage) => {
	const { receipt, result } = await readVerifiedPackageSetReceipt({ receiptPath: join(handoff,"package-set-receipt.json") });
	const [pkg] = receipt.packages;
	assert.equal(receipt.profiles[0].id, "native-php-io-v1"); assert.equal(pkg.target, "php-native");
	assert.equal(pkg.runtimeDelivery, "embedded"); assert.equal(pkg.artifacts.length, 1);
	const archive = join(handoff, pkg.artifacts[0].path);
	const meta = JSON.parse(await run("unzip", ["-p",archive,"composer.json"],stage,env));
	assert.equal(meta.name, pkg.name); assert.equal(meta.version, pkg.version);
	const bytes = await readFile(archive);
	const dist = { type: "zip", url: composerFileUrl(archive), shasum: createHash("sha1").update(bytes).digest("hex") };
	return { pkg, receiptSha256: result.receiptSha256, repository: { type: "package", package: { ...meta, dist } } };
};

/**
 * Install into a disposable project, move it and authenticate deployed files.
 *
 * @param stage - Disposable working directory.
 * @param local - Prepared consumer project under stage.
 * @param deploy - New directory receiving the relocated consumer.
 * @param handoffs - Independent genuine package handoffs.
 */
export const installPhpIOComponents = async (stage,local,deploy,handoffs) => {
	const components = [];
	for(const handoff of handoffs) components.push(await repo(handoff,stage));
	const pkgs = components.map(r => r.pkg);
	const repositories = [...components.map(r => r.repository), await brickMathRepository(join(stage,"feed")), { "packagist.org": false }];
	const require = Object.fromEntries(pkgs.map(p => [p.name, p.version]));
	await writeFile(join(local,"composer.json"), canonicalJson({ name: "test/consumer", require, repositories }));
	const composer = env.LEAN_BRIDGE_COMPOSER ?? "composer";
	const offline = { ...env, COMPOSER_DISABLE_NETWORK: "1", COMPOSER_ALLOW_SUPERUSER: "1", COMPOSER_HOME: join(stage,"home"), COMPOSER_CACHE_DIR: join(stage,"cache") };
	await run(composer, ["--no-plugins","--no-scripts","--no-interaction","install","--prefer-dist"],local,offline);
	await rename(local, deploy); const vendor = join(deploy,"vendor");
	const lock = await load(join(deploy,"composer.lock"));
	assert.deepEqual(lock.packages.map(p => p.name).sort(), ["brick/math", ...pkgs.map(p => p.name)].sort());
	for(const r of components)
	{
		const locked = lock.packages.find(p => p.name === r.pkg.name);
		assert.deepEqual(locked.dist, r.repository.package.dist); assert.equal(locked.version, r.pkg.version);
		const prefix = join(vendor,r.pkg.name), pin = await load(join(prefix,"lean-bridge/package-receipt.json"));
		assert.equal(pin.name, r.pkg.name); assert.equal(pin.profile, r.pkg.profile);
		for(const [file, entry] of Object.entries(pin.files))
		{
			const data = await readFile(join(prefix,file)); assert.equal(data.length,entry.bytes); assert.equal(sha256(data),entry.sha256);
		}
	}
	return { components, vendor };
};
