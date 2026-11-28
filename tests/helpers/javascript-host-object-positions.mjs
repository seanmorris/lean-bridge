/** @file Replay the original threaded Workshop npm archives in five downstream profiles. */
import assert from "node:assert/strict";
import {copyFile,mkdir,readFile,writeFile} from "node:fs/promises";
import {createRequire} from "node:module";
import {join,resolve} from "node:path";
import test from "node:test";
import {canonicalJson,sha256} from "../../src/capsule/node.mjs";
import {deployThreadedWorkshop,withInstalledThreadedWorkshop} from "./javascript-threaded-delivery-clients.mjs";
import {runInstalledChromium} from "./javascript-wasm-installed-browser.mjs";
import {saveLakeFile} from "./lake-workspace.mjs";
import {runNativeTool as run} from "./native-effect-consumers.mjs";

const require=createRequire(import.meta.url),name="@lean-bridge/workshop-host-example";
const fixture=resolve("tests/fixtures/javascript-threaded-host-callbacks");
const expected={visits: 2,levels: [8,8],drained: true};
const exercise=async({root,app,site,copy,metadata,frameworkVersions,env})=>{
	const raw=await readFile(join(app,"node_modules",name,"metadata/binding-ir.json"));
	const ir=JSON.parse(raw),decl=n=>ir.declarations.find(d=>d.source.declaration==="Workshop."+n);
	const immediate=decl("identity"),map=decl("mapBox"),id=immediate.parameters[0].type.id;
	const box=ir.types.find(t=>t.id===id);assert.ok(box.host.targets.includes("javascript"));
	const cb=ir.types.find(t=>t.id===map.parameters[1].type.id);assert.equal(cb.kind,"callback");
	for(const v of [immediate.result,map.parameters[0],cb.callable.parameters[0],cb.callable.result]) assert.equal(v.type.id,id);
	const sources={};
	const files={"object-app.mjs": "object-positions.mjs"
		, "typed.mts": "object-positions.mts","object-node.mjs": "object-node.mjs"
		, "object-react.mjs": "object-react.mjs"
		, "object-worker.mjs": "object-worker.mjs"};
	for(const [dest,original] of Object.entries(files))
	{
		await copyFile(join(fixture,original),join(app,dest));sources[original]=sha256(await readFile(join(app,dest)));
	}
	const noTools=async args=>JSON.parse(await run(process.execPath,args,app,env,90000));
	const js=await noTools(["object-node.mjs"]);
	assert.deepEqual(js,expected);
	const compilerOptions={strict: true,types: [],module: "NodeNext",target: "ES2022",lib: ["ES2024","DOM"]};
	await saveLakeFile(app,"tsconfig.json",JSON.stringify({files: ["typed.mts"],compilerOptions}));
	await run(process.execPath,[require.resolve("typescript/bin/tsc"),"-p","tsconfig.json"],app,env);
	const typescript=await noTools(["typed.mjs"]);assert.deepEqual(typescript,expected);
	await saveLakeFile(app,"index.html",`<div id="component"></div>
<script>globalThis.deliveryReady = Promise.withResolvers();</script>
<script type="module">import("./object-react.mjs").then(m=>deliveryReady.resolve(m.exercisePage),e=>deliveryReady.reject(e));</script>`);
	const deployed=await deployThreadedWorkshop(app,site);
	const evaluate=async()=>{
		let timer;
		try
		{
			const work=globalThis.deliveryReady.promise.then(start=>start());
			const deadline=new Promise((_,reject)=>{
				timer=setTimeout(()=>reject(new Error("No progress: "+(globalThis.objectPositionPhase??"bundle load"))),100000);
			});
			return await Promise.race([work,deadline]);
		} finally
		{clearTimeout(timer);}
	};
	const browser=await runInstalledChromium({root,consumer: app
		, assembledDirectory: site,isolated: true,timeoutMs: 120000,evaluate});
	assert.deepEqual(browser,{page: expected,react: expected,text: "8:8",worker: expected});
	return {receiptSha256: copy.receiptSha256,source: metadata.sourceTreeSha256
		, reviewed: metadata.reviewedSourceSha256,publicIr: sha256(raw),sources
		, deployed,node: js,typescript,browser,frameworkVersions
		, typescriptVersion: require("typescript/package.json").version};
};

test("five installed npm clients exchange original application objects in four positions", {timeout: 1200000},async t=>{
	const releases=resolve(process.env.LEAN_BRIDGE_JS_OBJECT_HANDOFFS),results=[];
	for(const route of ["ordinary","reviewed"])
	{
		const data=await withInstalledThreadedWorkshop(join(releases,route,"packages/npm"),route,exercise);
		results.push(data);
		if(process.env.LEAN_BRIDGE_JS_OBJECT_OUTPUT)
		{
			const out=resolve(process.env.LEAN_BRIDGE_JS_OBJECT_OUTPUT);await mkdir(out,{recursive: true});
			await writeFile(join(out,route+".json"),canonicalJson({route,...data}));
		}
		t.diagnostic(route+": "+data.receiptSha256);
	}
	assert.notEqual(results[0].receiptSha256,results[1].receiptSha256);
	assert.deepEqual(results[0].sources,results[1].sources);
});
