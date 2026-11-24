/** @file Compile the real MRI host provider and package its authenticated shared domain. */
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { canonicalJson, sha256 } from "../capsule/node.mjs";
import { hashBindingIr } from "../binding-ir/canonical.mjs";
import { compileHostSources } from "../build/host-elaboration.mjs";
import { processBuildRunner } from "../build/process-runner.mjs";
import { readVerifiedNativeRuntime, validateNativeElf } from "../build/native-artifacts.mjs";
import { generateRubyHostProvider } from "../backends/ruby/host-provider.mjs";
import { copiedRubyRuntime } from "../backends/ruby/copied-assets.mjs";
import { isReservedRubyName } from "../backends/ruby/copied-model.mjs";
import { verifiedRubyAssets } from "../backends/ruby/verified-assets.mjs";
import { writeRubySyncRelease } from "./ruby-sync-package.mjs";

const domain = "liblean_bridge_ruby_host_v1.so";
const asset = name => readFile(new URL("../backends/ruby/" + name, import.meta.url));
/**
 * Build a target-specific owner-thread extension. Ruby headers are publisher inputs only.
 *
 * @param o - Captured project, pinned toolchain, runtime and new release stage.
 */
export const buildRubyHostPackage = async o => {
	const { ir, projectContract, name, version, leanPrefix, runtimeRoot, workRoot, environment, signal } = o;
	if(!ir || projectContract.taskExports.length || projectContract.asyncIterators.length || projectContract.leanResources.length) throw new TypeError("Ruby host imports require standalone synchronous exports");
	const slug = name.replaceAll("-", "_"), ns = slug.split("_").map(s => s[0].toUpperCase() + s.slice(1)).join("");
	if(!/^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$/u.test(slug) || isReservedRubyName(ns) || ns === "RubyHostValuesV1") throw new TypeError("Invalid Ruby host component namespace");
	const app = await mkdtemp(join(workRoot, ".ruby-host-")), run = (command, args, cwd = app, env = environment) => processBuildRunner.capture({ command, args, cwd, env, signal });
	try
	{
		const { identity: runtimeIdentity, manifest } = await readVerifiedNativeRuntime(runtimeRoot);
		const { api, entries, objects, evidence, env } = await compileHostSources({ ...o, target: "rubygems", app, run });
		const bindingIrSha256 = hashBindingIr(api), ruby = environment.LEAN_BRIDGE_RUBY ?? "ruby";
		const rb = JSON.parse((await run(ruby, ["--disable-gems", "-rrbconfig", "-rjson", "-e", 'abort "MRI Ruby 3.3 x86_64 Linux required" unless RUBY_ENGINE=="ruby" && RUBY_VERSION.start_with?("3.3.") && RUBY_PLATFORM.include?("x86_64-linux"); puts JSON.generate(RbConfig::CONFIG.values_at("rubyhdrdir","rubyarchhdrdir"))'])).stdout);
		const hdr = await asset("host-domain.h"), c = await asset("host-domain.c"), scalars = await asset("host-scalars.h");
		const options = { ir, entries, modules: projectContract.modules, namespace: ns, extension: "liblb_rh_" + slug };
		const skeleton = generateRubyHostProvider({ ...options, identity: "0".repeat(64) });
		const componentIdentity = sha256(canonicalJson({ api, evidence, runtimeIdentity, skeleton, domain: [sha256(c), sha256(hdr)], scalars: sha256(scalars), name, version }));
		const generated = generateRubyHostProvider({ ...options, identity: componentIdentity }), lib = options.extension + ".so";
		const save = (p, data) => writeFile(join(app, p), data, { flag: "wx" });
		await save("host-domain.h", hdr); await save("host-domain.c", c); await save("host-scalars.h", scalars); await save("provider.c", generated.source);
		await save("entry-declarations.h", generated.header); await save("BridgeRubyExports.lean", generated.entryLean);
		await run(join(leanPrefix, "bin/lean"), ["-j1", "-c", "entry.c", "BridgeRubyExports.lean"], app, env);
		const units = []; for(const [i, f] of [...objects, "entry.c"].entries())
		{
			const file = "checked" + i + ".c"; await save(file, '#include "' + f + '"\n#include "entry-declarations.h"\n'); units.push(file);
		}
		const cc = environment.CC ?? "cc", flags = ["-O2", "-g0", "-fPIC", "-shared"
			, "-Werror=implicit-function-declaration"
			, "-Werror=incompatible-pointer-types"
			, "-ffile-prefix-map=" + app + "=/build/lean-bridge/component"
			, "-I" + join(leanPrefix, "include")
			, "-I" + join(runtimeRoot, "include")
			, ...rb.map(p => "-I" + p)
			, "-L" + join(runtimeRoot, "lib")
			, "-Wl,--build-id=none"
			, "-Wl,-rpath,$ORIGIN"
			, "-Wl,-z,nodelete"];
		await save("domain.map", "{ global: lb_rh_*; local: *; };\n");
		await run(cc, [...flags, "host-domain.c", "-lleanshared", "-Wl,--version-script=domain.map", "-Wl,-soname," + domain, "-o", domain]);
		await save("extension.map", "{ global: Init_" + options.extension + "; local: *; };\n");
		await run(cc, [...flags, ...units, "provider.c", "-L.", "-l:" + domain, "-lleanshared", "-llean_bridge_native", "-Wl,--version-script=extension.map", "-Wl,-soname," + lib, "-o", lib]);
		const floor = environment.LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR ?? "2.38";
		if(!/^2\.(?:3[0-9]|[4-9][0-9])$/u.test(floor)) throw new TypeError("Invalid Linux ABI floor");
		const files = new Map(), libraries = {};
		for(const base of ["libleanshared.so", "liblean_bridge_native.so", domain, lib])
		{
			const path = "lib/" + base, sdk = manifest.files[path], file = sdk ? join(runtimeRoot, path) : join(app, base), bytes = await readFile(file);
			validateNativeElf(bytes); const hash = sha256(bytes);
			if(sdk ? hash !== sdk.sha256 : bytes.includes(Buffer.from(resolve(workRoot)))) throw new Error("Invalid Ruby host binary provenance: " + base);
			for(const m of (await run("readelf", ["--version-info", file])).stdout.matchAll(/GLIBC_(\d+)\.(\d+)(?:\.(\d+))?/gu))
				if(+m[1] > 2 || (+m[1] === 2 && (+m[2] > +floor.slice(2) || (+m[2] === +floor.slice(2) && +m[3] > 0)))) throw new Error(base + " exceeds glibc " + floor);
			files.set(path, bytes); libraries[base] = hash;
		}
		const path = "lean_bridge/" + slug;
		const loader = 'require "fiddle"\nrequire "digest"\nmodule LeanBridge\n  module ' + ns + '\n    module HostLoader\n' + verifiedRubyAssets({ componentId: api.component.id, library: lib, libraries, runtimeIdentity })
			+ '\n    end\n    private_constant :HostLoader\n  end\nend\nrequire_relative "native/linux-x64/' + options.extension + '"\n' + generated.privateMethods;
		const source = {
			namespace: "LeanBridge::" + ns, requirePath: path
			, files: {
				["lib/" + path + ".rb"]: generated.ruby + 'require_relative "' + slug + '/host_loader"\n'
				, ["lib/" + path + "/host_loader.rb"]: loader
				, "lib/lean_bridge/native_copied_runtime_v1.rb": copiedRubyRuntime
			}
		};
		return await writeRubySyncRelease({ ...o, prefix: options.extension.slice(3), host: { domain, source }, files, api, evidence, manifest, runtimeIdentity, componentIdentity, bindingIrSha256, floor });
	} finally
	{ await rm(app, { recursive: true, force: true }); }
};
