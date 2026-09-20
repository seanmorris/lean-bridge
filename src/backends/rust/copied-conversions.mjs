/**
 * Generate private C layouts, bounded Rust copies and scoped ownership.
 *
 * @file
 */

/** Shared Rust conversion helpers and test-only failure instrumentation. */
export const copiedRustHelpers = String.raw`
const LIMIT: usize = 16 * 1024 * 1024;

#[cfg(test)]
thread_local! {
    static FAULT: std::cell::Cell<(usize, usize, bool)> = const { std::cell::Cell::new((0, 0, false)) };
    static LIVE: std::cell::Cell<usize> = const { std::cell::Cell::new(0) };
    static CLEARS: std::cell::Cell<usize> = const { std::cell::Cell::new(0) };
}
fn checkpoint() -> Result<(), Error> {
    #[cfg(test)]
    FAULT.with(|state| {
        let (target, current, panic) = state.get();
        state.set((target, current + 1, panic));
        if target != 0 && target == current + 1 {
            assert!(!panic, "injected conversion panic");
            return Err(Error::Allocation);
        }
        Ok(())
    })?;
    Ok(())
}

struct Owner<T: 'static>(Vec<T>);
impl<T: 'static> Drop for Owner<T> {
    fn drop(&mut self) {
        #[cfg(test)] LIVE.with(|live| live.set(live.get() - 1));
    }
}
struct Scope { remaining: usize, owners: Vec<Box<dyn std::any::Any>> }
impl Scope {
    fn new() -> Self { Self { remaining: LIMIT, owners: Vec::new() } }
    fn charge(&mut self, count: usize, width: usize) -> Result<(), Error> {
        let bytes = count.checked_mul(width.max(1)).ok_or(Error::Limit)?;
        self.remaining = self.remaining.checked_sub(bytes).ok_or(Error::Limit)?;
        Ok(())
    }
    fn vector<T>(&mut self, count: usize) -> Result<Vec<T>, Error> {
        checkpoint()?;
        self.charge(count, std::mem::size_of::<T>())?;
        let mut result = Vec::new();
        result.try_reserve_exact(count).map_err(|_| Error::Allocation)?;
        Ok(result)
    }
    fn keep<T: 'static>(&mut self, values: Vec<T>) -> Result<*const T, Error> {
        checkpoint()?;
        self.owners.try_reserve(1).map_err(|_| Error::Allocation)?;
        let pointer = values.as_ptr();
        #[cfg(test)] LIVE.with(|live| live.set(live.get() + 1));
        self.owners.push(Box::new(Owner(values)));
        Ok(pointer)
    }
}
struct Output<T> { value: T, clear: unsafe extern "C" fn(*mut T) }
impl<T> Drop for Output<T> {
    fn drop(&mut self) {
        unsafe { (self.clear)(&mut self.value) };
        #[cfg(test)] CLEARS.with(|clears| clears.set(clears.get() + 1));
    }
}

#[repr(C)]
#[derive(Default)]
struct NativeError { code: i32, message: *const u8, message_length: usize }
fn check(status: i32, error: &NativeError) -> Result<(), Error> {
    if status == 0 { return Ok(()); }
    let message = if error.message.is_null() { "Native Lean call failed".into() }
        else { unsafe { String::from_utf8_lossy(std::slice::from_raw_parts(error.message, error.message_length.min(16384))).into_owned() } };
    Err(Error::Native { code: status, message })
}
unsafe fn checked_slice<'a, T>(data: *const T, length: usize) -> Result<&'a [T], Error> {
    if length == 0 { return Ok(&[]); }
    if data.is_null() || (data as usize) % std::mem::align_of::<T>() != 0
        || length > LIMIT / std::mem::size_of::<T>().max(1) { return Err(Error::InvalidNative); }
    Ok(unsafe { std::slice::from_raw_parts(data, length) })
}
`;

/**
 * Render repr(C) aggregates in dependency order.
 *
 * @param model - Admitted Rust projection.
 */
export const copiedRustTypes = model => model.surface.copies.filter(copy => copy.aggregate).map(copy => `#[repr(C)]
#[derive(Clone, Copy, Default)]
struct ${copy.ctype} {
${copy.compound ? `${copy.compound === "tuple" ? "" : `    ${copy.compound === "option" ? "has_value" : "is_ok"}: u8,\n`}${copy.fields.map(field => `    ${field.name}: ${field.type.ctype},`).join("\n")}`
	: copy.record ? copy.fields.length ? copy.fields.map(field => `    ${field.name}: ${field.type.ctype},`).join("\n") : "    empty: u8,"
		: `    data: *const ${copy.element?.ctype ?? (copy.scalarName === "nat" || copy.scalarName === "int" ? "u32" : "u8")},
    length: usize,
    owner: *mut std::ffi::c_void,
    release: Option<unsafe extern "C" fn(*mut std::ffi::c_void)>,${copy.scalarName === "int" ? "\n    negative: bool," : ""}`}
}
`).join("\n");

/**
 * Convert borrowed public values into scoped ABI inputs and independent outputs.
 *
 * @param model - Admitted copied Rust projection.
 */
