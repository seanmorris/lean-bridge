#![allow(dead_code, unused_imports, unused_variables)]
use crate::{Error, BigInt, BigUint, GenericNat, Envelope, Event, AliasPair, Pair, EnvelopeAlias};
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
    value: T0,
    marker: T0,
}

#[repr(C)]
#[derive(Clone, Copy, Default)]
struct T2 {
    payload: T0,
    digit: T0,
}

#[repr(C)]
#[derive(Clone, Copy, Default)]
struct T3 {
    has_value: u8,
    value: T2,
}

#[repr(C)]
#[derive(Clone, Copy, Default)]
struct T4 {
    data: *const T3,
    length: usize,
    owner: *mut std::ffi::c_void,
    release: Option<unsafe extern "C" fn(*mut std::ffi::c_void)>,
}

#[repr(C)]
#[derive(Clone, Copy, Default)]
struct T5 {
    data: *const T0,
    length: usize,
    owner: *mut std::ffi::c_void,
    release: Option<unsafe extern "C" fn(*mut std::ffi::c_void)>,
}

#[repr(C)]
#[derive(Clone, Copy, Default)]
struct T6 {
    is_ok: u8,
    ok: T0,
    error: T0,
}

#[repr(C)]
#[derive(Clone, Copy, Default)]
struct T7 {
    has_value: u8,
    value: T6,
}

#[repr(C)]
#[derive(Clone, Copy, Default)]
struct T8 {
    data: *const T7,
    length: usize,
    owner: *mut std::ffi::c_void,
    release: Option<unsafe extern "C" fn(*mut std::ffi::c_void)>,
}

#[repr(C)]
#[derive(Clone, Copy, Default)]
struct B9_0 {
    empty: u8,
}

#[repr(C)]
#[derive(Clone, Copy, Default)]
struct B9_1 {
    value: T2,
}

#[repr(C)]
#[derive(Clone, Copy, Default)]
struct B9_2 {
    values: T8,
}

#[repr(C)]
#[derive(Clone, Copy)]
union V9 {
    case0: B9_0,
    case1: B9_1,
    case2: B9_2,
}
impl Default for V9 {
    fn default() -> Self {
        // Every private ABI field admits zero; there are no Rust references or owning values.
        unsafe { std::mem::zeroed() }
    }
}
#[repr(C)]
#[derive(Clone, Copy, Default)]
struct T9 { kind: u32, cases: V9 }

#[repr(C)]
#[derive(Clone, Copy, Default)]
struct T10 {
    left: T4,
    right: T4,
}

#[repr(C)]
#[derive(Clone, Copy, Default)]
struct T11 {
    data: *const T0,
    length: usize,
    owner: *mut std::ffi::c_void,
    release: Option<unsafe extern "C" fn(*mut std::ffi::c_void)>,
}

#[repr(C)]
#[derive(Clone, Copy, Default)]
struct T12 {
    left: T2,
    right: T2,
}

#[repr(C)]
#[derive(Clone, Copy, Default)]
struct T13 {
    has_value: u8,
    value: T0,
}

