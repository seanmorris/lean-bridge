/**
 * Private control frame shared by generated owned wasm32 bindings and the loader.
 * Its first three words match the existing dynamically linked call trampoline.
 *
 * @file
 */
export const ownedWasmControlVersion = 1;
export const ownedWasmControlBytes = 64;
export const ownedWasmControlOperations = Object.freeze({
	init: 0, open: 1, valid: 2, release: 3, claim: 4, identity: 5
	, dispatch: 6, retain: 7, close: 8, live: 9, results: 10
	, callbackBegin: 11, callbackEnd: 12, callbackValid: 13, callbackLive: 14
	, metadata: 15
});
export const ownedWasmBorrowOperations = Object.freeze({ copy: 16, alive: 17, revoke: 18 });
