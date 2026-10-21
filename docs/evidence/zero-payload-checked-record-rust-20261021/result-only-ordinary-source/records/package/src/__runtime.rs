#![allow(dead_code, unused_imports, unused_variables)]
use crate::{Error, BigInt, BigUint, Witness, Mark, Marker, Token};
use std::sync::{OnceLock, atomic::{AtomicU32, Ordering}};
#[path = "assets.rs"] mod assets;
unsafe extern "C" { fn dlsym(library: *mut std::ffi::c_void, name: *const std::ffi::c_char) -> *mut std::ffi::c_void; }
#[repr(C)]
#[derive(Clone, Copy, Default)]
struct T1 {
    empty: u8,
}

#[repr(C)]
#[derive(Clone, Copy, Default)]
struct T2 {
    has_value: u8,
    value: T1,
}

#[repr(C)]
#[derive(Clone, Copy, Default)]
struct B3_0 {
    empty: u8,
}

#[repr(C)]
#[derive(Clone, Copy, Default)]
struct B3_1 {
    witness: T1,
}

#[repr(C)]
#[derive(Clone, Copy)]
union V3 {
    case0: B3_0,
    case1: B3_1,
}
impl Default for V3 {
    fn default() -> Self {
        // Every private ABI field admits zero; there are no Rust references or owning values.
        unsafe { std::mem::zeroed() }
    }
}
#[repr(C)]
#[derive(Clone, Copy, Default)]
struct T3 { kind: u32, cases: V3 }

#[repr(C)]
#[derive(Clone, Copy, Default)]
struct T4 {
    empty: u8,
}

#[repr(C)]
#[derive(Clone, Copy, Default)]
struct T6 {
    tag: u8,
}

#[repr(C)]
#[derive(Clone, Copy, Default)]
struct T7 {
    data: *const u32,
    length: usize,
    owner: *mut std::ffi::c_void,
    release: Option<unsafe extern "C" fn(*mut std::ffi::c_void)>,
}

#[repr(C)]
#[derive(Clone, Copy, Default)]
struct T8 {
    data: *const T1,
    length: usize,
    owner: *mut std::ffi::c_void,
    release: Option<unsafe extern "C" fn(*mut std::ffi::c_void)>,
}


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

struct Native {
    clear1: unsafe extern "C" fn(*mut T1),
    clear2: unsafe extern "C" fn(*mut T2),
    clear3: unsafe extern "C" fn(*mut T3),
    clear4: unsafe extern "C" fn(*mut T4),
    clear6: unsafe extern "C" fn(*mut T6),
    clear7: unsafe extern "C" fn(*mut T7),
    clear8: unsafe extern "C" fn(*mut T8),
    call0: unsafe extern "C" fn(bool, *mut T2, *mut NativeError) -> i32,
    call1: unsafe extern "C" fn(bool, *mut T3, *mut NativeError) -> i32,
    call2: unsafe extern "C" fn(*mut T4, *mut NativeError) -> i32,
    call3: unsafe extern "C" fn(*mut T6, *mut NativeError) -> i32,
    call4: unsafe extern "C" fn(*mut T1, *mut NativeError) -> i32,
    call5: unsafe extern "C" fn(*const T7, *mut T8, *mut NativeError) -> i32,

}
static NATIVE: OnceLock<Result<Native, Error>> = OnceLock::new();
static PID: AtomicU32 = AtomicU32::new(0);
fn runtime() -> Result<&'static Native, Error> {
    let pid = std::process::id();
    let owner = PID.compare_exchange(0, pid, Ordering::Relaxed, Ordering::Relaxed).unwrap_or_else(|owner| owner);
    if owner != 0 && owner != pid { return Err(Error::Load("Start a fresh process after fork to use Lean".into())); }
    NATIVE.get_or_init(|| {
        let library = assets::load()? as *mut std::ffi::c_void;
        macro_rules! symbol { ($name:literal, $type:ty) => {{
            let name = concat!($name, "\0");
            let value = unsafe { dlsym(library, name.as_ptr().cast()) };
            if value.is_null() { return Err(Error::Load(format!("Missing native symbol {}", $name))); }
            unsafe { std::mem::transmute::<*mut std::ffi::c_void, $type>(value) }
        }}; }
        Ok(Native {
            clear1: symbol!("zeropayloadcheckedrecords_witness_clear", unsafe extern "C" fn(*mut T1)),
            clear2: symbol!("zeropayloadcheckedrecords_option_lean_zero_payload_checked_records_witness_value_clear", unsafe extern "C" fn(*mut T2)),
            clear3: symbol!("zeropayloadcheckedrecords_mark_clear", unsafe extern "C" fn(*mut T3)),
            clear4: symbol!("zeropayloadcheckedrecords_marker_clear", unsafe extern "C" fn(*mut T4)),
            clear6: symbol!("zeropayloadcheckedrecords_token_clear", unsafe extern "C" fn(*mut T6)),
            clear7: symbol!("zeropayloadcheckedrecords_nat_clear", unsafe extern "C" fn(*mut T7)),
            clear8: symbol!("zeropayloadcheckedrecords_array_lean_zero_payload_checked_records_witness_span_clear", unsafe extern "C" fn(*mut T8)),
            call0: symbol!("zeropayloadcheckedrecords_maybe_witness", unsafe extern "C" fn(bool, *mut T2, *mut NativeError) -> i32),
            call1: symbol!("zeropayloadcheckedrecords_produce_mark", unsafe extern "C" fn(bool, *mut T3, *mut NativeError) -> i32),
            call2: symbol!("zeropayloadcheckedrecords_produce_marker", unsafe extern "C" fn(*mut T4, *mut NativeError) -> i32),
            call3: symbol!("zeropayloadcheckedrecords_produce_token", unsafe extern "C" fn(*mut T6, *mut NativeError) -> i32),
            call4: symbol!("zeropayloadcheckedrecords_produce_witness", unsafe extern "C" fn(*mut T1, *mut NativeError) -> i32),
            call5: symbol!("zeropayloadcheckedrecords_witnesses", unsafe extern "C" fn(*const T7, *mut T8, *mut NativeError) -> i32),

        })
    }).as_ref().map_err(Clone::clone)
}
fn to0(value: &bool, scope: &mut Scope) -> Result<bool, Error> {
    scope.charge(1, std::mem::size_of::<bool>())?;
    Ok(*value)
}
fn from0(value: &bool, scope: &mut Scope) -> Result<bool, Error> {
    checkpoint()?;
    scope.charge(1, std::mem::size_of::<bool>())?;
    Ok(*value)
}

