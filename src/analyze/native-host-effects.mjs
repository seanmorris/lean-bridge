/**
 * Classify the native leaves of pinned Lean 4.32.2 compiler IR on the canonical
 * native host-export route. A new primitive needs review, not a naming heuristic.
 * This is a build-time contract, not a sandbox for the compiler or caller.
 *
 * @file
 */
export const nativeEffectPolicy = "native-host-io-v1";
const ambient = {
	filesystem: "Read or change files, directories, or their metadata."
	, environment: "Read environment variables."
	, stdio: "Use the application's standard streams."
	, clock: "Read a system or monotonic clock."
	, random: "Request random bytes from the operating system."
	, "process-info": "Read process or host information."
};
export const nativeEffects = Object.freeze(Object.keys(ambient).sort());
const fail = message => { throw Object.assign(new TypeError(`Native effect policy: ${message}`), { code: "native-effect-policy" }); };
const catalog = new Map();
// A synchronous pthread-to-JavaScript proxy needs the heap owner to service it.
// The audit records transitive leaves, not which agent eventually runs them;
// refuse explicit waits even when the author expects them to run on a worker.
const ownerBlocking = new Set(["lean_task_get_own", "lean_io_wait"
	, "lean_io_wait_any", "lean_dbg_sleep", "lean_io_condvar_wait"
	, "lean_io_basemutex_lock", "lean_io_baserecmutex_lock"
	, "lean_io_basesharedmutex_read", "lean_io_basesharedmutex_write"]);
// Lean 4.32.2: runtime/object.cpp dispatches this constructor to
// Init/Data/List/ToArrayImpl.lean (allocate, then push each element).
// Authenticate both ends of the shim; a similar symbol is not a grant.
// runtime/platform.cpp returns 32 or 64 from sizeof(void*), not a host OS query.
const exactInMemory = new Map([
	["lean_array_mk", ["Init.Prelude", "Array.mk"]]
	, ["lean_system_platform_nbits", ["Init.Prelude", "System.Platform.getNumBits"]]
]);
const group = (capability, prefix, words) => {
	for(const w of words.trim().split(/\s+/u))
	{
		const symbol = prefix + w;
		if(catalog.has(symbol) || exactInMemory.has(symbol)) throw new Error("Duplicate native effect classification: " + symbol);
		catalog.set(symbol, capability);
	}
};
group("filesystem", "lean_io_", "metadata symlink_metadata read_dir realpath remove_file remove_dir create_dir create_tempdir create_tempfile rename hard_link");
group("filesystem", "lean_io_prim_handle_", "mk read write flush get_line is_tty lock try_lock unlock put_str rewind truncate");
group("filesystem", "lean_", "chmod");
group("environment", "lean_io_", "getenv");
group("stdio", "lean_get_", "stdin stdout stderr");
group("stdio", "lean_dbg_", "trace trace_if_shared stack_trace");
group("clock", "lean_", "io_mono_ms_now io_mono_nanos_now get_current_time");
group("random", "lean_io_", "get_random_bytes");
group("process-info", "lean_", "io_app_path io_current_dir io_process_get_current_dir io_process_get_pid io_get_tid internal_get_hardware_concurrency");

