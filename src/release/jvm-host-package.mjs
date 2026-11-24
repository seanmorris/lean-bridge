/** @file Package compiled Lean calls to application-owned Java classes for Maven. */
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { canonicalJson, sha256 } from "../capsule/node.mjs";
import { hashBindingIr } from "../binding-ir/canonical.mjs";
import { compileHostSources } from "../build/host-elaboration.mjs";
import { compileJvmHostDomain, compileJvmIOOwner } from "../build/jvm-io-owner.mjs";
import { resolveJvmTool } from "../build/compile-jvm-sources.mjs";
import { processBuildRunner } from "../build/process-runner.mjs";
import { readVerifiedNativeRuntime, validateNativeElf } from "../build/native-artifacts.mjs";
import { generateJvmHostExports } from "../backends/jvm/host-exports.mjs";
import { jvmHostNamespace } from "../backends/jvm/host-api.mjs";
import { writeJvmIORelease } from "./jvm-io-package.mjs";

/**
 * Build a complete, compiler-free consumer handoff after checking exact imported and exported declarations.
 *
 * @param o - Captured source, verified shared Lean runtime and Maven coordinates.
 */
export const buildJvmHostPackage = async o => {
	const { ir, projectContract, workRoot, runtimeRoot, leanPrefix, environment, signal } = o;
	if(!ir || projectContract.taskExports.length || projectContract.asyncIterators.length || projectContract.leanResources.length) throw new TypeError("JVM host imports require standalone synchronous exports");
	const app = await mkdtemp(join(workRoot, ".jvm-host-")), cc = environment.CC ?? "cc";
	const run = (command, args, cwd = app, env = environment) => processBuildRunner.capture({ command, args, cwd, env, signal });
	const save = (name, contents) => writeFile(join(app, name), contents, { flag: "wx" });
	try
	{
		const { identity: runtimeIdentity, manifest } = await readVerifiedNativeRuntime(runtimeRoot);
		const { api, entries, objects, evidence, env } = await compileHostSources({ ...o, target: "maven", app, run });
		const javac = await resolveJvmTool(environment.LEAN_BRIDGE_JAVAC ?? "javac", environment, app), javaHome = dirname(dirname(javac));
		const tool = { app, runtimeRoot, runtimeIdentity, javaHome, leanPrefix, cc, run };
		const owner = await compileJvmIOOwner(tool), domain = await compileJvmHostDomain({ ...tool, owner });
		const wire = await readFile(new URL("../backends/jvm/host-wire.h", import.meta.url));
		await save("host-wire.h", wire);
		const options = { ir, entries, modules: projectContract.modules }, skeleton = await generateJvmHostExports({ ...options, identity: "0".repeat(64) });
		const componentIdentity = sha256(canonicalJson({ api, evidence
			, owner: owner.id, domain: domain.id, runtimeIdentity
			, source: skeleton.source
			, entry: skeleton.entryLean
			, header: skeleton.header
			, members: skeleton.model.implementation
			, wire: sha256(wire), name: o.name, version: o.version }));
		const gen = await generateJvmHostExports({ ...options, identity: componentIdentity });
		const { prefix } = gen, library = "lib" + prefix + ".so", veneerName = "liblb_jni_" + componentIdentity + ".so";
		await save("BridgeJvmExports.lean", gen.entryLean); await save("entry-abi.h", gen.header); await save("provider.c", gen.source);
		await run(join(leanPrefix, "bin/lean"), ["-j1", "-c", "entry.c", "BridgeJvmExports.lean"], app, env);
		const units = [];
		for(const [i, c] of [...objects, "entry.c"].entries())
		{
			const name = "checked" + i + ".c"; await save(name, '#include "' + c + '"\n#include "entry-abi.h"\n'); units.push(name);
		}
		const jni = "Java_" + jvmHostNamespace(api.component).replaceAll("_", "_1").replaceAll(".", "_") + "_NativePort_invoke";
		await save("veneer.c", `#include <jni.h>
extern jobject ${prefix}_call(JNIEnv *,jobject,jint,jobjectArray);
JNIEXPORT jobjectArray JNICALL ${jni}(JNIEnv *e,jclass cls,jobject port,jint op,jobjectArray args) {
    (void)cls; return (jobjectArray)${prefix}_call(e,port,op,args);
}
`);
		await save("provider.map", "{ global: " + prefix + "_call; local: *; };\n");
		const flags = ["-std=gnu11", "-O2", "-g0", "-DNDEBUG"
			, "-shared", "-fPIC", "-fvisibility=hidden"
			, "-Werror=incompatible-pointer-types"
			, "-Werror=implicit-function-declaration"
			, "-ffile-prefix-map=" + app + "=/build/lean-bridge/host"
			, ...domain.includes
			, "-I" + join(runtimeRoot, "include")
			, "-Wl,--build-id=none"
			, "-Wl,-rpath,$ORIGIN"
			, "-L."
			, "-L" + join(runtimeRoot, "lib")];
		await run(cc, [...flags, owner.flag, domain.flag, ...units
			, "provider.c", "host-frame.c", "-l:" + domain.name, "-l:" + owner.name
			, "-lleanshared", "-llean_bridge_native"
			, "-Wl,--version-script=provider.map"
			, "-Wl,-z,defs,-z,nodelete"
			, "-Wl,-soname," + library
			, "-o"
			, library]);
		await run(cc, [...flags, "veneer.c", "-l:" + library, "-Wl,-z,defs", "-Wl,-soname," + veneerName, "-o", veneerName]);
		const floor = environment.LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR ?? "2.38";
		if(!/^2\.(?:3[0-9]|[4-9][0-9])$/u.test(floor)) throw new TypeError("Invalid JVM host glibc floor");
		const files = new Map(); let veneer;
		for(const n of ["libleanshared.so", "liblean_bridge_native.so", owner.name, domain.name, library, veneerName])
		{
			const path = "lib/" + n, sdk = manifest.files[path], file = sdk ? join(runtimeRoot, path) : join(app, n);
			const bytes = await readFile(file); validateNativeElf(bytes);
			if(sdk ? sha256(bytes) !== sdk.sha256 : bytes.includes(Buffer.from(resolve(workRoot)))) throw new Error("Invalid JVM host binary provenance: " + n);
			for(const m of (await run("readelf", ["--version-info", file])).stdout.matchAll(/GLIBC_(\d+)\.(\d+)(?:\.(\d+))?/gu))
				if(+m[1] > 2 || (+m[1] === 2 && (+m[2] > +floor.slice(2) || (+m[2] === +floor.slice(2) && +m[3] > 0)))) throw new Error(n + " exceeds glibc " + floor);
			if(n === veneerName) veneer = { name: n, sha256: sha256(bytes), bytes }; else files.set(path, bytes);
		}
		const host = { domain, veneer, model: gen.model, entries, ir };
		return await writeJvmIORelease({ ...o, prefix, host, files, owner, api, evidence, runtimeIdentity, componentIdentity, bindingIrSha256: hashBindingIr(api), manifest, floor });
	}
	finally
	{ await rm(app, { recursive: true, force: true }); }
};
