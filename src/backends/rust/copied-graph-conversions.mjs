/**
 * Private Rust layouts and bounded conversions for authenticated native graphs.
 * Guarded calls coordinate initialization, retirement and result publication.
 * Loading and public package admission remain caller policy.
 *
 * @file
 */
import { componentRecursiveLimits } from "../../abi/component-recursive.mjs";
import { generateCopiedRustGraphValues } from "./copied-graph-values.mjs";

const primitives = {
	unit: "u8"
	, bool: "u8"
	, char: "u32"
	, usize: "u64"
	, isize: "i64"
	, float32: "f32"
	, float64: "f64"
	, uint8: "u8"
	, uint16: "u16"
	, uint32: "u32"
	, uint64: "u64"
	, int8: "i8"
	, int16: "i16"
	, int32: "i32"
	, int64: "i64"
};
const support = `use crate::*;
const _: () = assert!(std::mem::size_of::<usize>() == 8);
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(crate) enum GraphError { InvalidInput, Limit, Allocation, InvalidNative, Unavailable }
#[cfg(test)]
thread_local! {
    static GRAPH_FAULT: std::cell::Cell<(usize, usize, bool)> = const { std::cell::Cell::new((0, 0, false)) };
    static GRAPH_LIVE: std::cell::Cell<usize> = const { std::cell::Cell::new(0) };
}
fn graph_checkpoint() -> Result<(), GraphError> {
    #[cfg(test)]
    GRAPH_FAULT.with(|state| {
        let (target, current, panic) = state.get(); state.set((target, current + 1, panic));
        if target != 0 && target == current + 1 {
            assert!(!panic, "injected graph conversion panic"); return Err(GraphError::Allocation);
        }
        Ok(())
    })?;
    Ok(())
}
struct GraphBudget { nodes: usize, native: usize, storage: usize }
impl GraphBudget {
    fn new() -> Self { Self { nodes: ${componentRecursiveLimits.valueNodes}, native: 16 * 1024 * 1024, storage: 16 * 1024 * 1024 } }
    fn enter(&mut self, depth: usize) -> Result<(), GraphError> {
        if depth > ${componentRecursiveLimits.valueDepth} || self.nodes == 0 { return Err(GraphError::Limit); }
        self.nodes -= 1; Ok(())
    }
    fn charge(remaining: &mut usize, count: usize, width: usize) -> Result<(), GraphError> {
        let bytes = count.checked_mul(width.max(1)).ok_or(GraphError::Limit)?;
        *remaining = remaining.checked_sub(bytes).ok_or(GraphError::Limit)?; Ok(())
    }
    fn native(&mut self, count: usize, width: usize) -> Result<(), GraphError> { Self::charge(&mut self.native, count, width) }
    fn storage(&mut self, count: usize, width: usize) -> Result<(), GraphError> { Self::charge(&mut self.storage, count, width) }
}
struct GraphOwner<T: 'static>(Vec<T>);
impl<T> Drop for GraphOwner<T> {
    fn drop(&mut self) { #[cfg(test)] GRAPH_LIVE.with(|live| live.set(live.get() - 1)); }
}
struct GraphScope { budget: GraphBudget, owners: Vec<Box<dyn std::any::Any>> }
impl GraphScope {
    fn new(budget: GraphBudget) -> Self { Self { budget, owners: Vec::new() } }
    fn vector<T>(&mut self, count: usize) -> Result<Vec<T>, GraphError> {
        self.budget.storage(count, std::mem::size_of::<T>())?;
        graph_checkpoint()?;
        let mut values = Vec::new(); values.try_reserve_exact(count).map_err(|_| GraphError::Allocation)?;
        if std::mem::size_of::<T>() != 0 && values.capacity() > count {
            self.budget.storage(values.capacity() - count, std::mem::size_of::<T>())?;
        }
        Ok(values)
    }
    fn keep<T: 'static>(&mut self, values: Vec<T>) -> Result<*const T, GraphError> {
        graph_checkpoint()?;
        self.budget.storage(1, std::mem::size_of::<GraphOwner<T>>())?;
        let previous = self.owners.capacity();
        self.owners.try_reserve_exact(1).map_err(|_| GraphError::Allocation)?;
        self.budget.storage(self.owners.capacity() - previous, std::mem::size_of::<Box<dyn std::any::Any>>())?;
        let pointer = values.as_ptr();
        let owner = Box::new(GraphOwner(values));
        #[cfg(test)] GRAPH_LIVE.with(|live| live.set(live.get() + 1));
        self.owners.push(owner); Ok(pointer)
    }
    fn one<T: 'static>(&mut self, value: T) -> Result<*const T, GraphError> {
        let mut values = self.vector(1)?; values.push(value); self.keep(values)
    }
    fn boxed<T>(&mut self, value: T) -> Result<Box<T>, GraphError> { graph_checkpoint()?; Ok(Box::new(value)) }
}
struct GraphOutput<T> { value: T, clear: unsafe fn(*mut T) }
impl<T> Drop for GraphOutput<T> { fn drop(&mut self) { unsafe { (self.clear)(&mut self.value) }; } }
unsafe fn graph_slice<'a, T>(pointer: *const T, count: usize) -> Result<&'a [T], GraphError> {
    if count == 0 { return Ok(&[]); }
    let address = pointer as usize;
    let bytes = count.checked_mul(std::mem::size_of::<T>()).ok_or(GraphError::InvalidNative)?;
    if pointer.is_null() || address % std::mem::align_of::<T>() != 0 || bytes > isize::MAX as usize || address.checked_add(bytes).is_none() {
        return Err(GraphError::InvalidNative);
    }
    // The authenticated native adapter supplies readable storage for its spans.
    // Rust checks shape, alignment and bounds, not arbitrary process addresses.
    Ok(unsafe { std::slice::from_raw_parts(pointer, count) })
}
unsafe fn graph_read<'a, T>(pointer: *const T) -> Result<&'a T, GraphError> { Ok(&unsafe { graph_slice(pointer, 1)? }[0]) }
fn graph_status(status: u32) -> Result<(), GraphError> {
    match status { 0 => Ok(()), 1 => Err(GraphError::InvalidInput), 2 => Err(GraphError::Limit), 3 => Err(GraphError::Allocation),
        5 => Err(GraphError::Unavailable), _ => Err(GraphError::InvalidNative) }
}
struct GraphLifecycle {
    initialize: unsafe extern "C" fn() -> u32,
    ready: unsafe extern "C" fn() -> i32,
    retire: unsafe extern "C" fn(),
}
fn graph_finish<T>(result: Result<T, GraphError>, lifecycle: Option<&GraphLifecycle>) -> Result<T, GraphError> {
    if let Some(runtime) = lifecycle {
        if matches!(&result, Err(GraphError::InvalidNative)) { unsafe { (runtime.retire)() }; }
        if result.is_ok() && unsafe { (runtime.ready)() } == 0 { return Err(GraphError::Unavailable); }
    }
    result
}
`;

