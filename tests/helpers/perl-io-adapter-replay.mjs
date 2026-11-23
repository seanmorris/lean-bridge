/**
 * Reproject an original native IO archive with the current Perl adapter, without compiling application Lean again.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { reconcileHostExports } from "../../src/analyze/host-export-model.mjs";
import { generateSyncWire } from "../../src/backends/c/sync-wire.mjs";
import { buildNativeSharedRuntime } from "../../src/build/native-component.mjs";
import { installCpanArchive } from "../../src/release/cpan-install.mjs";
import { stageCpanPackage, archiveCpanPackage } from "../../src/release/cpan-package.mjs";
import { readVerifiedPackageSetReceipt } from "../../src/release/package-set-receipt.mjs";
import { runNativeTool as run } from "./native-effect-consumers.mjs";

const env = { ...process.env, LEAN_NUM_THREADS: "1" }, dest = env.LEAN_BRIDGE_PERL_IO_ADAPTER;
test("current Perl XS works with the compiled original component and runtime, including magic and conversion exceptions", { skip: !dest, timeout: 900_000 }, async () => {
	const work=resolve(dest), root=join(resolve(env.LEAN_BRIDGE_PERL_IO_ORIGINAL),"ordinary/handoff"); await mkdir(work);
	const { receipt, result }=await readVerifiedPackageSetReceipt({ receiptPath: join(root,"package-set-receipt.json") });
	const pkg=receipt.packages.find(p => p.role === "component"), rt=receipt.packages.find(p => p.role === "runtime");
	const archive=join(root,pkg.artifacts[0].path), dist=basename(archive,".tar.gz");
	const get=async p=>JSON.parse(await run("tar",["-xOzf",archive,dist+"/"+p],work,env));
	const api=await get("binding-ir.json"), evidence=await get("elaboration.json"), original=await get("lean-bridge-package.json");
	const s=original.syncIO, name=original.module, relative=name.replaceAll("::","/"), prefix=s.library.slice(3,-3);
	const native=await readFile(join(root,"packages/component/lib",relative,"native",s.library));
	assert.equal(sha256(native),s.librarySha256); assert.equal(s.bindingIrSha256,pkg.profile === "native-perl-io-v1" && receipt.profiles[0].bindingIrSha256);
	assert.equal(sha256(canonicalJson(evidence)),s.elaborationSha256);
	const { entries }=reconcileHostExports({ ...evidence, component: api.component, ir: null, review: { source: canonicalJson(api) } });
	const runtimeRoot=join(work,"runtime"), prep=join(work,"component"), leanPrefix=env.LEAN_BRIDGE_LEAN_PREFIX;
	await buildNativeSharedRuntime({ outputRoot: runtimeRoot, leanPrefix });
	await stageCpanPackage({ outputRoot: prep
		, runtimePackageRoot: join(root,"packages/runtime")
		, runtimeRoot, leanPrefix
		, version: original.version, glibcMinimumVersion: original.glibcMinimumVersion
		, syncIO: { api, evidence, name, prefix
			, wire: generateSyncWire(prefix,entries)
			, componentIdentity: s.componentIdentity
			, bindingIrSha256: s.bindingIrSha256
			, runtimeIdentity: rt.runtimeIdentity
			, files: new Map([["lib/"+s.library,native]])
			, projectContract: { notices: {} } } });
	const current=await archiveCpanPackage({ packageRoot: prep, outputRoot: join(work,"archives") });
	const perl=JSON.parse(env.LEAN_BRIDGE_PERLS)[0], prefixDir=join(work,"installed");
	const installed=await installCpanArchive({ archive: join(root,rt.artifacts[0].path), workingRoot: work, prefix: prefixDir, perl, mode: "prebuilt-only", environment: env });
	await installCpanArchive({ archive: current.path, workingRoot: work, prefix: prefixDir, perl, mode: "auto", environment: env });
	const child={ PATH: "/unavailable", LANG: "C.UTF-8", TMPDIR: work, LEAN_NUM_THREADS: "1", PERL5LIB: installed.perl5lib };
	const observations={};
	for(const script of ["magic.t","installed.t"])
	{
		const tap=await run(perl,[resolve("tests/fixtures/perl-sync-io",script)],work,child);
		assert.doesNotMatch(tap,/^not ok\b/mu); observations[script]={ sha256: sha256(tap+"\n"), tests: Number(/^1\.\.(\d+)$/mu.exec(tap)[1]) };
	}
	await writeFile(join(work,"probe.json"),canonicalJson({ originalReceipt: result.receiptSha256, originalNative: s.librarySha256, currentComponent: current.receipt.sha256, observations }),{ flag: "wx" });
});
