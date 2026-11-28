/** @file Prepare a pthread author kit independently of any Lean application. */
import {prepareTaskSdk} from "../src/build/javascript-wasm-task-sdk.mjs";

const [outputRoot,...extra]=process.argv.slice(2);
if(!outputRoot || extra.length || !process.env.LEAN_BRIDGE_JS_EMSDK || !process.env.LEAN_BRIDGE_JS_THREAD_CORE)
	throw new Error("Usage: set LEAN_BRIDGE_JS_EMSDK and LEAN_BRIDGE_JS_THREAD_CORE, then run prepare-javascript-task-sdk.mjs NEW_DIRECTORY");
const kit = await prepareTaskSdk({outputRoot
	, emsdkRoot: process.env.LEAN_BRIDGE_JS_EMSDK
	, leanRuntimeRoot: process.env.LEAN_BRIDGE_JS_THREAD_CORE
	, initArchive: process.env.LEAN_BRIDGE_JS_THREAD_INIT
	, environment: process.env});
console.log(JSON.stringify(kit));
