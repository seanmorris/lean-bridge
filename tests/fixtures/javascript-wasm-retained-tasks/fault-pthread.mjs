/** @file Fault-injection wrapper: load the unmodified installed pthread and raise an actual uncaught worker error on request. */
globalThis.addEventListener("message",event => {
	if(event.data!=="test:fail-this-pthread") return;
	event.stopImmediatePropagation();
	throw new Error("Injected lost Lean pthread");
},{capture: true});
await import("/installed/@lean-bridge/runtime/internal/task.mjs");
