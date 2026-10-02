/**
 * Verify real dlopen isolation and process-wide JVM loader admission.
 *
 * @file
 */
import assert from "node:assert/strict";
import { cp, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { sha256 } from "../src/capsule/node.mjs";
import { verifiedJvmAssets } from "../src/backends/jvm/verified-assets.mjs";
import { nativeFixtureEnvironment, runCopied } from "./helpers/copied-fixture-install.mjs";
import { javaCompilerOptions } from "./helpers/type-corpus-jvm-tools.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";

const identity = "a".repeat(64), componentHash = "b".repeat(64);
const fakeEvidence = () => ({ runtimeIdentity: identity, componentId: "one"
	, componentReceiptSha256: componentHash
	, library: "libone_jvm.so"
	, libraries: Object.fromEntries(["libleanshared.so", "liblean_bridge_native.so", "libone_jvm.so"].map(name => [name, identity])) });

test("verified JVM assets reject malformed names, identities and shared dependencies", () => {
	assert.match(verifiedJvmAssets(null, "_Native"), /Build a prepared Maven release/u);
	assert.throws(() => verifiedJvmAssets(null, "bad;\n#error"), /Invalid private/u);
	for(const change of [
		value => { value.runtimeIdentity = "unsigned"; }
		, value => { value.componentReceiptSha256 = ""; }
		, value => { value.componentId = "bad\0value"; }
		, value => { value.library = "libleanshared.so"; }
		, value => { delete value.libraries["liblean_bridge_native.so"]; }
		, value => { value.libraries["../libescape.so"] = identity; }
		, value => { value.libraries["libgmp.so.10"] = identity; }
		, value => { value.libraries["libone_jvm.so"] = "unsigned"; }
	]) {
		const evidence = fakeEvidence(); change(evidence);
		assert.throws(() => verifiedJvmAssets(evidence, "_Native"), /Invalid authenticated/u);
	}
	const source = verifiedJvmAssets(fakeEvidence(), "_Native");
	assert.match(source, /2 \| 256 \| 8/u);
	assert.match(source, /RTLD_NOLOAD/u);
	assert.doesNotMatch(source, /ProcessHandle|Runtime\.getRuntime/u);
});

test("verified JVM loader executes isolated native dependencies and rejects conflicts", {
	skip: process.env.LEAN_BRIDGE_OWNED_NATIVE_TEST !== "1", timeout: 600000
}, async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-jvm-assets-")); t.after(() => rm(root, { recursive: true, force: true }));
	const env = nativeFixtureEnvironment(["java"]);
	const resource = "META-INF/lean-bridge/native/linux-x64", libraries = {};
	const library = async (name, source, flags = []) => {
		await saveLakeFile(root, name + ".c", source);
		await runCopied("/usr/bin/cc", [
			"-shared", "-fPIC", "-O2", "-Wall", "-Wextra", "-Werror"
			, name + ".c", ...flags, "-Wl,-soname," + name, "-o", name
		], root, { PATH: "/usr/bin:/bin" });
		libraries[name] = await readFile(join(root, name)); return libraries[name];
	};
	await library("libleanshared.so", "int fixture_runtime(void) { return 1; }\n");
	await library("liblean_bridge_native.so", "int fixture_broker(void) { return 1; }\n");
	await library("libgmp-lean-bridge.so.10", "int fixture_gmp(void) { return 7; }\n", ["-Wl,-Bsymbolic"]);
	for(const [name, value] of [["libone_jvm.so", 42], ["libtwo_jvm.so", 43]])
		await library(name, `extern int fixture_gmp(void); int answer(void) { return ${value} + fixture_gmp(); }\n`,
			["-L", root, "-l:libgmp-lean-bridge.so.10", "-Wl,-rpath,$ORIGIN", "-Wl,-z,defs"]);
	await library("libpoison.so", "int fixture_gmp(void) { return 9000; }\n");
	const create = async (directory, { componentId = directory, libraryName = directory === "one" ? "libone_jvm.so" : "libtwo_jvm.so", runtimeIdentity = identity, replacements = {} } = {}) => {
		const names = ["libleanshared.so", "liblean_bridge_native.so", "libgmp-lean-bridge.so.10", libraryName];
		const evidence = { componentId, componentReceiptSha256: componentHash
			, runtimeIdentity, library: libraryName
			, libraries: Object.fromEntries(names.map(name => [name, sha256(replacements[name] ?? libraries[name])])) };
		const where = join(root, directory), source = `package fixture;
final class _Native {
${verifiedJvmAssets(evidence, "_Native")}
}
`;
		await saveLakeFile(where, "_Native.java", source);
		await saveLakeFile(where, "Api.java", `package fixture;
public final class Api {
    private Api() { }
    public static int read() throws Throwable {
        var lookup = _Native.lookup();
        var call = java.lang.foreign.Linker.nativeLinker().downcallHandle(lookup.find("answer").orElseThrow(),
            java.lang.foreign.FunctionDescriptor.of(java.lang.foreign.ValueLayout.JAVA_INT));
        return (int)call.invokeExact();
    }
}
`);
		await runCopied(env.LEAN_BRIDGE_JAVAC, [...javaCompilerOptions, "-d", "classes", "_Native.java", "Api.java"], where);
		for(const name of names) await saveLakeFile(where, "classes/" + resource + "/" + name, replacements[name] ?? libraries[name]);
		return where;
	};
	await create("one"); await create("two"); await create("runtime", { runtimeIdentity: "c".repeat(64) });
	await create("component", { componentId: "one" });
	await create("hash", { replacements: { "libleanshared.so": await library("libdifferent.so", "int fixture_runtime(void) { return 2; }\n") } });
	await create("broken", { replacements: { "libtwo_jvm.so": Buffer.from("not an ELF shared library\n") } });
	for(const mode of ["missing", "tampered"])
	{
		await cp(join(root, "one"), join(root, mode), { recursive: true });
		const path = join(root, mode, "classes", resource, "libone_jvm.so");
		if(mode === "missing") await rm(path);
		else await saveLakeFile(root, join(mode, "classes", resource, "libone_jvm.so"), Buffer.from("tampered\n"));
	}
	const probe = await readFile("tests/fixtures/structured-types/VerifiedJvmAssetsProbe.java", "utf8");
	await saveLakeFile(root, "VerifiedJvmAssetsProbe.java", probe);
	await runCopied(env.LEAN_BRIDGE_JAVAC, [...javaCompilerOptions, "-d", "probe", "VerifiedJvmAssetsProbe.java"], root);
	const observations = [];
	for(const mode of ["shared", "isolation", "preload", "runtime", "component", "hash", "missing", "tampered", "broken", "warm-origin", "cold-origin"])
	{
		const run = await runCopied(env.LEAN_BRIDGE_JAVA, [
			"--enable-native-access=ALL-UNNAMED", "-cp", "probe"
			, "VerifiedJvmAssetsProbe", root, mode
		], root);
		assert.equal(run.stderr, "");
		const observed = JSON.parse(run.stdout.trim()); assert.equal(observed.mode, mode); assert.ok(observed.checks > 0);
		observations.push(observed);
	}
	t.diagnostic(JSON.stringify({ fixtureLibraries: true, compiledLean: false, installedMaven: false, observations }));
});
