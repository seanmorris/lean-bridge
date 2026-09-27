/**
 * Keep prepared Ruby arithmetic independent of the interpreter's GMP hooks.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { buildNativeGmp } from "../src/build/native-gmp.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";
import { runCopied } from "./helpers/copied-fixture-install.mjs";

test("private GMP selection rejects arbitrary library identities", async () => {
	for(const privateSoname of [null, 1, "escape/../gmp"])
		await assert.rejects(() => buildNativeGmp({ root: "unused", privateSoname }), /must be a Boolean/u);
});

test("Ruby keeps its GMP while a private checked library supplies bridge integers", {
	skip: process.env.LEAN_BRIDGE_OWNED_NATIVE_TEST !== "1", timeout: 900000
}, async t => {
	const directory = await mkdtemp(join(tmpdir(), "lean-bridge-ruby-gmp-"));
	t.after(() => rm(directory, { recursive: true, force: true }));
	await buildNativeGmp({ root: directory, privateSoname: true }).catch(error => {
		error.message += `: ${JSON.stringify({ ...error.details, stdout: error.details?.stdout?.slice(-8000) })}`;
		throw error;
	});
	const manifest = JSON.parse(await readFile(join(directory, "share/lean-bridge/gmp.json")));
	assert.equal(manifest.soname, "libgmp-lean-bridge.so.10");
	assert.equal(manifest.binding, "local-symbols"); assert.equal(manifest.checked, true);
	const source = await readFile("tests/fixtures/structured-types/owned-ruby-gmp.c", "utf8");
	const ruby = await readFile("tests/fixtures/structured-types/owned-ruby-gmp.rb", "utf8");
	await saveLakeFile(directory, "probe.c", source);
	await saveLakeFile(directory, "consumer.rb", ruby);
	await runCopied("cc", ["-std=c11", "-O2", "-g0", "-fPIC", "-shared"
		, "-Wall", "-Wextra", "-Werror", "-I", "include", "probe.c"
		, "-L", "lib", "-Wl,--no-as-needed", "-l:libgmp-lean-bridge.so.10"
		, "-Wl,-rpath,$ORIGIN", "-Wl,-z,defs", "-ldl", "-o", "lib/libprobe.so"]
	, directory, process.env);
	const dynamic = await runCopied("readelf", ["-d", "lib/libprobe.so"], directory, process.env);
	assert.match(dynamic.stdout, /NEEDED.*\[libgmp-lean-bridge\.so\.10\]/u);
	assert.doesNotMatch(dynamic.stdout, /NEEDED.*\[libgmp\.so\.10\]/u);
	const command = resolve(process.env.LEAN_BRIDGE_RUBY ?? ".toolchains/ruby33/bin/ruby");
	const lean = resolve(process.env.LEAN_BRIDGE_LEAN_PREFIX ?? ".toolchains/elan/toolchains/leanprover--lean4---v4.32.2");
	const result = await runCopied(command, ["--disable-gems", "consumer.rb", join(directory, "lib"), join(lean, "lib/lean/libleanshared.so")], directory, { PATH: "/usr/bin:/bin" });
	assert.equal(result.stderr, "");
	const observation = JSON.parse(result.stdout);
	assert.equal(observation.bundledVersion, "6.3.0");
	assert.equal(observation.interposedWithoutDeepBind, true);
	assert.equal(observation.privateWithDeepBind, true);
	assert.equal(observation.rubyAllocatorsUnchanged, true);
	assert.equal(observation.privateAllocatorsIndependent, true);
	assert.equal(observation.leanAllocatorsIndependent, true);
	assert.equal(observation.roundTrips, 500);
	await saveLakeFile(resolve("build/owned-ruby-gmp"), "isolation.json", canonicalJson({
		observation, gmp: manifest, installedPackage: false
		, compilerProbeSha256: sha256(source), rubyProbeSha256: sha256(ruby)
		, compilerProbeLibrarySha256: sha256(await readFile(join(directory, "lib/libprobe.so")))
		, dynamic: dynamic.stdout
	}));
	t.diagnostic(JSON.stringify(observation));
});
