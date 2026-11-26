/** @file Verify callable fields on ordinary and reviewed native Composer packages. */
import assert from "node:assert/strict";
import {copyFile,mkdir,mkdtemp,readFile,realpath,rm,writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join,resolve} from "node:path";
import test from "node:test";
import {buildCanonicalProject} from "../../src/build/canonical-build.mjs";
import {canonicalJson,sha256} from "../../src/capsule/node.mjs";
import {readVerifiedPackageSetReceipt} from "../../src/release/package-set-receipt.mjs";
import {runNativeTool as run} from "./native-effect-consumers.mjs";
import {installOwnedPhpArchive} from "./owned-php-installed.mjs";
import {copyPackageSetHandoff} from "./package-set.mjs";
import {prepareStagedQuoteProject,checkStagedQuoteIdentities} from "./staged-quote-project.mjs";

test("relocated Composer clients retain, repack and return callable fields",{timeout:7_200_000},async t=>{
	const env=process.env,work=await mkdtemp(join(tmpdir(),"php-tariff-"));
	t.after(()=>rm(work,{recursive:true,force:true}));
	const keep=env.LEAN_BRIDGE_PHP_TARIFF_KEEP,replay=env.LEAN_BRIDGE_PHP_TARIFF_REPLAY;
	assert.ok(!(keep && replay));
	const sets=replay?resolve(replay):keep?await mkdtemp(join(resolve(keep),"tariff-")):join(work,"sets");
	const output=resolve(env.LEAN_BRIDGE_PHP_TARIFF_OUTPUT??"build/php-function-fields"),routes=["ordinary","reviewed"];
	const bins=(env.LEAN_BRIDGE_PHP_HOST_INTERPRETERS??"/usr/bin/php").split(",");
	await mkdir(output,{recursive:true});
	if(!replay) for(const route of routes) {
		const project=join(work,route+"-project"),out=join(work,route+"-out");
		await prepareStagedQuoteProject(project,route,"php-native");
		try {await buildCanonicalProject({projectRoot:project,outputRoot:out,targets:["php-native"],environment:env});}
		catch(e){throw new Error(e.message+"\n"+JSON.stringify(e.details),{cause:e});}
		await copyPackageSetHandoff(out,join(sets,route));
		await rm(project,{recursive:true});await rm(out,{recursive:true});
	}
	for(const route of routes) {
		const handoff=join(work,route+"-handoff"),install=join(work,route+"-install");
		await copyPackageSetHandoff(join(sets,route),handoff);await mkdir(install);
		const {receipt,result}=await readVerifiedPackageSetReceipt({receiptPath:join(handoff,"package-set-receipt.json")});
		assert.equal(receipt.packages.length,1);const [pkg]=receipt.packages;
		assert.equal(pkg.target,"php-native");assert.equal(pkg.name,"example/tariff-quotes");
		assert.equal(pkg.version,"1.0.0");assert.equal(pkg.artifacts.length,1);const [zip]=pkg.artifacts;
		const {deployment,environment,evidence}=await installOwnedPhpArchive({root:install,archive:join(handoff,zip.path),
			pkg:{name:pkg.name,version:pkg.version,sha256:zip.sha256},environment:env});
		await rm(handoff,{recursive:true});
		const meta=async f=>JSON.parse(await readFile(join(deployment,"vendor",pkg.name,"lean-bridge/component",f+".json")));
		const identity=checkStagedQuoteIdentities(await meta("model"),await meta("binding-ir"),receipt.profiles.find(p=>p.id===pkg.profile),route);
		const sources={};
		for(const f of ["tariff-observer.php","tariff-fields.php"]) {
			await copyFile(resolve("tests/fixtures/structured-types",f),join(deployment,f));sources[f]=sha256(await readFile(join(deployment,f)));
		}
		const observations=[];
		for(const path of bins) {
			const php=await realpath(path),probe=JSON.parse(await run(php,["-n","-r",'echo json_encode([PHP_VERSION,PHP_SAPI,PHP_INT_SIZE,extension_loaded("ffi"),ini_get("extension_dir")]);'],deployment,environment));
			assert.equal(probe[1],"cli");assert.equal(probe[2],8);
			const flags=probe[3]?[]:["-d","extension="+await realpath(join(probe[4],"ffi.so"))];
			const observed=JSON.parse(await run(php,["-n",...flags,"-d","ffi.enable=1","-d","display_errors=stderr","tariff-observer.php"],deployment,environment));
			const {baseline,held,after,...rest}=observed;assert.ok(held>baseline);assert.equal(after,baseline);
			assert.deepEqual(rest,{afterShutdown:0,stageCalls:1,visits:0,result:42,php:probe[0]});
			observations.push({interpreterSha256:sha256(await readFile(php)),...observed});
		}
		await writeFile(join(output,route+".json"),canonicalJson({route,receiptSha256:result.receiptSha256,...identity,archives:pkg.artifacts,
			composerVersion:evidence.composerVersion,lockSha256:evidence.lockSha256,sources,observations}));
		t.diagnostic(route+": "+result.receiptSha256);
	}
	t.diagnostic("Handoffs: "+sets);
});
