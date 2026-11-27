/** @file Exercise one downstream C++20 application through both supported package discovery mechanisms. */
import assert from "node:assert/strict";
import {copyFile,readFile} from "node:fs/promises";
import {join,resolve} from "node:path";
import {sha256} from "../../src/capsule/node.mjs";
import {saveLakeFile} from "./lake-workspace.mjs";
import {runNativeTool as run} from "./native-effect-consumers.mjs";

/**
 * Build against the relocated archive, not producer build directories.
 *
 * @param root - Isolated consumer project.
 * @param install - Relocated public C++ package.
 * @param env - Consumer compiler tool locations.
 * @param tickets - Whether the selected release declares direct Ticket exchange.
 */
export const runCppApplication=async(root,install,env,tickets=true)=>{
	const names=["tariff-application.cpp","tariff-cpp-probe.cpp"],sources={};
	for(const f of names)
	{
		await copyFile(resolve("tests/fixtures/structured-types",f),join(root,f));
		sources[f]=sha256(await readFile(join(root,f)));
	}
	const cmake=`cmake_minimum_required(VERSION 3.16)
project(consumer LANGUAGES CXX)
find_package(LeanBridgeTariffQuotesCpp CONFIG REQUIRED)
add_executable(consumer tariff-application.cpp tariff-cpp-probe.cpp)
target_compile_features(consumer PRIVATE cxx_std_20)
${tickets?"":"target_compile_definitions(consumer PRIVATE TARIFF_FUNCTION_ONLY)"}
target_compile_options(consumer PRIVATE -Wall -Wextra -Werror -UNDEBUG)
target_link_libraries(consumer PRIVATE LeanBridge::tariff_quotes_cpp \${CMAKE_DL_LIBS})
`;
	await saveLakeFile(root,"CMakeLists.txt",cmake);sources["CMakeLists.txt"]=sha256(cmake);
	const pc={PATH: env.PATH,PKG_CONFIG_LIBDIR: join(install,"lib/pkgconfig")};
	assert.equal(await run("pkg-config",["--variable=pcfiledir","tariff-quotes"],root,pc),pc.PKG_CONFIG_LIBDIR);
	const flags=await run("pkg-config",["--cflags","--libs","tariff-quotes"],root,pc);
	const tokens=flags.match(/(?:\\.|[^\s\\])+/gu).map(s=>s.replace(/\\(.)/gu,"$1"));
	await run(env.CXX??"c++",["-std=c++20","-Wall","-Wextra","-Werror","-UNDEBUG",...tickets?[]:["-DTARIFF_FUNCTION_ONLY"],...names,...tokens,"-ldl","-o","pkg-consumer"],root,env);
	const cfg="-DLeanBridgeTariffQuotesCpp_DIR="+join(install,"lib/cmake/LeanBridgeTariffQuotesCpp");
	await run("cmake",["-S",".","-B","cmake",cfg],root,env);
	await run("cmake",["--build","cmake","--parallel","1"],root,env);
	const methods={};
	for(const [tool,path] of [["pkgConfig","pkg-consumer"],["cmake","cmake/consumer"]])
	{
		const exe=join(root,path),output=await run(exe,[],root,{PATH: "/no-author-tools",LEAN_NUM_THREADS: "1",LANG: "C.UTF-8"});
		const tail=tickets?["ticket:42:43","ticket42","ticket:71:72","ticket71"]:["registration expired after success","registration expired after failure"];
		assert.deepEqual(output.split("\n"),["expired","forwarded:42","forward","after-failure:43","nested",...tail,"fresh","identities:1,1,1,1,1,1,0"]);
		methods[tool]={clientSha256: sha256(await readFile(exe)),output};
	}
	return {sources,methods};
};
