/**
 * Run native-asset tampering as a non-root owner, including failure cleanup.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { promisify } from "node:util";
import test from "node:test";
import { assertNativeAssetTamperRepair, assertNativeAssetTamperSourceUpdate } from "./helpers/native-asset-tamper-history.mjs";

test("native tamper probes restore read-only bytes and permissions without root", { skip: process.platform !== "linux" }, async () => {
	const helper = new URL("./helpers/native-asset-tamper.mjs", import.meta.url).href;
	const save = new URL("./helpers/lake-workspace.mjs", import.meta.url).href;
	const source = `import assert from "node:assert/strict";
import { chmod, mkdtemp, readFile, rm, stat, symlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { withCorruptedNativeAsset } from ${JSON.stringify(helper)};
import { saveLakeFile } from ${JSON.stringify(save)};
if (process.getuid() === 0) { process.setgid(65534); process.setuid(65534); }
assert.notEqual(process.getuid(), 0);
const root = await mkdtemp("/tmp/lean-bridge-native-tamper-owner-");
let checks = 0;
try {
  const path = join(root, "libfixture.so"), original = Buffer.from([1, 2, 3, 4]);
  for (const mode of [0o444, 0o555]) {
    await writeFile(path, original); await chmod(path, mode);
    await assert.rejects(() => saveLakeFile(root, "libfixture.so", Buffer.from([9])), { code: "EACCES" }); checks++;
    for (const fail of [false, true]) {
      const sentinel = new Error("intentional rejection-probe failure");
      const probe = withCorruptedNativeAsset(path, async () => {
        assert.deepEqual(await readFile(path), Buffer.from([1, 2, 3, 5])); checks++;
        assert.equal((await stat(path)).mode & 0o7777, mode | 0o200); checks++;
        if (fail) throw sentinel;
        return 42;
      });
      if (fail) await assert.rejects(probe, error => error === sentinel);
      else assert.equal(await probe, 42);
      assert.deepEqual(await readFile(path), original); checks++;
      assert.equal((await stat(path)).mode & 0o7777, mode); checks++;
    }
    await rm(path);
  }
  await writeFile(path, original);
  await symlink(path, join(root, "link.so"));
  await assert.rejects(() => withCorruptedNativeAsset(join(root, "link.so"), () => assert.fail()), /regular file/); checks++;
  await assert.rejects(() => withCorruptedNativeAsset(root, () => assert.fail()), /regular file/); checks++;
  await writeFile(path, "");
  await assert.rejects(() => withCorruptedNativeAsset(path, () => assert.fail()), /nonempty/); checks++;
  console.log(JSON.stringify({ checks, unprivileged: process.getuid() !== 0 }));
} finally { await rm(root, { recursive: true, force: true }); }
`;
	const result = await promisify(execFile)(process.execPath, ["--input-type=module", "-e", source], { cwd: "/tmp" });
	assert.equal(result.stderr, "");
	assert.deepEqual(JSON.parse(result.stdout), { checks: 21, unprivileged: true });
});

test("native tamper repair retains the original archives and all eight installed observations", async () => {
	await assertNativeAssetTamperRepair();
});

test("native tamper source history rejects unrelated changes and reconstructs both original helpers", async () => {
	const { baselines } = await assertNativeAssetTamperRepair();
	for(const path of ["tests/helpers/perl-graph-documentation.mjs", "tests/helpers/source-registration-history.mjs"])
	{
		const source = await readFile(path, "utf8");
		const expected = Object.values(baselines).map(record => record.sourceHashes[path]).find(Boolean);
		assert.equal(await assertNativeAssetTamperSourceUpdate(path, source, expected), true);
		await assert.rejects(() => assertNativeAssetTamperSourceUpdate(path, source + "\n", expected));
		await assert.rejects(() => assertNativeAssetTamperSourceUpdate(path, source, "0".repeat(64)));
	}
	assert.equal(await assertNativeAssetTamperSourceUpdate("src/build/native-project.mjs", "", ""), false);
});
