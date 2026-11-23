/**
 * Install original archives with the normal CPAN installer and run relocated Perl clients.
 *
 * @file
 */
import assert from "node:assert/strict";
import { constants } from "node:fs";
import { copyFile, mkdir, mkdtemp, readFile, rename, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { readVerifiedPackageSetReceipt } from "../../src/release/package-set-receipt.mjs";
import { installCpanArchive } from "../../src/release/cpan-install.mjs";
import { runNativeTool as run } from "./native-effect-consumers.mjs";
import { assertJsonSchema } from "./json-schema.mjs";

const env = { ...process.env, LEAN_NUM_THREADS: "1" }, capture = env.LEAN_BRIDGE_PERL_IO_CAPTURE;
const replay = env.LEAN_BRIDGE_PERL_IO_REPLAY, json = async f => JSON.parse(await readFile(f,"utf8"));
const smoke = env.LEAN_BRIDGE_PERL_IO_SMOKE === "1";
test("relocated prebuilt CPAN clients preserve synchronous IO and distinct returned and thrown Except values", { skip: !capture && !replay, timeout: 7_200_000 }, async t => {
	assert.ok(!(capture && replay));
	const root = resolve(capture ?? replay), work = await mkdtemp(join(tmpdir(),"installed-perl-io-"));
	t.after(() => rm(work,{ recursive: true, force: true }));
	const original = replay ? await readFile(join(root,"acceptance.json")) : null;
	if(env.LEAN_BRIDGE_PERL_IO_EXPECTED)
	{
		assert.ok(original, "A pinned acceptance digest is for replay of the original release");
		assert.equal(sha256(original),(await json(resolve(env.LEAN_BRIDGE_PERL_IO_EXPECTED))).acceptanceSha256);
	}
	const retained = original ? JSON.parse(original) : null;
	const archive = {}, reports = [], rows = [], sources = {}, fallback = [];
	// Failed rows never publish partial TAP that can be mistaken for accepted evidence.
	const pendingTap = new Map();
	const recordTap = async (name,tap) => {
		if(capture) pendingTap.set(name,tap+"\n");
		else assert.equal(await readFile(join(root,name),"utf8"),tap+"\n");
	};
	for(const f of ["installed.t","example.pl","verify.py","magic.t", ...smoke ? [] : ["compose.t","retire.t","Observe.xs","build-observer.pl"]])
	{
		const b = await readFile(replay ? join(root,f) : join("tests/fixtures/perl-sync-io",f)); sources[f] = sha256(b);
		if(replay) assert.equal(sources[f],retained.sources[f]);
		await writeFile(join(work,f),b,{ flag: "wx" });
	}
	for(const route of smoke ? ["ordinary"] : ["ordinary","reviewed","peer"])
	{
		const dir = join(root,route,"handoff");
		const { receipt, result } = await readVerifiedPackageSetReceipt({ receiptPath: join(dir,"package-set-receipt.json") });
		await assertJsonSchema("package-set-receipt",receipt);
		if(replay) assert.equal(result.receiptSha256,retained.packages.find(p => p.route === route)?.receiptSha256);
		const [rt, comp] = ["runtime","component"].map(role => receipt.packages.find(p => p.role === role));
		assert.equal(receipt.profiles[0].id,"native-perl-io-v1"); assert.equal(rt.name,"LeanBridge-Runtime");
		assert.deepEqual(comp.requires,[{ ecosystem: "cpan", name: rt.name, version: rt.version }]);
		assert.equal(comp.name,route === "peer" ? "LeanBridge-Companion" : "LeanBridge-Journal");
		const manifest = await json(join(dir,"packages/component/lean-bridge-package.json"));
		assert.equal(manifest.syncIO.bindingIrSha256,receipt.profiles[0].bindingIrSha256); assert.equal(manifest.nativeRuntimeIdentity,rt.runtimeIdentity);
		archive[route] = { runtime: join(dir,rt.artifacts[0].path), component: join(dir,comp.artifacts[0].path), prebuilt: manifest.prebuilt, files: manifest.files };
		const inspect = async role => JSON.parse(await run("python3",["-I",join(work,"verify.py"),role,archive[route][role],join(dir,"binding-ir.json"),join(dir,"host-export-evidence.json")],work,env,180_000));
		// The same runtime archive is referenced by every route; inspect its contents once.
		assert.deepEqual(rt.artifacts[0],reports[0]?.runtime ?? rt.artifacts[0]);
		const runtimeInspection = reports[0]?.runtimeInspection ?? await inspect("runtime");
		const componentInspection = await inspect("component");
		assert.equal(runtimeInspection.version,componentInspection.runtimeVersion);
		assert.equal(componentInspection.nativeRuntime,rt.runtimeIdentity); assert.equal(runtimeInspection.bindingRuntime,componentInspection.bindingRuntime);
		reports.push({ route, receiptSha256: result.receiptSha256
			, profile: receipt.profiles[0], runtime: rt.artifacts[0]
			, component: comp.artifacts[0]
			, abiKeys: manifest.prebuilt.map(v => v.abiKey)
			, nativeLibrarySha256: manifest.syncIO.librarySha256
			, runtimeInspection, componentInspection });
	}
	const perls = JSON.parse(env.LEAN_BRIDGE_PERLS);
	for(const [i,perl] of perls.entries())
	{
		const dir = join(work,"abi-"+i), install = join(dir,"original"), moved = join(dir,"relocated"); await mkdir(install,{ recursive: true });
		const doInstall = (archive,sub,extra = {}) => installCpanArchive({ archive, workingRoot: dir, prefix: join(install,sub), perl, mode: "prebuilt-only", environment: { ...env, ...extra } });
		const rt = await doInstall(archive.ordinary.runtime,"runtime"), extra = { PERL5LIB: rt.perl5lib };
		for(const [route,files] of Object.entries(archive)) await doInstall(files.component,route,extra);
		await rename(install,moved);
		const rootLib = n => join(moved,n,"lib/perl5");
		const audit = join(dir,"test-observer");
		if(!smoke)
		{
			await mkdir(audit);
			await run(perl,[join(work,"build-observer.pl"),join(work,"Observe.xs")],audit,{ ...env, PERL5LIB: rootLib("runtime") });
		}
		for(const route of smoke ? ["ordinary"] : ["ordinary","reviewed"])
		{
			const pwd = join(dir,route); await mkdir(pwd);
			const child = { PATH: "/unavailable", LANG: "C.UTF-8", TMPDIR: pwd, LEAN_NUM_THREADS: "1", PERL5LIB: [rootLib(route),...smoke ? [] : [rootLib("peer")],rootLib("runtime")].join(":") };
			const abi = await run(perl,["-MLeanBridge::Runtime::Platform","-MJSON::PP","-e","print JSON::PP->new->canonical->encode({key=>LeanBridge::Runtime::Platform::abi_key(),version=>sprintf('%vd',$^V),threaded=>!!$Config::Config{useithreads}?1:0})"],pwd,child);
			const info = JSON.parse(abi), expected = archive[route].prebuilt.find(v => v.abiKey === info.key); assert.ok(expected);
			const observations = {};
			assert.equal(await run(perl,[join(work,"example.pl")],pwd,child),"42\n37\nout of stock");
			for(const [label,script,...args] of [["public","installed.t"],["magic","magic.t"],...smoke ? [] : [["journal-first","compose.t","journal-first"],["peer-first","compose.t","peer-first"],["retirement","retire.t"]]])
			{
				const tap = await run(perl,[...label === "retirement" ? ["-I"+audit] : [],join(work,script),...args],pwd,child,150_000);
				assert.doesNotMatch(tap,/^not ok\b/mu); const plan = /^1\.\.(\d+)$/mu.exec(tap); assert.ok(plan);
				assert.equal(tap.split("\n").filter(l => /^ok \d+\b/u.test(l)).length,Number(plan[1]));
				observations[label] = { tests: Number(plan[1]), tapSha256: sha256(tap+"\n") };
				await recordTap(route+"-"+info.key+"-"+label+".tap",tap);
			}
			const arch = join(rootLib(route),expected.abi.archname);
			const installed = await json(join(arch,"LeanBridge/Journal/install-receipt.json"));
			assert.equal(installed.operation,"prebuilt-xs"); assert.deepEqual(installed.abi,expected.abi);
			assert.equal(installed.outputSha256,archive[route].files[expected.path]);
			assert.equal(sha256(await readFile(join(arch,"auto/LeanBridge/Journal/Journal.so"))),installed.outputSha256);
			rows.push({ route, ...info, installedXsSha256: installed.outputSha256, observations });
			t.diagnostic(route+" "+info.version+" "+(info.threaded?"threaded":"unthreaded")+": installed client passed");
		}
		if(i === 0 && !smoke)
		{
			const prefix = join(dir,"fallback"), pwd = join(dir,"xs-only-client"); await mkdir(pwd);
			await installCpanArchive({ archive: archive.ordinary.component, workingRoot: dir, prefix, perl, mode: "build-xs", environment: { ...env, PERL5LIB: rootLib("runtime") } });
			const relocated = join(dir,"relocated-xs-only"); await rename(prefix,relocated);
			const own = join(relocated,"lib/perl5"), child = { PATH: "/unavailable", LANG: "C.UTF-8", LEAN_NUM_THREADS: "1", TMPDIR: pwd, PERL5LIB: own+":"+rootLib("runtime") };
			assert.equal(await run(perl,[join(work,"example.pl")],pwd,child),"42\n37\nout of stock");
			const t = await run(perl,[join(work,"installed.t")],pwd,child,150_000); assert.doesNotMatch(t,/^not ok\b/mu);
			await recordTap("fallback-"+rows[0].key+"-public.tap",t);
			const arch = join(own,archive.ordinary.prebuilt.find(v => v.abiKey === rows[0].key).abi.archname);
			const xs = await json(join(arch,"LeanBridge/Journal/install-receipt.json"));
			assert.equal(xs.operation,"generated-xs-only"); assert.equal(xs.sourceSha256,archive.ordinary.files["Component.xs"]);
			assert.equal(xs.outputSha256,sha256(await readFile(join(arch,"auto/LeanBridge/Journal/Journal.so"))));
			fallback.push({ key: rows[0].key, sourceSha256: xs.sourceSha256, installedXsSha256: xs.outputSha256, tapSha256: sha256(t+"\n") });
		}
	}
	if(!smoke)
	{
		assert.equal(reports[0].profile.bindingIrSha256,reports[1].profile.bindingIrSha256);
		assert.notEqual(reports[0].profile.bindingIrSha256,reports[2].profile.bindingIrSha256);
		const matrix = ["5.36.3:0","5.36.3:1","5.38.2:0","5.38.2:1"];
		for(const route of ["ordinary","reviewed"])
			assert.deepEqual(rows.filter(r => r.route === route).map(r => r.version+":"+r.threaded).sort(),matrix);
		const keys = rows.filter(r => r.route === "ordinary").map(r => r.key).sort();
		for(const route of reports) assert.deepEqual([...route.abiKeys].sort(),keys);
	}
	const report = { schemaVersion: 1, sources, packages: reports, rows, fallback };
	if(capture)
	{
		for(const [name,tap] of pendingTap) await writeFile(join(root,name),tap,{ flag: "wx" });
		for(const f of Object.keys(sources)) await copyFile(join(work,f),join(root,f),constants.COPYFILE_EXCL);
		await writeFile(join(root,"acceptance.json"),canonicalJson(report),{ flag: "wx" });
	} else assert.deepEqual(report,retained);
});
