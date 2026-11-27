/** @file Compile the application forwarding client for both public C interfaces. */
import assert from "node:assert/strict";
import {mkdtemp,rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join,resolve} from "node:path";
import test from "node:test";
import {generateOwnedCValues} from "../../src/backends/c/owned-values.mjs";
import {compileOwnedWitGraphModel} from "../../src/backends/wit/owned-graph-model.mjs";
import {ownedWitPublicPrefix} from "../../src/backends/wit/owned-package.mjs";
import {leasedClosureFieldReviewedIr} from "./owned-aggregate-fixture.mjs";
import {checkApplicationFunctionPositions,checkTicketExchangePositions} from "./staged-quote-project.mjs";
import {saveLakeFile} from "./lake-workspace.mjs";
import {runNativeTool} from "./native-effect-consumers.mjs";

test("host-provided C functions use public calls in both native and Wasmtime headers",async t=>{
	const ir=leasedClosureFieldReviewedIr({staged: true,hostFunctions: true,ticketExchange: true}),m=compileOwnedWitGraphModel(ir);
	checkApplicationFunctionPositions(ir);checkTicketExchangePositions(ir);
	assert.match(m.wit,/pass-application-quote: func\(arg0: borrow<(identity-[\w-]+)>\) -> own<\1>;/u);
	assert.match(m.wit,/visit-application-quote: func\(arg0: borrow<identity-[\w-]+>, arg1: borrow<identity-[\w-]+>, arg2: u32\) -> u32;/u);
	const root=await mkdtemp(join(tmpdir(),"application-function-c-"));t.after(()=>rm(root,{recursive: true,force: true}));
	for(const wit of [false,true])
	{
		const v=generateOwnedCValues(ir,{hostCallbacks: true,valueCopies: true,...wit?{publicPrefix: ownedWitPublicPrefix(ir)}:{}});
		await saveLakeFile(root,v.prefix+".h",v.header);
		const sources=["tariff-application-function.c","tariff-ticket-exchange.c","tariff-application-observer.c"].map(f=>resolve("tests/fixtures/structured-types",f));
		await runNativeTool(process.env.CC??"cc",["-std=c11","-Wall","-Wextra","-Werror","-UNDEBUG","-I.",wit?"-DTARIFF_WIT":"-DTARIFF_NATIVE_C","-fsyntax-only",...sources],root,process.env);
	}
});
