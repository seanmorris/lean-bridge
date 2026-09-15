/**
 * Closed compiler-input bundles, relocation and optional CLI delivery.
 *
 * @file
 */
import assert from "node:assert/strict";
import { chmod, cp, lstat, mkdir, mkdtemp, readFile, rename, rm, symlink, truncate } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { buildPhpWasmCompilerInputs, phpWasmCompilerInputsName as manifestName, readVerifiedPhpWasmCompilerInputs } from "../src/release/php-wasm-compiler-inputs.mjs";
import { buildCliNpmPackage } from "../src/release/cli-npm-package.mjs";
import { buildPhpWasmProject } from "../src/build/php-wasm-project.mjs";
import { processBuildRunner } from "../src/build/process-runner.mjs";
import { createPhpWasmCompilerInputFixture } from "./helpers/php-wasm-compiler-inputs.mjs";
import { createPhpWasmOrdinaryProject } from "./helpers/php-wasm-ordinary.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";

const scratch = async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-php-inputs-test-"));
	t.after(() => rm(root, { recursive: true, force: true })); return root;
};
const changeManifest = async (root, update) => {
	const manifest = JSON.parse(await readFile(join(root, manifestName), "utf8")); update(manifest);
	const bytes = canonicalJson(manifest);
	await saveLakeFile(root, manifestName, bytes);
	await saveLakeFile(root, `${manifestName}.sha256`, `${sha256(bytes)}  ${manifestName}\n`);
};

test("prepared PHP-Wasm inputs are deterministic, closed and relocatable without source trees", async t => {
	const root = await scratch(t), source = join(root, "source"), input = await createPhpWasmCompilerInputFixture(source);
	await saveLakeFile(input.phpSource, ".git/private", "not shipped");
	await saveLakeFile(input.phpSource, "ext/scratch.c", "not shipped");
	const first = await buildPhpWasmCompilerInputs({ ...input, outputRoot: join(root, "first") });
	const moved = join(root, "moved"); await cp(source, moved, { recursive: true });
	await rename(source, `${source}-unavailable`);
	const second = await buildPhpWasmCompilerInputs({ runtimeRoot: join(moved, "runtime"), phpSource: join(moved, "php"), projectRoot: join(moved, "engine"), outputRoot: join(root, "second") });
	assert.deepEqual(await readFile(first.archive), await readFile(second.archive));
	await saveLakeFile(join(moved, "php"), "ext/.git/private.h", "not a public header");
	await assert.rejects(buildPhpWasmCompilerInputs({ runtimeRoot: join(moved, "runtime"), phpSource: join(moved, "php"), projectRoot: join(moved, "engine"), outputRoot: join(root, "private-headers") }), /header inventory/);
	assert.equal(first.archiveSha256, second.archiveSha256);
	assert.equal(first.identity, second.identity);
	const extracted = join(root, "read-only"); await cp(first.directory, extracted, { recursive: true });
	const before = await readVerifiedPhpWasmCompilerInputs(extracted);
	assert.ok([...before.files.keys()].every(path => !path.includes(".git") && !path.endsWith("scratch.c")));
	for(const path of before.files.keys()) await chmod(join(extracted, path), 0o444);
	await chmod(extracted, 0o555);
	try
	{ assert.equal((await readVerifiedPhpWasmCompilerInputs(extracted)).identity, first.identity); }
	finally
	{ await chmod(extracted, 0o755); }
	assert.equal(before.manifest.runtimeIdentity, first.runtimeIdentity);
	assert.equal(before.manifest.phpHeadersSha256, first.phpHeadersSha256);
	await assert.rejects(buildPhpWasmCompilerInputs({ ...input, outputRoot: first.output }), /already exists/);
	assert.deepEqual(await readFile(first.archive), await readFile(second.archive));
});

test("bundles reject corruption, unsafe entries, wrong profiles, missing notices and oversized payloads", async t => {
	const root = await scratch(t), input = await createPhpWasmCompilerInputFixture(join(root, "source"));
	const prepared = await buildPhpWasmCompilerInputs({ ...input, outputRoot: join(root, "prepared") });
	const cases = [
		["header drift", dir => saveLakeFile(dir, "php/main/php.h", "modified")]
		, ["manifest sidecar", dir => saveLakeFile(dir, `${manifestName}.sha256`, "invalid")]
		, ["missing sidecar", dir => rm(join(dir, `${manifestName}.sha256`))]
		, ["unrecorded file", dir => saveLakeFile(dir, "private.txt", "do not ship")]
		, ["missing notice", dir => rm(join(dir, "notices/php/Zend/LICENSE"))]
		, ["unsafe path", dir => changeManifest(dir, value => { value.files["../escape"] = value.files["php/config.h"]; })]
		, ["wrong profile", dir => changeManifest(dir, value => { value.profile = "native-library-v1"; })]
		, ["wrong pins", dir => changeManifest(dir, value => { value.pins.phpVersion = "8.3.0"; })]
		, ["unknown field", dir => changeManifest(dir, value => { value.extra = true; })]
		, ["negative size", dir => changeManifest(dir, value => { value.files["php/config.h"].bytes = -1; })]
		, ["huge size", dir => changeManifest(dir, value => { value.files["php/config.h"].bytes = 65 * 1024 ** 2; })]
		, ["oversized actual file", dir => truncate(join(dir, "php/config.h"), 65 * 1024 ** 2)]
		, ["wrong header identity", dir => changeManifest(dir, value => { value.phpHeadersSha256 = "0".repeat(64); })]
		, ["wrong runtime identity", dir => changeManifest(dir, value => { value.runtimeIdentity = "0".repeat(64); })]
		, ["symlink file", async dir => { await rm(join(dir, "php/config.h")); await symlink(join(input.phpSource, "config.h"), join(dir, "php/config.h")); }]
		, ["symlink directory", async dir => { await rename(join(dir, "php/main"), join(dir, "elsewhere")); await symlink(join(dir, "elsewhere"), join(dir, "php/main")); }]
	];
	for(const [label, mutate] of cases) await t.test(label, async () => {
		const dir = join(root, label); await cp(prepared.directory, dir, { recursive: true });
		await mutate(dir); await assert.rejects(readVerifiedPhpWasmCompilerInputs(dir));
	});
	for(const [label, contents] of [["wrong PHP", "#define PHP_VERSION_ID 80300\n"], ["wrong width", "#define SIZEOF_LONG 8\n#define SIZEOF_SIZE_T 8\n"], ["ZTS", "#define SIZEOF_LONG 4\n#define SIZEOF_SIZE_T 4\n#define ZTS 1\n"]]) await t.test(label, async () => {
		const dir = join(root, label); await cp(prepared.directory, dir, { recursive: true });
		const path = label === "wrong PHP" ? "php/main/php_version.h" : "php/main/php_config.h";
		await saveLakeFile(dir, path, contents);
		await changeManifest(dir, value => { value.files[path] = { bytes: Buffer.byteLength(contents), sha256: sha256(contents) }; });
		await assert.rejects(readVerifiedPhpWasmCompilerInputs(dir), /PHP 8.4.1 wasm32 NTS/);
	});
	const controller = new AbortController(); controller.abort();
	await assert.rejects(readVerifiedPhpWasmCompilerInputs(prepared.directory, { signal: controller.signal }), { name: "AbortError" });
});

