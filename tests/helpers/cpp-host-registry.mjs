/** @file Check that the native C++ owner preserves application shared_ptr control blocks. */
import assert from "node:assert/strict";
import {mkdtemp,rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join,resolve} from "node:path";
import test from "node:test";
import {runNativeTool as run} from "./native-effect-consumers.mjs";

test("C++ adopted objects preserve their original shared_ptr and reject ambiguous ownership",async t=>{
	const root=await mkdtemp(join(tmpdir(),"cpp-host-registry-"));
	t.after(()=>rm(root,{recursive: true,force: true}));
	const c=resolve("src/backends/c"),cpp=resolve("src/backends/cpp");
	const flags=["-Wall","-Wextra","-Werror","-DLB_C_REF_PREFIX=checked_ref_","-I"+c];
	await run(process.env.CC??"cc",["-std=c11",...flags,"-c",join(c,"host-registry.c"),"-o","registry.o"],root,process.env);
	await run(process.env.CXX??"c++",["-std=c++20",...flags,"-DLB_CPP_OWNER_PREFIX=checked_cpp_","-I"+cpp,join(cpp,"host-shared.cpp"),resolve("tests/fixtures/c-host-members/shared.cpp"),"registry.o","-pthread","-o","client"],root,process.env);
	assert.match(await run("./client",[],root,process.env),/same control block, exact destruction/u);
});
