/** @file Terminate a real installed Lean worker on request from the PHP host test. */
globalThis.addEventListener("message",event=>{
	if(event.data!=="test:lose-php-task-worker") return;
	event.stopImmediatePropagation();throw new Error("Injected PHP-Wasm lost Lean worker");
},{capture: true});
await import("/node_modules/@lean-bridge/runtime/internal/task.mjs");
