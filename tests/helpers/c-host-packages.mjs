/** @file Verify public CLI C host archives, then compile and run offline consumers. */
import assert from "node:assert/strict";
import {access,copyFile,mkdir,mkdtemp,readFile,realpath,rename,rm,writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join,resolve} from "node:path";
import test from "node:test";
import {canonicalJson,sha256} from "../../src/capsule/node.mjs";
import {buildCliNpmPackage} from "../../src/release/cli-npm-package.mjs";
import {readVerifiedPackageSetReceipt} from "../../src/release/package-set-receipt.mjs";
import {runNativeTool as run} from "./native-effect-consumers.mjs";
import {prepareNativeHostFixture} from "./native-host-import-check.mjs";

const cpp=process.env.LEAN_BRIDGE_CPP_HOST_TEST==="1",target=cpp?"cpp":"c",label=cpp?"C++":"C";
const variable="LEAN_BRIDGE_"+target.toUpperCase()+"_HOST_",replay=process.env[variable+"REPLAY"];
const success=cpp?/C\+\+ shared identity and original exception/u:/public C owners: exactly one destruction/u;
test(label+(replay?" retained host archives replay without Lean":" offline CLI publishes ordinary and reviewed packages sharing one owner"),{timeout: 3600000},async t=>{
	const env=process.env,root=await mkdtemp(join(tmpdir(),"c-host-publisher-"));
	t.after(()=>rm(root,{recursive: true,force: true}));
	const out=replay?resolve(replay):env[variable+"HANDOFFS"]?await mkdtemp(join(env[variable+"HANDOFFS"],target+"-host-releases-")):root;
	const tools=join(root,"tools");
	if(!replay)
	{
		const candidate=await buildCliNpmPackage({outputRoot: join(root,"candidate")});
		await mkdir(tools);
		await run("npm",["install","--offline","--prefix",tools,"--ignore-scripts","--no-audit","--no-fund","--cache",join(root,"cache"),candidate.archive],root,env);
	}
	const cli=join(tools,"node_modules/.bin/lean-bridge"),prefixes={},reports=[];
	let review=null;
	for(const route of ["ordinary","peer","reviewed",...replay?[]:["rejected"]])
	{
		const name=route==="peer"?"peer":"workshop",src=join(root,"source-"+route),release=join(out,route);
		if(!replay)
		{
			await prepareNativeHostFixture(src,target); await copyFile("LICENSE",join(src,"LICENSE"));
			const cfg=join(src,"lean-bridge.exports.json"),config=JSON.parse(await readFile(cfg,"utf8"));
			if(route==="peer")
			{
				const lake=join(src,"lakefile.toml"); await writeFile(lake,(await readFile(lake,"utf8")).replace('"workshop"','"peer"'));
				config.targets[target].name=name;
			}
			if(route==="reviewed" || route==="rejected")
			{
				const ir=JSON.parse(review);
				if(route==="rejected") delete ir.declarations.find(d=>d.name==="read").source.extensions["lean-bridge.dev/host-members"];
				await writeFile(join(src,"workshop.binding-ir.json"),canonicalJson(ir)); delete config.exports;
			}
			await writeFile(cfg,canonicalJson(config));
			const publish=()=>run(process.execPath,[cli,"build","--project",src,"--target",target,"--output",release,"--json","--progress","none"],root,env,900000);
			if(route==="rejected")
			{
				await assert.rejects(publish(),/Reviewed API differs from compiled host exports/u);
				await assert.rejects(access(join(release,"package-set-receipt.json")),{code: "ENOENT"});
				await rm(src,{recursive: true}); continue;
			}
			await publish(); await rm(src,{recursive: true});
		}
		const {receipt,result}=await readVerifiedPackageSetReceipt({receiptPath: join(release,"package-set-receipt.json")});
		assert.deepEqual(result.profiles,["native-"+target+"-host-v1"]); assert.equal(result.archives,1);
		const [pkg]=receipt.packages; assert.equal(pkg.name,name);assert.equal(pkg.runtimeDelivery,"embedded");
		const ir=await readFile(join(release,"binding-ir.json"),"utf8"),ev=JSON.parse(await readFile(join(release,"host-export-evidence.json")));
		assert.equal(ev.reviewedSourceSha256,route==="reviewed"?sha256(review):null);
		if(route==="ordinary") review=ir; if(route==="reviewed") assert.equal(ir,review);
		const staging=join(root,"extract-"+route),dest=join(root,"installed-"+route);
		await mkdir(staging);
		await run("tar",["-xzf",join(release,pkg.artifacts[0].path),"--strip-components=1","-C",staging],root,env);
		await rename(staging,dest);
		const manifest=JSON.parse(await readFile(join(dest,"lean-bridge-package.json")));
		assert.equal(await readFile(join(dest,"share/lean-bridge/binding-ir.json"),"utf8"),ir);
		assert.deepEqual(JSON.parse(await readFile(join(dest,"share/lean-bridge/elaboration.json"))),ev);
		assert.equal(manifest.hostImportsSourceSha256,ev.hostImportsSourceSha256);
		assert.equal(manifest.bindingIrSha256,receipt.profiles[0].bindingIrSha256);assert.equal(manifest.runtimeIdentity,receipt.profiles[0].runtimeIdentity);
		for(const [path,expected] of Object.entries(manifest.files))
		{
			const bytes=await readFile(join(dest,path)); assert.equal(bytes.length,expected.bytes); assert.equal(sha256(bytes),expected.sha256);
		}
		prefixes[route]=dest;reports.push({route,receipt: result.receiptSha256,archive: pkg.artifacts[0].sha256});
	}
	if(!replay) await rm(tools,{recursive: true});
	const client=join(root,"consumer"); await mkdir(client);
	const main="consumer."+target;
	await copyFile(resolve("tests/fixtures/c-host-members",main),join(client,main));
	for(const route of ["ordinary","reviewed"])
	{
		for(const [first,second] of [["workshop","peer"],["peer","workshop"]])
		{
			const dirs=[prefixes[route],prefixes.peer],bin=join(client,"via-pkg-config");
			const pc={...env,PKG_CONFIG_PATH: "",PKG_CONFIG_LIBDIR: dirs.map(d=>join(d,"lib/pkgconfig")).join(":")};
			const flags=(await run("pkg-config",["--cflags","--libs",first,second],client,pc)).trim().split(/\s+/u);
			await run(cpp?"c++":"cc",[cpp?"-std=c++20":"-std=c11","-Werror","-Wall","-Wextra",...cpp?["-DCHECK_COPIED_MEMBERS=1"]:[],main,...flags,"-o",bin],client,pc);
			const isolated={PATH: "/without-tools",LANG: "C",LEAN_NUM_THREADS: "1",LD_LIBRARY_PATH: ""};
			const loaded=async file=>{
				const deps=(await run("ldd",[file],client,{...env,LD_LIBRARY_PATH:""})).split("\n");
				const names=[];
				for(const line of deps) {
					const m=/^\s*(lib(?:lb_(?:c|cpp)_host_\w+|lean_bridge_native|leanshared)\.so) => (.+?) \(/u.exec(line);
					if(!m) continue;
					const path=await realpath(m[2]); assert.ok(dirs.some(d=>path.startsWith(d+"/lib/")),path); names.push(m[1]);
				}
				assert.equal(names.length,5,"expected two components, one shared object domain and both embedded runtime libraries: "+names);
			};
			await loaded(bin);
			assert.match(await run(bin,[],client,isolated),success);
			const cmake=env.LEAN_BRIDGE_CMAKE??"cmake",build=await mkdtemp(join(root,"cmake-"));
			await writeFile(join(client,"CMakeLists.txt"),["cmake_minimum_required(VERSION 3.16)","project(check "+(cpp?"CXX":"C")+")","find_package(LeanBridgeWorkshop CONFIG REQUIRED)","find_package(LeanBridgePeer CONFIG REQUIRED)","add_executable(client "+main+")",...cpp?["target_compile_definitions(client PRIVATE CHECK_COPIED_MEMBERS=1)"]:[],"target_link_libraries(client PRIVATE LeanBridge::"+first+" LeanBridge::"+second+")",""].join("\n"));
			await run(cmake,["-S",client,"-B",build,"-DCMAKE_PREFIX_PATH="+dirs.join(";")],client,env);
			await run(cmake,["--build",build,"-j1"],client,env);
			await loaded(join(build,"client"));
			assert.match(await run(join(build,"client"),[],client,isolated),success);
		}
	}
	t.diagnostic(JSON.stringify(reports)); if(out!==root) t.diagnostic("Retained handoffs: "+out);
});
