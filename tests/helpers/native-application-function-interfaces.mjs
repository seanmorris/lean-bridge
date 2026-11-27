/** @file Compile the downstream application against both sources of the Rust callback contract. */
import assert from "node:assert/strict";
import {mkdtemp,readFile,rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import test from "node:test";
import {generateOwnedRustCallables} from "../../src/backends/rust/owned-callables.mjs";
import {nativeFixtureEnvironment} from "./copied-fixture-install.mjs";
import {saveLakeFile} from "./lake-workspace.mjs";
import {runNativeTool} from "./native-effect-consumers.mjs";
import {leasedClosureFieldReviewedIr} from "./owned-aggregate-fixture.mjs";
import {checkApplicationFunctionPositions} from "./staged-quote-project.mjs";

test("Rust infers application and nested visitor types in the public function-forwarding client",async t=>{
	const env=nativeFixtureEnvironment(["rust"]),root=await mkdtemp(join(tmpdir(),"host-function-rust-"));
	t.after(()=>rm(root,{recursive: true,force: true}));
	const reviewed=leasedClosureFieldReviewedIr({staged: true,hostFunctions: true});
	const cases=[["reviewed",reviewed]];
	if(env.LEAN_BRIDGE_APP_FUNCTION_COMPILED_IR)
		cases.push(["compiled",JSON.parse(await readFile(env.LEAN_BRIDGE_APP_FUNCTION_COMPILED_IR))]);
	const client=await readFile("tests/fixtures/structured-types/tariff-application-function.rs");
	for(const [name,ir] of cases)
	{
		checkApplicationFunctionPositions(ir);const g=generateOwnedRustCallables(ir,{hostCallbacks: true}),dir=join(root,name);
		assert.deepEqual(g.closureEntries.map(x=>x.name),["visit_application_quote_with"]);
		await saveLakeFile(dir,"src/lib.rs","mod owned_values;\n"+g.apiSource);
		await saveLakeFile(dir,"src/owned_values.rs",g.source);await saveLakeFile(dir,"src/main.rs",client);
		await saveLakeFile(dir,"Cargo.toml",'[package]\nname="tariff-quotes"\nversion="1.0.0"\nedition="2021"\n[dependencies]\nnum-bigint="=0.4.6"\n');
		await runNativeTool(env.LEAN_BRIDGE_CARGO,["check","--offline","--bins","--jobs","1"],dir,
			{...env,RUSTC: env.LEAN_BRIDGE_RUSTC,CARGO_NET_OFFLINE: "true",CARGO_TARGET_DIR: join(root,"target")});
	}
});
