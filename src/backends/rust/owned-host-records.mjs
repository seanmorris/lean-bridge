/** @file Render call-scoped Rust callback descriptors and their containing input records. */

/**
 * The context and optional recovery value live until after the native return.
 *
 * @param o - Callback layout, call-local Rust expression, generic type and unique suffix.
 * @param o.node - Callback type projection.
 * @param o.callback - Native callback operation.
 * @param o.result - Rust projection of the callback result.
 * @param o.suffix - Unique suffix for locals in this call.
 * @param o.argument - Rust expression borrowing the application's callback.
 * @param o.generic - Generic parameter implementing this callback signature.
 * @param o.field - Put a record field's context in fallibly allocated storage.
 */
export const ownedRustCallbackView = ({node, callback, result, suffix: i, argument, generic, field = false}) => {
	const ctx = `OwnedContext${node.index}`, context = `${ctx} { function: std::cell::RefCell::new(&mut ${argument}), call: &call }`;
	return [`    let closure${i} = ${argument}.closure().map(|value| value.raw(&state)).transpose()?;`
		, `    let recovery${i} = if closure${i}.is_none() { ${argument}.recovery().cloned() } else { None };`
		, `    let recovery_view${i} = recovery${i}.as_ref().map(|value| owned_to${result.index}(${callback.anchor !== undefined ? "value.owned_reply()?" : "value"}, &mut scope, &state)).transpose()?;`
		, ...field ? [`    let mut context${i} = scope.vector::<${ctx}<'_, ${generic}>>(1)?;`
			, `    context${i}.push(${context});`] : [`    let mut context${i} = ${context};`]
		, `    let view${i} = OwnedHost${node.index} {`
		, `        call: if closure${i}.is_none() { Some(owned_callback${node.index}::<${generic}>) } else { None },`
		, `        context: if closure${i}.is_none() { ${field ? `context${i}.as_mut_ptr()` : `(&mut context${i} as *mut ${ctx}<'_, ${generic}>)`}.cast() } else { std::ptr::null_mut() },`
		, `        closure: closure${i}.unwrap_or(std::ptr::null_mut()), recovery: recovery_view${i}.as_ref().map_or(std::ptr::null(), |value| value),`
		, "    };"];
};

/**
 * Render the alternate C layout, without changing any returned record.
 *
 * @param nodes - Rust projections indexed by interface type.
 */
export const ownedRustRawRecords = nodes => [...nodes.values()].filter(n => n.hostInput).flatMap(n =>
	["#[repr(C)]", `struct OwnedRawHostRecord${n.index} {`
		, ...n.hostInput.fields.map(f => {
			const child = nodes.get(f.type);
			return `    field${f.index}: ${f.pointer ? "*const " : ""}${f.host ? "OwnedHost" + child.index : child.raw},`;
		})
		, "}"]);

/**
 * Preflight the complete record before creating its call-scoped views.
 *
 * @param o - Input record projection.
 * @param o.node - Public Rust record and field metadata.
 * @param o.index - Position in the exported function's argument list.
 * @param o.nodes - All child type projections.
 * @param o.callbacks - Available native callback operations.
 */
export const ownedRustRecordView = ({node, index: i, nodes, callbacks}) => {
	const key = f => `OwnedCallbackP${i}Field${f.index}`, raw = `OwnedRawHostRecord${node.index}`;
	const args = node.hostInput.lifetime ? ["'_"] : [], generic = [];
	const check = ["    budget.enter(0)?;", `    budget.native(1, std::mem::size_of::<${raw}>())?;`];
	// Reserve aligned storage without building a second, possibly wide, raw
	// record on the stack. No pointer is passed to C until every field is set.
	const make = [`    let mut storage${i} = scope.vector::<std::mem::MaybeUninit<${raw}>>(1)?;`
		, `    let view${i} = storage${i}.as_mut_ptr().cast::<${raw}>();`];
	for(const f of node.hostInput.fields)
	{
		const child = nodes.get(f.type), argument = `a${i}.${f.publicName}`, suffix = `${i}_${f.index}`;
		let value;
		if(f.host)
		{
			const name = key(f), callback = callbacks.find(item => item.id === child.id);
			generic.push(`${name}: OwnedCallback${child.index}`); args.push(name);
			check.push(`    owned_check_callback${child.index}(&${argument}, &mut budget, &state)?;`);
			make.push(...ownedRustCallbackView({node: child, callback, result: nodes.get(callback.result), suffix, argument, generic: name, field: true}));
			value = `view${suffix}`;
		}
		else
		{
			const arg = (f.borrowed ? "" : "&") + argument;
			check.push(`    owned_check${child.index}(${arg}, 1, &mut budget, &state)?;`);
			make.push(`    let field${suffix} = owned_to${child.index}(${arg}, &mut scope, &state)?;`);
			value = "field" + suffix;
		}
		make.push(`    unsafe { std::ptr::addr_of_mut!((*view${i}).field${f.index}).write(${f.pointer ? `scope.one(${value})?` : value}); }`);
	}
	return {check, make, generic, argType: `&mut ${node.hostInput.name}<${args.join(", ")}>`};
};
