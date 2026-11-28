/** @file Check both directions of a terminal result fault through an installed CPython package pair. */
import assert from "node:assert/strict";
import {execFile} from "node:child_process";
import {fileURLToPath} from "node:url";
import {promisify} from "node:util";

const exec=promisify(execFile);
export const policyClient=fileURLToPath(new URL("../fixtures/host-object/error-policy.py",import.meta.url));

/**
 * Run each direction in a fresh process: retirement is permanent.
 *
 * @param python - The real interpreter used to install the wheels.
 * @param cwd - Isolated working directory outside the producer.
 * @param env - Consumer environment selecting the relocated package prefix.
 */
export const checkPythonHostErrors=async (python,cwd,env)=>{
	const terminal=[];
	for(const order of [["lean_workshop","lean_workshop_peer"],["lean_workshop_peer","lean_workshop"]])
	{
		const reply=await exec(python,["-S","-B",policyClient,...order],{cwd,env,timeout: 45000});
		assert.equal(reply.stderr,"");
		const observed=JSON.parse(reply.stdout);
		assert.deepEqual(observed,{outer: order[0],peer: order[1],set: 1,read: 0,native: 1,caught: 1,retired: true,live: 0});
		terminal.push(observed);
	}
	return terminal;
};
