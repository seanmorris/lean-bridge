/** @file Elaborate a real authored Lake archive with JS host members in tasks and cursor operations. */
import assert from "node:assert/strict";
import {mkdir,mkdtemp,rm,writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import test from "node:test";
import {inspectLeanProject} from "../../src/analyze/lean-project.mjs";
import {elaboratedComponent} from "../../src/analyze/semantic-model.mjs";
import {reconcileHostExports} from "../../src/analyze/host-export-model.mjs";
import {openHostProjectSource} from "../../src/build/host-project-source.mjs";
import {compileHostSources,threadedHostSource} from "../../src/build/host-elaboration.mjs";
import {processBuildRunner} from "../../src/build/process-runner.mjs";
import {canonicalJson,sha256} from "../../src/capsule/node.mjs";
import {javaScriptTaskAbi} from "../../src/abi/javascript-wasm-tasks.mjs";
import {prepareThreadedHostProject} from "./javascript-threaded-host-source.mjs";

test("ordinary and reviewed Lake sources authenticate JavaScript host calls in tasks, pull and close",async t=>{
	const root=await mkdtemp(join(tmpdir(),"js-owner-project-"));t.after(()=>rm(root,{recursive: true,force: true}));
	const project=join(root,"project"),{config,capability}=await prepareThreadedHostProject(project);
	const compile=async label=>{
		const inventory=await inspectLeanProject(project),component=elaboratedComponent(inventory.project);
		const source=await openHostProjectSource({project,inventory,component,targets: ["npm"]});
		try
		{
			const app=join(root,label);await mkdir(app);
			const run=(command,args,cwd,env)=>processBuildRunner.capture({command,args,cwd,env});
			const {projectContract}=source;
			const result=await compileHostSources({...source,ir: projectContract.ir,app,run,target: "npm",environment: process.env});
			await source.verify();
			return {...result,ir: projectContract.ir,component,review: projectContract.review,contract: projectContract,hostSource: projectContract.hostImportsSource};
		}
		finally
		{await source.dispose();}
	};
	try
	{
		const built=await compile("ordinary"),{api,evidence}=built, prefix="LeanBridge.Host.Javascript.Box.";
		const fn=name=>api.declarations.find(d=>d.id==="lean:Workshop."+name);
		const ext=n=>fn(n).source.extensions;
		assert.equal(evidence.hostImportsSourceSha256,sha256(built.hostSource));
		assert.deepEqual(threadedHostSource(built.contract,evidence),built.ir);
		assert.throws(()=>threadedHostSource({...built.contract,hostImportsSource: built.hostSource+" "},evidence),/Unverified threaded JavaScript host source/u);
		assert.throws(()=>threadedHostSource(built.contract,{...evidence,interfaces: evidence.interfaces.filter(f=>f.module==="Workshop")}),/differs from the elaborated module/u);
		assert.equal(evidence.selection.javascriptThreadedHostMembers,true);
		assert.deepEqual(ext("openCursor")["lean-bridge.dev/host-member-phases"],{call: [],pull: [prefix+"identity",prefix+"read"],close: [prefix+"setLevel"]});
		assert.deepEqual(ext("work")["lean-bridge.dev/host-members"],[prefix+"read"]);
		assert.deepEqual(new Set(fn("work").failure.errors),new Set(["error:TaskIO.Error","error:JavaScriptCallbackError","error:JavaScriptHostException"]));
		assert.deepEqual(fn("start").failure.errors,["error:IO.Error","error:JavaScriptHostException"]);
		assert.deepEqual(fn("openCursor").failure.errors,["error:AsyncStep.Workshop.openCursor","error:JavaScriptHostException"]);
		assert.equal(ext("openCursor")["lean-bridge.dev/step-failure"],"IO.Error");
		assert.equal(fn("either").result.ownership,"lease"); assert.equal(fn("either").failure.mode,"none");
		assert.equal(ext("checked")["lean-bridge.dev/error-payload-site"].ownership,"lease");
		assert.equal(fn("identity").resultMode,"value");
		assert.deepEqual(fn("openCursor").capabilities,[capability.id]);assert.deepEqual(fn("work").capabilities,[]);
		const id="d".repeat(64),abi=javaScriptTaskAbi(api,id,built.ir),methods=new Map(abi.methods.map(m=>[m.name,m]));
		const nominal=methods.get("start").result;
		assert.match(nominal,/^host:[a-f0-9]{64}$/u);
		assert.deepEqual(methods.get("work").args,[nominal,"callback"]);
		assert.deepEqual(methods.get("either").result,["uint32",nominal]);
		assert.equal(methods.get("checked").error,nominal);assert.equal(methods.get("open_cursor").terminal,"string");
		assert.equal(methods.get("open_cursor").stepIO,true);
		assert.throws(()=>javaScriptTaskAbi(api,id));
		const wrong=(change,pattern)=>{
			const a=structuredClone(api),h=structuredClone(built.ir);change(a,h);
			assert.throws(()=>javaScriptTaskAbi(a,id,h),pattern);
		};
		wrong((_,h)=>{h.declarations.find(d=>d.name==="read").documentation.summary="Other authored import.";},/host import contract/u);
		wrong(a=>{a.types.find(t=>t.host).mutability="read";},/host import contract/u);
		wrong(a=>{a.declarations.find(d=>d.name==="start").name="then";},/host import contract/u);
		wrong(a=>{a.declarations.find(d=>d.name==="open_cursor").capabilities=[];},/host import contract/u);
		wrong(a=>{Object.assign(a.declarations.find(d=>d.name==="either").result,{ownership: "copy",lifetime: null});},/identity types cannot use copy ownership/u);
		wrong(a=>{delete a.declarations.find(d=>d.name==="checked").source.extensions["lean-bridge.dev/error-payload-site"];},/host import contract/u);
		wrong(a=>{a.declarations.find(d=>d.name==="work").failure.errors.pop();},/failure channels/u);
		const reject=(change,pattern)=>{
			const {metadata,selection}=structuredClone(evidence);change({metadata,selection});
			assert.throws(()=>reconcileHostExports({...built,metadata,selection}),pattern);
		};
		reject(({metadata})=>{metadata.entries.find(e=>e.protocol).protocolHostMembers.pull=[];},/Unverified host member dependencies/u);
		reject(({selection})=>{delete selection.javascriptThreadedHostMembers;},/outside its owner/u);
		reject(({selection})=>{selection.nativeEffects=["filesystem"];},/Unauthenticated JavaScript host owner/u);
		reject(({metadata})=>{metadata.nativeEffectAudit.initializers.push("Workshop.work");},/before it is bound/u);
		reject(({selection})=>{selection.hostModule="LeanBridge.Host.Python";},/selected host's resources and members/u);
		reject(({metadata})=>{
			const op=metadata.nativeEffectAudit.roots.find(r=>r.declaration==="Workshop.pull").leaves.find(l=>l.name===prefix+"identity");
			op.symbol+="_other";
		},/unclassified native operation/u);
		const review=structuredClone(api);review.documentation.summary="Application-reviewed task API.";
		await writeFile(join(project,"workshop.binding-ir.json"),canonicalJson(review));
		delete config.exports;await writeFile(join(project,"lean-bridge.exports.json"),canonicalJson(config));
		const reviewed=await compile("reviewed");
		assert.deepEqual(reviewed.api,review);assert.equal(reviewed.evidence.reviewedSourceSha256,sha256(canonicalJson(review)));
		assert.deepEqual(reviewed.evidence.metadata,evidence.metadata);
	}
	catch(error)
	{if(error.details) t.diagnostic(JSON.stringify(error.details).slice(-4000));throw error;}
});
