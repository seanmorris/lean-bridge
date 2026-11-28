/** @file Verify the origin and direct use of a callable in installed packQuote clients. */
import assert from "node:assert/strict";
import {execFileSync} from "node:child_process";
import {readFile} from "node:fs/promises";
import test from "node:test";
import {sha256} from "../../src/capsule/node.mjs";

// profile | evidence directory | source revision | report suffix | client | digest field |
// call with the Lean-produced function | observation using the returned function
const manifest=`python|python-staged-callback-results-20261125|45861a3|execution|leased-closure-fields.py|fieldConsumerSha256|pack_quote(projected).quote as repacked|assert repacked(6) == 46
c|c-leased-closure-fields-20261125|58d98e0|execution|leased-closure-fields.c|consumerSha256|tariff_quotes_pack_quote(s, &lean, &repacked|call(s, repacked.quote, 5, 45)
cpp|cpp-staged-callback-results-20261126|03d3e97|fields|tariff-fields.cpp|clientSha256|api::pack_quote(fn)|assert(repacked.quote(6) == 42)
rust|rust-staged-callback-results-20261126|21d9dec|fields|tariff-fields.rs|clientSha256|pack_quote(owner.clone())?|assert_eq!(repacked.quote.call(6)?, 42)
dotnet|dotnet-function-fields-20261126|02c9a55||tariff-fields.cs|clientSha256|Api.PackQuote(field.AsCallback)|Check(repacked.Quote.Invoke(6) == 42)
java|jvm-function-fields-20261126|c2ad18a||jvm-tariff/JavaTariff.java|sources.JavaTariff.java|Api.packQuote(unpacked.asCallback())|Ownership.check(quote.invoke(6) == 42)
kotlin|jvm-function-fields-20261126|c2ad18a||jvm-tariff/KotlinTariff.kt|sources.KotlinTariff.kt|Api.packQuote(unpacked.asCallback())|check(it.invoke(6) == 42L)
php-native|php-function-fields-20261126|7825d60||tariff-fields.php|sources.tariff-fields.php|pack_quote($retained)|$keep(3) === 43
php-wasm|php-wasm-function-fields-20261126|ea57fdc||tariff-zend.php|sources.structured-types/tariff-zend.php|pack_quote($retained)|(string)$keep(UInt::of(3)) === '43'
ruby|ruby-function-fields-20261126|5b8b2c2||tariff-fields.rb|clientSha256|API.pack_quote(retained)|keep.call(3) == 43
perl|perl-function-fields-20261126|62bc25f||tariff-fields.pl|clientSha256|LeanBridge::TariffQuotes::pack_quote($retained)|check($keep->call(3) == 43)
wit-wasi|wit-function-fields-20261126|40b5fb0||tariff-wasmtime.c|clientSha256|Q(pack_quote)(s, &wrap, &repacked|call(s, repacked.quote, 3) == 43
node-javascript|npm-function-fields-20261126|ebb5530||tariff-fields.mjs|sourceHashes.calls.mjs|api.packQuote(field)|keptValue === base + 2
node-typescript|npm-function-fields-20261126|ebb5530||tariff-fields.mts|sourceHashes.typed.mts|api.packQuote(kept)|api.applyTariff(packed, 4) !== 44
browser-javascript|npm-function-fields-20261126|ebb5530||tariff-fields.mjs|sourceHashes.calls.mjs|api.packQuote(field)|keptValue === base + 2
browser-react|npm-function-fields-20261126|ebb5530||tariff-fields.mjs|sourceHashes.calls.mjs|api.packQuote(field)|keptValue === base + 2
browser-worker|npm-function-fields-20261126|ebb5530||tariff-fields.mjs|sourceHashes.calls.mjs|api.packQuote(field)|keptValue === base + 2`;

