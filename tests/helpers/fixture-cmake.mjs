/** @file Find a consumer's CMake before creating a compiler-free execution environment. */
import assert from "node:assert/strict";
import {constants} from "node:fs";
import {access,realpath} from "node:fs/promises";
import {delimiter,join,resolve} from "node:path";
import {copiedCleanEnvironment,runCopied} from "./copied-fixture-install.mjs";

/**
 * Verify an explicit tool, a local toolchain, or the CMake on the producer PATH.
 *
 * @param work - Working directory for the version check.
 * @param env - Producer environment, before restricting the consumer PATH.
 */
export const fixtureCmake=async(work,env)=>{
	const candidates=env.LEAN_BRIDGE_CMAKE?[resolve(env.LEAN_BRIDGE_CMAKE)]
		:[resolve(".toolchains/cmake/bin/cmake"),...(env.PATH??"").split(delimiter).filter(Boolean).map(d=>join(d,"cmake"))];
	for(const path of candidates)
	{
		try
		{await access(path,constants.X_OK);}
		catch(e)
		{if(e.code==="ENOENT" || e.code==="EACCES") continue;throw e;}
		const tool=await realpath(path),{stdout}=await runCopied(tool,["--version"],work,copiedCleanEnvironment);
		const match=/^cmake version (\d+)\.(\d+)/u.exec(stdout);
		assert.ok(match && (+match[1]>3 || (+match[1]===3 && +match[2]>=20)),"CMake 3.20 or newer is required: "+tool);
		return tool;
	}
	throw new Error("CMake not found. Set LEAN_BRIDGE_CMAKE to an executable CMake 3.20+ path.");
};
