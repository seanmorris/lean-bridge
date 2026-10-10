/**
 * Authenticate result spans against the native call's allocation receipt.
 * Result values cannot nominate arbitrary pointers for cleanup or reuse a
 * buffer twice. Cleanup itself uses the native ledger, never the result tree.
 *
 * @file
 */
import { componentRecursiveLimits } from "../abi/component-recursive.mjs";
import { scalarCopyLimit } from "../abi/component-scalars.mjs";

/**
 * Snapshot and check all native-owned result allocations before copying values.
 *
 * @param module - Shared Wasm module exposing the native receipt API.
 * @param frame - Owning call frame, independently allocated by the runtime.
 * @param inputs - Runtime-owned input spans, including the frame itself.
 */
export const recursiveOutputReceipt = (module, frame, inputs) => {
	const fail = () => { throw new TypeError("Invalid recursive output allocation receipt"); };
	const count = module._bridge_recursive_receipt_count(frame);
	const table = module._bridge_recursive_receipt_data(frame);
	const span = (pointer, bytes, alignment = 1) => {
		if(!Number.isSafeInteger(pointer) || pointer <= 0 || !Number.isSafeInteger(bytes) || bytes <= 0
			|| pointer % alignment || pointer + bytes > module.HEAP8.length) fail();
		return { start: pointer, end: pointer + bytes };
	};
	if(!Number.isInteger(count) || count < 0 || count > componentRecursiveLimits.valueNodes || (!count && table)) fail();
	const spans = inputs.map(({ pointer, bytes }) => span(pointer, bytes, 8));
	if(count) spans.push(span(table, count * 8, 4));
	const allocations = new Map(), data = new DataView(module.HEAP8.buffer);
	let total = 0;
	for(let index = 0; index < count; index++)
	{
		const pointer = data.getUint32(table + index * 8, true), bytes = data.getUint32(table + index * 8 + 4, true);
		if(bytes > scalarCopyLimit || allocations.has(pointer)) fail();
		// Empty scalar payloads have a physical byte although their logical copy
		// budget is zero. Bound that overhead by the independent node allowance.
		total += bytes;
		if(total > scalarCopyLimit + componentRecursiveLimits.valueNodes) fail();
		spans.push(span(pointer, bytes)); allocations.set(pointer, bytes);
	}
	spans.sort((left, right) => left.start - right.start);
	for(let index = 1; index < spans.length; index++) if(spans[index].start < spans[index - 1].end) fail();
	return Object.freeze({
		claim: (pointer, bytes) => {
			if(!Number.isSafeInteger(bytes) || bytes < 0 || allocations.get(pointer) !== Math.max(1, bytes)) fail();
			allocations.delete(pointer);
		}
		, finish: () => { if(allocations.size) fail(); }
	});
};
