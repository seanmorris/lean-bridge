/**
 * Read the public revision identity without exposing environment or private inputs.
 *
 * @file
 */

import { execFileSync } from "node:child_process";

/**
 * Describe the current checkout and all maintained site/build inputs.
 *
 * @param {string} root Repository checkout to inspect.
 */
export const readBuildContext = root => {
	const git = args => execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
	return {
		commit: git(["rev-parse", "HEAD"])
		, modified: Boolean(git(["status", "--porcelain", "--untracked-files=no"])
			|| git([
				"ls-files", "--others", "--exclude-standard", "--"
				, "site", "docs", "demos", "scripts", "src", "poc", "patches"
				, "containers", "nix", "schema", ".github"
			])
		)
	};
};
