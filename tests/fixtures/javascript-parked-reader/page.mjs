import React from "react";
import {createRoot} from "react-dom/client";
import {flushSync} from "react-dom";
import {run,close} from "./public.mjs";

async function exercise() {
	const page=await run(), rendered=Promise.withResolvers();
	const mount=createRoot(document.querySelector("main"));
	function Start() {
		const [state,update]=React.useState("start");
		return React.createElement("button",{onClick:async()=>{
			try {
				const value=await run(); flushSync(()=>update(String(value.late)));
				rendered.resolve(value);
			} catch(e) { rendered.reject(e); }
		}},state);
	}
	let react;
	try {
		flushSync(()=>mount.render(React.createElement(Start)));
		const button=document.querySelector("button"); button.click(); react=await rendered.promise;
		if(button.textContent!=="73") throw new Error("missing React update");
	} finally { mount.unmount(); await close(); }
	const worker=await new Promise((resolve,reject)=>{
		const w=new Worker(new URL("./worker.mjs",import.meta.url),{type:"module"});
		w.onmessage=e=>{ w.terminate(); if(e.data.error) reject(new Error(e.data.error)); else resolve(e.data); };
		w.onerror=e=>{ w.terminate(); reject(new Error(e.message)); };
	});
	return {page,react,worker};
}
globalThis.readerReady.resolve(exercise);
