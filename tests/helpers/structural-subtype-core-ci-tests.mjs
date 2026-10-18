/**
 * Require the Git source history used by the Core evidence contracts.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";

const checkout = `      - name: Check out the exact revision
        uses: actions/checkout@v6
        with:
          # Evidence tests authenticate source bytes at their original producer commits.
          fetch-depth: 0
          persist-credentials: false
`;
const aggregateCheckout = `      - name: Check out the exact aggregate revision
        uses: actions/checkout@v6
        with:
          fetch-depth: 1
          persist-credentials: false
`;
const assertHistoryCheckout = source => {
	assert.equal(source.split("uses: actions/checkout@").length, 4);
	assert.equal(source.split(checkout).length, 3
		, "Static and contract jobs must fetch every original producer commit");
	assert.equal(source.split(aggregateCheckout).length, 2
		, "The aggregate must read the exact current tree without retaining credentials");
};

test("Core CI requires complete Git history for original producer authentication", async () => {
	const source = await readFile(".github/workflows/quality.yml", "utf8");
	assertHistoryCheckout(source);
	for(const changed of [source.replace("          fetch-depth: 0\n", "")
		, source.replace("fetch-depth: 0", "fetch-depth: 1")
		, source.replace("fetch-depth: 0", "fetch-depth: 100")
		, source.replace("persist-credentials: false", "persist-credentials: true")
		, source.replace("fetch-depth: 1", "fetch-depth: 0")
		, source.replace("        with:\n", "        if: false\n        with:\n")]) {
		assert.notEqual(changed, source);
		assert.throws(() => assertHistoryCheckout(changed));
		}
});

test("a real shallow checkout refuses an older producer until Git history is fetched", async t => {
	const directory = await mkdtemp(join(tmpdir(), "lean-bridge-core-history-checkout-"));
	t.after(() => rm(directory, { recursive: true, force: true }));
	const origin = join(directory, "origin"), checkoutRoot = join(directory, "checkout");
	const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("GIT_")));
	const git = (cwd, args) => execFileSync("git", args, { cwd, env, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
	git(directory, ["init", "--quiet", "--initial-branch=main", origin]);
	const commit = message => git(origin, ["-c", "user.name=Test", "-c", "user.email=test@example.invalid", "-c", "commit.gpgsign=false", "commit", "--quiet", "-m", message]);
	await writeFile(join(origin, "producer.txt"), "original producer bytes\n");
	git(origin, ["add", "producer.txt"]); commit("producer");
	const producer = git(origin, ["rev-parse", "HEAD"]).trim();
	await writeFile(join(origin, "producer.txt"), "current producer bytes\n");
	git(origin, ["add", "producer.txt"]); commit("later source");
	git(directory, ["clone", "--quiet", "--depth=1", pathToFileURL(origin).href, checkoutRoot]);
	assert.equal(git(checkoutRoot, ["rev-parse", "--is-shallow-repository"]).trim(), "true");
	const before = spawnSync("git", ["show", `${producer}:producer.txt`], { cwd: checkoutRoot, env, encoding: "utf8" });
	assert.notEqual(before.status, 0); assert.equal(before.stdout, "");
	assert.match(before.stderr, /not in|invalid object|bad object/u);
	assert.equal(git(checkoutRoot, ["show", "HEAD:producer.txt"]), "current producer bytes\n");
	git(checkoutRoot, ["fetch", "--quiet", "--unshallow", "origin"]);
	assert.equal(git(checkoutRoot, ["rev-parse", "--is-shallow-repository"]).trim(), "false");
	assert.equal(git(checkoutRoot, ["show", `${producer}:producer.txt`]), "original producer bytes\n");
	assert.equal(git(checkoutRoot, ["show", "HEAD:producer.txt"]), "current producer bytes\n");
});
