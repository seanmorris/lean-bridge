#![allow(dead_code, unused_imports, unused_variables)]
use crate::{Error, BigInt, BigUint, Packet, Choice, Holder};
use std::sync::{OnceLock, atomic::{AtomicU32, Ordering}};
#[path = "assets.rs"] mod assets;
unsafe extern "C" { fn dlsym(library: *mut std::ffi::c_void, name: *const std::ffi::c_char) -> *mut std::ffi::c_void; }
#[repr(C)]
#[derive(Clone, Copy, Default)]
struct T0 {
    data: *const u32,
    length: usize,
    owner: *mut std::ffi::c_void,
    release: Option<unsafe extern "C" fn(*mut std::ffi::c_void)>,
}

#[repr(C)]
#[derive(Clone, Copy, Default)]
struct T1 {
    digit: T0,
    word: T0,
}

#[repr(C)]
#[derive(Clone, Copy, Default)]
struct T2 {
    data: *const T1,
    length: usize,
    owner: *mut std::ffi::c_void,
    release: Option<unsafe extern "C" fn(*mut std::ffi::c_void)>,
}

#[repr(C)]
#[derive(Clone, Copy, Default)]
struct B3_0 {
    empty: u8,
}

#[repr(C)]
#[derive(Clone, Copy, Default)]
struct B3_1 {
    value: T1,
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
    is_ok: u8,
    ok: T1,
    error: T1,
}

#[repr(C)]
#[derive(Clone, Copy, Default)]
struct T5 {
    packet: T1,
    tag: T0,
}

#[repr(C)]
#[derive(Clone, Copy, Default)]
struct T6 {
    data: *const T1,
    length: usize,
    owner: *mut std::ffi::c_void,
    release: Option<unsafe extern "C" fn(*mut std::ffi::c_void)>,
}

#[repr(C)]
#[derive(Clone, Copy, Default)]
struct T7 {
    has_value: u8,
    value: T1,
}

