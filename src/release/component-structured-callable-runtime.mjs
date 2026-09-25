/**
 * Recursive copied-value frames for the shared callback registry. This codec
 * owns no tokens or dispatcher; scalar and structured calls share their limits,
 * exception state, closure leases, reentry stack and poisoned heap.
 *
 * @file
 */
import { componentCallableDepth } from "../abi/component-callables.mjs";
import { assertComponentStructuredCallableAbi } from "../abi/component-structured-callables.mjs";
import { componentRecursiveAbi } from "../abi/component-recursive-abi.mjs";
import { createComponentRecursiveBudget } from "../abi/component-recursive.mjs";
import { scalarCopyLimit, scalarFrameHeaderBytes, scalarSlotBytes } from "../abi/component-scalars.mjs";
import { compileComponentRecursiveCodec } from "./component-recursive-codec.mjs";
import { recursiveOutputReceipt } from "./component-recursive-ownership.mjs";
import { readComponentScalarSlot } from "./component-scalar-codec.mjs";

const uint32 = { kind: "primitive", name: "uint32" };
const budgetFailure = error => error instanceof RangeError && [
	"Component copy budget exceeded"
	, "Component recursive value node budget exceeded"
].includes(error.message);
const failure = status => status === 4 ? new RangeError("Component copy budget exceeded")
	: new Error(`Component structured callable call failed (${status})`);

/**
 * Compile codecs bound to one authenticated descriptor and one shared registry.
 *
 * @param module - Initialized Emscripten heap and recursive allocation ledger.
 * @param controls - Private registry operations and shared synchronous call stack.
 * @param abi - Authenticated copied-payload callback descriptor.
 */
