/**
 * Call arenas for the compiled copied-array ABI. No Wasm views escape a call.
 *
 * @file
 */
import { scalarCopyLimit, scalarFrameHeaderBytes, scalarSlotBytes } from "../abi/component-scalars.mjs";
import { componentCopiedAbi, componentArrayShape, createComponentCopyBudget } from "../abi/component-copied.mjs";
import { compileComponentCopiedCodec } from "./component-copied-codec.mjs";

/**
 * Compile a call's codecs once, sharing input/result limits and runtime poison.
 *
 * @param module - Shared Emscripten runtime.
 * @param operation - Generated typed C adapter.
 * @param signature - Authenticated copied-array signature.
 * @param poison - Retire the shared runtime after a trap or malformed output.
 */
export const compileComponentCopiedCall = (module, operation, signature, poison) => {
	const types = [...signature.parameters, signature.result];
	for(const type of types) componentArrayShape(type);
	const codecs = types.map(compileComponentCopiedCodec);
	return args => {
		if(args.length !== signature.parameters.length) throw new TypeError(`Expected ${signature.parameters.length} arguments`);
		const allocations = [], budget = createComponentCopyBudget();
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
			if(pointer % 8 || pointer + size > module.HEAP8.length)
			{ unsafe = true; poison(); throw new Error("Invalid component allocation"); }
			return pointer;
		};
		const view = () => new DataView(module.HEAP8.buffer);
		const release = () => {
			try
			{
				if(frame) module._bridge_copied_frame_clear(frame);
				for(const pointer of allocations.reverse()) module._free(pointer);
			} catch(error)
			{ poison(); throw error; }
		};
		try
		{
			const size = scalarFrameHeaderBytes + scalarSlotBytes * args.length;
			frame = allocate(size);
			module.HEAP8.fill(0, frame, frame + size);
			view().setUint32(frame, componentCopiedAbi, true);
			view().setUint32(frame + 4, size, true);
			view().setUint32(frame + 12, args.length, true);
			args.forEach((value, index) => codecs[index].write(module, frame + scalarFrameHeaderBytes + index * scalarSlotBytes, value, allocate, budget));
			let status;
			try
			{ status = operation(frame); }
			catch(error)
			{ unsafe = true; poison(); throw error; }
			if(view().getUint32(frame, true) !== componentCopiedAbi || view().getUint32(frame + 4, true) !== size
				|| view().getUint32(frame + 12, true) !== args.length || view().getUint32(frame + 8, true) !== status){ unsafe = true; poison(); throw new Error("Invalid component copied frame result"); }
			if(status)
			{
				// These failures leave no native result. All other statuses indicate a
				// broken adapter, invalid output, or runtime state and retire the heap.
				if(![4, 5].includes(status) || view().getUint32(frame + 16, true) || view().getUint32(frame + 20, true) || view().getBigUint64(frame + 24, true))
				{ unsafe = true; poison(); }
				throw status === 4 ? new RangeError("Component copy budget exceeded") : new Error(`Component copied call failed (${status})`);
			}
			try
			{ return codecs.at(-1).read(module, frame + 16, budget); }
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