#[repr(C)]
#[derive(Clone, Copy, Default)]
struct T8 {
    fst: T1,
    snd: T1,
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
    clear0: unsafe extern "C" fn(*mut T0),
    clear1: unsafe extern "C" fn(*mut T1),
    clear2: unsafe extern "C" fn(*mut T2),
    clear3: unsafe extern "C" fn(*mut T3),
    clear4: unsafe extern "C" fn(*mut T4),
    clear5: unsafe extern "C" fn(*mut T5),
    clear6: unsafe extern "C" fn(*mut T6),
    clear7: unsafe extern "C" fn(*mut T7),
    clear8: unsafe extern "C" fn(*mut T8),
    call0: unsafe extern "C" fn(*const T2, *mut T2, *mut NativeError) -> i32,
    call1: unsafe extern "C" fn(*const T1, *mut T0, *mut NativeError) -> i32,
    call2: unsafe extern "C" fn(*const T2, *mut T0, *mut NativeError) -> i32,
    call3: unsafe extern "C" fn(*const T3, *mut T0, *mut NativeError) -> i32,
    call4: unsafe extern "C" fn(*const T4, *mut T0, *mut NativeError) -> i32,
    call5: unsafe extern "C" fn(*const T5, *mut T0, *mut NativeError) -> i32,
    call6: unsafe extern "C" fn(*const T6, *mut T0, *mut NativeError) -> i32,
    call7: unsafe extern "C" fn(*const T7, *mut T0, *mut NativeError) -> i32,
    call8: unsafe extern "C" fn(*const T8, *mut T0, *mut NativeError) -> i32,
    call9: unsafe extern "C" fn(*const T1, *const T1, *mut T0, *mut NativeError) -> i32,
    call10: unsafe extern "C" fn(*const T0, *mut T2, *mut NativeError) -> i32,
    call11: unsafe extern "C" fn(*const T0, *mut T7, *mut NativeError) -> i32,
    call12: unsafe extern "C" fn(*const T1, *mut T0, *mut NativeError) -> i32,

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
            clear0: symbol!("nestedcheckedrecords_nat_clear", unsafe extern "C" fn(*mut T0)),
            clear1: symbol!("nestedcheckedrecords_packet_clear", unsafe extern "C" fn(*mut T1)),
            clear2: symbol!("nestedcheckedrecords_array_lean_nested_checked_records_packet_span_clear", unsafe extern "C" fn(*mut T2)),
            clear3: symbol!("nestedcheckedrecords_choice_clear", unsafe extern "C" fn(*mut T3)),
            clear4: symbol!("nestedcheckedrecords_result_lean_nested_checked_records_packet_lean_nested_checked_records_packet_value_clear", unsafe extern "C" fn(*mut T4)),
            clear5: symbol!("nestedcheckedrecords_holder_clear", unsafe extern "C" fn(*mut T5)),
            clear6: symbol!("nestedcheckedrecords_list_lean_nested_checked_records_packet_span_clear", unsafe extern "C" fn(*mut T6)),
            clear7: symbol!("nestedcheckedrecords_option_lean_nested_checked_records_packet_value_clear", unsafe extern "C" fn(*mut T7)),
            clear8: symbol!("nestedcheckedrecords_tuple_lean_nested_checked_records_packet_lean_nested_checked_records_packet_value_clear", unsafe extern "C" fn(*mut T8)),
            call0: symbol!("nestedcheckedrecords_echo_array", unsafe extern "C" fn(*const T2, *mut T2, *mut NativeError) -> i32),
            call1: symbol!("nestedcheckedrecords_first", unsafe extern "C" fn(*const T1, *mut T0, *mut NativeError) -> i32),
            call2: symbol!("nestedcheckedrecords_in_array", unsafe extern "C" fn(*const T2, *mut T0, *mut NativeError) -> i32),
            call3: symbol!("nestedcheckedrecords_in_choice", unsafe extern "C" fn(*const T3, *mut T0, *mut NativeError) -> i32),
            call4: symbol!("nestedcheckedrecords_in_except", unsafe extern "C" fn(*const T4, *mut T0, *mut NativeError) -> i32),
            call5: symbol!("nestedcheckedrecords_in_holder", unsafe extern "C" fn(*const T5, *mut T0, *mut NativeError) -> i32),
            call6: symbol!("nestedcheckedrecords_in_list", unsafe extern "C" fn(*const T6, *mut T0, *mut NativeError) -> i32),
            call7: symbol!("nestedcheckedrecords_in_option", unsafe extern "C" fn(*const T7, *mut T0, *mut NativeError) -> i32),
            call8: symbol!("nestedcheckedrecords_in_product", unsafe extern "C" fn(*const T8, *mut T0, *mut NativeError) -> i32),
            call9: symbol!("nestedcheckedrecords_pair", unsafe extern "C" fn(*const T1, *const T1, *mut T0, *mut NativeError) -> i32),
            call10: symbol!("nestedcheckedrecords_produce_array", unsafe extern "C" fn(*const T0, *mut T2, *mut NativeError) -> i32),
            call11: symbol!("nestedcheckedrecords_produce_option", unsafe extern "C" fn(*const T0, *mut T7, *mut NativeError) -> i32),
            call12: symbol!("nestedcheckedrecords_second", unsafe extern "C" fn(*const T1, *mut T0, *mut NativeError) -> i32),

        })
    }).as_ref().map_err(Clone::clone)
}
fn to0(value: &BigUint, scope: &mut Scope) -> Result<T0, Error> {
    scope.charge(1, std::mem::size_of::<T0>())?;
    let length = usize::try_from((value.bits() + 31) / 32).map_err(|_| Error::Limit)?;
    let mut digits = scope.vector::<u32>(length)?;
    digits.extend(value.iter_u32_digits());
    let length = digits.len();
    Ok(T0 { data: scope.keep(digits)?, length, ..Default::default() })
}
fn from0(value: &T0, scope: &mut Scope) -> Result<BigUint, Error> {
    checkpoint()?;
    scope.charge(1, std::mem::size_of::<T0>())?;
    scope.charge(value.length, 8)?;
    let digits = unsafe { checked_slice(value.data, value.length)? };
    if digits.last() == Some(&0) { return Err(Error::InvalidNative); }
    Ok(BigUint::from_slice(digits))
}

