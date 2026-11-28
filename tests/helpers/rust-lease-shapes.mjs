/** @file Type-check the session lease implementation under each Rust ownership capability. */
import {mkdtemp,rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import test from "node:test";
import {generateOwnedRustCallables} from "../../src/backends/rust/owned-callables.mjs";
import {nativeFixtureEnvironment} from "./copied-fixture-install.mjs";
import {saveLakeFile} from "./lake-workspace.mjs";
import {runNativeTool} from "./native-effect-consumers.mjs";
import {ownedRustBorrowReviewedIr} from "./owned-rust-borrow-fixture.mjs";
import {ownedRustCallbackResultCombinedReviewedIr,ownedRustCallbackResultReviewedIr} from "./owned-rust-callback-result-fixture.mjs";
import {ownedRustPlainReceiverReviewedIr,ownedRustReceiverReviewedIr} from "./owned-rust-receiver-fixture.mjs";
import {ownedRustTransferReviewedIr} from "./owned-rust-transfer-fixture.mjs";

test("six generated ownership APIs compile against the same Rust lease implementation",async t=>{
	const env=nativeFixtureEnvironment(["rust"]),dir=await mkdtemp(join(tmpdir(),"rust-lease-shapes-"));
	t.after(()=>rm(dir,{recursive: true,force: true}));
	const move={transferredInputs: true},anchored={...move,anchoredResults: true},receiver={...anchored,receiverExports: true};
	const shapes=[
		["transfer",ownedRustTransferReviewedIr(),move]
		, ["borrow",ownedRustBorrowReviewedIr(),anchored]
		, ["receiver",ownedRustReceiverReviewedIr(),receiver]
		, ["plain_receiver",ownedRustPlainReceiverReviewedIr(true),{...move,receiverExports: true,hostCallbacks: false}]
		, ["callback_result",ownedRustCallbackResultReviewedIr(),{callbackResultAnchors: true}]
		, ["combined",ownedRustCallbackResultCombinedReviewedIr(),{...receiver,callbackResultAnchors: true}]
	];
	for(const [name,ir,capabilities] of shapes)
	{
		const target=join(dir,name), g=generateOwnedRustCallables(ir,capabilities);
		await saveLakeFile(target,"src/lib.rs","mod owned_values;\n"+g.apiSource);
		await saveLakeFile(target,"src/owned_values.rs",g.source);
		await saveLakeFile(target,"Cargo.toml",`[package]\nname="${name}"\nversion="0.0.0"\nedition="2021"\n[dependencies]\nnum-bigint="=0.4.6"\n`);
	}
	await saveLakeFile(dir,"Cargo.toml",'[workspace]\nresolver="2"\nmembers='+JSON.stringify(shapes.map(([n])=>n))+"\n");
	await runNativeTool(env.LEAN_BRIDGE_CARGO,["check","--offline","--workspace","--keep-going","--jobs","1"],dir,
		{...env,RUSTC: env.LEAN_BRIDGE_RUSTC,CARGO_NET_OFFLINE: "true"});
});
