/** @file Verify that a real uncaught browser pthread error rejects an installed pending caller. */
import assert from "node:assert/strict";
import {copyFile} from "node:fs/promises";
import {join} from "node:path";
import {runInstalledChromium} from "./javascript-wasm-installed-browser.mjs";

/**
 * Exercise fatal worker delivery in a disposable browser realm.
 *
 * @param options - Installed consumer and its browser fixture.
 */
export const verifyLostTaskWorker=async options => {
	const {root,consumer,fixtures,names}=options;
	await copyFile(join(fixtures,"fault-pthread.mjs"),join(consumer,"fault-pthread.mjs"));
	const evaluate=async () => {
		const Native=globalThis.Worker, workers=[];
		/** Wrap only the SDK's pthread workers, preserving the installed program. */
		globalThis.Worker=class extends Native {
			/**
			 * Start a worker with a test fault listener ahead of the installed module.
			 *
			 * @param url - Requested worker module.
			 * @param options - Native worker options.
			 */
			constructor(url,options) {
				const owned=options?.name==="em-pthread" && new URL(url,globalThis.location.href).pathname.endsWith("/internal/task.mjs");
				super(owned ? new URL("/fault-pthread.mjs",globalThis.location.href) : url,options);
				if(owned) workers.push(this);
			}
		};
		const relay=await import("@example/lean-relay"), rt=await import("@lean-bridge/runtime");
		const entered=Promise.withResolvers(), reply=Promise.withResolvers();
		const reason=task => task.then(() => { throw new Error("Expected lost-worker rejection"); },e => e);
		const failure=reason(relay.factory(1,() => { entered.resolve();return reply.promise; }));
		await entered.promise;
		for(const worker of workers) worker.postMessage("test:fail-this-pthread");
		const first=await failure, closing=await reason(rt.closeTaskRuntime());
		let fresh;
		try
		{ relay.add(1); } catch(e)
		{ fresh=e; }
		reply.resolve(9); await Promise.resolve();
		const {state,frames,allocations,pending,notifications}=rt.taskRuntimeStats();
		return {trapped: first.message.includes("Injected lost Lean pthread"),same: first===closing && first===fresh,state,frames,allocations,pending,notifications};
	};
	const result=await runInstalledChromium({root,consumer,names,isolated: true,timeoutMs: 45000,evaluate});
	assert.deepEqual(result,{trapped: true,same: true,state: "poisoned",frames: 0,allocations: 0,pending: 0,notifications: 0});
};