#[repr(C)]
#[derive(Clone, Copy, Default)]
struct T14 {
    fst: T0,
    snd: T0,
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
    clear10: unsafe extern "C" fn(*mut T10),
    clear11: unsafe extern "C" fn(*mut T11),
    clear12: unsafe extern "C" fn(*mut T12),
    clear13: unsafe extern "C" fn(*mut T13),
    clear14: unsafe extern "C" fn(*mut T14),
    call0: unsafe extern "C" fn(*const T1, *mut T1, *mut NativeError) -> i32,
    call1: unsafe extern "C" fn(*const T1, *mut T1, *mut NativeError) -> i32,
    call2: unsafe extern "C" fn(*const T1, *mut T0, *mut NativeError) -> i32,
    call3: unsafe extern "C" fn(*const T4, *const T4, *mut T0, *mut NativeError) -> i32,
    call4: unsafe extern "C" fn(*const T0, *mut T5, *mut NativeError) -> i32,
    call5: unsafe extern "C" fn(*const T0, *mut T6, *mut NativeError) -> i32,
    call6: unsafe extern "C" fn(*const T2, *const T2, *mut T0, *mut NativeError) -> i32,
    call7: unsafe extern "C" fn(*const T2, *mut T2, *mut NativeError) -> i32,
    call8: unsafe extern "C" fn(*const T9, *mut T9, *mut NativeError) -> i32,
    call9: unsafe extern "C" fn(*const T4, *mut T4, *mut NativeError) -> i32,
    call10: unsafe extern "C" fn(*const T10, *mut T10, *mut NativeError) -> i32,
    call11: unsafe extern "C" fn(*const T0, *mut T9, *mut NativeError) -> i32,
    call12: unsafe extern "C" fn(*const T0, *mut T9, *mut NativeError) -> i32,
    call13: unsafe extern "C" fn(*const T9, *mut T0, *mut NativeError) -> i32,
    call14: unsafe extern "C" fn(*const T9, *mut T0, *mut NativeError) -> i32,
    call15: unsafe extern "C" fn(*const T0, *mut T9, *mut NativeError) -> i32,
    call16: unsafe extern "C" fn(*const T2, *mut T0, *mut NativeError) -> i32,
    call17: unsafe extern "C" fn(*const T0, *mut T4, *mut NativeError) -> i32,
    call18: unsafe extern "C" fn(*const T10, *mut T0, *mut NativeError) -> i32,
    call19: unsafe extern "C" fn(*const T0, *mut T11, *mut NativeError) -> i32,
    call20: unsafe extern "C" fn(*const T12, *mut T0, *mut NativeError) -> i32,
    call21: unsafe extern "C" fn(*const T0, *mut T5, *mut NativeError) -> i32,
    call22: unsafe extern "C" fn(*const T0, *mut T13, *mut NativeError) -> i32,
    call23: unsafe extern "C" fn(*const T0, *mut T10, *mut NativeError) -> i32,
    call24: unsafe extern "C" fn(*const T0, *mut T0, *mut NativeError) -> i32,
    call25: unsafe extern "C" fn(*const T0, *mut T2, *mut NativeError) -> i32,
    call26: unsafe extern "C" fn(*const T0, *mut T14, *mut NativeError) -> i32,
    call27: unsafe extern "C" fn(*const T0, *mut T0, *mut NativeError) -> i32,
    call28: unsafe extern "C" fn(*const T2, *mut T0, *mut NativeError) -> i32,

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
            clear0: symbol!("nominalsubtypes_nat_clear", unsafe extern "C" fn(*mut T0)),
            clear1: symbol!("nominalsubtypes_generic_nat_clear", unsafe extern "C" fn(*mut T1)),
            clear2: symbol!("nominalsubtypes_envelope_clear", unsafe extern "C" fn(*mut T2)),
            clear3: symbol!("nominalsubtypes_option_lean_nominal_subtypes_envelope_value_clear", unsafe extern "C" fn(*mut T3)),
            clear4: symbol!("nominalsubtypes_array_option_lean_nominal_subtypes_envelope_span_clear", unsafe extern "C" fn(*mut T4)),
            clear5: symbol!("nominalsubtypes_array_nat_span_clear", unsafe extern "C" fn(*mut T5)),
            clear6: symbol!("nominalsubtypes_result_nat_nat_value_clear", unsafe extern "C" fn(*mut T6)),
            clear7: symbol!("nominalsubtypes_option_result_nat_nat_value_clear", unsafe extern "C" fn(*mut T7)),
            clear8: symbol!("nominalsubtypes_array_option_result_nat_nat_span_clear", unsafe extern "C" fn(*mut T8)),
            clear9: symbol!("nominalsubtypes_event_clear", unsafe extern "C" fn(*mut T9)),
            clear10: symbol!("nominalsubtypes_alias_pair_clear", unsafe extern "C" fn(*mut T10)),
            clear11: symbol!("nominalsubtypes_list_nat_span_clear", unsafe extern "C" fn(*mut T11)),
            clear12: symbol!("nominalsubtypes_pair_clear", unsafe extern "C" fn(*mut T12)),
            clear13: symbol!("nominalsubtypes_option_nat_value_clear", unsafe extern "C" fn(*mut T13)),
            clear14: symbol!("nominalsubtypes_tuple_nat_nat_value_clear", unsafe extern "C" fn(*mut T14)),
            call0: symbol!("nominalsubtypes_echo_generic_first", unsafe extern "C" fn(*const T1, *mut T1, *mut NativeError) -> i32),
            call1: symbol!("nominalsubtypes_echo_generic_second", unsafe extern "C" fn(*const T1, *mut T1, *mut NativeError) -> i32),
            call2: symbol!("nominalsubtypes_generic_use", unsafe extern "C" fn(*const T1, *mut T0, *mut NativeError) -> i32),
            call3: symbol!("nominalsubtypes_aliases", unsafe extern "C" fn(*const T4, *const T4, *mut T0, *mut NativeError) -> i32),
            call4: symbol!("nominalsubtypes_array_values", unsafe extern "C" fn(*const T0, *mut T5, *mut NativeError) -> i32),
            call5: symbol!("nominalsubtypes_branch", unsafe extern "C" fn(*const T0, *mut T6, *mut NativeError) -> i32),
            call6: symbol!("nominalsubtypes_combine", unsafe extern "C" fn(*const T2, *const T2, *mut T0, *mut NativeError) -> i32),
            call7: symbol!("nominalsubtypes_echo", unsafe extern "C" fn(*const T2, *mut T2, *mut NativeError) -> i32),
            call8: symbol!("nominalsubtypes_echo_event", unsafe extern "C" fn(*const T9, *mut T9, *mut NativeError) -> i32),
            call9: symbol!("nominalsubtypes_echo_groups", unsafe extern "C" fn(*const T4, *mut T4, *mut NativeError) -> i32),
            call10: symbol!("nominalsubtypes_echo_pair", unsafe extern "C" fn(*const T10, *mut T10, *mut NativeError) -> i32),
            call11: symbol!("nominalsubtypes_event_choices", unsafe extern "C" fn(*const T0, *mut T9, *mut NativeError) -> i32),
            call12: symbol!("nominalsubtypes_event_empty", unsafe extern "C" fn(*const T0, *mut T9, *mut NativeError) -> i32),
            call13: symbol!("nominalsubtypes_event_first", unsafe extern "C" fn(*const T9, *mut T0, *mut NativeError) -> i32),
            call14: symbol!("nominalsubtypes_event_second", unsafe extern "C" fn(*const T9, *mut T0, *mut NativeError) -> i32),
            call15: symbol!("nominalsubtypes_event_value", unsafe extern "C" fn(*const T0, *mut T9, *mut NativeError) -> i32),
            call16: symbol!("nominalsubtypes_first", unsafe extern "C" fn(*const T2, *mut T0, *mut NativeError) -> i32),
            call17: symbol!("nominalsubtypes_group_values", unsafe extern "C" fn(*const T0, *mut T4, *mut NativeError) -> i32),
            call18: symbol!("nominalsubtypes_inspect_alias_pair", unsafe extern "C" fn(*const T10, *mut T0, *mut NativeError) -> i32),
            call19: symbol!("nominalsubtypes_list_values", unsafe extern "C" fn(*const T0, *mut T11, *mut NativeError) -> i32),
            call20: symbol!("nominalsubtypes_nested", unsafe extern "C" fn(*const T12, *mut T0, *mut NativeError) -> i32),
            call21: symbol!("nominalsubtypes_no_items", unsafe extern "C" fn(*const T0, *mut T5, *mut NativeError) -> i32),
            call22: symbol!("nominalsubtypes_optional", unsafe extern "C" fn(*const T0, *mut T13, *mut NativeError) -> i32),
            call23: symbol!("nominalsubtypes_pair_values", unsafe extern "C" fn(*const T0, *mut T10, *mut NativeError) -> i32),
            call24: symbol!("nominalsubtypes_plain_fin", unsafe extern "C" fn(*const T0, *mut T0, *mut NativeError) -> i32),
            call25: symbol!("nominalsubtypes_produce_envelope", unsafe extern "C" fn(*const T0, *mut T2, *mut NativeError) -> i32),
            call26: symbol!("nominalsubtypes_product", unsafe extern "C" fn(*const T0, *mut T14, *mut NativeError) -> i32),
            call27: symbol!("nominalsubtypes_scalar", unsafe extern "C" fn(*const T0, *mut T0, *mut NativeError) -> i32),
            call28: symbol!("nominalsubtypes_second", unsafe extern "C" fn(*const T2, *mut T0, *mut NativeError) -> i32),

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

fn to1(value: &crate::GenericNat, scope: &mut Scope) -> Result<T1, Error> {
    scope.charge(1, std::mem::size_of::<T1>())?;
    Ok(T1 { value: to0(&value.value, scope)?, marker: to0(&value.marker, scope)? })
}
fn from1(value: &T1, scope: &mut Scope) -> Result<crate::GenericNat, Error> {
    checkpoint()?;
    scope.charge(1, std::mem::size_of::<T1>())?;
    Ok(crate::GenericNat { value: from0(&value.value, scope)?, marker: from0(&value.marker, scope)? })
}

fn to2(value: &crate::Envelope, scope: &mut Scope) -> Result<T2, Error> {
    scope.charge(1, std::mem::size_of::<T2>())?;
    Ok(T2 { payload: to0(&value.payload, scope)?, digit: to0(&value.digit, scope)? })
}
fn from2(value: &T2, scope: &mut Scope) -> Result<crate::Envelope, Error> {
    checkpoint()?;
    scope.charge(1, std::mem::size_of::<T2>())?;
    Ok(crate::Envelope { payload: from0(&value.payload, scope)?, digit: from0(&value.digit, scope)? })
}

fn to3(value: &Option<Envelope>, scope: &mut Scope) -> Result<T3, Error> {
    scope.charge(1, std::mem::size_of::<T3>())?;
    match value { None => Ok(T3::default()), Some(inner) => Ok(T3 { has_value: 1, value: to2(inner, scope)? }) }
}
fn from3(value: &T3, scope: &mut Scope) -> Result<Option<Envelope>, Error> {
    checkpoint()?;
    scope.charge(1, std::mem::size_of::<T3>())?;
    match value.has_value { 0 => Ok(None), 1 => Ok(Some(from2(&value.value, scope)?)), _ => Err(Error::InvalidNative) }
}

fn to4(value: &[Option<Envelope>], scope: &mut Scope) -> Result<T4, Error> {
    scope.charge(1, std::mem::size_of::<T4>())?;
    scope.charge(value.len(), 8)?;
    let mut items = scope.vector::<T3>(value.len())?;
    for item in value { items.push(to3(item, scope)?); }
    Ok(T4 { data: scope.keep(items)?, length: value.len(), ..Default::default() })
}
fn from4(value: &T4, scope: &mut Scope) -> Result<Vec<Option<Envelope>>, Error> {
    checkpoint()?;
    scope.charge(1, std::mem::size_of::<T4>())?;
    let input = unsafe { checked_slice(value.data, value.length)? };
    scope.charge(input.len(), 8)?;
    let mut items = scope.vector::<Option<Envelope>>(input.len())?;
    for item in input { items.push(from3(item, scope)?); }
    Ok(items)
}

fn to5(value: &[BigUint], scope: &mut Scope) -> Result<T5, Error> {
    scope.charge(1, std::mem::size_of::<T5>())?;
    scope.charge(value.len(), 8)?;
    let mut items = scope.vector::<T0>(value.len())?;
    for item in value { items.push(to0(item, scope)?); }
    Ok(T5 { data: scope.keep(items)?, length: value.len(), ..Default::default() })
}
fn from5(value: &T5, scope: &mut Scope) -> Result<Vec<BigUint>, Error> {
    checkpoint()?;
    scope.charge(1, std::mem::size_of::<T5>())?;
    let input = unsafe { checked_slice(value.data, value.length)? };
    scope.charge(input.len(), 8)?;
    let mut items = scope.vector::<BigUint>(input.len())?;
    for item in input { items.push(from0(item, scope)?); }
    Ok(items)
}

fn to6(value: &Result<BigUint, BigUint>, scope: &mut Scope) -> Result<T6, Error> {
    scope.charge(1, std::mem::size_of::<T6>())?;
    match value { Ok(inner) => Ok(T6 { is_ok: 1, ok: to0(inner, scope)?, ..Default::default() }), Err(inner) => Ok(T6 { error: to0(inner, scope)?, ..Default::default() }) }
}
fn from6(value: &T6, scope: &mut Scope) -> Result<Result<BigUint, BigUint>, Error> {
    checkpoint()?;
    scope.charge(1, std::mem::size_of::<T6>())?;
    match value.is_ok { 1 => Ok(Ok(from0(&value.ok, scope)?)), 0 => Ok(Err(from0(&value.error, scope)?)), _ => Err(Error::InvalidNative) }
}

fn to7(value: &Option<Result<BigUint, BigUint>>, scope: &mut Scope) -> Result<T7, Error> {
    scope.charge(1, std::mem::size_of::<T7>())?;
    match value { None => Ok(T7::default()), Some(inner) => Ok(T7 { has_value: 1, value: to6(inner, scope)? }) }
}
fn from7(value: &T7, scope: &mut Scope) -> Result<Option<Result<BigUint, BigUint>>, Error> {
    checkpoint()?;
    scope.charge(1, std::mem::size_of::<T7>())?;
    match value.has_value { 0 => Ok(None), 1 => Ok(Some(from6(&value.value, scope)?)), _ => Err(Error::InvalidNative) }
}

fn to8(value: &[Option<Result<BigUint, BigUint>>], scope: &mut Scope) -> Result<T8, Error> {
    scope.charge(1, std::mem::size_of::<T8>())?;
    scope.charge(value.len(), 8)?;
    let mut items = scope.vector::<T7>(value.len())?;
    for item in value { items.push(to7(item, scope)?); }
    Ok(T8 { data: scope.keep(items)?, length: value.len(), ..Default::default() })
}
fn from8(value: &T8, scope: &mut Scope) -> Result<Vec<Option<Result<BigUint, BigUint>>>, Error> {
    checkpoint()?;
    scope.charge(1, std::mem::size_of::<T8>())?;
    let input = unsafe { checked_slice(value.data, value.length)? };
    scope.charge(input.len(), 8)?;
    let mut items = scope.vector::<Option<Result<BigUint, BigUint>>>(input.len())?;
    for item in input { items.push(from7(item, scope)?); }
    Ok(items)
}

fn to9(value: &Event, scope: &mut Scope) -> Result<T9, Error> {
    scope.charge(1, std::mem::size_of::<T9>())?;
    match value {
        crate::Event::Empty => Ok(T9 { kind: 0, cases: V9 { case0: B9_0 { empty: 0 } } }),
        crate::Event::Box { value: field0 } => Ok(T9 { kind: 1, cases: V9 { case1: B9_1 { value: to2(field0, scope)? } } }),
        crate::Event::Choices { values: field0 } => Ok(T9 { kind: 2, cases: V9 { case2: B9_2 { values: to8(field0, scope)? } } }),
    }
}
fn from9(value: &T9, scope: &mut Scope) -> Result<Event, Error> {
    checkpoint()?;
    scope.charge(1, std::mem::size_of::<T9>())?;
    match value.kind {
        0 => Ok(crate::Event::Empty),
        1 => {
        // Read this union member only after validating its matching tag.
        let active = unsafe { &value.cases.case1 };
        Ok(crate::Event::Box { value: from2(&active.value, scope)? })
    },
        2 => {
        // Read this union member only after validating its matching tag.
        let active = unsafe { &value.cases.case2 };
        Ok(crate::Event::Choices { values: from8(&active.values, scope)? })
    },
        _ => Err(Error::InvalidNative)
    }
}

fn to10(value: &crate::AliasPair, scope: &mut Scope) -> Result<T10, Error> {
    scope.charge(1, std::mem::size_of::<T10>())?;
    Ok(T10 { left: to4(&value.left, scope)?, right: to4(&value.right, scope)? })
}
fn from10(value: &T10, scope: &mut Scope) -> Result<crate::AliasPair, Error> {
    checkpoint()?;
    scope.charge(1, std::mem::size_of::<T10>())?;
    Ok(crate::AliasPair { left: from4(&value.left, scope)?, right: from4(&value.right, scope)? })
}

fn to11(value: &[BigUint], scope: &mut Scope) -> Result<T11, Error> {
    scope.charge(1, std::mem::size_of::<T11>())?;
    scope.charge(value.len(), 8)?;
    let mut items = scope.vector::<T0>(value.len())?;
    for item in value { items.push(to0(item, scope)?); }
    Ok(T11 { data: scope.keep(items)?, length: value.len(), ..Default::default() })
}
fn from11(value: &T11, scope: &mut Scope) -> Result<Vec<BigUint>, Error> {
    checkpoint()?;
    scope.charge(1, std::mem::size_of::<T11>())?;
    let input = unsafe { checked_slice(value.data, value.length)? };
    scope.charge(input.len(), 8)?;
    let mut items = scope.vector::<BigUint>(input.len())?;
    for item in input { items.push(from0(item, scope)?); }
    Ok(items)
}

fn to12(value: &crate::Pair, scope: &mut Scope) -> Result<T12, Error> {
    scope.charge(1, std::mem::size_of::<T12>())?;
    Ok(T12 { left: to2(&value.left, scope)?, right: to2(&value.right, scope)? })
}
fn from12(value: &T12, scope: &mut Scope) -> Result<crate::Pair, Error> {
    checkpoint()?;
    scope.charge(1, std::mem::size_of::<T12>())?;
    Ok(crate::Pair { left: from2(&value.left, scope)?, right: from2(&value.right, scope)? })
}

fn to13(value: &Option<BigUint>, scope: &mut Scope) -> Result<T13, Error> {
    scope.charge(1, std::mem::size_of::<T13>())?;
    match value { None => Ok(T13::default()), Some(inner) => Ok(T13 { has_value: 1, value: to0(inner, scope)? }) }
}
fn from13(value: &T13, scope: &mut Scope) -> Result<Option<BigUint>, Error> {
    checkpoint()?;
    scope.charge(1, std::mem::size_of::<T13>())?;
    match value.has_value { 0 => Ok(None), 1 => Ok(Some(from0(&value.value, scope)?)), _ => Err(Error::InvalidNative) }
}

fn to14(value: &(BigUint, BigUint), scope: &mut Scope) -> Result<T14, Error> {
    scope.charge(1, std::mem::size_of::<T14>())?;
    Ok(T14 { fst: to0(&value.0, scope)?, snd: to0(&value.1, scope)? })
}
fn from14(value: &T14, scope: &mut Scope) -> Result<(BigUint, BigUint), Error> {
    checkpoint()?;
    scope.charge(1, std::mem::size_of::<T14>())?;
    Ok((from0(&value.fst, scope)?, from0(&value.snd, scope)?))
}


pub(super) fn call0(arg0: &GenericNat) -> Result<GenericNat, Error> {
    let native = runtime()?;
    let mut scope = Scope::new();
    let mut output = Output { value: T1::default(), clear: native.clear1 };
    let mut error = NativeError::default();
    let input0 = to1(&arg0, &mut scope)?;
    let status = unsafe { (native.call0)(&input0, &mut output.value, &mut error) };
    
    check(status, &error)?;
    let result = { from1(&output.value, &mut scope) };
    result
}

pub(super) fn call1(arg0: &GenericNat) -> Result<GenericNat, Error> {
    let native = runtime()?;
    let mut scope = Scope::new();
    let mut output = Output { value: T1::default(), clear: native.clear1 };
    let mut error = NativeError::default();
    let input0 = to1(&arg0, &mut scope)?;
    let status = unsafe { (native.call1)(&input0, &mut output.value, &mut error) };
    
    check(status, &error)?;
    let result = { from1(&output.value, &mut scope) };
    result
}

pub(super) fn call2(arg0: &GenericNat) -> Result<BigUint, Error> {
    let native = runtime()?;
    let mut scope = Scope::new();
    let mut output = Output { value: T0::default(), clear: native.clear0 };
    let mut error = NativeError::default();
    let input0 = to1(&arg0, &mut scope)?;
    let status = unsafe { (native.call2)(&input0, &mut output.value, &mut error) };
    
    check(status, &error)?;
    let result = { from0(&output.value, &mut scope) };
    result
}

pub(super) fn call3(arg0: &[Option<Envelope>], arg1: &[Option<Envelope>]) -> Result<BigUint, Error> {
    let native = runtime()?;
    let mut scope = Scope::new();
    let mut output = Output { value: T0::default(), clear: native.clear0 };
    let mut error = NativeError::default();
    let input0 = to4(&arg0, &mut scope)?;
    let input1 = to4(&arg1, &mut scope)?;
    let status = unsafe { (native.call3)(&input0, &input1, &mut output.value, &mut error) };
    
    check(status, &error)?;
    let result = { from0(&output.value, &mut scope) };
    result
}

pub(super) fn call4(arg0: &BigUint) -> Result<Vec<BigUint>, Error> {
    let native = runtime()?;
    let mut scope = Scope::new();
    let mut output = Output { value: T5::default(), clear: native.clear5 };
    let mut error = NativeError::default();
    let input0 = to0(&arg0, &mut scope)?;
    let status = unsafe { (native.call4)(&input0, &mut output.value, &mut error) };
    
    check(status, &error)?;
    let result = { from5(&output.value, &mut scope) };
    result
}

pub(super) fn call5(arg0: &BigUint) -> Result<Result<BigUint, BigUint>, Error> {
    let native = runtime()?;
    let mut scope = Scope::new();
    let mut output = Output { value: T6::default(), clear: native.clear6 };
    let mut error = NativeError::default();
    let input0 = to0(&arg0, &mut scope)?;
    let status = unsafe { (native.call5)(&input0, &mut output.value, &mut error) };
    
    check(status, &error)?;
    let result = { from6(&output.value, &mut scope) };
    result
}

pub(super) fn call6(arg0: &Envelope, arg1: &Envelope) -> Result<BigUint, Error> {
    let native = runtime()?;
    let mut scope = Scope::new();
    let mut output = Output { value: T0::default(), clear: native.clear0 };
    let mut error = NativeError::default();
    let input0 = to2(&arg0, &mut scope)?;
    let input1 = to2(&arg1, &mut scope)?;
    let status = unsafe { (native.call6)(&input0, &input1, &mut output.value, &mut error) };
    
    check(status, &error)?;
    let result = { from0(&output.value, &mut scope) };
    result
}

pub(super) fn call7(arg0: &Envelope) -> Result<Envelope, Error> {
    let native = runtime()?;
    let mut scope = Scope::new();
    let mut output = Output { value: T2::default(), clear: native.clear2 };
    let mut error = NativeError::default();
    let input0 = to2(&arg0, &mut scope)?;
    let status = unsafe { (native.call7)(&input0, &mut output.value, &mut error) };
    
    check(status, &error)?;
    let result = { from2(&output.value, &mut scope) };
    result
}

pub(super) fn call8(arg0: &Event) -> Result<Event, Error> {
    let native = runtime()?;
    let mut scope = Scope::new();
    let mut output = Output { value: T9::default(), clear: native.clear9 };
    let mut error = NativeError::default();
    let input0 = to9(&arg0, &mut scope)?;
    let status = unsafe { (native.call8)(&input0, &mut output.value, &mut error) };
    
    check(status, &error)?;
    let result = { from9(&output.value, &mut scope) };
    result
}

pub(super) fn call9(arg0: &[Option<Envelope>]) -> Result<Vec<Option<Envelope>>, Error> {
    let native = runtime()?;
    let mut scope = Scope::new();
    let mut output = Output { value: T4::default(), clear: native.clear4 };
    let mut error = NativeError::default();
    let input0 = to4(&arg0, &mut scope)?;
    let status = unsafe { (native.call9)(&input0, &mut output.value, &mut error) };
    
    check(status, &error)?;
    let result = { from4(&output.value, &mut scope) };
    result
}

pub(super) fn call10(arg0: &AliasPair) -> Result<AliasPair, Error> {
    let native = runtime()?;
    let mut scope = Scope::new();
    let mut output = Output { value: T10::default(), clear: native.clear10 };
    let mut error = NativeError::default();
    let input0 = to10(&arg0, &mut scope)?;
    let status = unsafe { (native.call10)(&input0, &mut output.value, &mut error) };
    
    check(status, &error)?;
    let result = { from10(&output.value, &mut scope) };
    result
}

pub(super) fn call11(arg0: &BigUint) -> Result<Event, Error> {
    let native = runtime()?;
    let mut scope = Scope::new();
    let mut output = Output { value: T9::default(), clear: native.clear9 };
    let mut error = NativeError::default();
    let input0 = to0(&arg0, &mut scope)?;
    let status = unsafe { (native.call11)(&input0, &mut output.value, &mut error) };
    
    check(status, &error)?;
    let result = { from9(&output.value, &mut scope) };
    result
}

pub(super) fn call12(arg0: &BigUint) -> Result<Event, Error> {
    let native = runtime()?;
    let mut scope = Scope::new();
    let mut output = Output { value: T9::default(), clear: native.clear9 };
    let mut error = NativeError::default();
    let input0 = to0(&arg0, &mut scope)?;
    let status = unsafe { (native.call12)(&input0, &mut output.value, &mut error) };
    
    check(status, &error)?;
    let result = { from9(&output.value, &mut scope) };
    result
}

pub(super) fn call13(arg0: &Event) -> Result<BigUint, Error> {
    let native = runtime()?;
    let mut scope = Scope::new();
    let mut output = Output { value: T0::default(), clear: native.clear0 };
    let mut error = NativeError::default();
    let input0 = to9(&arg0, &mut scope)?;
    let status = unsafe { (native.call13)(&input0, &mut output.value, &mut error) };
    
    check(status, &error)?;
    let result = { from0(&output.value, &mut scope) };
    result
}

pub(super) fn call14(arg0: &Event) -> Result<BigUint, Error> {
    let native = runtime()?;
    let mut scope = Scope::new();
    let mut output = Output { value: T0::default(), clear: native.clear0 };
    let mut error = NativeError::default();
    let input0 = to9(&arg0, &mut scope)?;
    let status = unsafe { (native.call14)(&input0, &mut output.value, &mut error) };
    
    check(status, &error)?;
    let result = { from0(&output.value, &mut scope) };
    result
}

pub(super) fn call15(arg0: &BigUint) -> Result<Event, Error> {
    let native = runtime()?;
    let mut scope = Scope::new();
    let mut output = Output { value: T9::default(), clear: native.clear9 };
    let mut error = NativeError::default();
    let input0 = to0(&arg0, &mut scope)?;
    let status = unsafe { (native.call15)(&input0, &mut output.value, &mut error) };
    
    check(status, &error)?;
    let result = { from9(&output.value, &mut scope) };
    result
}

pub(super) fn call16(arg0: &Envelope) -> Result<BigUint, Error> {
    let native = runtime()?;
    let mut scope = Scope::new();
    let mut output = Output { value: T0::default(), clear: native.clear0 };
    let mut error = NativeError::default();
    let input0 = to2(&arg0, &mut scope)?;
    let status = unsafe { (native.call16)(&input0, &mut output.value, &mut error) };
    
    check(status, &error)?;
    let result = { from0(&output.value, &mut scope) };
    result
}

pub(super) fn call17(arg0: &BigUint) -> Result<Vec<Option<Envelope>>, Error> {
    let native = runtime()?;
    let mut scope = Scope::new();
    let mut output = Output { value: T4::default(), clear: native.clear4 };
    let mut error = NativeError::default();
    let input0 = to0(&arg0, &mut scope)?;
    let status = unsafe { (native.call17)(&input0, &mut output.value, &mut error) };
    
    check(status, &error)?;
    let result = { from4(&output.value, &mut scope) };
    result
}

pub(super) fn call18(arg0: &AliasPair) -> Result<BigUint, Error> {
    let native = runtime()?;
    let mut scope = Scope::new();
    let mut output = Output { value: T0::default(), clear: native.clear0 };
    let mut error = NativeError::default();
    let input0 = to10(&arg0, &mut scope)?;
    let status = unsafe { (native.call18)(&input0, &mut output.value, &mut error) };
    
    check(status, &error)?;
    let result = { from0(&output.value, &mut scope) };
    result
}

pub(super) fn call19(arg0: &BigUint) -> Result<Vec<BigUint>, Error> {
    let native = runtime()?;
    let mut scope = Scope::new();
    let mut output = Output { value: T11::default(), clear: native.clear11 };
    let mut error = NativeError::default();
    let input0 = to0(&arg0, &mut scope)?;
    let status = unsafe { (native.call19)(&input0, &mut output.value, &mut error) };
    
    check(status, &error)?;
    let result = { from11(&output.value, &mut scope) };
    result
}

pub(super) fn call20(arg0: &Pair) -> Result<BigUint, Error> {
    let native = runtime()?;
    let mut scope = Scope::new();
    let mut output = Output { value: T0::default(), clear: native.clear0 };
    let mut error = NativeError::default();
    let input0 = to12(&arg0, &mut scope)?;
    let status = unsafe { (native.call20)(&input0, &mut output.value, &mut error) };
    
    check(status, &error)?;
    let result = { from0(&output.value, &mut scope) };
    result
}

pub(super) fn call21(arg0: &BigUint) -> Result<Vec<BigUint>, Error> {
    let native = runtime()?;
    let mut scope = Scope::new();
    let mut output = Output { value: T5::default(), clear: native.clear5 };
    let mut error = NativeError::default();
    let input0 = to0(&arg0, &mut scope)?;
    let status = unsafe { (native.call21)(&input0, &mut output.value, &mut error) };
    
    check(status, &error)?;
    let result = { from5(&output.value, &mut scope) };
    result
}

pub(super) fn call22(arg0: &BigUint) -> Result<Option<BigUint>, Error> {
    let native = runtime()?;
    let mut scope = Scope::new();
    let mut output = Output { value: T13::default(), clear: native.clear13 };
    let mut error = NativeError::default();
    let input0 = to0(&arg0, &mut scope)?;
    let status = unsafe { (native.call22)(&input0, &mut output.value, &mut error) };
    
    check(status, &error)?;
    let result = { from13(&output.value, &mut scope) };
    result
}

pub(super) fn call23(arg0: &BigUint) -> Result<AliasPair, Error> {
    let native = runtime()?;
    let mut scope = Scope::new();
    let mut output = Output { value: T10::default(), clear: native.clear10 };
    let mut error = NativeError::default();
    let input0 = to0(&arg0, &mut scope)?;
    let status = unsafe { (native.call23)(&input0, &mut output.value, &mut error) };
    
    check(status, &error)?;
    let result = { from10(&output.value, &mut scope) };
    result
}

pub(super) fn call24(arg0: &BigUint) -> Result<BigUint, Error> {
    let native = runtime()?;
    let mut scope = Scope::new();
    let mut output = Output { value: T0::default(), clear: native.clear0 };
    let mut error = NativeError::default();
    let input0 = to0(&arg0, &mut scope)?;
    let status = unsafe { (native.call24)(&input0, &mut output.value, &mut error) };
    
    check(status, &error)?;
    let result = { from0(&output.value, &mut scope) };
    result
}

pub(super) fn call25(arg0: &BigUint) -> Result<Envelope, Error> {
    let native = runtime()?;
    let mut scope = Scope::new();
    let mut output = Output { value: T2::default(), clear: native.clear2 };
    let mut error = NativeError::default();
    let input0 = to0(&arg0, &mut scope)?;
    let status = unsafe { (native.call25)(&input0, &mut output.value, &mut error) };
    
    check(status, &error)?;
    let result = { from2(&output.value, &mut scope) };
    result
}

pub(super) fn call26(arg0: &BigUint) -> Result<(BigUint, BigUint), Error> {
    let native = runtime()?;
    let mut scope = Scope::new();
    let mut output = Output { value: T14::default(), clear: native.clear14 };
    let mut error = NativeError::default();
    let input0 = to0(&arg0, &mut scope)?;
    let status = unsafe { (native.call26)(&input0, &mut output.value, &mut error) };
    
    check(status, &error)?;
    let result = { from14(&output.value, &mut scope) };
    result
}

pub(super) fn call27(arg0: &BigUint) -> Result<BigUint, Error> {
    let native = runtime()?;
    let mut scope = Scope::new();
    let mut output = Output { value: T0::default(), clear: native.clear0 };
    let mut error = NativeError::default();
    let input0 = to0(&arg0, &mut scope)?;
    let status = unsafe { (native.call27)(&input0, &mut output.value, &mut error) };
    
    check(status, &error)?;
    let result = { from0(&output.value, &mut scope) };
    result
}

pub(super) fn call28(arg0: &Envelope) -> Result<BigUint, Error> {
    let native = runtime()?;
    let mut scope = Scope::new();
    let mut output = Output { value: T0::default(), clear: native.clear0 };
    let mut error = NativeError::default();
    let input0 = to2(&arg0, &mut scope)?;
    let status = unsafe { (native.call28)(&input0, &mut output.value, &mut error) };
    
    check(status, &error)?;
    let result = { from0(&output.value, &mut scope) };
    result
}