fn to1(value: &crate::Packet, scope: &mut Scope) -> Result<T1, Error> {
    scope.charge(1, std::mem::size_of::<T1>())?;
    Ok(T1 { digit: to0(&value.digit, scope)?, word: to0(&value.word, scope)? })
}
fn from1(value: &T1, scope: &mut Scope) -> Result<crate::Packet, Error> {
    checkpoint()?;
    scope.charge(1, std::mem::size_of::<T1>())?;
    Ok(crate::Packet { digit: from0(&value.digit, scope)?, word: from0(&value.word, scope)? })
}

fn to2(value: &[crate::Packet], scope: &mut Scope) -> Result<T2, Error> {
    scope.charge(1, std::mem::size_of::<T2>())?;
    scope.charge(value.len(), 8)?;
    let mut items = scope.vector::<T1>(value.len())?;
    for item in value { items.push(to1(item, scope)?); }
    Ok(T2 { data: scope.keep(items)?, length: value.len(), ..Default::default() })
}
fn from2(value: &T2, scope: &mut Scope) -> Result<Vec<Packet>, Error> {
    checkpoint()?;
    scope.charge(1, std::mem::size_of::<T2>())?;
    let input = unsafe { checked_slice(value.data, value.length)? };
    scope.charge(input.len(), 8)?;
    let mut items = scope.vector::<crate::Packet>(input.len())?;
    for item in input { items.push(from1(item, scope)?); }
    Ok(items)
}

fn to3(value: &Choice, scope: &mut Scope) -> Result<T3, Error> {
    scope.charge(1, std::mem::size_of::<T3>())?;
    match value {
        crate::Choice::Empty => Ok(T3 { kind: 0, cases: V3 { case0: B3_0 { empty: 0 } } }),
        crate::Choice::Packet { value: field0 } => Ok(T3 { kind: 1, cases: V3 { case1: B3_1 { value: to1(field0, scope)? } } }),
    }
}
fn from3(value: &T3, scope: &mut Scope) -> Result<Choice, Error> {
    checkpoint()?;
    scope.charge(1, std::mem::size_of::<T3>())?;
    match value.kind {
        0 => Ok(crate::Choice::Empty),
        1 => {
        // Read this union member only after validating its matching tag.
        let active = unsafe { &value.cases.case1 };
        Ok(crate::Choice::Packet { value: from1(&active.value, scope)? })
    },
        _ => Err(Error::InvalidNative)
    }
}

fn to4(value: &Result<Packet, Packet>, scope: &mut Scope) -> Result<T4, Error> {
    scope.charge(1, std::mem::size_of::<T4>())?;
    match value { Ok(inner) => Ok(T4 { is_ok: 1, ok: to1(inner, scope)?, ..Default::default() }), Err(inner) => Ok(T4 { error: to1(inner, scope)?, ..Default::default() }) }
}
fn from4(value: &T4, scope: &mut Scope) -> Result<Result<Packet, Packet>, Error> {
    checkpoint()?;
    scope.charge(1, std::mem::size_of::<T4>())?;
    match value.is_ok { 1 => Ok(Ok(from1(&value.ok, scope)?)), 0 => Ok(Err(from1(&value.error, scope)?)), _ => Err(Error::InvalidNative) }
}

fn to5(value: &crate::Holder, scope: &mut Scope) -> Result<T5, Error> {
    scope.charge(1, std::mem::size_of::<T5>())?;
    Ok(T5 { packet: to1(&value.packet, scope)?, tag: to0(&value.tag, scope)? })
}
fn from5(value: &T5, scope: &mut Scope) -> Result<crate::Holder, Error> {
    checkpoint()?;
    scope.charge(1, std::mem::size_of::<T5>())?;
    Ok(crate::Holder { packet: from1(&value.packet, scope)?, tag: from0(&value.tag, scope)? })
}

