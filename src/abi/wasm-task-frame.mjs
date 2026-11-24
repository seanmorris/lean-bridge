/** @file Version-one private word-frame layout shared by the emitter and the JS runtime. */
// These entry points must be visible to JavaScript as well as exported by
// the Wasm main module. The side-module import table alone cannot check that.
export const taskHostOwnerExports=Object.freeze(["member","run_member"
	, "error_ticket","collect","retire"].map(op=>"lb_jst_"+op+"_v1"));
export const taskFrame = Object.freeze({magic: 0x4c425431
	, handle: 24
	, out: 40
	, args: 72
	, start: 0, listen: 1, take: 2, cancel: 3, close: 4, pull: 5, clear: 6
	, leaseClose: 7, leaseRetain: 8, leaseSame: 9, leaseSize: 104
	, arm: 10
	, next: 11
	, arg: 12
	, reply: 13
	, fail: 14
	, hostPin: 15
	, hostResolve: 16, hostPrepare: 17});
