/**
 * Bounded Rust conversions over the checked, ownership-aware public C ABI.
 * Temporary input storage and partially converted outputs have separate owners.
 *
 * @file
 */
import { generateOwnedRustValues } from "./owned-values.mjs";

const primitives = {
	unit: "u8", bool: "u8", char: "u32", usize: "u64", isize: "i64"
	, float32: "f32", float64: "f64", uint8: "u8", uint16: "u16", uint32: "u32"
	, uint64: "u64", int8: "i8", int16: "i16", int32: "i32", int64: "i64"
};

const support = (limits, anchors = false) => `use crate::*;
use std::rc::Rc;
use std::ffi::c_void;
use crate::owned_runtime::{State, Lease, NativeOwner, checked, current_state};
const _: () = assert!(std::mem::size_of::<usize>() == 8);
// The native build verifies this layout and GMP's 64-bit, nail-free limbs.
#[repr(C)]
#[derive(Clone, Copy)]
pub(crate) struct OwnedMpz { pub(crate) allocated: i32, pub(crate) size: i32, pub(crate) data: *const u64 }
#[cfg(test)]
std::thread_local! {
    static OWNED_FAULT: std::cell::Cell<(usize, usize, bool)> = const { std::cell::Cell::new((0, 0, false)) };
    static OWNED_LIVE: std::cell::Cell<usize> = const { std::cell::Cell::new(0) };
}
fn owned_checkpoint() -> Result<(), Error> {
    #[cfg(test)]
    OWNED_FAULT.with(|state| {
        let (target, current, panic) = state.get(); state.set((target, current + 1, panic));
        if target != 0 && target == current + 1 {
            assert!(!panic, "injected owned conversion panic"); return Err(Error::Allocation);
        }
        Ok(())
    })?;
    Ok(())
}
#[derive(Clone)]
pub(crate) struct OwnedBudget { nodes: usize, native: usize, storage: usize }
impl OwnedBudget {
    pub(crate) fn new() -> Self { Self { nodes: ${limits.visits}, native: ${limits.bytes}, storage: ${limits.bytes} } }
    fn enter(&mut self, depth: usize) -> Result<(), Error> {
        if depth > ${limits.depth} || self.nodes == 0 { return Err(Error::Limit); }
        self.nodes -= 1; Ok(())
    }
    fn charge(remaining: &mut usize, count: usize, width: usize) -> Result<(), Error> {
        let bytes = count.checked_mul(width.max(1)).ok_or(Error::Limit)?;
        *remaining = remaining.checked_sub(bytes).ok_or(Error::Limit)?; Ok(())
    }
    fn native(&mut self, count: usize, width: usize) -> Result<(), Error> { Self::charge(&mut self.native, count, width) }
    fn storage(&mut self, count: usize, width: usize) -> Result<(), Error> { Self::charge(&mut self.storage, count, width) }
}
struct OwnedStorage<T: 'static>(Vec<T>);
impl<T> Drop for OwnedStorage<T> {
    fn drop(&mut self) { #[cfg(test)] OWNED_LIVE.with(|live| live.set(live.get() - 1)); }
}
pub(crate) struct OwnedScope { budget: OwnedBudget, owners: Vec<Box<dyn std::any::Any>> }
impl OwnedScope {
    pub(crate) fn new(budget: OwnedBudget) -> Self { Self { budget, owners: Vec::new() } }
    fn vector<T>(&mut self, count: usize) -> Result<Vec<T>, Error> {
        self.budget.storage(count, std::mem::size_of::<T>())?;
        owned_checkpoint()?;
        let mut values = Vec::new(); values.try_reserve_exact(count).map_err(|_| Error::Allocation)?;
        if std::mem::size_of::<T>() != 0 && values.capacity() > count {
            self.budget.storage(values.capacity() - count, std::mem::size_of::<T>())?;
        }
        Ok(values)
    }
    fn keep<T: 'static>(&mut self, values: Vec<T>) -> Result<*const T, Error> {
        owned_checkpoint()?;
        self.budget.storage(1, std::mem::size_of::<OwnedStorage<T>>())?;
        let previous = self.owners.capacity();
        self.owners.try_reserve_exact(1).map_err(|_| Error::Allocation)?;
        self.budget.storage(self.owners.capacity() - previous, std::mem::size_of::<Box<dyn std::any::Any>>())?;
        let pointer = values.as_ptr();
        let owner = Box::new(OwnedStorage(values));
        #[cfg(test)] OWNED_LIVE.with(|live| live.set(live.get() + 1));
        self.owners.push(owner); Ok(pointer)
    }
    fn one<T: 'static>(&mut self, value: T) -> Result<*const T, Error> {
        let mut values = self.vector(1)?; values.push(value); self.keep(values)
    }
    fn boxed<T>(&mut self, value: T) -> Result<Box<T>, Error> {
        self.budget.storage(1, std::mem::size_of::<T>())?;
        owned_checkpoint()?; Ok(Box::new(value))
    }
}
pub(crate) struct OwnedOutput {
    pub(crate) owner: NativeOwner, state: Rc<State>, lease: Option<Rc<Lease>>,${anchors ? "\n    anchored_result: bool," : ""}
}
impl OwnedOutput {
    pub(crate) fn new(state: Rc<State>) -> Self { Self { owner: NativeOwner::new(), state, lease: None${anchors ? ", anchored_result: false" : ""} } }
    pub(crate) fn borrowed(state: Rc<State>, lease: Rc<Lease>) -> Self {
        Self { owner: NativeOwner::new(), state, lease: Some(lease)${anchors ? ", anchored_result: true" : ""} }
    }
    fn hold(&mut self) -> Result<Rc<Lease>, Error> {
        if self.lease.is_none() {
            if self.owner.value.is_null() { return Err(Error::MalformedResult); }
            owned_checkpoint()?;
            self.lease = Some(self.state.adopt(&mut self.owner${anchors ? ", self.anchored_result" : ""})?);
        }
        let lease = self.lease.as_ref().ok_or(Error::MalformedResult)?;
        lease.require()?; Ok(Rc::clone(lease))
    }
}
unsafe fn owned_slice<'a, T>(pointer: *const T, count: usize) -> Result<&'a [T], Error> {
    if count == 0 { return Ok(&[]); }
    let address = pointer as usize;
    let bytes = count.checked_mul(std::mem::size_of::<T>()).ok_or(Error::MalformedResult)?;
    if pointer.is_null() || address % std::mem::align_of::<T>() != 0 || bytes > isize::MAX as usize || address.checked_add(bytes).is_none() {
        return Err(Error::MalformedResult);
    }
    // The authenticated adapter supplies readable memory. Shape checks cannot
    // establish whether an arbitrary address belongs to a live allocation.
    Ok(unsafe { std::slice::from_raw_parts(pointer, count) })
}
unsafe fn owned_read<'a, T>(pointer: *const T) -> Result<&'a T, Error> { Ok(&unsafe { owned_slice(pointer, 1)? }[0]) }
`;