fn to6(value: &[crate::Packet], scope: &mut Scope) -> Result<T6, Error> {
    scope.charge(1, std::mem::size_of::<T6>())?;
    scope.charge(value.len(), 8)?;
    let mut items = scope.vector::<T1>(value.len())?;
    for item in value { items.push(to1(item, scope)?); }
    Ok(T6 { data: scope.keep(items)?, length: value.len(), ..Default::default() })
}
fn from6(value: &T6, scope: &mut Scope) -> Result<Vec<Packet>, Error> {
    checkpoint()?;
    scope.charge(1, std::mem::size_of::<T6>())?;
    let input = unsafe { checked_slice(value.data, value.length)? };
    scope.charge(input.len(), 8)?;
    let mut items = scope.vector::<crate::Packet>(input.len())?;
    for item in input { items.push(from1(item, scope)?); }
    Ok(items)
}

fn to7(value: &Option<Packet>, scope: &mut Scope) -> Result<T7, Error> {
    scope.charge(1, std::mem::size_of::<T7>())?;
    match value { None => Ok(T7::default()), Some(inner) => Ok(T7 { has_value: 1, value: to1(inner, scope)? }) }
}
fn from7(value: &T7, scope: &mut Scope) -> Result<Option<Packet>, Error> {
    checkpoint()?;
    scope.charge(1, std::mem::size_of::<T7>())?;
    match value.has_value { 0 => Ok(None), 1 => Ok(Some(from1(&value.value, scope)?)), _ => Err(Error::InvalidNative) }
}

fn to8(value: &(Packet, Packet), scope: &mut Scope) -> Result<T8, Error> {
    scope.charge(1, std::mem::size_of::<T8>())?;
    Ok(T8 { fst: to1(&value.0, scope)?, snd: to1(&value.1, scope)? })
}
fn from8(value: &T8, scope: &mut Scope) -> Result<(Packet, Packet), Error> {
    checkpoint()?;
    scope.charge(1, std::mem::size_of::<T8>())?;
    Ok((from1(&value.fst, scope)?, from1(&value.snd, scope)?))
}


pub(super) fn call0(arg0: &[Packet]) -> Result<Vec<Packet>, Error> {
    let native = runtime()?;
    let mut scope = Scope::new();
    let mut output = Output { value: T2::default(), clear: native.clear2 };
    let mut error = NativeError::default();
    let input0 = to2(&arg0, &mut scope)?;
    let status = unsafe { (native.call0)(&input0, &mut output.value, &mut error) };
    
    check(status, &error)?;
    let result = { from2(&output.value, &mut scope) };
    result
}

pub(super) fn call1(arg0: &Packet) -> Result<BigUint, Error> {
    let native = runtime()?;
    let mut scope = Scope::new();
    let mut output = Output { value: T0::default(), clear: native.clear0 };
    let mut error = NativeError::default();
    let input0 = to1(&arg0, &mut scope)?;
    let status = unsafe { (native.call1)(&input0, &mut output.value, &mut error) };
    
    check(status, &error)?;
    let result = { from0(&output.value, &mut scope) };
    result
}

pub(super) fn call2(arg0: &[Packet]) -> Result<BigUint, Error> {
    let native = runtime()?;
    let mut scope = Scope::new();
    let mut output = Output { value: T0::default(), clear: native.clear0 };
    let mut error = NativeError::default();
    let input0 = to2(&arg0, &mut scope)?;
    let status = unsafe { (native.call2)(&input0, &mut output.value, &mut error) };
    
    check(status, &error)?;
    let result = { from0(&output.value, &mut scope) };
    result
}

pub(super) fn call3(arg0: &Choice) -> Result<BigUint, Error> {
    let native = runtime()?;
    let mut scope = Scope::new();
    let mut output = Output { value: T0::default(), clear: native.clear0 };
    let mut error = NativeError::default();
    let input0 = to3(&arg0, &mut scope)?;
    let status = unsafe { (native.call3)(&input0, &mut output.value, &mut error) };
    
    check(status, &error)?;
    let result = { from0(&output.value, &mut scope) };
    result
}

pub(super) fn call4(arg0: &Result<Packet, Packet>) -> Result<BigUint, Error> {
    let native = runtime()?;
    let mut scope = Scope::new();
    let mut output = Output { value: T0::default(), clear: native.clear0 };
    let mut error = NativeError::default();
    let input0 = to4(&arg0, &mut scope)?;
    let status = unsafe { (native.call4)(&input0, &mut output.value, &mut error) };
    
    check(status, &error)?;
    let result = { from0(&output.value, &mut scope) };
    result
}

