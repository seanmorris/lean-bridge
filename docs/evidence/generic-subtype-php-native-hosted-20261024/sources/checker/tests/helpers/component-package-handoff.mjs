/**
 * Relocate the complete npm release without producer sources or staging files.
 *
 * @file
 */
import assert from "node:assert/strict";
import { copyFile, mkdir, readFile } from "node:fs/promises";
import { join, relative, resolve, sep } from "node:path";
import { verifyComponentPackageReceipt } from "../../src/release/component-package-receipt.mjs";
import { processBuildRunner } from "../../src/build/process-runner.mjs";

const receiptName = "component-package-receipt.json";
const verifierName = "verify-component-package-receipt.mjs";

/**
 * Copy only verified archives, the receipt and its standalone Node verifier.
 * The caller owns removal of its author tree before consuming this handoff.
 *
 * @param source - Completed npm release directory.
 * @param destination - New directory outside the release directory.
 */
export const copyComponentPackageHandoff = async (source, destination) => {
	const from = resolve(source), output = resolve(destination);
	const outside = path => path === ".." || path.startsWith(`..${sep}`);
	assert.ok(outside(relative(from, output)) && outside(relative(output, from)), "Use a separate consumer handoff directory");
	const verified = await verifyComponentPackageReceipt({ receiptPath: join(from, receiptName) });
	const receipt = JSON.parse(await readFile(join(from, receiptName), "utf8"));
	await mkdir(output);
	for(const name of [receiptName, verifierName, receipt.package.archive, receipt.runtime.archive])
		await copyFile(join(from, name), join(output, name));
	assert.deepEqual(await verifyComponentPackageReceipt({ receiptPath: join(output, receiptName) }), verified);
	const result = await processBuildRunner.capture({ command: process.execPath
		, args: [join(output, verifierName), "--receipt", join(output, receiptName)]
		, cwd: output
		, env: { PATH: "/unavailable", NODE_PATH: "", LEAN_BRIDGE_LEAN: "/unavailable/lean", LEAN_BRIDGE_RUNTIME_ROOT: "/unavailable/runtime" }
	});
	assert.equal(result.stderr, "");
	assert.deepEqual(JSON.parse(result.stdout), verified);
	return { output, componentArchive: join(output, receipt.package.archive)
		, runtimeArchive: join(output, receipt.runtime.archive), receipt, verified };
};
