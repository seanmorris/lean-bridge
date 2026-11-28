/** @file Verify the no-ambient-IO policy on real threaded JS and Zend worker projects. */
import assert from "node:assert/strict";
import {access,appendFile,copyFile,mkdir,mkdtemp,readFile,rm,writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join,resolve} from "node:path";
import test from "node:test";
import {canonicalJson} from "../../src/capsule/node.mjs";
import {runNativeTool as run} from "./native-effect-consumers.mjs";
import {prepareThreadedHostProject} from "./javascript-threaded-host-source.mjs";
import {prepareZendAuthorProject} from "./php-wasm-zend-project.mjs";

for(const [target,label] of [["npm","JavaScript"],["php-wasm","PHP-Wasm"]])
	test(target+" worker packages refuse grants, ungranted OS effects, and owner-blocking cleanup",async t=>{
		const root=await mkdtemp(join(tmpdir(),"wasm-worker-policy-"));t.after(()=>rm(root,{recursive: true,force: true}));
		const project=join(root,"source"),fixture="tests/fixtures/native-host-effects";
		if(target==="npm")await prepareThreadedHostProject(project);else await prepareZendAuthorProject(root);
		const file=join(project,"lean-bridge.exports.json"),cfg=JSON.parse(await readFile(file));
		const extra=JSON.parse(await readFile(join(fixture,"lean-bridge.exports.json")));
		for(const field of ["modules","exports","taskExports","asyncIterators"])(cfg[field]??=[]).push(...extra[field]);
		await copyFile(join(fixture,"Effects.lean"),join(project,"Effects.lean"));await copyFile("LICENSE",join(project,"LICENSE"));
		await appendFile(join(project,"lakefile.toml"),'\n[[lean_lib]]\nname = "Effects"\n');
		const sdk=process.env.LEAN_BRIDGE_TEST_TASK_INPUTS??process.env.LEAN_BRIDGE_JS_TASK_INPUTS;
		assert.ok(sdk,"Set LEAN_BRIDGE_TEST_TASK_INPUTS to the verified threaded author SDK");
		const env={...process.env,LEAN_BRIDGE_JS_TASK_INPUTS: resolve(sdk)},cli=resolve("scripts/lean-bridge.mjs");
		for(const mode of ["grant","implicit","blocking"])
		{
			const out=join(root,mode,"release");
			await mkdir(join(root,mode));
			cfg.nativeEffects=mode==="grant"?extra.nativeEffects:[];
			if(mode==="blocking")
			{
				cfg.asyncIterators.find(p=>p.open==="Effects.walk").close="Effects.blockingClose";
				await appendFile(join(project,"Effects.lean"),await readFile(join(fixture,"owner-wait.lean.in")));
			}
			await writeFile(file,canonicalJson(cfg));
			const build=()=>run(process.execPath,[cli,"build","--project",project,"--target",target,"--output",out,"--json","--progress","none"],root,env,600000);
			const expected=mode==="grant"?[target==="npm"?"Threaded JavaScript tasks support only in-memory effects":"PHP-Wasm workers support only in-memory effects"]
				:mode==="blocking"?["Effects.blockingClose","lean_io_wait","can block the "+label+" host owner"]
					:["Effects.observe","Effects.worker","Effects.pull","Effects.close"].map(n=>n+' requires nativeEffects "filesystem"').concat(['requires nativeEffects "environment"',"lean_io_getenv","lean_io_prim_handle_read","lean_io_prim_handle_put_str"]);
			await assert.rejects(build(),e=>{
				const payload=JSON.parse(e.cause.stdout.trim() || e.cause.stderr.trim());
				assert.equal(payload.status,"failed");assert.equal(payload.result,null);
				const messages=payload.diagnostics.filter(d=>d.severity==="error" && (mode==="grant" || d.code==="native-effect-policy")).map(d=>d.message).join("\n");
				for(const s of expected)assert.ok(messages.includes(s),s+" missing from "+messages);
				if(mode==="implicit")assert.match(messages,/^_private\.Effects\..*initFn[^\n]*lean_io_getenv/mu);
				return true;
			});
			await assert.rejects(access(out),{code: "ENOENT"});t.diagnostic(mode+": "+expected.join(", "));
		}
	});