test("CLI archives include only verified optional PHP-Wasm inputs", async t => {
	const root = await scratch(t), input = await createPhpWasmCompilerInputFixture(join(root, "source"));
	const prepared = await buildPhpWasmCompilerInputs({ ...input, outputRoot: join(root, "prepared") });
	const candidate = await buildCliNpmPackage({ outputRoot: join(root, "cli"), phpWasmInputsRoot: prepared.directory });
	assert.equal(candidate.report.runtimeIncluded, false); assert.equal(candidate.report.phpWasmInputsIncluded, true);
	assert.equal((await readVerifiedPhpWasmCompilerInputs(join(candidate.directory, "runtime/php-wasm"))).identity, prepared.identity);
	const repeat = await buildCliNpmPackage({ outputRoot: join(root, "cli-repeat"), phpWasmInputsRoot: prepared.directory });
	assert.deepEqual(await readFile(candidate.archive), await readFile(repeat.archive));
	await saveLakeFile(prepared.directory, "php/config.h", "damaged");
	await assert.rejects(buildCliNpmPackage({ outputRoot: join(root, "rejected"), phpWasmInputsRoot: prepared.directory }));
	await assert.rejects(lstat(join(root, "rejected")), { code: "ENOENT" });
});

test("the compiler-input packaging command needs only Node and existing files", async t => {
	const root = await scratch(t), input = await createPhpWasmCompilerInputFixture(join(root, "source"));
	const response = await processBuildRunner.capture({ command: process.execPath
		, args: [join(process.cwd(), "scripts/build-php-wasm-compiler-inputs.mjs"), "--runtime", input.runtimeRoot, "--php-source", input.phpSource, "--output", join(root, "bundle")]
		, cwd: root, env: { PATH: "/nonexistent-tools" } });
	const result = JSON.parse(response.stdout);
	assert.equal((await readVerifiedPhpWasmCompilerInputs(result.directory)).identity, result.identity);
	assert.equal(sha256(await readFile(result.archive)), result.archiveSha256);
	const missing = processBuildRunner.capture({ command: process.execPath
		, args: [join(process.cwd(), "scripts/build-php-wasm-compiler-inputs.mjs"), "--output", join(root, "missing-inputs")]
		, cwd: root });
	await assert.rejects(missing, error => error.details.stderr.includes("--runtime, --php-source and --output are required"));
	await assert.rejects(lstat(join(root, "missing-inputs")), { code: "ENOENT" });
});

test("explicit bundles cannot mix with raw inputs and corrupt defaults cannot fall back", async t => {
	const root = await scratch(t), projectRoot = join(root, "project"), engineRoot = join(root, "engine"), outputRoot = join(root, "release");
	await createPhpWasmOrdinaryProject(projectRoot, "Willow");
	const sdk = join(root, "sdk"); await mkdir(sdk);
	for(const name of ["LEAN_BRIDGE_PHP_SOURCE", "LEAN_BRIDGE_PHP_COPIED_RUNTIME", "LEAN_BRIDGE_PHP_LEAN_RUNTIME"])
		await assert.rejects(buildPhpWasmProject({ projectRoot, outputRoot, engineRoot, environment: { LEAN_BRIDGE_PHP_EMSDK: sdk, LEAN_BRIDGE_PHP_INPUTS: "/unused", [name]: "/unused" } }), { code: "conflicting-php-wasm-inputs" });
	await mkdir(join(engineRoot, "runtime/php-wasm"), { recursive: true });
	await assert.rejects(buildPhpWasmProject({ projectRoot, outputRoot, engineRoot, environment: { LEAN_BRIDGE_PHP_EMSDK: sdk } }), error => error.code === "ENOENT" && error.path.endsWith(manifestName));
	await assert.rejects(lstat(outputRoot), { code: "ENOENT" });
});
