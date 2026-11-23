/** @file Dispatch Lean worker notifications to components sharing one Wasm runtime. */

const retainNode = () => {
	if(!globalThis.process?.versions?.node) return () => {};
	const {port1, port2} = new MessageChannel();
	port1.start(); port1.ref();
	return () => { port1.close(); port2.close(); };
};

/**
 * Allocate one-shot notification tokens local to a single Wasm module.
 * Cancelling a public operation does not unsubscribe its native drain.
 * Only a failed admission or a redundant signal should detach early.
 *
 * @param capacity - Maximum number of outstanding native subscriptions.
 */
export const createWasmTaskNotifications = (capacity = 65535) => {
	if(!Number.isInteger(capacity) || capacity < 1 || capacity > 0xffffffff)
		throw new RangeError("Expected a positive UInt32 notification capacity");
	const listeners = new Map();
	let last = 0, release;
	const remove = token => {
		if(!listeners.delete(token)) return false;
		if(!listeners.size)
		{
			release(); release = undefined;
		}
		return true;
	};
	const subscribe = ready => {
		if(typeof ready !== "function") throw new TypeError("Missing native readiness handler");
		if(listeners.size === capacity || last === 0xffffffff) throw new RangeError("Lean task notification capacity exhausted");
		if(!listeners.size) release = retainNode();
		const token = ++last;
		listeners.set(token, ready);
		return Object.freeze({token, detach: () => remove(token)});
	};
	const notify = token => {
		const ready = listeners.get(token);
		if(!ready) return false;
		remove(token); // Claim before re-entry, including redelivery of this token.
		ready();
		return true;
	};
	return Object.freeze({subscribe, notify, pending: () => listeners.size});
};