export const createComponentStructuredCallableProtocol = (module, controls, abi) => {
	assertComponentStructuredCallableAbi(abi);
	if(["abi", "frame_validate", "frame_clear", "receipt_count", "receipt_data"].some(name => typeof module[`_bridge_recursive_${name}`] !== "function")
		|| module._bridge_recursive_abi() !== 1) throw new TypeError("Shared runtime lacks the component recursive callable ABI");
	const types = new Map(abi.callbacks.map(signature => [signature.id, signature]));
	const identity = type => type.kind === "named" && types.has(type.id);
	const codecs = new Map([...abi.exports, ...abi.callbacks].map(signature => [signature
		, [...signature.parameters, signature.result].map(root => compileComponentRecursiveCodec({
			schemaVersion: 1
			, root: identity(root) ? uint32 : root
			, types: abi.types }))]));
	const view = () => new DataView(module.HEAP8.buffer);
	const protectedNative = operation => {
		try
		{ return operation(); }
		catch(error)
		{ if(!budgetFailure(error)) controls.poison(); throw error; }
	};
	const header = (frame, count) => {
		const bytes = scalarFrameHeaderBytes + scalarSlotBytes * count;
		if(!Number.isInteger(frame) || frame <= 0 || frame % 8 || frame + bytes > module.HEAP8.length
			|| view().getUint32(frame, true) !== componentRecursiveAbi || view().getUint32(frame + 4, true) !== bytes
			|| view().getUint32(frame + 12, true) !== count) throw new TypeError("Invalid structured callable frame");
		return bytes;
	};
	const inputSpans = () => controls.frames.flatMap(scope => scope.spans);
	const emptyResult = frame => !view().getUint32(frame + 16, true) && !view().getUint32(frame + 20, true)
		&& view().getBigUint64(frame + 24, true) === 0n;
	const call = (operation, signature, args) => {
		controls.requireOpen();
		if(!Array.isArray(args) || args.length !== signature.parameters.length) throw new TypeError(`Expected ${signature.parameters.length} arguments`);
		if(controls.frames.length >= componentCallableDepth) throw new RangeError("Component callable reentry limit (64) exceeded");
		const scope = { failed: false, error: undefined, budget: createComponentRecursiveBudget(), callbacks: [], allocations: [], spans: [] };
		const allocate = size => {
			controls.requireOpen();
			if(!Number.isSafeInteger(size) || size < 0 || size > scalarCopyLimit) throw new RangeError("Component copy budget exceeded");
			let pointer;
			try
			{ pointer = module._malloc(Math.max(1, size)); }
			catch(error)
			{ controls.poison(); throw error; }
			if(!pointer) throw new Error("Component allocation failed");
			if(!Number.isInteger(pointer) || pointer < 0 || pointer % 8 || pointer + Math.max(1, size) > module.HEAP8.length)
			{ controls.poison(); throw new Error("Invalid component allocation"); }
			scope.allocations.push(pointer); scope.spans.push({ pointer, bytes: Math.max(1, size) });
			return pointer;
		};
		scope.allocate = allocate;
		let frame = 0, pendingLease = 0, failing = false;
		const cleanup = () => {
			if(controls.isPoisoned()) return;
			try
			{
				if(pendingLease) controls.releaseUnreturned(pendingLease, types.get(signature.result.id));
				if(frame) module._bridge_recursive_frame_clear(frame);
				for(const pointer of scope.allocations.reverse()) module._free(pointer);
			}
			catch(error)
			{ controls.poison(); if(!failing) throw error; }
		};
		controls.frames.push(scope);
		const payloads = codecs.get(signature);
		try
		{
			const size = scalarFrameHeaderBytes + scalarSlotBytes * args.length;
			frame = allocate(size); module.HEAP8.fill(0, frame, frame + size);
			view().setUint32(frame, componentRecursiveAbi, true); view().setUint32(frame + 4, size, true); view().setUint32(frame + 12, args.length, true);
			for(const [index, type] of signature.parameters.entries())
			{
				const value = identity(type) ? controls.register(args[index], types.get(type.id), scope, protocol) : args[index];
				payloads[index].write(module, frame + scalarFrameHeaderBytes + index * scalarSlotBytes, value, allocate, scope.budget);
			}
			controls.requireOpen();
			let status;
			try
			{ status = operation(frame); }
			catch(error)
			{ controls.poison(); throw error; }
			controls.requireOpen();
			protectedNative(() => {
				header(frame, args.length);
				if(!Number.isInteger(status) || view().getUint32(frame + 8, true) !== status) throw new TypeError("Invalid structured callable result status");
			});
			if(status)
			{
				if(![4, 5, 9].includes(status) || !emptyResult(frame)) controls.poison();
				throw failure(status);
			}
			if(identity(signature.result)) pendingLease = protectedNative(() => readComponentScalarSlot(module, frame + 16, "uint32"));
			const result = protectedNative(() => {
				const receipt = recursiveOutputReceipt(module, frame, inputSpans());
				const value = payloads.at(-1).readOwned(module, frame + 16, scope.budget, receipt.claim);
				receipt.finish(); return value;
			});
			if(identity(signature.result)) pendingLease = result;
			if(scope.failed) throw scope.error;
			if(identity(signature.result))
			{
				pendingLease = 0;
				return controls.owned(result, types.get(signature.result.id), protocol);
			}
			return result;
		}
		catch(error)
		{ failing = true; if(scope.failed) throw scope.error; throw error; }
		finally
		{
			for(const token of scope.callbacks) controls.callbacks.delete(token);
			controls.frames.pop();
			cleanup();
		}
	};
	const dispatch = (callback, current, frame) => {
		const { signature } = callback, payloads = codecs.get(signature);
		const size = protectedNative(() => header(frame, signature.parameters.length));
		const status = view().getUint32(frame + 8, true);
		if(status)
		{
			// Encoding and reply-validation failures report a status without a
			// second host invocation. Partial native arguments need only ledger cleanup.
			if(![4, 5].includes(status)) controls.poison();
			throw failure(status);
		}
		const args = protectedNative(() => {
			if(module._bridge_recursive_frame_validate(frame, signature.parameters.length)) throw new TypeError("Invalid structured callback frame");
			const receipt = recursiveOutputReceipt(module, frame, [...inputSpans(), { pointer: frame, bytes: size }]);
			const args = signature.parameters.map((_, index) => payloads[index].readOwned(module,
				frame + scalarFrameHeaderBytes + index * scalarSlotBytes, current.budget, receipt.claim));
			receipt.finish(); return args;
		});
		const result = Reflect.apply(callback.value, undefined, args);
		controls.requireOpen();
		if(current.failed || callback.scope.failed) return 8;
		// Reply allocations stay with the enclosing call even when conversion is
		// interrupted. Native cleanup never interprets them as its own allocations.
		payloads.at(-1).write(module, frame + 16, result, current.allocate, current.budget);
		return 0;
	};
	const protocol = Object.freeze({ call, dispatch });
	return protocol;
};