/**
 * Preserve scalar/aggregate semantics while bounding recursive conversions.
 * Resource wrappers share the native result owner or a scoped callback borrow.
 * Callable descriptors and prepared-package loading are separate projections.
 *
 * @param ir - Compiler-authenticated explicit ownership contract.
 * @param options - Prepared-package runtime policy.
 */
export const generateOwnedRustConversions = (ir, options = {}) => {
	const values = generateOwnedRustValues(ir, options), { c } = values;
	const nodes = new Map(values.types.map(node => [node.id, { ...node
		, input: node.element ? `[${values.types.find(child => child.id === node.element).hostName}]`
			: node.name === "string" ? "str" : node.name === "bytes" ? "[u8]" : node.hostName
		, raw: node.identity ? "*mut c_void" : node.integer ? "*const OwnedMpz"
			: node.scalar ? primitives[node.name] : `OwnedRaw${node.index}` }]));
	const finite = new Set(); let changed = true;
	while(changed)
	{
		changed = false;
		for(const node of nodes.values())
		{
			const all = fields => fields.every(field => finite.has(field.type));
			if(!finite.has(node.id) && (node.leaf || node.element || node.kind === "option"
				|| (node.kind === "variant" ? node.cases.some(branch => all(branch.fields))
					: node.kind === "result" ? node.fields.some(field => finite.has(field.type)) : all(node.fields)))){ finite.add(node.id); changed = true; }
		}
	}
	const raw = [], functions = [], calls = [], callModels = [];
	const member = (field, index) => `    pub(crate) field${index}: ${field.pointer ? "*const " : ""}${nodes.get(field.type).raw},`;
	for(const node of nodes.values())
	{
		const i = node.index;
		if(!node.scalar && !node.integer && !node.identity)
		{
			if(node.kind === "variant")
			{
				node.cases.forEach((branch, index) => raw.push("#[repr(C)]", "#[derive(Clone, Copy)]", `pub(crate) struct OwnedCase${i}_${index} {`
					, ...branch.fields.length ? branch.fields.map(member) : ["    pub(crate) empty: u8,"], "}"));
				raw.push("#[repr(C)]", "#[derive(Clone, Copy)]", `pub(crate) union OwnedUnion${i} {`
					, ...node.cases.map((_, index) => `    pub(crate) case${index}: OwnedCase${i}_${index},`), "}");
			}
			raw.push("#[repr(C)]", "#[derive(Clone, Copy)]", `pub(crate) struct ${node.raw} {`);
			if(node.kind === "primitive" || node.element) raw.push(`    pub(crate) data: *const ${node.element ? nodes.get(node.element).raw : "u8"},`, "    pub(crate) length: usize,");
			else if(node.kind === "variant") raw.push("    pub(crate) kind: u32,", `    pub(crate) cases: OwnedUnion${i},`);
			else raw.push(...node.kind === "option" ? ["    pub(crate) has_value: u8,"] : node.kind === "result" ? ["    pub(crate) is_ok: u8,"] : []
				, ...node.kind === "record" && !node.fields.length ? ["    pub(crate) empty: u8,"] : node.fields.map(member));
			raw.push("}", `impl Default for ${node.raw} { fn default() -> Self {`
				, `    let value: Self = unsafe { std::mem::zeroed() }; ${node.kind === "variant" ? "Self { kind: u32::MAX, ..value }" : "value"}`, "} }");
		}
		const check = ["budget.enter(depth)?;", `budget.native(1, std::mem::size_of::<${node.raw}>())?;`];
		const to = [], from = ["scope.budget.enter(depth)?;"
			, `scope.budget.native(1, std::mem::size_of::<${node.raw}>())?;`
			, `scope.budget.storage(1, std::mem::size_of::<${node.hostName}>())?;`];
		const checkField = (field, slot) => `owned_check${nodes.get(field.type).index}(${field.boxed ? `${slot}.as_ref()` : slot}, depth + 1, budget, state)?;`;
		const toField = (field, slot) => {
			const child = `owned_to${nodes.get(field.type).index}(${field.boxed ? `${slot}.as_ref()` : slot}, scope, state)?`;
			return field.pointer ? `{ let child = ${child}; scope.one(child)? }` : child;
		};
		const fromField = (field, slot) => {
			const child = `owned_from${nodes.get(field.type).index}(${field.pointer ? `owned_read(${slot})?` : `&${slot}`}, depth + 1, scope, output)?`;
			return field.boxed ? `{ let child = ${child}; scope.boxed(child)? }` : child;
		};
		if(!finite.has(node.id))
		{ check.push("return Err(Error::InvalidArgument);"); to.push("Err(Error::InvalidArgument)"); from.push("Err(Error::MalformedResult)"); }
		else if(node.identity)
		{
			check.push("value.raw(state)?;"); to.push("value.raw(state)");
			from.push("if value.is_null() { return Err(Error::MalformedResult); }", "Resource::from_owned(output.hold()?, *value)");
		}
		else if(node.kind === "primitive")
		{
			if(["string", "bytes"].includes(node.name))
			{
				check.push("budget.native(value.len(), 1)?;");
				to.push(`Ok(${node.raw} { data: value.as_ptr(), length: value.len() })`);
				from.push("scope.budget.native(value.length, 1)?;", "let input = owned_slice(value.data, value.length)?;"
					, ...node.name === "string" ? ["std::str::from_utf8(input).map_err(|_| Error::MalformedResult)?;"] : []
					, "let mut result = scope.vector::<u8>(input.len())?; result.extend_from_slice(input);"
					, node.name === "string" ? "String::from_utf8(result).map_err(|_| Error::MalformedResult)" : "Ok(result)");
			}
			else if(node.integer)
			{
				const magnitude = node.name === "int" ? "value.magnitude()" : "value";
				check.push(`let count = usize::try_from(${magnitude}.bits().div_ceil(64)).map_err(|_| Error::Limit)?;`
					, "budget.native(count, 8)?;", "budget.native(1, std::mem::size_of::<OwnedMpz>())?;");
				to.push(`let count = usize::try_from(${magnitude}.bits().div_ceil(64)).map_err(|_| Error::Limit)?;`
					, `let mut limbs = scope.vector::<u64>(count)?; limbs.extend(${magnitude}.iter_u64_digits());`
					, "let size = i32::try_from(limbs.len()).map_err(|_| Error::Limit)?;"
					, ...node.name === "int" ? ["let size = if value.sign() == num_bigint::Sign::Minus { -size } else { size };"] : []
					, "let data = scope.keep(limbs)?;", "scope.one(OwnedMpz { allocated: 0, size, data })");
				from.push("let value = owned_read(*value)?;", "let count = value.size.unsigned_abs() as usize;"
					, "scope.budget.native(1, std::mem::size_of::<OwnedMpz>())?;"
					, "scope.budget.native(count, 8)?; scope.budget.storage(count, 8)?;"
					, ...node.name === "nat" ? ["if value.size < 0 { return Err(Error::MalformedResult); }"] : []
					, "if value.allocated < 0 || (value.allocated != 0 && (value.allocated as usize) < count) { return Err(Error::MalformedResult); }"
					, "let limbs = owned_slice(value.data, count)?;"
					, "if count != 0 && limbs[count - 1] == 0 { return Err(Error::MalformedResult); }"
					, "let mut digits = scope.vector::<u32>(count * 2)?;"
					, "for limb in limbs { digits.push(*limb as u32); digits.push((*limb >> 32) as u32); }"
					, "owned_checkpoint()?; let magnitude = BigUint::from_slice(&digits);"
					, node.name === "nat" ? "Ok(magnitude)" : "Ok(BigInt::from_biguint(if value.size < 0 { num_bigint::Sign::Minus } else { num_bigint::Sign::Plus }, magnitude))");
			}
			else if(node.name === "unit")
			{ to.push("Ok(0)"); from.push("if *value == 0 { Ok(()) } else { Err(Error::MalformedResult) }"); }
			else if(node.name === "bool")
			{ to.push("Ok(u8::from(*value))"); from.push("match value { 0 => Ok(false), 1 => Ok(true), _ => Err(Error::MalformedResult) }"); }
			else if(node.name === "char")
			{ to.push("Ok(*value as u32)"); from.push("char::from_u32(*value).ok_or(Error::MalformedResult)"); }
			else
			{ to.push("Ok(*value)"); from.push("Ok(*value)"); }
		}
		else if(node.element)
		{
			const child = nodes.get(node.element);
			check.push("if value.len() > budget.nodes { return Err(Error::Limit); }"
				, `budget.native(value.len(), std::mem::size_of::<${child.raw}>())?;`
				, `for item in value { owned_check${child.index}(item, depth + 1, budget, state)?; }`);
			to.push(`let mut items = scope.vector::<${child.raw}>(value.len())?;`
				, `for item in value { items.push(owned_to${child.index}(item, scope, state)?); }`
				, `Ok(${node.raw} { data: scope.keep(items)?, length: value.len() })`);
			from.push("if value.length > scope.budget.nodes { return Err(Error::Limit); }"
				, `scope.budget.native(value.length, std::mem::size_of::<${child.raw}>())?;`
				, "let input = owned_slice(value.data, value.length)?;"
				, `let mut result = scope.vector::<${child.hostName}>(input.len())?;`
				, `for item in input { result.push(owned_from${child.index}(item, depth + 1, scope, output)?); }`, "Ok(result)");
		}
		else if(node.kind === "variant")
		{
			check.push("match value {"); to.push("match value {"); from.push("match value.kind {");
			node.cases.forEach((branch, index) => {
				const pattern = `${node.hostName}::${branch.publicName}${branch.fields.length ? ` { ${branch.fields.map((field, j) => field.publicName === `field${j}` ? `field${j}` : `${field.publicName}: field${j}`).join(", ")} }` : ""}`;
				check.push(`    ${pattern} => { ${branch.fields.map((field, j) => checkField(field, `field${j}`)).join(" ")} },`);
				to.push(`    ${pattern} => Ok(${node.raw} { kind: ${index}, cases: OwnedUnion${i} { case${index}: OwnedCase${i}_${index} { ${branch.fields.length ? branch.fields.map((field, j) => `field${j}: ${toField(field, `field${j}`)}`).join(", ") : "empty: 0"} } } }),`);
				from.push(`    ${index} => Ok(${node.hostName}::${branch.publicName}${branch.fields.length ? ` { ${branch.fields.map((field, j) => `${field.publicName}: ${fromField(field, `value.cases.case${index}.field${j}`)}`).join(", ")} }` : ""}),`);
			});
			check.push("}"); to.push("}"); from.push("    _ => Err(Error::MalformedResult)", "}");
		}
		else if(["option", "result"].includes(node.kind))
		{
			const optional = node.kind === "option", flag = optional ? "has_value" : "is_ok";
			check.push("match value {"); to.push("match value {"); from.push(`match value.${flag} {`);
			if(optional)
			{ check.push("    None => {},"); to.push(`    None => Ok(${node.raw}::default()),`); from.push("    0 => Ok(None),"); }
			node.fields.forEach((field, index) => {
				const constructor = optional ? "Some" : index ? "Err" : "Ok", tag = index ? 0 : 1;
				check.push(`    ${constructor}(inner) => { ${checkField(field, "inner")} },`);
				to.push(`    ${constructor}(inner) => Ok(${node.raw} { ${flag}: ${tag}, field${index}: ${toField(field, "inner")}, ..Default::default() }),`);
				from.push(`    ${tag} => Ok(${constructor}(${fromField(field, `value.field${index}`)})),`);
			});
			check.push("}"); to.push("}"); from.push("    _ => Err(Error::MalformedResult)", "}");
		}
		else
		{
			const fields = node.fields, slot = (field, index) => `${field.boxed ? "" : "&"}value.${node.kind === "tuple" ? index : field.publicName}`;
			check.push(...fields.map((field, j) => checkField(field, slot(field, j))));
			to.push(`Ok(${node.raw} { ${fields.length ? fields.map((field, j) => `field${j}: ${toField(field, slot(field, j))}`).join(", ") : "empty: 0"} })`);
			const items = fields.map((field, j) => `${node.kind === "tuple" ? "" : `${field.publicName}: `}${fromField(field, `value.field${j}`)}`);
			from.push(node.kind === "tuple" ? `Ok((${items.join(", ")}))` : `Ok(${node.hostName} { ${items.join(", ")} })`);
		}
		functions.push(`pub(crate) fn owned_check${i}(value: &${node.input}, depth: usize, budget: &mut OwnedBudget, state: &Rc<State>) -> Result<(), Error> {`
			, "    let _ = (&value, &state);", ...check.map(line => `    ${line}`), ...finite.has(node.id) ? ["    Ok(())"] : [], "}"
			, `pub(crate) fn owned_to${i}(value: &${node.input}, scope: &mut OwnedScope, state: &Rc<State>) -> Result<${node.raw}, Error> {`
			, "    let _ = (&value, &scope, &state);", ...to.map(line => `    ${line}`), "}"
			, `pub(crate) unsafe fn owned_from${i}(value: &${node.raw}, depth: usize, scope: &mut OwnedScope, output: &mut OwnedOutput) -> Result<${node.hostName}, Error> {`
			, "    let _ = (&value, &output);", ...from.map(line => `    ${line}`), "}");
	}
	for(const root of [...c.functions, ...c.retains, ...c.copies])
	{
		// Callback descriptors and input-owner transactions use the callable projection.
		if(c.anchoredResults || root.transfers?.length || root.parameters.some((_, index) => c.hostArgument(root, index))) continue;
		const params = root.parameters.map(id => nodes.get(id)), result = nodes.get(root.result);
		const name = root.cName.slice(c.prefix.length + 1);
		const invoke = `unsafe extern "C" fn(${["*mut c_void", ...params.map(node => `${node.leaf ? "" : "*const "}${node.raw}`), `*mut ${result.raw}`, "*mut *mut c_void"].join(", ")}) -> u32`;
		calls.push(`pub(crate) unsafe fn owned_call_${name}(invoke: ${invoke}${params.map((node, j) => `, arg${j}: &${node.input}`).join("")}) -> Result<${result.hostName}, Error> {`
			, "    let state = current_state()?;", ...params.length ? ["    let mut budget = OwnedBudget::new();"] : []
			, ...params.map((node, j) => `    owned_check${node.index}(arg${j}, 0, &mut budget, &state)?;`)
			, ...params.length ? ["    let mut scope = OwnedScope::new(budget);"] : []
			, ...params.map((node, j) => `    let input${j} = owned_to${node.index}(arg${j}, &mut scope, &state)?;`)
			, `    let mut raw: ${result.raw} = Default::default();`, "    let mut output = OwnedOutput::new(Rc::clone(&state));"
			, `    checked(unsafe { invoke(${["state.require()?", ...params.map((node, j) => `${node.leaf ? "" : "&"}input${j}`), "&mut raw", "&mut output.owner.value"].join(", ")}) })?;`
			, "    let mut result_scope = OwnedScope::new(OwnedBudget::new());"
			, `    unsafe { owned_from${result.index}(&raw, 0, &mut result_scope, &mut output) }`, "}");
		callModels.push({ ...root, name, invoke, parameters: params.map(node => node.id), result: result.id });
	}
	return { ...values, valuesSource: values.source
		, types: [...nodes.values()], calls: callModels
		, rawSource: raw.join("\n")
		, source: ["#![allow(dead_code, unused_imports)]", support(c.native.model.limits, Boolean(c.anchoredResults)), ...raw, ...functions, ...calls, ""].join("\n") };
};
