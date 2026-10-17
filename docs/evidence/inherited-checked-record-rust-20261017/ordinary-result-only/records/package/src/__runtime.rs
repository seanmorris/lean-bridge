#![allow(dead_code, unused_imports, unused_variables)]
use crate::{Error, BigInt, BigUint, Span, Ticket, Stamped};
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
    lo: T0,
    hi: T0,
}

#[repr(C)]
#[derive(Clone, Copy, Default)]
struct T2 {
    to_span: T1,
    word: T0,
}

#[repr(C)]
#[derive(Clone, Copy, Default)]
struct T3 {
    to_ticket: T2,
    mark: T0,
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
    call0: unsafe extern "C" fn(*const T0, *mut T2, *mut NativeError) -> i32,
    call1: unsafe extern "C" fn(*const T0, *mut T3, *mut NativeError) -> i32,

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
            clear0: symbol!("inheritedcheckedrecords_nat_clear", unsafe extern "C" fn(*mut T0)),
            clear1: symbol!("inheritedcheckedrecords_span_clear", unsafe extern "C" fn(*mut T1)),
            clear2: symbol!("inheritedcheckedrecords_ticket_clear", unsafe extern "C" fn(*mut T2)),
            clear3: symbol!("inheritedcheckedrecords_stamped_clear", unsafe extern "C" fn(*mut T3)),
            call0: symbol!("inheritedcheckedrecords_produce", unsafe extern "C" fn(*const T0, *mut T2, *mut NativeError) -> i32),
            call1: symbol!("inheritedcheckedrecords_produce_stamped", unsafe extern "C" fn(*const T0, *mut T3, *mut NativeError) -> i32),

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

fn to1(value: &crate::Span, scope: &mut Scope) -> Result<T1, Error> {
    scope.charge(1, std::mem::size_of::<T1>())?;
    Ok(T1 { lo: to0(&value.lo, scope)?, hi: to0(&value.hi, scope)? })
}
fn from1(value: &T1, scope: &mut Scope) -> Result<crate::Span, Error> {
    checkpoint()?;
    scope.charge(1, std::mem::size_of::<T1>())?;
    Ok(crate::Span { lo: from0(&value.lo, scope)?, hi: from0(&value.hi, scope)? })
}

fn to2(value: &crate::Ticket, scope: &mut Scope) -> Result<T2, Error> {
    scope.charge(1, std::mem::size_of::<T2>())?;
    Ok(T2 { to_span: to1(&value.to_span, scope)?, word: to0(&value.word, scope)? })
}
fn from2(value: &T2, scope: &mut Scope) -> Result<crate::Ticket, Error> {
    checkpoint()?;
    scope.charge(1, std::mem::size_of::<T2>())?;
    Ok(crate::Ticket { to_span: from1(&value.to_span, scope)?, word: from0(&value.word, scope)? })
}

fn to3(value: &crate::Stamped, scope: &mut Scope) -> Result<T3, Error> {
    scope.charge(1, std::mem::size_of::<T3>())?;
    Ok(T3 { to_ticket: to2(&value.to_ticket, scope)?, mark: to0(&value.mark, scope)? })
}
fn from3(value: &T3, scope: &mut Scope) -> Result<crate::Stamped, Error> {
    checkpoint()?;
    scope.charge(1, std::mem::size_of::<T3>())?;
    Ok(crate::Stamped { to_ticket: from2(&value.to_ticket, scope)?, mark: from0(&value.mark, scope)? })
}


pub(super) fn call0(arg0: &BigUint) -> Result<Ticket, Error> {
    let native = runtime()?;
    let mut scope = Scope::new();
    let mut output = Output { value: T2::default(), clear: native.clear2 };
    let mut error = NativeError::default();
    let input0 = to0(&arg0, &mut scope)?;
    let status = unsafe { (native.call0)(&input0, &mut output.value, &mut error) };
    
    check(status, &error)?;
    let result = { from2(&output.value, &mut scope) };
    result
}

pub(super) fn call1(arg0: &BigUint) -> Result<Stamped, Error> {
    let native = runtime()?;
    let mut scope = Scope::new();
    let mut output = Output { value: T3::default(), clear: native.clear3 };
    let mut error = NativeError::default();
    let input0 = to0(&arg0, &mut scope)?;
    let status = unsafe { (native.call1)(&input0, &mut output.value, &mut error) };
    
    check(status, &error)?;
    let result = { from3(&output.value, &mut scope) };
    result
}