// Memory, copied carriers and the in-process scheduler don't grant ambient OS access.
group(null, "lean_", "dbg_sleep mk_empty_array_with_capacity mk_empty_byte_array mk_empty_float_array");
group(null, "lean_task_", "pure bind get_own map spawn");
group(null, "lean_st_", "mk_ref ref_get ref_set ref_swap ref_take ref_ptr_eq");
group(null, "lean_io_", "as_task bind_task map_task cancel check_canceled get_task_state wait wait_any promise_new promise_resolve promise_result_opt");
for(const m of ["basemutex", "baserecmutex"]) group(null, `lean_io_${m}_`, "lock new try_lock unlock");
group(null, "lean_io_basesharedmutex_", "new read write try_read try_write unlock_read unlock_write");
group(null, "lean_io_condvar_", "new notify_all notify_one wait");
group(null, "lean_nat_", "abs add sub mul div div_exact mod gcd dec_eq dec_le dec_lt land lor lxor pow pred shiftl shiftr to_int");
group(null, "lean_int_", "add sub mul div div_exact mod ediv emod neg dec_eq dec_le dec_lt dec_nonneg");
for(const type of ["uint8", "uint16", "uint32", "uint64", "usize", "int8", "int16", "int32", "int64", "isize"])
{
	group(null, `lean_${type}_`, "add sub mul div mod neg abs complement dec_eq dec_le dec_lt land lor xor log2 shift_left shift_right of_nat of_int to_nat to_int to_float to_float32");
	group(null, `lean_${type}_`, "to_uint8 to_uint16 to_uint32 to_uint64 to_usize to_int8 to_int16 to_int32 to_int64 to_isize");
}
for(const type of ["float", "float32"])
	group(null, `lean_${type}_`, "add sub mul div beq decLe decLt frexp isfinite isinf isnan negate of_bits scaleb to_bits to_float to_float32 to_int8 to_int16 to_int32 to_int64 to_isize to_uint8 to_uint16 to_uint32 to_uint64 to_usize to_string");
group(null, "lean_array_", "fget fget_borrowed fset fswap get get_borrowed get_size pop push set size swap uget uget_borrowed uset");
group(null, "lean_byte_array_", "copy_slice data fget fset get hash mk push set size uget uset");
group(null, "lean_float_array_", "fget fset get push set size uget uset");
group(null, "lean_string_", `any append capitalize compare contains data dec_eq dec_lt drop dropright foldl front
	get_byte_fast hash intercalate is_valid_pos isempty isprefixof length memcmp mk nextwhile of_usize offsetofpos
	pos_min pos_sub posof push pushn to_utf8 trim utf8_at_end utf8_byte_size utf8_extract utf8_get utf8_get_bang
	utf8_get_fast utf8_get_opt utf8_next utf8_next_fast utf8_prev utf8_set validate_utf8 from_utf8_unchecked`);
const id = cap => `capability:native.${cap}`;
const distinct = rows => [...new Set(rows)].sort();
const strings = v => Array.isArray(v) && v.every(x => typeof x === "string") && new Set(v).size === v.length;

/**
 * Is this exact selection backed by the heap's JavaScript owner dispatcher?
 *
 * @param selection - Captured target and private compiler request, not an author grant.
 */
export const hasJavaScriptHostOwner=selection=>selection.javascriptThreadedHostMembers===true
	&& selection.hostModule==="LeanBridge.Host.Javascript" && Boolean(selection.taskExports?.length || selection.asyncIterators?.length);

/**
 * Bind the compiler's root/leaf records to the exact public selection and generated provider.
 *
 * @param selection - Captured entry points, protocol members, modules and author grants.
 * @param audit - Fresh records produced from compiled Lean interfaces.
 * @param hostSymbols - Exact names and foreign symbols from the selected generated provider.
 */