fn to1(value: &crate::Witness, scope: &mut Scope) -> Result<T1, Error> {
    scope.charge(1, std::mem::size_of::<T1>())?;
    Ok(T1 { empty: 0 })
}
fn from1(value: &T1, scope: &mut Scope) -> Result<crate::Witness, Error> {
    checkpoint()?;
    scope.charge(1, std::mem::size_of::<T1>())?;
    Ok(crate::Witness {  })
}

fn to2(value: &Option<Witness>, scope: &mut Scope) -> Result<T2, Error> {
    scope.charge(1, std::mem::size_of::<T2>())?;
    match value { None => Ok(T2::default()), Some(inner) => Ok(T2 { has_value: 1, value: to1(inner, scope)? }) }
}
fn from2(value: &T2, scope: &mut Scope) -> Result<Option<Witness>, Error> {
    checkpoint()?;
    scope.charge(1, std::mem::size_of::<T2>())?;
    match value.has_value { 0 => Ok(None), 1 => Ok(Some(from1(&value.value, scope)?)), _ => Err(Error::InvalidNative) }
}

fn to3(value: &Mark, scope: &mut Scope) -> Result<T3, Error> {
    scope.charge(1, std::mem::size_of::<T3>())?;
    match value {
        crate::Mark::Blank => Ok(T3 { kind: 0, cases: V3 { case0: B3_0 { empty: 0 } } }),
        crate::Mark::Marked { witness: field0 } => Ok(T3 { kind: 1, cases: V3 { case1: B3_1 { witness: to1(field0, scope)? } } }),
    }
}
fn from3(value: &T3, scope: &mut Scope) -> Result<Mark, Error> {
    checkpoint()?;
    scope.charge(1, std::mem::size_of::<T3>())?;
    match value.kind {
        0 => Ok(crate::Mark::Blank),
        1 => {
        // Read this union member only after validating its matching tag.
        let active = unsafe { &value.cases.case1 };
        Ok(crate::Mark::Marked { witness: from1(&active.witness, scope)? })
    },
        _ => Err(Error::InvalidNative)
    }
}

fn to4(value: &crate::Marker, scope: &mut Scope) -> Result<T4, Error> {
    scope.charge(1, std::mem::size_of::<T4>())?;
    Ok(T4 { empty: 0 })
}
fn from4(value: &T4, scope: &mut Scope) -> Result<crate::Marker, Error> {
    checkpoint()?;
    scope.charge(1, std::mem::size_of::<T4>())?;
    Ok(crate::Marker {  })
}

fn to5(value: &(), scope: &mut Scope) -> Result<u8, Error> {
    scope.charge(1, std::mem::size_of::<u8>())?;
    Ok(0)
}
fn from5(value: &u8, scope: &mut Scope) -> Result<(), Error> {
    checkpoint()?;
    scope.charge(1, std::mem::size_of::<u8>())?;
    Ok(())
}

