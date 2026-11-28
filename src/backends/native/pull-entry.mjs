/**
 * Generate monomorphic, host-independent Lean adapters for an authenticated pull protocol.
 *
 * @file
 */
export const streamEntryLean = `structure PullHandle (α : Type) where
  next : Unit → BaseIO (Task α)
  close : Unit → BaseIO Unit`;

export const iteratorEntryLean = `structure ImmediateHandle (α : Type) where
  next : Unit → BaseIO α
  close : Unit → BaseIO Unit`;

/**
 * Lower a private cursor to closures. BaseIO returns a bare value at the C ABI.
 * Expose explicit IO wrappers whose signatures can be checked beside Lean's emitted C.
 *
 * @param i - Local declaration index.
 * @param prefix - Private C symbol prefix.
 * @param entry - Elaborated factory, effect and pull/close names.
 * @param element - Concrete Lean element type.
 * @param startError - Concrete typed factory error, if present.
 * @param stepError - Concrete typed pull error, if present.
 */
export const nativePullEntry = (i, prefix, entry, element, startError, stepError) => {
	const option = `(_root_.Option ${element})`;
	const step = stepError ? `(_root_.Except ${stepError} ${option})` : option;
	const immediate = entry.delivery === "iterator", ctor=immediate?"ImmediateHandle":"PullHandle";
	const handle = `(${ctor} ${step})`;
	const next = `${prefix}_pull_next_${i}`, close = `${prefix}_pull_close_${i}`;
	return {
		lean: startError ? `(_root_.Except ${startError} ${handle})` : handle
		, helpers: `@[export ${next}] def pullNext${i} (h : ${handle}) : IO ${immediate?step:"(Task "+step+")"} := liftM (h.next ())
@[export ${close}] def pullClose${i} (h : ${handle}) : IO Unit := liftM (h.close ())`
		, application: expr => {
			const expression = `_root_.${entry.protocol.next} cursor`;
			const pull = immediate && entry.stepEffect!=="BaseIO" ? "("+expression+").toBaseIO" : expression;
			const wrap = `(fun cursor => ${ctor}.mk (fun _ => ${pull}) (fun _ => _root_.${entry.protocol.close} cursor))`;
			return entry.effect === "pure" ? `(${wrap} ${expr})` : `(${wrap} <$> ${expr})`;
		}
		, declarations: `extern lean_object *${next}(lean_object *);\nextern lean_object *${close}(lean_object *);`
		, next, close
	};
};
