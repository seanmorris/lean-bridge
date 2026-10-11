/**
 * Require historical Git sources before native, managed and WIT consumer builds.
 *
 * @file
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";
import "./native-history-checkout-history-tests.mjs";
import "./wit-history-checkout-history-tests.mjs";

const checkout = "      - name: Check out the exact revision\n        uses: actions/checkout@v6\n        with:\n          fetch-depth: 0\n          persist-credentials: false\n";
const preflight = family => `      - name: Require source history before ${family === "wasi" ? "WIT" : family} consumer builds\n        run: test "$(git rev-parse --is-shallow-repository)" = false\n`;
const jobOf = (source, family) => {
	const parts = source.split(`\n  ${family === "wasi" ? "wasi-consumer" : `${family}-consumers`}:\n`);
	assert.equal(parts.length, 2);
	return parts[1].split(/\n {2}[a-z][a-z0-9-]*:\n/u)[0];
};
const requireHistory = (source, family) => {
	const job = jobOf(source, family), guard = preflight(family);
	assert.equal(job.split(checkout + guard).length, 2);
	assert.equal(job.split("actions/checkout@").length, 2);
	assert.ok(job.includes("    steps:\n" + checkout + guard + "      - name: Install Node.js\n"));
	assert.doesNotMatch(job, /^ {4}(?:if|continue-on-error):/mu);
	assert.ok(job.indexOf(guard) < job.indexOf("uses: actions/setup-node@v6"));
	assert.ok(job.indexOf(guard) < job.indexOf("uses: cachix/install-nix-action@v31"));
	if(family !== "wasi")
		assert.ok(job.includes(family === "native" ? "        profile: [c-family, python, rust]\n" : "        profile: [dotnet, jvm, ruby]\n"));
};

test("native, managed and WIT consumer CI require full source history before installing tools", async () => {
	const source = await readFile(".github/workflows/consumer-matrix.yml", "utf8");
	for(const family of ["native", "managed", "wasi"]) requireHistory(source, family);
	const root = await readFile("tests/helpers/native-fin-nix-boundary-tests.mjs", "utf8");
	assert.ok(root.includes('import "./native-history-checkout-tests.mjs";'));
});

test("native, managed and WIT history gates reject shallow, missing, misplaced or bypassed checks", async t => {
	const source = await readFile(".github/workflows/consumer-matrix.yml", "utf8");
	let controls = 0;
	for(const family of ["native", "managed", "wasi"])
	{
		const job = jobOf(source, family), guard = preflight(family);
		for(const changed of [
			job.replace("          fetch-depth: 0\n", "")
			, job.replace("          fetch-depth: 0\n", "          fetch-depth: 1\n")
			, job.replace(checkout, checkout.replace("        with:", "        if: false\n        with:"))
			, job.replace(checkout, checkout.replace("        with:", "        continue-on-error: true\n        with:"))
			, job.replace(guard, "")
			, job.replace(guard, guard + guard)
			, job.replace(checkout + guard, guard + checkout)
			, job.replace(guard, guard.replace("        run:", "        if: false\n        run:"))
			, job.replace(guard, guard.replace("        run:", "        continue-on-error: true\n        run:"))
			, job.replace(guard, guard.replace("= false", "= true"))
			, job.replace(guard, guard.replace("= false", "= false || true"))
			, job.replace("    steps:\n", "    if: false\n    steps:\n")
			, job.replace("    steps:\n", "    continue-on-error: true\n    steps:\n")
		]) {
			assert.notEqual(changed, job);
			assert.throws(() => requireHistory(source.replace(job, changed), family));
			controls++;
		}
	}
	t.diagnostic(`${controls} weakened source-history prerequisites rejected`);
});

test("the source-history preflight refuses a real shallow clone and accepts its unchanged unshallowed HEAD", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-native-history-control-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const source = join(root, "source"), clone = join(root, "clone");
	await mkdir(source);
	const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("GIT_")));
	const git = (cwd, args) => {
		const result = spawnSync("git", args, { cwd, env, encoding: "utf8", timeout: 10_000 });
		assert.equal(result.status, 0, result.stderr);
		return result.stdout.trim();
	};
	git(source, ["init", "--quiet"]);
	for(const message of ["first", "second"])
		git(source, ["-c", "user.name=Test", "-c", "user.email=test@example.invalid", "-c", "commit.gpgsign=false", "commit", "--quiet", "--allow-empty", "-m", message]);
	git(root, ["clone", "--quiet", "--depth=1", pathToFileURL(source).href, clone]);
	const head = git(clone, ["rev-parse", "HEAD"]);
	const command = preflight("wasi").split("        run: ")[1].trim();
	for(const family of ["native", "managed"])
		assert.equal(preflight(family).split("        run: ")[1].trim(), command);
	const check = cwd => spawnSync("bash", ["--noprofile", "--norc", "-euo", "pipefail", "-c", command], { cwd, env, encoding: "utf8", timeout: 10_000 });
	assert.equal(check(root).status, 1);
	assert.equal(check(clone).status, 1);
	assert.equal(check(source).status, 0);
	git(clone, ["fetch", "--quiet", "--unshallow", "origin"]);
	assert.equal(check(clone).status, 0);
	assert.equal(git(clone, ["rev-parse", "HEAD"]), head);
});