export const resolveNativeHostEffects = (selection, audit, hostSymbols = new Map()) => {
	const allowed = selection.nativeEffects;
	if(selection.nativeEffectPolicy !== nativeEffectPolicy || audit?.policy !== nativeEffectPolicy
		|| !strings(allowed) || allowed.some(k => !nativeEffects.includes(k))
		|| !strings(selection.modules) || !strings(selection.members) || !strings(selection.exports)
		|| !Array.isArray(selection.asyncIterators) || !strings(audit.initializers) || !Array.isArray(audit.roots)) fail("missing or invalid compiler audit");
	const roots = distinct([...audit.initializers, ...selection.exports, ...selection.asyncIterators.flatMap(p => [p.next, p.close])]);
	const asyncRoots = new Set([...(selection.taskExports ?? []), ...selection.asyncIterators.flatMap(p => [p.open, p.next, p.close])]);
	const names = audit.roots.map(r => r?.declaration);
	if(!strings(names) || names.length !== roots.length || roots.some(k => !names.includes(k))) fail("compiled roots do not match the export, startup and pull selection");
	const workerOwner=hasJavaScriptHostOwner(selection);
	const staticOwners = { c: "C", cpp: "C++", rust: "Rust", "wit-wasi": "WIT/WASI" };
	const localOwner=Object.hasOwn(staticOwners,selection.staticTaskOwner)?staticOwners[selection.staticTaskOwner]:selection.perlTaskObjects===true?"Perl":selection.jvmTaskObjects===true?"JVM":selection.dotnetTaskObjects===true?"CLR":selection.pythonTaskObjects===true?"Python":selection.rubyTaskObjects===true?"Ruby":null;
	const byRoot = new Map(), compiledMembers=workerOwner || ["LeanBridge.Host.C","LeanBridge.Host.Cpp","LeanBridge.Host.Rust","LeanBridge.Host.WitWasi","LeanBridge.Host.Php"].includes(selection.hostModule) || localOwner?new Map():null;
	const violations = new Set();
	for(const { declaration, leaves } of audit.roots)
	{
		if(!Array.isArray(leaves) || !strings(leaves.map(l => l?.name))) fail(`invalid compiler leaves for ${declaration}`);
		const found = new Set(), host=compiledMembers?[]:null;
		for(const { name, module, symbol } of leaves)
		{
			if(typeof module !== "string" || typeof symbol !== "string" || !symbol) fail(`unidentified native leaf in ${declaration}`);
			if(module === (selection.hostModule ?? "LeanBridge.Host.Python") && selection.members.includes(name) && hostSymbols.get(name) === symbol)
			{
				if(audit.initializers.includes(declaration)) violations.add(`initializer ${declaration} reaches host member ${name} before it is bound`);
				if(asyncRoots.has(declaration) && !workerOwner) violations.add(`async entry ${declaration} reaches host member ${name} outside its owner`);
				host?.push(name);
				continue;
			}
			const exact = exactInMemory.get(symbol);
			if(selection.modules.includes(module) || !/^(?:Init|Std)(?:\.|$)/u.test(module)
				|| (exact ? module !== exact[0] || name !== exact[1] : !catalog.has(symbol))){
				violations.add(`${declaration} reaches unclassified native operation ${name} (${module}: ${symbol}); it cannot be granted`);
				continue;
				}
			const cap = exact ? null : catalog.get(symbol);
			if((workerOwner || selection.phpWasmTaskObjects===true || localOwner) && ownerBlocking.has(symbol))
				violations.add(`${declaration} reaches ${name} (${symbol}), which can block the ${workerOwner?"JavaScript":localOwner??"PHP-Wasm"} host owner; return or compose the task without waiting synchronously`);
			if(cap === null) continue;
			if(!allowed.includes(cap)) violations.add(`${declaration} requires nativeEffects "${cap}" via ${name} (${symbol})`);
			found.add(cap);
		}
		byRoot.set(declaration, [...found].sort());
		if(host) compiledMembers.set(declaration,host.sort());
	}
	// Collect every policy violation from this intact compiler audit before
	// rejecting it. Never emit a partial capability list or package.
	if(violations.size) fail([...violations].sort().join("\n"));
	const startup = distinct(audit.initializers.flatMap(n => byRoot.get(n)));
	const phases = new Map();
	for(const name of selection.exports)
	{
		const p = selection.asyncIterators.find(p => p.open === name);
		const rows = { startup, call: byRoot.get(name), ...(p ? { pull: byRoot.get(p.next), close: byRoot.get(p.close) } : {}) };
		phases.set(name, Object.fromEntries(Object.entries(rows).filter(([, caps]) => caps.length).map(([phase, caps]) => [phase, caps.map(id)])));
	}
	const capabilities = distinct([...byRoot.values()].flat()).map(cap => ({ id: id(cap)
		, category: "runtime"
		, requirement: "required"
		, documentation: { summary: ambient[cap], details: "" } }));
	return { capabilities, phases, ...(compiledMembers?{compiledMembers}:{}) };
};
