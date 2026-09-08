/**
 * Check the documented theorem and reject broken or admitted proofs with pinned Lean.
 *
 * @file
 */

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { constants } from "node:fs";
import { access, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";

const repository = resolve(import.meta.dirname, "..");
const fixture = join(repository, "tests/fixtures/documentation/lean-author");
const configuration = JSON.parse(await readFile(join(repository, "bridge.config.json"), "utf8"));
const pin = configuration.toolchains.lean;
const toolchain = `leanprover/lean4:${pin.version}`;
assert.equal((await readFile(join(repository, "lean-toolchain"), "utf8")).trim(), toolchain);
assert.equal((await readFile(join(fixture, "lean-toolchain"), "utf8")).trim(), toolchain,
	"The tutorial must use the repository's pinned Lean toolchain");
const installed = join(repository, ".toolchains/elan/toolchains",
	toolchain.replaceAll("/", "--").replaceAll(":", "---"), "bin/lean");
const lean = process.env.LEAN_BRIDGE_LEAN
	?? (process.env.LEAN_WASM_HOST_LEAN_PREFIX ? join(process.env.LEAN_WASM_HOST_LEAN_PREFIX, "bin/lean") : installed);
await access(lean, constants.X_OK).catch(() => {
	throw new Error("The pinned Lean compiler is unavailable. Run npm run bootstrap before test:docs:proof.");
});

/**
 * Run a bounded compiler check without writing generated files or changing the fixture.
 *
 * @param {string[]} args Lean arguments.
 * @param {string} [input] Optional replacement source supplied through stdin.
 */
const run = (args, input) => {
	const result = spawnSync(lean, args, {
		cwd: fixture, input, encoding: "utf8", timeout: 30000
		, maxBuffer: 1024 * 1024, env: { ...process.env, LEAN_PATH: "" }
	});
	assert.ifError(result.error);
	assert.equal(result.signal, null, "Lean must exit normally, not from a signal");
	return result;
};

const version = run(["--version"]);
assert.equal(version.status, 0, "Lean must report its compiler identity");
const identity = version.stdout.match(/Lean \(version ([^,]+),.*commit ([0-9a-f]{40}),/u);
assert.ok(identity, "Lean must report its version and commit");
assert.equal(identity[1], pin.version.replace(/^v/u, ""), "Lean version differs from the repository pin");
assert.equal(identity[2], pin.commit, "Lean commit differs from the repository pin");

const source = await readFile(join(fixture, "OnboardingSmall.lean"), "utf8");
const positive = run(["-DwarningAsError=true", "OnboardingSmall.lean"]);
assert.equal(positive.status, 0, positive.stdout + positive.stderr);
assert.match(positive.stdout, /^'OnboardingSmall\.add_commutative' does not depend on any axioms$/mu);
const rejected = [];
for(const mutation of [
	{ name: "changed implementation", from: "left + right", to: "left", diagnostic: /type mismatch/iu }
	, { name: "admitted proof", from: "Nat.add_comm left right", to: "by sorry", diagnostic: /declaration uses `sorry`/u }
]) {
	assert.equal(source.split(mutation.from).length, 2, `${mutation.name}: the mutation must replace exactly one expression`);
	const result = run(["--stdin", "-DwarningAsError=true"], source.replace(mutation.from, mutation.to));
	assert.equal(result.status, 1, `${mutation.name} must fail strict Lean checking`);
	assert.match(result.stdout + result.stderr, mutation.diagnostic);
	rejected.push({ name: mutation.name, exitCode: result.status, output: result.stdout.trim() });
}
process.stdout.write(`${JSON.stringify({
	status: "passed", toolchain, leanCommit: identity[2]
	, fixture: "tests/fixtures/documentation/lean-author/OnboardingSmall.lean"
	, sourceSha256: createHash("sha256").update(source).digest("hex")
	, theorem: "OnboardingSmall.add_commutative"
	, proof: positive.stdout.trim(), rejected
}, null, 2)}\n`);