export const copiedRustConversions = model => model.surface.copies.map(copy => {
	const name = copy.scalarName, input = [], output = [];
	if(name === "unit")
	{ input.push("Ok(0)"); output.push("Ok(())"); }
	else if(name === "char")
	{ input.push("Ok(*value as u32)"); output.push("char::from_u32(*value).ok_or(Error::InvalidNative)"); }
	else if(!copy.aggregate)
	{ input.push("Ok(*value)"); output.push("Ok(*value)"); }
	else if(name === "string" || name === "bytes")
	{
		input.push("scope.charge(value.len(), 1)?;", `Ok(${copy.ctype} { data: value.as_ptr(), length: value.len(), ..Default::default() })`);
		output.push("let input = unsafe { checked_slice(value.data, value.length)? };", "let mut result = scope.vector::<u8>(input.len())?;", "result.extend_from_slice(input);");
		output.push(name === "string" ? "String::from_utf8(result).map_err(|_| Error::InvalidNative)" : "Ok(result)");
	} else if(name === "nat" || name === "int")
	{
		input.push(`let length = usize::try_from((${name === "int" ? "value.magnitude()" : "value"}.bits() + 31) / 32).map_err(|_| Error::Limit)?;`, "let mut digits = scope.vector::<u32>(length)?;", `digits.extend(${name === "int" ? "value.magnitude()" : "value"}.iter_u32_digits());`, "let length = digits.len();", `Ok(${copy.ctype} { data: scope.keep(digits)?, length, ${name === "int" ? "negative: value.sign() == num_bigint::Sign::Minus, " : ""}..Default::default() })`);
		output.push("scope.charge(value.length, 8)?;", "let digits = unsafe { checked_slice(value.data, value.length)? };", "if digits.last() == Some(&0) { return Err(Error::InvalidNative); }");
		if(name === "int") output.push("if digits.is_empty() && value.negative { return Err(Error::InvalidNative); }");
		output.push(name === "nat" ? "Ok(BigUint::from_slice(digits))" : "Ok(BigInt::from_slice(if value.negative { num_bigint::Sign::Minus } else { num_bigint::Sign::Plus }, digits))");
	} else if(copy.compound === "option")
	{
		const child = copy.fields[0].type;
		input.push(`match value { None => Ok(${copy.ctype}::default()), Some(inner) => Ok(${copy.ctype} { has_value: 1, value: to${child.index}(inner, scope)? }) }`);
		output.push(`match value.has_value { 0 => Ok(None), 1 => Ok(Some(from${child.index}(&value.value, scope)?)), _ => Err(Error::InvalidNative) }`);
	} else if(copy.compound === "result")
	{
		const [ok, error] = copy.fields.map(field => field.type);
		input.push(`match value { Ok(inner) => Ok(${copy.ctype} { is_ok: 1, ok: to${ok.index}(inner, scope)?, ..Default::default() }), Err(inner) => Ok(${copy.ctype} { error: to${error.index}(inner, scope)?, ..Default::default() }) }`);
		output.push(`match value.is_ok { 1 => Ok(Ok(from${ok.index}(&value.ok, scope)?)), 0 => Ok(Err(from${error.index}(&value.error, scope)?)), _ => Err(Error::InvalidNative) }`);
	} else if(copy.compound === "tuple")
	{
		input.push(`Ok(${copy.ctype} { ${copy.fields.map((field, i) => `${field.name}: to${field.type.index}(&value.${i}, scope)?`).join(", ")} })`);
		output.push(`Ok((${copy.fields.map(field => `from${field.type.index}(&value.${field.name}, scope)?`).join(", ")}))`);
	} else if(copy.record)
	{
		input.push(`Ok(${copy.ctype} { ${copy.fields.length ? copy.fields.map(field => `${field.name}: to${field.type.index}(&value.${field.name}, scope)?`).join(", ") : "empty: 0"} })`);
		output.push(`Ok(crate::${copy.publicName} { ${copy.fields.map(field => `${field.name}: from${field.type.index}(&value.${field.name}, scope)?`).join(", ")} })`);
	} else
	{
		input.push("scope.charge(value.len(), 8)?;", `let mut items = scope.vector::<${copy.element.ctype}>(value.len())?;`, `for item in value { items.push(to${copy.element.index}(item, scope)?); }`, `Ok(${copy.ctype} { data: scope.keep(items)?, length: value.len(), ..Default::default() })`);
		output.push("let input = unsafe { checked_slice(value.data, value.length)? };", "scope.charge(input.len(), 8)?;", `let mut items = scope.vector::<${copy.element.record ? "crate::" : ""}${copy.element.publicType}>(input.len())?;`, `for item in input { items.push(from${copy.element.index}(item, scope)?); }`, "Ok(items)");
	}
	const publicType = copy.record ? `crate::${copy.publicName}` : copy.publicType;
	const borrowed = name === "string" ? "str" : name === "bytes" ? "[u8]" : copy.element ? `[${copy.element.record ? "crate::" : ""}${copy.element.publicType}]` : publicType;
	return `fn to${copy.index}(value: &${borrowed}, scope: &mut Scope) -> Result<${copy.ctype}, Error> {
    scope.charge(1, std::mem::size_of::<${copy.ctype}>())?;
${input.map(line => `    ${line}`).join("\n")}
}
fn from${copy.index}(value: &${copy.ctype}, scope: &mut Scope) -> Result<${publicType}, Error> {
    checkpoint()?;
    scope.charge(1, std::mem::size_of::<${copy.ctype}>())?;
${output.map(line => `    ${line}`).join("\n")}
}
`;
}).join("\n");
