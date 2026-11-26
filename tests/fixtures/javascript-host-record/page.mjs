/** @file Exercise the installed components on the page, through React, and in a worker. */
/* global Worker */
import React from "react";
import {createRoot} from "react-dom/client";
import {flushSync} from "react-dom";
import {exercise} from "./calls.mjs";

globalThis.recordReady.resolve(async()=>{
	const page=exercise(false);
	const root=createRoot(globalThis.document.querySelector("main"));
	const Probe=()=>{
		const [result,setResult]=React.useState(null);
		return React.createElement("button",{onClick: ()=>setResult(exercise(true))},result?JSON.stringify(result):"run");
	};
	flushSync(()=>root.render(React.createElement(Probe)));
	const button=globalThis.document.querySelector("button");flushSync(()=>button.click());
	const react=JSON.parse(button.textContent);flushSync(()=>root.unmount());
	const worker=await new Promise((ok,no)=>{
		const w=new Worker(new URL("./worker.mjs",import.meta.url),{type: "module"});
		w.onmessage=e=>{w.terminate();ok(e.data);};
		w.onerror=e=>{w.terminate();no(new Error(e.message));};
	});
	return {page,react,worker};
});
