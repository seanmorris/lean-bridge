/** @file Run native PHP clients against authenticated Lean compiler output without crediting a Composer installation. */
import {mkdtemp,mkdir,rename,rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import test from "node:test";
import {frameReplaySource} from "./callback-frame-source.mjs";
import {buildFrameFacade,privateGmp} from "./direct-native-facade.mjs";
import {saveLakeFile} from "./lake-workspace.mjs";
import {runNativeTool} from "./native-effect-consumers.mjs";
import {runPhpIncoming} from "./php-incoming-client.mjs";

const env=process.env;
for(const route of env.LEAN_BRIDGE_FRAME_NATIVE_STAGE?["ordinary"]:["ordinary","reviewed"]) test(route+" native PHP callback-borrow replay",async t=>{
	const keep=env.LEAN_BRIDGE_FRAME_PHP_KEEP;
	const work=await mkdtemp(join(keep??tmpdir(),"php-direct-"));
	if(keep) t.diagnostic("Retained adapter replay directory: "+work);
	else t.after(()=>rm(work,{recursive: true,force: true}));
	const run=(cmd,args,cwd=work,environment=env)=>runNativeTool(cmd,args,cwd,environment);
	const source=await frameReplaySource({env,route,work,run,direct: true}),gmp=await privateGmp(work,source,run);
	const {stage,native,pkg}=await buildFrameFacade({work,source,run,privateLib: gmp.lib},"php");
	const app=join(stage,"app"),vendor=join(app,"vendor"),root=join(vendor,"example/tariff-quotes");
	for(const [n,s] of Object.entries(pkg.files)) if(n.endsWith(".php")) await saveLakeFile(root,n,s);
	await mkdir(join(root,"native"),{recursive: true});await rename(native,join(root,"native/linux-x64"));
	await saveLakeFile(vendor,"autoload.php","<?php require __DIR__.'/example/tariff-quotes/src/Api.php';");
	const bins=(env.LEAN_BRIDGE_PHP_HOST_INTERPRETERS??"/usr/bin/php").split(",");
	const result=await runPhpIncoming(app,bins,{PATH: "/unavailable",LANG: "C.UTF-8",LEAN_NUM_THREADS: "1"});
	t.diagnostic(JSON.stringify({route,origin: source.origin,...result}));
});
