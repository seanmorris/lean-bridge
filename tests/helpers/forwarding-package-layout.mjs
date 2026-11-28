/** @file Read the actual native package payload and verify the installed client's observations. */
import assert from "node:assert/strict";
import {execFile} from "node:child_process";
import {readFile} from "node:fs/promises";
import {join} from "node:path";
import {promisify} from "node:util";
import {sha256} from "../../src/capsule/node.mjs";
import {readClosedPackageTarGz} from "./closed-package-tar.mjs";

const exec=promisify(execFile), fixture="tests/fixtures/structured-types";
const hex=/^[a-f0-9]{64}$/u;
/**
 * Open a wheel, C++ SDK or crate without installing or executing its code.
 *
 * @param target - Target in the verified receipt.
 * @param archive - Artifact covered by that receipt.
 */
export const forwardingPackage=async(target,archive)=>{
	assert.ok(["pypi","cpp","cargo"].includes(target));
	if(target==="pypi")
	{
		const member=async name=>(await exec("unzip",["-p",archive,"lean_tariff_quotes/"+name],{encoding: "buffer",maxBuffer: 16<<20})).stdout;
		return {member,component: "lean_bridge/component/",lib: "native/linux-x64/"};
	}
	const cpp=target==="cpp",root="tariff-quotes-1.0.0"+(cpp?"-cpp":"");
	const files=readClosedPackageTarGz(await readFile(archive),{root,maxInput: 64<<20,maxBytes: 220<<20});
	const member=name=>{assert.ok(files.has(name),name);return files.get(name);};
	const component=cpp?"share/lean-bridge/component/":"lean-bridge/component/";
	return {member,component,lib: cpp?"lib/":"native/linux-x64/"};
};

/**
 * Match report source digests and outcomes to the specific consumer and route.
 *
 * @param target - Installed consumer language's package target.
 * @param row - Record from the relocated client and its observer.
 * @param payload - Member reader for that same receipt's archive.
 */
export const verifyForwardingClient=async(target,row,payload)=>{
	const reviewed=row.route==="reviewed";
	if(target==="cpp")
	{
		for(const name of ["tariff-application.cpp","tariff-cpp-probe.cpp"])
			assert.equal(row.sources[name],sha256(await readFile(join(fixture,name))));
		assert.deepEqual(Object.keys(row.methods).sort(),["cmake","pkgConfig"]);
		const tail=reviewed?["ticket:42:43","ticket42","ticket:71:72","ticket71"]:["registration expired after success","registration expired after failure"];
		for(const {clientSha256,output} of Object.values(row.methods))
		{
			assert.match(clientSha256,hex);
			assert.deepEqual(output.split("\n"),["expired","forwarded:42","forward","after-failure:43","nested",...tail,"fresh","identities:1,1,1,1,1,1,0"]);
		}
		return;
	}
	const ext=target==="cargo"?"rs":"py";
	for(const [key,file] of [["clientSha256","tariff-application-function."],["observerSha256","tariff-incoming-observer."]])
		assert.equal(row[key],sha256(await readFile(join(fixture,file+ext))));
	if(target==="pypi")
	{
		assert.deepEqual(row.observed,[1,1,1,1,1,1,0]);return;
	}
	const deps=process.env.LEAN_BRIDGE_FORWARDING_RUST_DEPS;
	assert.ok(deps,"supply the vendored lock and sources used by both offline installs");
	const receipt=await readFile(join(deps,"dependencies.json")),d=JSON.parse(receipt);
	assert.equal(sha256(receipt),process.env.LEAN_BRIDGE_FORWARDING_RUST_DEPS_SHA256);
	if(reviewed)assert.equal(row.dependenciesReceiptSha256,sha256(receipt));
	assert.equal(d.archive,"rust-dependencies.tar.gz");assert.equal(sha256(await readFile(join(deps,d.archive))),d.sha256);
	assert.equal(row.dependenciesSha256,d.sha256);assert.equal(row.lockSha256,d.lockSha256);
	assert.equal(sha256(await payload.member("Cargo.lock")),d.lockSha256);
	assert.ok(Number.isSafeInteger(row.held)&&row.held>0);assert.deepEqual(row.observed,[0,0,0,0,0,0,0]);
};