fn to6(value: &crate::Token, scope: &mut Scope) -> Result<T6, Error> {
    scope.charge(1, std::mem::size_of::<T6>())?;
    Ok(T6 { tag: to5(&value.tag, scope)? })
}
fn from6(value: &T6, scope: &mut Scope) -> Result<crate::Token, Error> {
    checkpoint()?;
    scope.charge(1, std::mem::size_of::<T6>())?;
    Ok(crate::Token { tag: from5(&value.tag, scope)? })
}

fn to7(value: &BigUint, scope: &mut Scope) -> Result<T7, Error> {
    scope.charge(1, std::mem::size_of::<T7>())?;
    let length = usize::try_from((value.bits() + 31) / 32).map_err(|_| Error::Limit)?;
    let mut digits = scope.vector::<u32>(length)?;
    digits.extend(value.iter_u32_digits());
    let length = digits.len();
    Ok(T7 { data: scope.keep(digits)?, length, ..Default::default() })
}
fn from7(value: &T7, scope: &mut Scope) -> Result<BigUint, Error> {
    checkpoint()?;
    scope.charge(1, std::mem::size_of::<T7>())?;
    scope.charge(value.length, 8)?;
    let digits = unsafe { checked_slice(value.data, value.length)? };
    if digits.last() == Some(&0) { return Err(Error::InvalidNative); }
    Ok(BigUint::from_slice(digits))
}

fn to8(value: &[crate::Witness], scope: &mut Scope) -> Result<T8, Error> {
    scope.charge(1, std::mem::size_of::<T8>())?;
    scope.charge(value.len(), 8)?;
    let mut items = scope.vector::<T1>(value.len())?;
    for item in value { items.push(to1(item, scope)?); }
    Ok(T8 { data: scope.keep(items)?, length: value.len(), ..Default::default() })
}
fn from8(value: &T8, scope: &mut Scope) -> Result<Vec<Witness>, Error> {
    checkpoint()?;
    scope.charge(1, std::mem::size_of::<T8>())?;
    let input = unsafe { checked_slice(value.data, value.length)? };
    scope.charge(input.len(), 8)?;
    let mut items = scope.vector::<crate::Witness>(input.len())?;
    for item in input { items.push(from1(item, scope)?); }
    Ok(items)
}


pub(super) fn call0(arg0: bool) -> Result<Option<Witness>, Error> {
    let native = runtime()?;
    let mut scope = Scope::new();
    let mut output = Output { value: T2::default(), clear: native.clear2 };
    let mut error = NativeError::default();
    let input0 = to0(&arg0, &mut scope)?;
    let status = unsafe { (native.call0)(input0, &mut output.value, &mut error) };
    
    check(status, &error)?;
    let result = { from2(&output.value, &mut scope) };
    result
}

pub(super) fn call1(arg0: bool) -> Result<Mark, Error> {
    let native = runtime()?;
    let mut scope = Scope::new();
    let mut output = Output { value: T3::default(), clear: native.clear3 };
    let mut error = NativeError::default();
    let input0 = to0(&arg0, &mut scope)?;
    let status = unsafe { (native.call1)(input0, &mut output.value, &mut error) };
    
    check(status, &error)?;
    let result = { from3(&output.value, &mut scope) };
    result
}

pub(super) fn call2() -> Result<Marker, Error> {
    let native = runtime()?;
    let mut scope = Scope::new();
    let mut output = Output { value: T4::default(), clear: native.clear4 };
    let mut error = NativeError::default();

    let status = unsafe { (native.call2)(&mut output.value, &mut error) };
    
    check(status, &error)?;
    let result = { from4(&output.value, &mut scope) };
    result
}

pub(super) fn call3() -> Result<Token, Error> {
    let native = runtime()?;
    let mut scope = Scope::new();
    let mut output = Output { value: T6::default(), clear: native.clear6 };
    let mut error = NativeError::default();

    let status = unsafe { (native.call3)(&mut output.value, &mut error) };
    
    check(status, &error)?;
    let result = { from6(&output.value, &mut scope) };
    result
}

pub(super) fn call4() -> Result<Witness, Error> {
    let native = runtime()?;
    let mut scope = Scope::new();
    let mut output = Output { value: T1::default(), clear: native.clear1 };
    let mut error = NativeError::default();

    let status = unsafe { (native.call4)(&mut output.value, &mut error) };
    
    check(status, &error)?;
    let result = { from1(&output.value, &mut scope) };
    result
}

pub(super) fn call5(arg0: &BigUint) -> Result<Vec<Witness>, Error> {
    let native = runtime()?;
    let mut scope = Scope::new();
    let mut output = Output { value: T8::default(), clear: native.clear8 };
    let mut error = NativeError::default();
    let input0 = to7(&arg0, &mut scope)?;
    let status = unsafe { (native.call5)(&input0, &mut output.value, &mut error) };
    
    check(status, &error)?;
    let result = { from8(&output.value, &mut scope) };
    result
}
