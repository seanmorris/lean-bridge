/**
 * Independently verify the shared runtime and identify the exact installed host tools.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { constants, existsSync } from "node:fs";
import { access, readFile, realpath } from "node:fs/promises";
import { chromium } from "playwright";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { readVerifiedPhpWasmCopiedRuntime } from "../src/build/php-wasm-copied-artifacts.mjs";

assert.equal(process.argv.length, 2, "Usage: snapshot-nominal-subtype-php-wasm-ci.mjs");
const { env } = process;
assert.ok(env.LEAN_BRIDGE_TEST_PHP_COPIED_RUNTIME, "Select the independently prepared shared runtime");
const producerCommit = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
assert.match(producerCommit, /^[a-f0-9]{40}$/u);
execFileSync("git", ["diff", "--quiet", "HEAD", "--"]);
const host = { schemaVersion: 1, node: process.version, platform: process.platform, arch: process.arch };
const paths = { nodeSha256: process.execPath
	, phpSha256: env.LEAN_BRIDGE_PHP ?? "/usr/bin/php"
	, composerSha256: env.LEAN_BRIDGE_COMPOSER ?? "/usr/bin/composer"
	, chromiumSha256: env.CHROMIUM_PATH ?? (existsSync("/usr/lib/chromium/chromium") ? "/usr/lib/chromium/chromium" : chromium.executablePath()) };
for(const [key, path] of Object.entries(paths))
{
	const selected = await realpath(path); await access(selected, constants.X_OK);
	host[key] = sha256(await readFile(selected));
}
const runtime = await readVerifiedPhpWasmCopiedRuntime(env.LEAN_BRIDGE_TEST_PHP_COPIED_RUNTIME);
process.stdout.write(canonicalJson({ schemaVersion: 1, producerCommit, host, runtime }));
