#![allow(dead_code, unused_imports, unused_variables)]
use crate::{Error, BigInt, BigUint, Ab, EmptySized, EmptyToken, Off, On, UnicodeToken, WideToken, ZeroToken};
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
    size: T0,
}

#[repr(C)]
#[derive(Clone, Copy, Default)]
struct T2 {
    data: *const T0,
    length: usize,
    owner: *mut std::ffi::c_void,
    release: Option<unsafe extern "C" fn(*mut std::ffi::c_void)>,
}

#[repr(C)]
#[derive(Clone, Copy, Default)]
struct T3 {
    data: T2,
}

#[repr(C)]
#[derive(Clone, Copy, Default)]
struct T4 {
    count: T0,
}

#[repr(C)]
#[derive(Clone, Copy, Default)]
struct T5 {
    count: T0,
}

#[repr(C)]
#[derive(Clone, Copy, Default)]
struct T6 {
    count: T0,
}

#[repr(C)]
#[derive(Clone, Copy, Default)]
struct T7 {
    count: T0,
}

#[repr(C)]
#[derive(Clone, Copy, Default)]
struct T8 {
    count: T0,
}

#[repr(C)]
#[derive(Clone, Copy, Default)]
struct T9 {
    count: T0,
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
    clear9: unsafe extern "C" fn(*mut T9),
    call0: unsafe extern "C" fn(*mut T1, *mut NativeError) -> i32,
    call1: unsafe extern "C" fn(*mut T3, *mut NativeError) -> i32,
    call2: unsafe extern "C" fn(*const T0, *mut T4, *mut NativeError) -> i32,
    call3: unsafe extern "C" fn(*mut T5, *mut NativeError) -> i32,
    call4: unsafe extern "C" fn(*mut T6, *mut NativeError) -> i32,
    call5: unsafe extern "C" fn(*const T0, *mut T7, *mut NativeError) -> i32,
    call6: unsafe extern "C" fn(*const T0, *mut T8, *mut NativeError) -> i32,
    call7: unsafe extern "C" fn(*const T0, *mut T9, *mut NativeError) -> i32,

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
            clear0: symbol!("checkedrecordvalueindices_nat_clear", unsafe extern "C" fn(*mut T0)),
            clear1: symbol!("checkedrecordvalueindices_ab_clear", unsafe extern "C" fn(*mut T1)),
            clear2: symbol!("checkedrecordvalueindices_array_nat_span_clear", unsafe extern "C" fn(*mut T2)),
            clear3: symbol!("checkedrecordvalueindices_empty_sized_clear", unsafe extern "C" fn(*mut T3)),
            clear4: symbol!("checkedrecordvalueindices_empty_token_clear", unsafe extern "C" fn(*mut T4)),
            clear5: symbol!("checkedrecordvalueindices_off_clear", unsafe extern "C" fn(*mut T5)),
            clear6: symbol!("checkedrecordvalueindices_on_clear", unsafe extern "C" fn(*mut T6)),
            clear7: symbol!("checkedrecordvalueindices_unicode_token_clear", unsafe extern "C" fn(*mut T7)),
            clear8: symbol!("checkedrecordvalueindices_wide_token_clear", unsafe extern "C" fn(*mut T8)),
            clear9: symbol!("checkedrecordvalueindices_zero_token_clear", unsafe extern "C" fn(*mut T9)),
            call0: symbol!("checkedrecordvalueindices_produce_ab", unsafe extern "C" fn(*mut T1, *mut NativeError) -> i32),
            call1: symbol!("checkedrecordvalueindices_produce_empty_sized", unsafe extern "C" fn(*mut T3, *mut NativeError) -> i32),
            call2: symbol!("checkedrecordvalueindices_produce_empty_string", unsafe extern "C" fn(*const T0, *mut T4, *mut NativeError) -> i32),
            call3: symbol!("checkedrecordvalueindices_produce_false_bool", unsafe extern "C" fn(*mut T5, *mut NativeError) -> i32),
            call4: symbol!("checkedrecordvalueindices_produce_true_bool", unsafe extern "C" fn(*mut T6, *mut NativeError) -> i32),
            call5: symbol!("checkedrecordvalueindices_produce_unicode_string", unsafe extern "C" fn(*const T0, *mut T7, *mut NativeError) -> i32),
            call6: symbol!("checkedrecordvalueindices_produce_wide_nat", unsafe extern "C" fn(*const T0, *mut T8, *mut NativeError) -> i32),
            call7: symbol!("checkedrecordvalueindices_produce_zero_nat", unsafe extern "C" fn(*const T0, *mut T9, *mut NativeError) -> i32),

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

fn to1(value: &crate::Ab, scope: &mut Scope) -> Result<T1, Error> {
    scope.charge(1, std::mem::size_of::<T1>())?;
    Ok(T1 { size: to0(&value.size, scope)? })
}
fn from1(value: &T1, scope: &mut Scope) -> Result<crate::Ab, Error> {
    checkpoint()?;
    scope.charge(1, std::mem::size_of::<T1>())?;
    Ok(crate::Ab { size: from0(&value.size, scope)? })
}

fn to2(value: &[BigUint], scope: &mut Scope) -> Result<T2, Error> {
    scope.charge(1, std::mem::size_of::<T2>())?;
    scope.charge(value.len(), 8)?;
    let mut items = scope.vector::<T0>(value.len())?;
    for item in value { items.push(to0(item, scope)?); }
    Ok(T2 { data: scope.keep(items)?, length: value.len(), ..Default::default() })
}
fn from2(value: &T2, scope: &mut Scope) -> Result<Vec<BigUint>, Error> {
    checkpoint()?;
    scope.charge(1, std::mem::size_of::<T2>())?;
    let input = unsafe { checked_slice(value.data, value.length)? };
    scope.charge(input.len(), 8)?;
    let mut items = scope.vector::<BigUint>(input.len())?;
    for item in input { items.push(from0(item, scope)?); }
    Ok(items)
}

fn to3(value: &crate::EmptySized, scope: &mut Scope) -> Result<T3, Error> {
    scope.charge(1, std::mem::size_of::<T3>())?;
    Ok(T3 { data: to2(&value.data, scope)? })
}
fn from3(value: &T3, scope: &mut Scope) -> Result<crate::EmptySized, Error> {
    checkpoint()?;
    scope.charge(1, std::mem::size_of::<T3>())?;
    Ok(crate::EmptySized { data: from2(&value.data, scope)? })
}

fn to4(value: &crate::EmptyToken, scope: &mut Scope) -> Result<T4, Error> {
    scope.charge(1, std::mem::size_of::<T4>())?;
    Ok(T4 { count: to0(&value.count, scope)? })
}
fn from4(value: &T4, scope: &mut Scope) -> Result<crate::EmptyToken, Error> {
    checkpoint()?;
    scope.charge(1, std::mem::size_of::<T4>())?;
    Ok(crate::EmptyToken { count: from0(&value.count, scope)? })
}

fn to5(value: &crate::Off, scope: &mut Scope) -> Result<T5, Error> {
    scope.charge(1, std::mem::size_of::<T5>())?;
    Ok(T5 { count: to0(&value.count, scope)? })
}
fn from5(value: &T5, scope: &mut Scope) -> Result<crate::Off, Error> {
    checkpoint()?;
    scope.charge(1, std::mem::size_of::<T5>())?;
    Ok(crate::Off { count: from0(&value.count, scope)? })
}

fn to6(value: &crate::On, scope: &mut Scope) -> Result<T6, Error> {
    scope.charge(1, std::mem::size_of::<T6>())?;
    Ok(T6 { count: to0(&value.count, scope)? })
}
fn from6(value: &T6, scope: &mut Scope) -> Result<crate::On, Error> {
    checkpoint()?;
    scope.charge(1, std::mem::size_of::<T6>())?;
    Ok(crate::On { count: from0(&value.count, scope)? })
}

fn to7(value: &crate::UnicodeToken, scope: &mut Scope) -> Result<T7, Error> {
    scope.charge(1, std::mem::size_of::<T7>())?;
    Ok(T7 { count: to0(&value.count, scope)? })
}
fn from7(value: &T7, scope: &mut Scope) -> Result<crate::UnicodeToken, Error> {
    checkpoint()?;
    scope.charge(1, std::mem::size_of::<T7>())?;
    Ok(crate::UnicodeToken { count: from0(&value.count, scope)? })
}

fn to8(value: &crate::WideToken, scope: &mut Scope) -> Result<T8, Error> {
    scope.charge(1, std::mem::size_of::<T8>())?;
    Ok(T8 { count: to0(&value.count, scope)? })
}
fn from8(value: &T8, scope: &mut Scope) -> Result<crate::WideToken, Error> {
    checkpoint()?;
    scope.charge(1, std::mem::size_of::<T8>())?;
    Ok(crate::WideToken { count: from0(&value.count, scope)? })
}

fn to9(value: &crate::ZeroToken, scope: &mut Scope) -> Result<T9, Error> {
    scope.charge(1, std::mem::size_of::<T9>())?;
    Ok(T9 { count: to0(&value.count, scope)? })
}
fn from9(value: &T9, scope: &mut Scope) -> Result<crate::ZeroToken, Error> {
    checkpoint()?;
    scope.charge(1, std::mem::size_of::<T9>())?;
    Ok(crate::ZeroToken { count: from0(&value.count, scope)? })
}


pub(super) fn call0() -> Result<Ab, Error> {
    let native = runtime()?;
    let mut scope = Scope::new();
    let mut output = Output { value: T1::default(), clear: native.clear1 };
    let mut error = NativeError::default();

    let status = unsafe { (native.call0)(&mut output.value, &mut error) };
    
    check(status, &error)?;
    let result = { from1(&output.value, &mut scope) };
    result
}

pub(super) fn call1() -> Result<EmptySized, Error> {
    let native = runtime()?;
    let mut scope = Scope::new();
    let mut output = Output { value: T3::default(), clear: native.clear3 };
    let mut error = NativeError::default();

    let status = unsafe { (native.call1)(&mut output.value, &mut error) };
    
    check(status, &error)?;
    let result = { from3(&output.value, &mut scope) };
    result
}

pub(super) fn call2(arg0: &BigUint) -> Result<EmptyToken, Error> {
    let native = runtime()?;
    let mut scope = Scope::new();
    let mut output = Output { value: T4::default(), clear: native.clear4 };
    let mut error = NativeError::default();
    let input0 = to0(&arg0, &mut scope)?;
    let status = unsafe { (native.call2)(&input0, &mut output.value, &mut error) };
    
    check(status, &error)?;
    let result = { from4(&output.value, &mut scope) };
    result
}

pub(super) fn call3() -> Result<Off, Error> {
    let native = runtime()?;
    let mut scope = Scope::new();
    let mut output = Output { value: T5::default(), clear: native.clear5 };
    let mut error = NativeError::default();

    let status = unsafe { (native.call3)(&mut output.value, &mut error) };
    
    check(status, &error)?;
    let result = { from5(&output.value, &mut scope) };
    result
}

pub(super) fn call4() -> Result<On, Error> {
    let native = runtime()?;
    let mut scope = Scope::new();
    let mut output = Output { value: T6::default(), clear: native.clear6 };
    let mut error = NativeError::default();

    let status = unsafe { (native.call4)(&mut output.value, &mut error) };
    
    check(status, &error)?;
    let result = { from6(&output.value, &mut scope) };
    result
}

pub(super) fn call5(arg0: &BigUint) -> Result<UnicodeToken, Error> {
    let native = runtime()?;
    let mut scope = Scope::new();
    let mut output = Output { value: T7::default(), clear: native.clear7 };
    let mut error = NativeError::default();
    let input0 = to0(&arg0, &mut scope)?;
    let status = unsafe { (native.call5)(&input0, &mut output.value, &mut error) };
    
    check(status, &error)?;
    let result = { from7(&output.value, &mut scope) };
    result
}

pub(super) fn call6(arg0: &BigUint) -> Result<WideToken, Error> {
    let native = runtime()?;
    let mut scope = Scope::new();
    let mut output = Output { value: T8::default(), clear: native.clear8 };
    let mut error = NativeError::default();
    let input0 = to0(&arg0, &mut scope)?;
    let status = unsafe { (native.call6)(&input0, &mut output.value, &mut error) };
    
    check(status, &error)?;
    let result = { from8(&output.value, &mut scope) };
    result
}

pub(super) fn call7(arg0: &BigUint) -> Result<ZeroToken, Error> {
    let native = runtime()?;
    let mut scope = Scope::new();
    let mut output = Output { value: T9::default(), clear: native.clear9 };
    let mut error = NativeError::default();
    let input0 = to0(&arg0, &mut scope)?;
    let status = unsafe { (native.call7)(&input0, &mut output.value, &mut error) };
    
    check(status, &error)?;
    let result = { from9(&output.value, &mut scope) };
    result
}
