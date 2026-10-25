/**
 * Exercise the exact CI bootstrap without importing repository evidence into Nix.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { chmod, mkdtemp, readFile, readdir, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { sha256 } from "../../src/capsule/node.mjs";
import { wasmtimeCapiIdentity } from "../../src/build/native-wit-artifacts.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";

const { version, archiveSha256 } = wasmtimeCapiIdentity;
const archive = `wasmtime-v${version}-x86_64-linux-c-api.tar.xz`;
const url = `https://github.com/bytecodealliance/wasmtime/releases/download/v${version}/${archive}`;

export const wasmtimeCapiBootstrap = `set -euo pipefail
test "$(uname -sm)" = 'Linux x86_64'
mkdir -p build
test ! -e build/wasmtime-c-api && test ! -L build/wasmtime-c-api
WASMTIME_CAPI_STAGING=$(mktemp -d build/wasmtime-c-api.XXXXXX)
trap 'rm -rf -- "$WASMTIME_CAPI_STAGING"' EXIT
curl --fail --location --retry 3 --retry-delay 2 --connect-timeout 20 --max-time 300 \\
  --output "$WASMTIME_CAPI_STAGING/wasmtime.tar.xz" \\
  '${url}'
echo '${archiveSha256}'"  $WASMTIME_CAPI_STAGING/wasmtime.tar.xz" | sha256sum --check --status
mkdir "$WASMTIME_CAPI_STAGING/unpacked"
tar -xJf "$WASMTIME_CAPI_STAGING/wasmtime.tar.xz" --strip-components=1 -C "$WASMTIME_CAPI_STAGING/unpacked"
test -s "$WASMTIME_CAPI_STAGING/unpacked/include/wasmtime.h"
test -s "$WASMTIME_CAPI_STAGING/unpacked/include/wasm.h"
test -s "$WASMTIME_CAPI_STAGING/unpacked/lib/libwasmtime.so"
test -s "$WASMTIME_CAPI_STAGING/unpacked/lib/libwasmtime.a"
mv -T "$WASMTIME_CAPI_STAGING/unpacked" build/wasmtime-c-api
`;

/**
 * Run the real bootstrap control flow with small inert archive bytes and a
 * local curl stand-in. The fixture hash substitution is test-only; production
 * commands must match the pinned canonical script exactly before substitution.
 *
 * @param t - Parent test lifecycle for scratch cleanup.
 * @param source - Actual executable workflow run scalar.
 */
export const checkWasmtimeCapiBootstrap = async (t, source) => {
	assert.equal(source, wasmtimeCapiBootstrap, "exact pinned Wasmtime bootstrap");
	const flake = await readFile("flake.nix", "utf8");
	assert.ok(flake.includes(`url = "${url}";`), "same Wasmtime archive as Nix");
	assert.ok(flake.includes(`hash = "sha256-${Buffer.from(archiveSha256, "hex").toString("base64")}";`)
		, "same Wasmtime SHA-256 as Nix");
	const root = await mkdtemp(join(tmpdir(), "lean-wasmtime-bootstrap-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const files = ["include/wasmtime.h", "include/wasm.h"
		, "lib/libwasmtime.so", "lib/libwasmtime.a"];
	for(const path of files) await saveLakeFile(root, `fixture/sdk/${path}`, `inert ${path}\n`);
	const compressed = join(root, "sdk.tar.xz");
	execFileSync("/usr/bin/tar", ["-cJf", compressed, "sdk"], { cwd: join(root, "fixture") });
	const bytes = await readFile(compressed), fixtureHash = sha256(bytes);
	assert.notEqual(fixtureHash, archiveSha256);
	assert.equal(source.split(archiveSha256).length, 2);
	const fixtureSource = source.replace(archiveSha256, fixtureHash);
	const fakeCurl = `#!/usr/bin/env bash
set -euo pipefail
test "$#" = 13
test "$1 $2 $3 $4 $5 $6 $7 $8 $9" = '--fail --location --retry 3 --retry-delay 2 --connect-timeout 20 --max-time'
test "\${10}" = 300 && test "\${11}" = --output
test "\${13}" = '${url}'
cp "$BOOTSTRAP_FIXTURE_ARCHIVE" "\${12}"
exit "\${BOOTSTRAP_CURL_STATUS:-0}"
`;
	await saveLakeFile(root, "bin/curl", fakeCurl);
	await chmod(join(root, "bin/curl"), 0o755);
	for(const tool of ["uname", "mkdir", "mktemp", "rm", "cp", "sha256sum", "tar", "xz", "mv", "bash"])
		await symlink(`/usr/bin/${tool}`, join(root, "bin", tool));
	const run = async (name, script = fixtureSource, status = "0", prepare = async () => {}) => {
		const directory = join(root, name);
		await saveLakeFile(directory, "sentinel", "preserve\n");
		await prepare(directory);
		const result = spawnSync("/usr/bin/bash", ["-c", script], {
			cwd: directory, encoding: "utf8", timeout: 10_000
			, env: { PATH: join(root, "bin"), LANG: "C.UTF-8"
				, BOOTSTRAP_FIXTURE_ARCHIVE: compressed, BOOTSTRAP_CURL_STATUS: status }
		});
		assert.equal(result.signal, null, name);
		assert.equal(await readFile(join(directory, "sentinel"), "utf8"), "preserve\n");
		assert.ok(!(await readdir(join(directory, "build"))).some(path =>
			path.startsWith("wasmtime-c-api.")), `${name}: staging cleanup`);
		return { result, directory };
	};
	const installed = await run("valid");
	assert.equal(installed.result.status, 0, installed.result.stderr);
	for(const path of files)
		assert.equal(await readFile(join(installed.directory, "build/wasmtime-c-api", path), "utf8"), `inert ${path}\n`);
	for(const [name, script, status] of [
		["wrong-hash", source, "0"], ["failed-download", fixtureSource, "22"]
	]) {
		const refused = await run(name, script, status);
		assert.notEqual(refused.result.status, 0, name);
		assert.deepEqual(await readdir(join(refused.directory, "build")), [], name);
	}
	const existing = await run("existing", fixtureSource, "0", directory =>
		saveLakeFile(directory, "build/wasmtime-c-api/existing", "keep\n"));
	assert.notEqual(existing.result.status, 0);
	assert.equal(await readFile(join(existing.directory, "build/wasmtime-c-api/existing"), "utf8"), "keep\n");
	const link = await run("symlink", fixtureSource, "0", async directory => {
		await saveLakeFile(directory, "target/sentinel", "keep\n");
		await saveLakeFile(directory, "build/sentinel", "keep\n");
		await symlink(resolve(directory, "target"), join(directory, "build/wasmtime-c-api"));
	});
	assert.notEqual(link.result.status, 0);
	assert.equal(await readFile(join(link.directory, "target/sentinel"), "utf8"), "keep\n");
	await rm(join(root, "fixture/sdk/lib/libwasmtime.so"));
	execFileSync("/usr/bin/tar", ["-cJf", compressed, "sdk"], { cwd: join(root, "fixture") });
	const incomplete = await run("incomplete", source.replace(archiveSha256, sha256(await readFile(compressed))));
	assert.notEqual(incomplete.result.status, 0);
	assert.deepEqual(await readdir(join(incomplete.directory, "build")), []);
	t.diagnostic("Wasmtime bootstrap: exact Nix/runtime pin; valid install, wrong hash, failed download, existing target, symlink and incomplete archive checked offline.");
};