const lookup=(r,key)=>{
	const split=key.indexOf(".");return split<0?r[key]:r[key.slice(0,split)][key.slice(split+1)];
};
const verifyExecution=(p,r)=>{
	if(["python","c","cpp","rust"].includes(p))
	{
		assert.ok(r.identities.length>=5);assert.equal(r.identities.at(-1),0);
		if(p==="c") assert.ok(r.pkgConfig.includes("repack and retain")&&r.relocatedCMake.includes("repack and retain"));
	} else if(p==="dotnet"||p==="java"||p==="kotlin")
	{
		const v=p==="dotnet"?r.live:r.results[p];assert.equal(v.repack,v.baseline);assert.equal(v.afterThreadExit,0);
	} else if(p==="php-native"||p==="php-wasm"||p==="perl")
	{
		assert.equal(r.observations.length,{"php-native": 2,"php-wasm": 8,perl: 4}[p]);
		for(const e of r.observations)
		{
			const v=p==="php-wasm"?e.result:e;assert.equal(v.after,v.baseline);
			assert.equal(Number(v.result??v.recovered),42);
		}
	} else if(p==="ruby"||p==="wit-wasi")
	{
		assert.equal(r.observed.recovered,42);assert.equal(r.observed.after,r.observed.baseline);
	} else
	{
		const browsers={"browser-javascript": "page","browser-react": "react","browser-worker": "worker"};
		const o=browsers[p]?r.browser[browsers[p]]:p==="node-javascript"?r.node:r.typescript;
		assert.ok(o.held>o.baseline);assert.equal(o.after,o.baseline);
		assert.equal(o.value??o.nextValue,42);assert.equal(o.entries,0);
	}
};
const rows=manifest.split("\n").map(row=>row.split("|"));
assert.equal(new Set(rows.map(([p])=>p)).size,17);
for(const [profile,dir,rev,suffix,name,key,call,use] of rows)
	test(profile+": pass a Lean function directly as an exported function argument",async()=>{
		const path="tests/fixtures/"+(name.includes("/")?name:"structured-types/"+name);
		const source=execFileSync("git",["cat-file","blob",rev+":"+path]);
		const author=execFileSync("git",["cat-file","blob",rev+":tests/fixtures/onboarding/leased-closure-fields/Owned.lean"]);
		assert.ok(author.toString().includes("def packQuote (quote : UInt32 → UInt32) : Tariff := ⟨quote⟩"));
		assert.match(source.toString(),/make_?tariff(?:\))?\(/iu,path+": receives a Lean-created function");
		assert.ok(source.toString().includes(call),path+": "+call);
		assert.ok(source.toString().includes(use),path+": "+use);
		const receipts=new Set();
		for(const route of ["ordinary","reviewed"])
		{
			const root="docs/evidence/"+dir+"/"+route,reportPath=root+(suffix?"."+suffix:"")+".json";
			const r=JSON.parse(await readFile(reportPath));assert.equal(r.route,route);
			assert.equal(lookup(r,key),sha256(source),path);verifyExecution(profile,r);
			if(profile.startsWith("browser-"))
			{
				const ui=profile==="browser-worker"?"worker.mjs":"page.mjs";
				const entry=execFileSync("git",["cat-file","blob",rev+":tests/fixtures/javascript-host-record/"+ui]);
				assert.equal(sha256(entry),r.sourceHashes[ui]);assert.ok(entry.toString().includes('from "./calls.mjs"'));
				assert.ok(entry.toString().includes(profile==="browser-javascript"?"exercise(false)":"exercise(true)"));
			}
			const receipt=r.receiptSha256??r.packageSetSha256;assert.match(receipt,/^[0-9a-f]{64}$/u);
			if(suffix)
			{
				const receiptPath=root+(profile==="c"?".json":".package-set.json");
				assert.equal(sha256(await readFile(receiptPath)),receipt);
			} else assert.equal(r.reviewedSourceSha256===null,route==="ordinary");
			receipts.add(receipt);
		}
		assert.equal(receipts.size,2);
	});
