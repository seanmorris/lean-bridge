/**
 * Call arenas for compiled copied-value ABIs. No Wasm views escape a call.
 *
 * @file
 */
import { scalarCopyLimit, scalarFrameHeaderBytes, scalarSlotBytes } from "../abi/component-scalars.mjs";
import { componentCopiedAbi, componentArrayShape, createComponentCopyBudget } from "../abi/component-copied.mjs";
import { compileComponentCopiedCodec } from "./component-copied-codec.mjs";
import { componentRecordAbi, componentCompoundAbi, componentNominalAbi, resolveComponentRecordType } from "../abi/component-records.mjs";
import { componentRecursiveAbi } from "../abi/component-recursive-abi.mjs";
import { createComponentRecursiveBudget } from "../abi/component-recursive.mjs";
import { compileComponentRecursiveCodec } from "./component-recursive-codec.mjs";
import { recursiveOutputReceipt } from "./component-recursive-ownership.mjs";

const diagnosticKind = 0xffffffff;
const diagnosticLimit = 16 * 1024;
const diagnosticDecoder = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true });

const failureDiagnostic = (module, frame) => {
	const data = new DataView(module.HEAP8.buffer);
	const kind = data.getUint32(frame + 16, true);
	const flags = data.getUint32(frame + 20, true);
	const bits = data.getBigUint64(frame + 24, true);
	if(!kind && !flags && bits === 0n) return null;
	const pointer = Number(bits & 0xffffffffn), length = Number(bits >> 32n);
	if(kind !== diagnosticKind || flags || !pointer || !length || length > diagnosticLimit
		|| pointer + length > module.HEAP8.length)
		throw new TypeError("Invalid component copied failure diagnostic");
	let message;
	try
	{ message = diagnosticDecoder.decode(module.HEAP8.subarray(pointer, pointer + length)); }
	catch
	{ throw new TypeError("Invalid component copied failure diagnostic"); }
	if(message.includes("\0")) throw new TypeError("Invalid component copied failure diagnostic");
	return message;
};

/**
 * Compile a call's codecs once, sharing input/result limits and runtime poison.
 *
 * @param module - Shared Emscripten runtime.
 * @param operation - Generated typed C adapter.
 * @param signature - Authenticated copied-value signature.
 * @param poison - Retire the shared runtime after a trap or malformed output.
 * @param version - Validated wire ABI version.
 * @param records - Authenticated named definitions for copied ABIs five through eight.
 */
export const compileComponentCopiedCall = (module, operation, signature, poison, version = componentCopiedAbi, records = []) => {
	const types = [...signature.parameters, signature.result];
	const recursive = version === componentRecursiveAbi;
	if(![componentCopiedAbi, componentRecordAbi, componentCompoundAbi, componentNominalAbi, componentRecursiveAbi].includes(version)) throw new TypeError("Invalid copied call ABI");
	if(version === componentCopiedAbi) for(const type of types) componentArrayShape(type);
	const codecs = recursive ? types.map(root => compileComponentRecursiveCodec({ schemaVersion: 1, root, types: records }))
		: types.map(type => compileComponentCopiedCodec(version === componentCopiedAbi ? type : resolveComponentRecordType(type, records, [componentCompoundAbi, componentNominalAbi].includes(version), version === componentNominalAbi)));
	return args => {
		if(args.length !== signature.parameters.length) throw new TypeError(`Expected ${signature.parameters.length} arguments`);
		const allocations = [], spans = [], budget = recursive ? createComponentRecursiveBudget() : createComponentCopyBudget();
		let frame = 0, unsafe = false;
		const allocate = size => {
			if(!Number.isSafeInteger(size) || size < 0 || size > scalarCopyLimit) throw new RangeError("Component copy budget exceeded");
			let pointer;
			try
			{ pointer = module._malloc(Math.max(1, size)); }
			catch(error)
			{ unsafe = true; poison(); throw error; }
			if(!pointer) throw new Error("Component allocation failed");
			allocations.push(pointer);
			if(recursive) spans.push({ pointer, bytes: Math.max(1, size) });
			if(pointer % 8 || pointer + size > module.HEAP8.length)
			{ unsafe = true; poison(); throw new Error("Invalid component allocation"); }
			return pointer;
		};
		const view = () => new DataView(module.HEAP8.buffer);
		const release = () => {
			try
			{
				if(frame) (recursive ? module._bridge_recursive_frame_clear : module._bridge_copied_frame_clear)(frame);
				for(const pointer of allocations.reverse()) module._free(pointer);
			} catch(error)
			{ poison(); throw error; }
		};
		try
		{
			const size = scalarFrameHeaderBytes + scalarSlotBytes * args.length;
			frame = allocate(size);
			module.HEAP8.fill(0, frame, frame + size);
			view().setUint32(frame, version, true);
			view().setUint32(frame + 4, size, true);
			view().setUint32(frame + 12, args.length, true);
			args.forEach((value, index) => codecs[index].write(module, frame + scalarFrameHeaderBytes + index * scalarSlotBytes, value, allocate, budget));
			let status;
			try
			{ status = operation(frame); }
			catch(error)
			{ unsafe = true; poison(); throw error; }
			if(view().getUint32(frame, true) !== version || view().getUint32(frame + 4, true) !== size
				|| view().getUint32(frame + 12, true) !== args.length || view().getUint32(frame + 8, true) !== status){ unsafe = true; poison(); throw new Error("Invalid component copied frame result"); }
			if(status)
			{
				let diagnostic;
				try
				{ diagnostic = failureDiagnostic(module, frame); }
				catch(error)
				{ unsafe = true; poison(); throw error; }
				// Budget failures and legacy conversion failures leave no result.
				// Recursive checked adapters may instead return one borrowed, bounded
				// UTF-8 diagnostic. Every other status/result combination retires the heap.
				if(![4, 5].includes(status) || diagnostic !== null && (status !== 5 || !recursive))
				{
					unsafe = true; poison();
					throw new Error("Invalid component copied frame result");
				}
				throw status === 4 ? new RangeError("Component copy budget exceeded")
					: new Error(diagnostic ?? `Component copied call failed (${status})`);
			}
			try
			{
				if(!recursive) return codecs.at(-1).read(module, frame + 16, budget);
				const receipt = recursiveOutputReceipt(module, frame, spans);
				const result = codecs.at(-1).readOwned(module, frame + 16, budget, receipt.claim);
				receipt.finish(); return result;
			}
			catch(error)
			{ unsafe = true; poison(); throw error; }
		} finally
		{
			// A trapped or corrupt heap is never traversed for cleanup. It remains
			// poisoned across all components sharing this runtime.
			if(!unsafe) release();
		}
	};
};
