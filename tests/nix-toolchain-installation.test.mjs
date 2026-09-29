/**
 * Exercise the actual archive installation phases without duplicating SDK trees.
 *
 * @file
 */
import assert from "node:assert/strict";
import { chmod, lstat, mkdtemp, readFile, readlink, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { processBuildRunner } from "../src/build/process-runner.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";

const source = await readFile("nix/wasm-toolchain.nix", "utf8");
const versions = Object.fromEntries([...source.matchAll(/^ {2}(\w+Version) = "([^"]+)";/gmu)].map(match => [match[1], match[2]]));
const installation = name => {
	const definition = source.split(`  ${name} = pkgs.stdenv.mkDerivation {`)[1]?.split("\n  };")[0];
	assert.ok(definition, `Missing ${name} derivation`);
	assert.match(definition, /dontUnpack = true;/u);
	const phase = definition.match(/installPhase = ''\n([\s\S]*?)\n {4}'';/u)?.[1];
	assert.ok(phase, `Missing ${name} install phase`);
	return phase.replace(/\$\{(\w+Version)\}/gu, (_, name) => {
		assert.ok(versions[name], `Unknown version ${name}`); return versions[name];
	});
};

for(const [name, unpacked] of [["leanHost", `lean-${versions.leanVersion}-linux`]
	, ["node", `node-v${versions.nodeVersion}-linux-x64`]
	, ["emscriptenUpstream", "install"]])
	test(`${name} extracts its archive directly into the final output`, {
		skip: process.env.LEAN_BRIDGE_NIX_TOOLCHAIN_TEST !== "1"
	}, async t => {
		const root = await mkdtemp(join(tmpdir(), "lean-bridge-nix-install-"));
		t.after(() => rm(root, { recursive: true, force: true }));
		const input = join(root, unpacked), output = join(root, "output");
		const contents = Buffer.from([0, 255, 1, 10, 128]);
		await saveLakeFile(input, "bin/compiler", contents);
		await chmod(join(input, "bin/compiler"), 0o555);
		await symlink("compiler", join(input, "bin/alias"));
		await saveLakeFile(input, "share/empty", "");
		if(name === "emscriptenUpstream")
		{
			await saveLakeFile(input, "emscripten/emscripten-version.txt", "development-marker\n");
			await chmod(join(input, "emscripten/emscripten-version.txt"), 0o444);
		}
		const archive = join(root, name === "leanHost" ? "sdk.tar.zst" : "sdk.tar.xz");
		const compression = name === "leanHost" ? "--zstd" : "-J";
		await processBuildRunner.capture({ command: "tar"
			, args: [compression, "-cf", archive, "-C", root, unpacked] });
		await rm(input, { recursive: true });
		await processBuildRunner.capture({ command: "bash"
			, args: ["-euc", installation(name)]
			, cwd: root, env: { ...process.env, src: archive, out: output } });
		await assert.rejects(lstat(input), { code: "ENOENT" });
		const installed = await lstat(join(output, "bin/compiler"));
		assert.equal(installed.mode & 0o777, 0o555);
		assert.deepEqual(await readFile(join(output, "bin/compiler")), contents);
		assert.equal(await readlink(join(output, "bin/alias")), "compiler");
		assert.equal((await lstat(join(output, "share/empty"))).size, 0);
		if(name === "emscriptenUpstream") assert.equal(await readFile(join(output, "emscripten/emscripten-version.txt"), "utf8"), `"${versions.emscriptenVersion}"\n`);
	});