pub(super) fn call5(arg0: &Holder) -> Result<BigUint, Error> {
    let native = runtime()?;
    let mut scope = Scope::new();
    let mut output = Output { value: T0::default(), clear: native.clear0 };
    let mut error = NativeError::default();
    let input0 = to5(&arg0, &mut scope)?;
    let status = unsafe { (native.call5)(&input0, &mut output.value, &mut error) };
    
    check(status, &error)?;
    let result = { from0(&output.value, &mut scope) };
    result
}

pub(super) fn call6(arg0: &[Packet]) -> Result<BigUint, Error> {
    let native = runtime()?;
    let mut scope = Scope::new();
    let mut output = Output { value: T0::default(), clear: native.clear0 };
    let mut error = NativeError::default();
    let input0 = to6(&arg0, &mut scope)?;
    let status = unsafe { (native.call6)(&input0, &mut output.value, &mut error) };
    
    check(status, &error)?;
    let result = { from0(&output.value, &mut scope) };
    result
}

pub(super) fn call7(arg0: &Option<Packet>) -> Result<BigUint, Error> {
    let native = runtime()?;
    let mut scope = Scope::new();
    let mut output = Output { value: T0::default(), clear: native.clear0 };
    let mut error = NativeError::default();
    let input0 = to7(&arg0, &mut scope)?;
    let status = unsafe { (native.call7)(&input0, &mut output.value, &mut error) };
    
    check(status, &error)?;
    let result = { from0(&output.value, &mut scope) };
    result
}

pub(super) fn call8(arg0: &(Packet, Packet)) -> Result<BigUint, Error> {
    let native = runtime()?;
    let mut scope = Scope::new();
    let mut output = Output { value: T0::default(), clear: native.clear0 };
    let mut error = NativeError::default();
    let input0 = to8(&arg0, &mut scope)?;
    let status = unsafe { (native.call8)(&input0, &mut output.value, &mut error) };
    
    check(status, &error)?;
    let result = { from0(&output.value, &mut scope) };
    result
}

pub(super) fn call9(arg0: &Packet, arg1: &Packet) -> Result<BigUint, Error> {
    let native = runtime()?;
    let mut scope = Scope::new();
    let mut output = Output { value: T0::default(), clear: native.clear0 };
    let mut error = NativeError::default();
    let input0 = to1(&arg0, &mut scope)?;
    let input1 = to1(&arg1, &mut scope)?;
    let status = unsafe { (native.call9)(&input0, &input1, &mut output.value, &mut error) };
    
    check(status, &error)?;
    let result = { from0(&output.value, &mut scope) };
    result
}

pub(super) fn call10(arg0: &BigUint) -> Result<Vec<Packet>, Error> {
    let native = runtime()?;
    let mut scope = Scope::new();
    let mut output = Output { value: T2::default(), clear: native.clear2 };
    let mut error = NativeError::default();
    let input0 = to0(&arg0, &mut scope)?;
    let status = unsafe { (native.call10)(&input0, &mut output.value, &mut error) };
    
    check(status, &error)?;
    let result = { from2(&output.value, &mut scope) };
    result
}

pub(super) fn call11(arg0: &BigUint) -> Result<Option<Packet>, Error> {
    let native = runtime()?;
    let mut scope = Scope::new();
    let mut output = Output { value: T7::default(), clear: native.clear7 };
    let mut error = NativeError::default();
    let input0 = to0(&arg0, &mut scope)?;
    let status = unsafe { (native.call11)(&input0, &mut output.value, &mut error) };
    
    check(status, &error)?;
    let result = { from7(&output.value, &mut scope) };
    result
}

pub(super) fn call12(arg0: &Packet) -> Result<BigUint, Error> {
    let native = runtime()?;
    let mut scope = Scope::new();
    let mut output = Output { value: T0::default(), clear: native.clear0 };
    let mut error = NativeError::default();
    let input0 = to1(&arg0, &mut scope)?;
    let status = unsafe { (native.call12)(&input0, &mut output.value, &mut error) };
    
    check(status, &error)?;
    let result = { from0(&output.value, &mut scope) };
    result
}
