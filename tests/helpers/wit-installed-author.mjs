/** @file Install the offline publisher CLI used by WIT release tests. */
import { execFile } from "node:child_process";
import { rm } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";
import { buildCliNpmPackage } from "../../src/release/cli-npm-package.mjs";

/**
 * Only the installed archive supplies publisher code or backend assets.
 *
 * @param root - Private temporary directory owned by the calling test.
 */
export const installWitAuthor = async root => {
	const dest = join(root, "author"), feed = join(root, "cli-feed");
	const { archive } = await buildCliNpmPackage({ outputRoot: feed });
	const args = ["install", "--offline", "--ignore-scripts"
		, "--no-audit", "--no-fund", "--no-package-lock"
		, "--cache", join(root, "npm-cache"), "--prefix", dest, archive];
	await promisify(execFile)("npm", args, { cwd: root });
	await rm(feed, { recursive: true });
	return join(dest, "node_modules/.bin/lean-bridge");
};