/**
 * Generate C-compatible raw types and scoped conversion functions. All input
 * validation precedes allocation and native calls; each output has one owner.
 *
 * @param ir - Compiler-checked concrete copied graph contract.
 */
export const generateCopiedRustGraphConversions = ir => {
	const values = generateCopiedRustGraphValues(ir), { layout } = values;
	const hosts = new Map(values.types.map(node => [node.id, node]));
	const nodes = new Map(layout.nodes.map((node, index) => [
		node.id
		, { ...node, index, host: hosts.get(node.id)
			, input: node.element ? `[${hosts.get(node.element).name}]`
				: node.ref.name === "string" ? "str" : node.ref.name === "bytes" ? "[u8]" : hosts.get(node.id).name
			, raw: node.aggregate ? `GraphRaw${index}` : primitives[node.ref.name] }]));
	const finite = new Set();
	let changed = true;
	while(changed)
	{
		changed = false;
		for(const node of nodes.values())
		{
			const all = fields => fields.every(field => finite.has(field.type));
			if(!finite.has(node.id) && (node.kind === "primitive" || node.element || node.kind === "option"
				|| (node.kind === "variant" ? node.cases.some(branch => all(branch.fields))
					: node.kind === "result" ? node.fields.some(field => finite.has(field.type)) : all(node.fields)))){ finite.add(node.id); changed = true; }
		}
	}
	const raw = [], functions = [], calls = [];
	const member = (field, index) => `    field${index}: ${field.storage === "pointer" ? "*const " : ""}${nodes.get(field.type).raw},`;
	for(const node of nodes.values())
	{
		const i = node.index;
		if(node.aggregate)
		{
			if(node.kind === "variant")
			{
				node.cases.forEach((branch, index) => raw.push("#[repr(C)]", "#[derive(Clone, Copy, Default)]", `struct GraphCase${i}_${index} {`
					, ...branch.fields.length ? branch.fields.map(member) : ["    empty: u8,"], "}"));
				raw.push("#[repr(C)]", "#[derive(Clone, Copy)]", `union GraphUnion${i} {`
					, ...node.cases.map((_, index) => `    case${index}: GraphCase${i}_${index},`), "}"
					, `impl Default for GraphUnion${i} { fn default() -> Self { unsafe { std::mem::zeroed() } } }`);
			}
			raw.push("#[repr(C)]", "#[derive(Clone, Copy)]", `struct ${node.raw} {`
				, "    owner: *mut std::ffi::c_void,", "    release: Option<unsafe extern \"C\" fn(*mut std::ffi::c_void)>,");
			if(node.kind === "primitive" || node.element)
				raw.push(`    data: *const ${node.element ? nodes.get(node.element).raw : ["nat", "int"].includes(node.ref.name) ? "u32" : "u8"},`
					, "    length: usize,", ...node.ref.name === "int" ? ["    negative: u8,"] : []);
			else if(node.kind === "variant") raw.push("    kind: u32,", `    cases: GraphUnion${i},`);
			else raw.push(...node.kind === "option" ? ["    has_value: u8,"] : node.kind === "result" ? ["    is_ok: u8,"] : []
				, ...node.fields.map(member));
			raw.push("}", `impl Default for ${node.raw} { fn default() -> Self {`
				, `    let value: Self = unsafe { std::mem::zeroed() }; ${node.kind === "variant" ? "Self { kind: u32::MAX, ..value }" : "value"}`
				, "} }");
		}
		raw.push(`unsafe fn graph_clear${i}(value: *mut ${node.raw}) {`
			, ...node.aggregate ? [
				"    let value = unsafe { &mut *value };"
				, "    let owner = value.owner; let release = value.release;"
				, "    *value = Default::default();"
				, "    if !owner.is_null() { if let Some(release) = release { unsafe { release(owner) }; } }"] : ["    let _ = value;"]
			, "}");
		const check = ["budget.enter(depth)?;", `if native_storage { budget.native(1, std::mem::size_of::<${node.raw}>())?; }`];
		const to = [], from = [
			"scope.budget.enter(depth)?;"
			, `if native_storage { scope.budget.native(1, std::mem::size_of::<${node.raw}>())?; }`
			, `if host_storage { scope.budget.storage(1, std::mem::size_of::<${node.host.name}>())?; }`];
		const checkField = (field, slot) => `graph_check${nodes.get(field.type).index}(${field.boxed ? `${slot}.as_ref()` : slot}, depth + 1, ${field.storage === "pointer"}, budget)?;`;
		const toField = (field, slot) => {
			const child = `graph_to${nodes.get(field.type).index}(${field.boxed ? `${slot}.as_ref()` : slot}, scope)?`;
			return field.storage === "pointer" ? `{ let child = ${child}; scope.one(child)? }` : child;
		};
		const fromField = (field, slot) => {
			const value = `graph_from${nodes.get(field.type).index}(${field.storage === "pointer" ? `graph_read(${slot})?` : `&${slot}`}, depth + 1, ${field.storage === "pointer"}, ${field.boxed}, scope)?`;
			return field.boxed ? `{ let child = ${value}; scope.boxed(child)? }` : value;
		};
		if(!finite.has(node.id))
		{ check.push("return Err(GraphError::InvalidInput);"); to.push("Err(GraphError::InvalidInput)"); from.push("Err(GraphError::InvalidNative)"); }
		else if(node.kind === "primitive")
		{
			const name = node.ref.name;
			if(["string", "bytes"].includes(name))
			{
				check.push("budget.native(value.len(), 1)?;");
				to.push(`Ok(${node.raw} { data: value.as_ptr(), length: value.len(), ..Default::default() })`);
				from.push("scope.budget.native(value.length, 1)?;", "let input = graph_slice(value.data, value.length)?;");
				if(name === "string") from.push("std::str::from_utf8(input).map_err(|_| GraphError::InvalidNative)?;");
				from.push("let mut result = scope.vector::<u8>(input.len())?; result.extend_from_slice(input);"
					, name === "string" ? "String::from_utf8(result).map_err(|_| GraphError::InvalidNative)" : "Ok(result)");
			}
			else if(["nat", "int"].includes(name))
			{
				const input = name === "int" ? "value.magnitude()" : "value";
				check.push(`let limbs = usize::try_from(${input}.bits().div_ceil(32)).map_err(|_| GraphError::Limit)?;`, "budget.native(limbs, 4)?;");
				to.push(`let limbs = usize::try_from(${input}.bits().div_ceil(32)).map_err(|_| GraphError::Limit)?;`
					, `let mut digits = scope.vector::<u32>(limbs)?; digits.extend(${input}.iter_u32_digits());`
					, `Ok(${node.raw} { data: scope.keep(digits)?, length: limbs, ${name === "int" ? "negative: u8::from(value.sign() == num_bigint::Sign::Minus), " : ""}..Default::default() })`);
				from.push("scope.budget.native(value.length, 4)?; scope.budget.storage(value.length, 4)?;"
					, ...name === "int" ? ["if value.negative > 1 { return Err(GraphError::InvalidNative); }"] : []
					, "let digits = graph_slice(value.data, value.length)?; graph_checkpoint()?;"
					, name === "nat" ? "Ok(BigUint::from_slice(digits))" : "Ok(BigInt::from_slice(if value.negative == 1 { num_bigint::Sign::Minus } else { num_bigint::Sign::Plus }, digits))");
			}
			else if(name === "unit")
			{ to.push("Ok(0)"); from.push("if *value == 0 { Ok(()) } else { Err(GraphError::InvalidNative) }"); }
			else if(name === "bool")
			{ to.push("Ok(u8::from(*value))"); from.push("match value { 0 => Ok(false), 1 => Ok(true), _ => Err(GraphError::InvalidNative) }"); }
			else if(name === "char")
			{ to.push("Ok(*value as u32)"); from.push("char::from_u32(*value).ok_or(GraphError::InvalidNative)"); }
			else
			{ to.push("Ok(*value)"); from.push("Ok(*value)"); }
		}
		else if(node.element)
		{
			const child = nodes.get(node.element);
			check.push("if value.len() > budget.nodes { return Err(GraphError::Limit); }"
				, `budget.native(value.len(), std::mem::size_of::<${child.raw}>())?;`
				, `for item in value { graph_check${child.index}(item, depth + 1, false, budget)?; }`);
			to.push(`let mut items = scope.vector::<${child.raw}>(value.len())?;`
				, `for item in value { items.push(graph_to${child.index}(item, scope)?); }`
				, `Ok(${node.raw} { data: scope.keep(items)?, length: value.len(), ..Default::default() })`);
			from.push("if value.length > scope.budget.nodes { return Err(GraphError::Limit); }"
				, `scope.budget.native(value.length, std::mem::size_of::<${child.raw}>())?;`
				, "let input = graph_slice(value.data, value.length)?;"
				, `let mut result = scope.vector::<${child.host.name}>(input.len())?;`
				, `for item in input { result.push(graph_from${child.index}(item, depth + 1, false, false, scope)?); }`, "Ok(result)");
		}
		else if(node.kind === "variant")
		{
			check.push("match value {"); to.push("match value {"); from.push("match value.kind {");
			node.host.cases.forEach((branch, index) => {
				const pattern = `${node.host.name}::${branch.publicName}${branch.fields.length ? ` { ${branch.fields.map((field, j) => field.publicName === `field${j}` ? `field${j}` : `${field.publicName}: field${j}`).join(", ")} }` : ""}`;
				check.push(`    ${pattern} => { ${branch.fields.map((field, j) => checkField(field, `field${j}`)).join(" ")} },`);
				to.push(`    ${pattern} => Ok(${node.raw} { kind: ${index}, cases: GraphUnion${i} { case${index}: GraphCase${i}_${index} { ${branch.fields.length ? branch.fields.map((field, j) => `field${j}: ${toField(field, `field${j}`)}`).join(", ") : "empty: 0"} } }, ..Default::default() }),`);
				from.push(`    ${index} => Ok(${node.host.name}::${branch.publicName}${branch.fields.length ? ` { ${branch.fields.map((field, j) => `${field.publicName}: ${fromField(field, `value.cases.case${index}.field${j}`)}`).join(", ")} }` : ""}),`);
			});
			check.push("}"); to.push("}"); from.push("    _ => Err(GraphError::InvalidNative)", "}");
		}
		else if(["option", "result"].includes(node.kind))
		{
			const optional = node.kind === "option", flag = optional ? "has_value" : "is_ok";
			check.push("match value {"); to.push("match value {"); from.push(`match value.${flag} {`);
			if(optional)
			{ check.push("    None => {},"); to.push(`    None => Ok(${node.raw}::default()),`); from.push("    0 => Ok(None),"); }
			node.host.fields.forEach((field, j) => {
				const constructor = optional ? "Some" : j ? "Err" : "Ok", tag = j ? 0 : 1;
				check.push(`    ${constructor}(inner) => { ${checkField(field, "inner")} },`);
				to.push(`    ${constructor}(inner) => Ok(${node.raw} { ${flag}: ${tag}, field${j}: ${toField(field, "inner")}, ..Default::default() }),`);
				from.push(`    ${tag} => Ok(${constructor}(${fromField(field, `value.field${j}`)})),`);
			});
			check.push("}"); to.push("}"); from.push("    _ => Err(GraphError::InvalidNative)", "}");
		}
		else
		{
			const fields = node.host.fields;
			check.push(...fields.map((field, j) => checkField(field, `${field.boxed ? "" : "&"}value.${node.kind === "tuple" ? j : field.publicName}`)));
			to.push(`Ok(${node.raw} { ${fields.map((field, j) => `field${j}: ${toField(field, `${field.boxed ? "" : "&"}value.${node.kind === "tuple" ? j : field.publicName}`)}`).join(", ")}${fields.length ? ", " : ""}..Default::default() })`);
			const items = fields.map((field, j) => `${node.kind === "tuple" ? "" : `${field.publicName}: `}${fromField(field, `value.field${j}`)}`);
			from.push(node.kind === "tuple" ? `Ok((${items.join(", ")}))` : `Ok(${node.host.name} { ${items.join(", ")} })`);
		}
		functions.push(`fn graph_check${i}(value: &${node.input}, depth: usize, native_storage: bool, budget: &mut GraphBudget) -> Result<(), GraphError> {`
			, "    let _ = value;", ...check.map(line => `    ${line}`), ...finite.has(node.id) ? ["    Ok(())"] : [], "}"
			, `fn graph_to${i}(value: &${node.input}, scope: &mut GraphScope) -> Result<${node.raw}, GraphError> {`
			, "    let _ = (&value, &scope);", ...to.map(line => `    ${line}`), "}"
			, `unsafe fn graph_from${i}(value: &${node.raw}, depth: usize, native_storage: bool, host_storage: bool, scope: &mut GraphScope) -> Result<${node.host.name}, GraphError> {`
			, "    let _ = value;", ...from.map(line => `    ${line}`), "}");
	}
	for(const root of layout.roots)
	{
		const params = root.parameters.map(id => nodes.get(id)), result = nodes.get(root.result), name = root.name.slice(layout.prefix.length + 1);
		const invoke = `unsafe extern "C" fn(${[...params.map(node => `*const ${node.raw}`), `*mut ${result.raw}`].join(", ")}) -> u32`;
		const parameters = params.map((node, j) => `, arg${j}: &${node.input}`).join("");
		const arguments_ = params.map((_, j) => `, arg${j}`).join("");
		calls.push(`unsafe fn graph_call_${name}(invoke: ${invoke}${parameters}) -> Result<${result.host.name}, GraphError> {`
			, `    unsafe { graph_call_${name}_guarded(None, invoke${arguments_}) }`, "}"
			, `unsafe fn graph_call_${name}_guarded(lifecycle: Option<&GraphLifecycle>, invoke: ${invoke}${parameters}) -> Result<${result.host.name}, GraphError> {`
			, `    let ${params.length ? "mut " : ""}budget = GraphBudget::new();`, ...params.map((node, j) => `    graph_check${node.index}(arg${j}, 0, true, &mut budget)?;`)
			, "    if let Some(runtime) = lifecycle { graph_finish(graph_status(unsafe { (runtime.initialize)() }), lifecycle)?; }"
			, "    let mut scope = GraphScope::new(budget);", ...params.map((node, j) => `    let input${j} = graph_to${node.index}(arg${j}, &mut scope)?;`)
			, `    let mut output = GraphOutput { value: ${result.raw}::default(), clear: graph_clear${result.index} };`
			, "    let result = (|| {"
			, `        graph_status(unsafe { invoke(${[...params.map((_, j) => `&input${j}`), "&mut output.value"].join(", ")}) })?;`
			, `        unsafe { graph_from${result.index}(&output.value, 0, true, true, &mut scope) }`
			, "    })();", "    graph_finish(result, lifecycle)", "}");
	}
	return {
		...values
		, valuesSource: values.source
		, inputTypes: [...nodes.values()].map(node => ({ id: node.id, name: node.input }))
		, rawTypes: [...nodes.values()].map(node => ({ id: node.id, name: node.raw, index: node.index }))
		, rawSource: raw.join("\n")
		, source: ["#![allow(dead_code, unused_imports)]", support, ...raw, ...functions, ...calls, ""].join("\n") };
};
