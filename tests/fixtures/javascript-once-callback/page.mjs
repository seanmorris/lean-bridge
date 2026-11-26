import React from "react";
import {createRoot} from "react-dom/client";
import {flushSync} from "react-dom";
import {run,close} from "./public.mjs";

globalThis.readerReady.resolve(async()=>{
	const page=await run(), result=Promise.withResolvers(), mount=createRoot(document.querySelector("main"));
	function Example(){
		const [label,setLabel]=React.useState("start");
		return React.createElement("button",{onClick:async()=>{
			try {
				const report=await run(); flushSync(()=>setLabel(String(report.recovered))); result.resolve(report);
			} catch(e) { result.reject(e); }
		}},label);
	}
	let react;
	try {
		flushSync(()=>mount.render(React.createElement(Example)));
		const button=document.querySelector("button"); button.click(); react=await result.promise;
		if(button.textContent!=="42") throw new Error("React state did not update");
	} finally { mount.unmount(); await close(); }
	const worker=await new Promise((resolve,reject)=>{
		const w=new Worker(new URL("./worker.mjs",import.meta.url),{type:"module"});
		w.onmessage=e=>{w.terminate();if(e.data.error) reject(new Error(e.data.error));else resolve(e.data);};
		w.onerror=e=>{w.terminate();reject(new Error(e.message));};
	});
	return {page,react,worker};
});
