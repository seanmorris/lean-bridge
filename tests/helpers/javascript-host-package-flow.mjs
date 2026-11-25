/** @file Build and use independent source-checked npm host-object packages without a registry. */
import assert from "node:assert/strict";
import {createRequire} from "node:module";
import {access,appendFile,cp,copyFile,mkdir,mkdtemp,readFile,rename,rm,writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join,resolve} from "node:path";
import test from "node:test";
import {build} from "vite";
import {canonicalJson} from "../../src/capsule/node.mjs";
import {processBuildRunner} from "../../src/build/process-runner.mjs";
import {buildCliNpmPackage} from "../../src/release/cli-npm-package.mjs";
import {readVerifiedPackageSetReceipt} from "../../src/release/package-set-receipt.mjs";
import {runInstalledChromium} from "./javascript-wasm-installed-browser.mjs";

test("packed author CLI and offline installed independent npm host classes",async t=>{
	const functions=process.env.LEAN_BRIDGE_TEST_JS_FUNCTIONS==="1";
	const root=await mkdtemp(join(tmpdir(),"js-host-packages-"));t.after(()=>rm(root,{recursive: true,force: true}));
	const env={...process.env,npm_config_offline: "true",npm_config_cache: join(root,"cache")};delete env.NODE_TEST_CONTEXT;
	const run=(cmd,args,cwd=root,extra={})=>processBuildRunner.capture({command: cmd,args,cwd,env: {...env,...extra}});
	const install=(out,archives)=>run("npm",["install","--prefix",out,"--offline","--no-audit","--no-fund","--ignore-scripts",...archives]);
	const cli=join(root,"author/node_modules/.bin/lean-bridge"), call=args=>run(process.execPath,[cli,...args]);
	const source=join(root,"source"),peer=join(root,"peer"),cfg="lean-bridge.exports.json",names=["@lean-bridge/workshop-host-example","@example/peer-host"];
	const handoff=async(project,name)=>{
		const output=join(root,name), dir=join(output,"packages/npm");
		await call(["build","--project",project,"--target","npm","--output",output,"--json","--progress","none"]);
		await call(["verify","--receipt",join(output,"package-set-receipt.json")]);
		const {receipt,result}=await readVerifiedPackageSetReceipt({receiptPath: join(dir,"package-set-receipt.json")});
		if(functions) t.diagnostic(name+" verified npm handoff "+result.receiptSha256);
		const row=role=>receipt.packages.find(p=>p.role===role),component=row("component"),runtime=row("runtime");
		assert.equal(component.profile,"javascript-wasm-host-io-v1");assert.equal(component.requires[0].version,runtime.version);
		const tar=join(dir,component.artifacts[0].path),member=p=>run("tar",["-xzOf",tar,"package/metadata/"+p]).then(r=>r.stdout);
		assert.equal(await member("host-imports.json"),await readFile(join(project,"lean-bridge.hosts.json"),"utf8"));
		if(component.name===names[0])
		{
			const evidence=JSON.parse(await member("compiler.json"));
			const leaves=evidence.metadata.nativeEffectAudit.roots.find(r=>r.declaration==="Outcomes.ordinaryFailure").leaves;
			assert.deepEqual(evidence.selection.nativeEffects,[]);
			assert.ok(leaves.some(l=>l.module==="Init.Prelude" && l.name==="Array.mk" && l.symbol==="lean_array_mk"));
			assert.ok(leaves.some(l=>l.module==="Init.Prelude" && l.name==="System.Platform.getNumBits" && l.symbol==="lean_system_platform_nbits"));
			assert.deepEqual(JSON.parse(await member("binding-ir.json")).capabilities,[]);
		}
		return {tar,member,runtime: join(dir,runtime.artifacts[0].path),digest: runtime.artifacts[0].sha256};
	};
	try
	{
		const packed=await buildCliNpmPackage({outputRoot: join(root,"cli")});await install(join(root,"author"),[packed.archive]);
		await cp(resolve("tests/fixtures/javascript-host-meter"),source,{recursive: true});
		await cp(source,peer,{recursive: true});
		const workshop=JSON.parse(await readFile(join(source,cfg)));
		workshop.modules.push("Outcomes");workshop.exports.push("Outcomes.branch","Outcomes.typed","Outcomes.ordinaryFailure");
		await writeFile(join(source,cfg),canonicalJson(workshop));
		await copyFile(resolve("tests/fixtures/javascript-host-wasm/Outcomes.lean"),join(source,"Outcomes.lean"));
		await appendFile(join(source,"lakefile.toml"),'\n[[lean_lib]]\nname = "Outcomes"\n');
		const config=JSON.parse(await readFile(join(peer,cfg)));
		config.targets.npm.name=names[1];config.modules=["Peer"];config.exports=config.exports.map(n=>n.replace("Workshop.","Peer."));
		await writeFile(join(peer,cfg),canonicalJson(config));
		await writeFile(join(peer,"lakefile.toml"),(await readFile(join(peer,"lakefile.toml"),"utf8")).replaceAll("workshop","peer").replaceAll("Workshop","Peer"));
		await rename(join(peer,"Workshop.lean"),join(peer,"Peer.lean"));
		await writeFile(join(peer,"Peer.lean"),(await readFile(join(peer,"Peer.lean"),"utf8")).replaceAll("Workshop","Peer"));
		if(functions) for(const [dir,c] of [[source,workshop],[peer,config]])
		{
			const lean=(await readFile("tests/fixtures/c-host-closures/Closures.lean","utf8")).replaceAll("LeanBridge.Host.C","LeanBridge.Host.Javascript");
			await writeFile(join(dir,"Closures.lean"),lean);await appendFile(join(dir,"lakefile.toml"),'\n[[lean_lib]]\nname = "Closures"\n');
			c.modules.push("Closures");c.exports.push("Closures.remember","Closures.reader","Closures.identityReader");await writeFile(join(dir,cfg),canonicalJson(c));
		}
		const a=await handoff(source,"ordinary"),unreviewed=await handoff(peer,"peer-ordinary");
		const api=JSON.parse(await unreviewed.member("binding-ir.json"));api.documentation.summary="Reviewed owner-agent peer.";
		const review=JSON.stringify(api,null,4)+"\n";await writeFile(join(peer,"peer.binding-ir.json"),review);
		delete config.exports;await writeFile(join(peer,cfg),canonicalJson(config));
		const b=await handoff(peer,"peer-reviewed");
		assert.equal(await b.member("review.binding-ir.json"),review);assert.equal(a.digest,b.digest);assert.equal(b.digest,unreviewed.digest);
		const consumer=join(root,"consumer");await mkdir(consumer);await writeFile(join(consumer,"package.json"),'{"private":true,"type":"module"}');
		await install(consumer,[a.runtime,a.tar,b.tar]);
		await copyFile(resolve("tests/helpers/javascript-host-installed-calls.mjs"),join(consumer,"calls.mjs"));
		await copyFile(resolve("tests/helpers/javascript-host-functions.mjs"),join(consumer,"javascript-host-functions.mjs"));
		const entries=order=>order.map((n,i)=>"const p"+i+"=await import("+JSON.stringify(n)+");").join("\n")
			+'\nimport {exercise} from "./calls.mjs";\nexport const result=exercise(p0,p1);\n';
		await writeFile(join(consumer,"run.mjs"),entries(names)+"console.log(JSON.stringify(result));");
		const noTools={PATH: join(root,"no-author-tools"),LEAN_BRIDGE_LEAN_PREFIX: "/absent",LEAN_BRIDGE_RUNTIME_ROOT: "/absent",LEAN_BRIDGE_JS_EMSDK: "/absent"};
		const node=JSON.parse((await run(process.execPath,["run.mjs"],consumer,noTools)).stdout);
		assert.equal(node.reading,31);assert.equal(node.typedOutcomes,true);
		if(functions) assert.equal(node.returnedFunctions,true);
		const reversed=names.toReversed();await writeFile(join(consumer,"reverse.mjs"),entries(reversed)+"console.log(JSON.stringify(result));");
		assert.deepEqual(JSON.parse((await run(process.execPath,["reverse.mjs"],consumer,noTools)).stdout),node);
		const types=`import {withHosts} from "${names[0]}";
class Box { constructor(public level: number){} read(){return this.level;} identity(){return this;} extra(){return 1;} }
const api=withHosts({Box}), box: Box=api.make(7);
const value:number=api.identity(box).extra();
const branch=api.branch(true,box);
if ("ok" in branch && "error" in branch.ok) { const same:Box=branch.ok.error; }
// @ts-expect-error -- executable signatures use UInt32, not BigInt
api.update(box, 7n);
// @ts-expect-error -- the inferred application instance includes extra()
api.read({level:7,read(){return 1},identity(){return this}});
// @ts-expect-error -- Box must implement read, identity and level
withHosts({Box:class {}});
api.dispose();`;
		await writeFile(join(consumer,"consume.mts"),types+(functions?`
const returned=api.remember(box), original:Box=returned(box);
const closed:boolean=returned.dispose(), value2:number=api.reader(original)(1);
// @ts-expect-error -- returned function accepts the original application's Box
returned(42);
// @ts-expect-error -- synchronous IO is not a JavaScript promise
returned(box).then(()=>{});
`:""));
		const tsc=createRequire(import.meta.url).resolve("typescript/bin/tsc");
		// This consumer imports only the installed packages. In workspace-backed
		// scratch, do not implicitly load ancestor @types for unrelated apps.
		await writeFile(join(consumer,"tsconfig.json"),JSON.stringify({files: ["consume.mts"],compilerOptions: {strict: true,noEmit: true,target: "ES2022",module: "NodeNext",types: []}}));
		await run(process.execPath,[tsc,"--project","tsconfig.json"],consumer,noTools);
		await writeFile(join(consumer,"worker.mjs"),entries(reversed)+"self.postMessage(result);");
		await writeFile(join(consumer,"page.mjs"),entries(names));
		await writeFile(join(consumer,"app.mjs"),`globalThis.replay=async()=>({page:(await import("./page.mjs")).result,worker:await new Promise((ok,no)=>{
const worker=new Worker(new URL("./worker.mjs",import.meta.url),{type:"module"});
worker.onmessage=e=>{worker.terminate();ok(e.data)};worker.onerror=e=>{worker.terminate();no(new Error(e.message))};})});`);
		await writeFile(join(consumer,"index.html"),'<script type="module" src="./app.mjs"></script>');
		await build({root: consumer,configFile: false,envDir: false
			, publicDir: false,logLevel: "error",worker: {format: "es"}
			, build: {target: "esnext",assetsInlineLimit: 0,minify: false}});
		const browser=await runInstalledChromium({root,consumer,names
			, assembledDirectory: join(consumer,"dist"),timeoutMs: 90000
			, evaluate: ()=>globalThis.replay()});
		assert.deepEqual(browser,{page: node,worker: node});
		t.diagnostic("Packed CLI; ordinary and reviewed releases; shared runtime "+a.digest+"; Node, strict TypeScript, Chromium page and module worker.");
		await t.test("an in-memory formatting grant cannot hide environment and filesystem access", async ()=>{
			await appendFile(join(source,"Outcomes.lean"),`
def Outcomes.forbidden (n : UInt32) : IO String := do
  let env ← IO.getEnv "LEAN_BRIDGE_EFFECT_PROBE"
  let text ← IO.FS.readFile "never-opened.txt"
  pure (toString n ++ env.getD "" ++ text)
`);
			workshop.exports.push("Outcomes.forbidden");await writeFile(join(source,cfg),canonicalJson(workshop));
			const output=join(root,"refused");
			await assert.rejects(call(["build","--project",source,"--target","npm","--output",output,"--json","--progress","none"]),err=>{
				const report=JSON.parse(err.details.stdout),d=report.diagnostics.find(e=>e.code==="native-effect-policy");
				assert.equal(report.status,"failed");assert.ok(d);
				for(const cap of ["environment","filesystem"]) assert.ok(d.message.includes('Outcomes.forbidden requires nativeEffects "'+cap+'"'));
				return true;
			});
			await assert.rejects(access(output),{code: "ENOENT"});
		});
	} catch(error)
	{t.diagnostic([error.message,error.details?.stderr,error.details?.stdout].filter(Boolean).join("\n").slice(-4500));throw error;}
});
