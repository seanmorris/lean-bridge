/**
 * Tests the targeted Docker consumer retry boundary.
 *
 * @file
 */

import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { chmod, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { promisify } from "node:util";

const execute = promisify(execFile);

const fakeNpm = `#!/usr/bin/env bash
set -euo pipefail
count=0
if [[ -f "$LEAN_BRIDGE_RETRY_COUNT" ]]; then count=$(<"$LEAN_BRIDGE_RETRY_COUNT"); fi
count=$((count + 1))
printf '%s\n' "$count" > "$LEAN_BRIDGE_RETRY_COUNT"
if [[ "$LEAN_BRIDGE_RETRY_MODE" == "transient" && "$count" -eq 1 ]]; then
  echo 'error: Init/Data/List/MinMaxIdx.lean:297:12: \`simp\` made no progress' >&2
  exit 2
fi
if [[ "$LEAN_BRIDGE_RETRY_MODE" == "permanent" ]]; then
  echo 'ordinary consumer failure' >&2
  exit 7
fi
echo 'consumer passed'
`;

const runFixture = async mode => {
	const scratch = await mkdtemp(join(tmpdir(), "lean-bridge-docker-retry-"));
	try
	{
		const npm = join(scratch, "npm");
		const count = join(scratch, "count");
		await writeFile(npm, fakeNpm);
		await chmod(npm, 0o755);
		try
		{
			const result = await execute("bash", ["scripts/test-docker-consumer-ci.sh"], {
				cwd: process.cwd()
				, env: {
					...process.env
					, PATH: `${scratch}:${process.env.PATH}`
					, LEAN_BRIDGE_RETRY_COUNT: count
					, LEAN_BRIDGE_RETRY_MODE: mode
				}
			});
			return { code: 0, stdout: result.stdout, stderr: result.stderr, attempts: Number(await readFile(count, "utf8")) };
		} catch(error)
		{
			return {
				code: error.code
				, stdout: error.stdout
				, stderr: error.stderr
				, attempts: Number(await readFile(count, "utf8"))
			};
		}
	} finally
	{
		await rm(scratch, { recursive: true, force: true });
	}
};

test("Docker consumer CI retries the exact transient Lean bootstrap failure", async () => {
	const result = await runFixture("transient");
	assert.equal(result.code, 0);
	assert.equal(result.attempts, 2);
	assert.match(result.stderr, /Retrying the exact pinned derivation once/);
});

test("Docker consumer CI does not retry an unrelated failure", async () => {
	const result = await runFixture("permanent");
	assert.equal(result.code, 7);
	assert.equal(result.attempts, 1);
	assert.doesNotMatch(result.stderr, /Retrying/);
});
