#![allow(dead_code, unused_imports, unused_variables)]
use crate::{Error, BigInt, BigUint, Packet, Event, Pair, RawPacket, PacketAlias};
use std::sync::{OnceLock, atomic::{AtomicU32, Ordering}};
#[path = "assets.rs"] mod assets;
unsafe extern "C" { fn dlsym(library: *mut std::ffi::c_void, name: *const std::ffi::c_char) -> *mut std::ffi::c_void; }
#[repr(C)]
#[derive(Clone, Copy, Default)]
struct T10 {
    data: *const u32,
    length: usize,
    owner: *mut std::ffi::c_void,
    release: Option<unsafe extern "C" fn(*mut std::ffi::c_void)>,
}

#[repr(C)]
#[derive(Clone, Copy, Default)]
struct T11 {
    data: *const u32,
    length: usize,
    owner: *mut std::ffi::c_void,
    release: Option<unsafe extern "C" fn(*mut std::ffi::c_void)>,
    negative: bool,
}

#[repr(C)]
#[derive(Clone, Copy, Default)]
struct T14 {
    data: *const u8,
    length: usize,
    owner: *mut std::ffi::c_void,
    release: Option<unsafe extern "C" fn(*mut std::ffi::c_void)>,
}

#[repr(C)]
#[derive(Clone, Copy, Default)]
struct T15 {
    data: *const u8,
    length: usize,
    owner: *mut std::ffi::c_void,
    release: Option<unsafe extern "C" fn(*mut std::ffi::c_void)>,
}

#[repr(C)]
#[derive(Clone, Copy, Default)]
struct T19 {
    unit_value: u8,
    bool_value: bool,
    uint8_value: u8,
    uint16_value: u16,
    uint32_value: u32,
    uint64_value: u64,
    int8_value: i8,
    int16_value: i16,
    int32_value: i32,
    int64_value: i64,
    nat_value: T10,
    int_value: T11,
    float32_value: f32,
    float64_value: f64,
    text_value: T14,
    bytes_value: T15,
    char_value: u32,
    usize_value: u64,
    isize_value: i64,
    digit: T10,
}

#[repr(C)]
#[derive(Clone, Copy, Default)]
struct T20 {
    has_value: u8,
    value: T19,
}

#[repr(C)]
#[derive(Clone, Copy, Default)]
struct T21 {
    data: *const T20,
    length: usize,
    owner: *mut std::ffi::c_void,
    release: Option<unsafe extern "C" fn(*mut std::ffi::c_void)>,
}

#[repr(C)]
#[derive(Clone, Copy, Default)]
struct T22 {
    fst: T19,
    snd: T19,
}

#[repr(C)]
#[derive(Clone, Copy, Default)]
struct T23 {
    is_ok: u8,
    ok: T19,
    error: T19,
}

#[repr(C)]
#[derive(Clone, Copy, Default)]
struct T24 {
    has_value: u8,
    value: T23,
}

#[repr(C)]
#[derive(Clone, Copy, Default)]
struct T25 {
    data: *const T24,
    length: usize,
    owner: *mut std::ffi::c_void,
    release: Option<unsafe extern "C" fn(*mut std::ffi::c_void)>,
}

#[repr(C)]
#[derive(Clone, Copy, Default)]
struct B26_0 {
    empty: u8,
}

#[repr(C)]
#[derive(Clone, Copy, Default)]
struct B26_1 {
    value: T19,
}

#[repr(C)]
#[derive(Clone, Copy, Default)]
struct B26_2 {
    values: T25,
}

#[repr(C)]
#[derive(Clone, Copy)]
union V26 {
    case0: B26_0,
    case1: B26_1,
    case2: B26_2,
}
impl Default for V26 {
    fn default() -> Self {
        // Every private ABI field admits zero; there are no Rust references or owning values.
        unsafe { std::mem::zeroed() }
    }
}
#[repr(C)]
#[derive(Clone, Copy, Default)]
struct T26 { kind: u32, cases: V26 }

#[repr(C)]
#[derive(Clone, Copy, Default)]
struct T27 {
    left: T21,
    right: T21,
}

#[repr(C)]
#[derive(Clone, Copy, Default)]
struct T28 {
    unit_value: u8,
    bool_value: bool,
    uint8_value: u8,
    uint16_value: u16,
    uint32_value: u32,
    uint64_value: u64,
    int8_value: i8,
    int16_value: i16,
    int32_value: i32,
    int64_value: i64,
    nat_value: T10,
    int_value: T11,
    float32_value: f32,
    float64_value: f64,
    text_value: T14,
    bytes_value: T15,
    char_value: u32,
    usize_value: u64,
    isize_value: i64,
    digit: T10,
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
    clear10: unsafe extern "C" fn(*mut T10),
    clear11: unsafe extern "C" fn(*mut T11),
    clear14: unsafe extern "C" fn(*mut T14),
    clear15: unsafe extern "C" fn(*mut T15),
    clear19: unsafe extern "C" fn(*mut T19),
    clear20: unsafe extern "C" fn(*mut T20),
    clear21: unsafe extern "C" fn(*mut T21),
    clear22: unsafe extern "C" fn(*mut T22),
    clear23: unsafe extern "C" fn(*mut T23),
    clear24: unsafe extern "C" fn(*mut T24),
    clear25: unsafe extern "C" fn(*mut T25),
    clear26: unsafe extern "C" fn(*mut T26),
    clear27: unsafe extern "C" fn(*mut T27),
    clear28: unsafe extern "C" fn(*mut T28),
    call0: unsafe extern "C" fn(*const T21, *const T21, *mut T21, *mut NativeError) -> i32,
    call1: unsafe extern "C" fn(*const T19, *const T19, *mut T22, *mut NativeError) -> i32,
    call2: unsafe extern "C" fn(*const T19, *mut T19, *mut NativeError) -> i32,
    call3: unsafe extern "C" fn(*const T19, *mut T19, *mut NativeError) -> i32,
    call4: unsafe extern "C" fn(*const T26, *mut T26, *mut NativeError) -> i32,
    call5: unsafe extern "C" fn(*const T26, *mut T26, *mut NativeError) -> i32,
    call6: unsafe extern "C" fn(*const T27, *mut T27, *mut NativeError) -> i32,
    call7: unsafe extern "C" fn(*const T28, *mut T20, *mut NativeError) -> i32,
    call8: unsafe extern "C" fn(*const T28, *mut T26, *mut NativeError) -> i32,
    call9: unsafe extern "C" fn(*const T28, *mut T26, *mut NativeError) -> i32,
    call10: unsafe extern "C" fn(*const T28, *mut T21, *mut NativeError) -> i32,
    call11: unsafe extern "C" fn(*const T28, *mut T27, *mut NativeError) -> i32,
    call12: unsafe extern "C" fn(*const T19, *mut T19, *mut NativeError) -> i32,
    call13: unsafe extern "C" fn(*mut u32, *mut NativeError) -> i32,

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
            clear10: symbol!("nominalprimitivesubtypes_nat_clear", unsafe extern "C" fn(*mut T10)),
            clear11: symbol!("nominalprimitivesubtypes_int_clear", unsafe extern "C" fn(*mut T11)),
            clear14: symbol!("nominalprimitivesubtypes_string_clear", unsafe extern "C" fn(*mut T14)),
            clear15: symbol!("nominalprimitivesubtypes_bytes_clear", unsafe extern "C" fn(*mut T15)),
            clear19: symbol!("nominalprimitivesubtypes_packet_clear", unsafe extern "C" fn(*mut T19)),
            clear20: symbol!("nominalprimitivesubtypes_option_lean_nominal_primitive_subtypes_packet_value_clear", unsafe extern "C" fn(*mut T20)),
            clear21: symbol!("nominalprimitivesubtypes_array_option_lean_nominal_primitive_subtypes_packet_span_clear", unsafe extern "C" fn(*mut T21)),
            clear22: symbol!("nominalprimitivesubtypes_tuple_lean_nominal_primitive_subtypes_packet_lean_nominal_primitive_subtypes_packet_value_clear", unsafe extern "C" fn(*mut T22)),
            clear23: symbol!("nominalprimitivesubtypes_result_lean_nominal_primitive_subtypes_packet_lean_nominal_primitive_subtypes_packet_value_clear", unsafe extern "C" fn(*mut T23)),
            clear24: symbol!("nominalprimitivesubtypes_option_result_lean_nominal_primitive_subtypes_packet_lean_nominal_primitive_subtypes_packet_value_clear", unsafe extern "C" fn(*mut T24)),
            clear25: symbol!("nominalprimitivesubtypes_array_option_result_lean_nominal_primitive_subtypes_packet_lean_nominal_primitive_subtypes_packet_span_clear", unsafe extern "C" fn(*mut T25)),
            clear26: symbol!("nominalprimitivesubtypes_event_clear", unsafe extern "C" fn(*mut T26)),
            clear27: symbol!("nominalprimitivesubtypes_pair_clear", unsafe extern "C" fn(*mut T27)),
            clear28: symbol!("nominalprimitivesubtypes_raw_packet_clear", unsafe extern "C" fn(*mut T28)),
            call0: symbol!("nominalprimitivesubtypes_aliases", unsafe extern "C" fn(*const T21, *const T21, *mut T21, *mut NativeError) -> i32),
            call1: symbol!("nominalprimitivesubtypes_combine", unsafe extern "C" fn(*const T19, *const T19, *mut T22, *mut NativeError) -> i32),
            call2: symbol!("nominalprimitivesubtypes_echo_a", unsafe extern "C" fn(*const T19, *mut T19, *mut NativeError) -> i32),
            call3: symbol!("nominalprimitivesubtypes_echo_b", unsafe extern "C" fn(*const T19, *mut T19, *mut NativeError) -> i32),
            call4: symbol!("nominalprimitivesubtypes_echo_event_a", unsafe extern "C" fn(*const T26, *mut T26, *mut NativeError) -> i32),
            call5: symbol!("nominalprimitivesubtypes_echo_event_b", unsafe extern "C" fn(*const T26, *mut T26, *mut NativeError) -> i32),
            call6: symbol!("nominalprimitivesubtypes_echo_pair", unsafe extern "C" fn(*const T27, *mut T27, *mut NativeError) -> i32),
            call7: symbol!("nominalprimitivesubtypes_produce", unsafe extern "C" fn(*const T28, *mut T20, *mut NativeError) -> i32),
            call8: symbol!("nominalprimitivesubtypes_produce_choices", unsafe extern "C" fn(*const T28, *mut T26, *mut NativeError) -> i32),
            call9: symbol!("nominalprimitivesubtypes_produce_event", unsafe extern "C" fn(*const T28, *mut T26, *mut NativeError) -> i32),
            call10: symbol!("nominalprimitivesubtypes_produce_group", unsafe extern "C" fn(*const T28, *mut T21, *mut NativeError) -> i32),
            call11: symbol!("nominalprimitivesubtypes_produce_pair", unsafe extern "C" fn(*const T28, *mut T27, *mut NativeError) -> i32),
            call12: symbol!("nominalprimitivesubtypes_refuse_unit", unsafe extern "C" fn(*const T19, *mut T19, *mut NativeError) -> i32),
            call13: symbol!("nominalprimitivesubtypes_word_bits", unsafe extern "C" fn(*mut u32, *mut NativeError) -> i32),

        })
    }).as_ref().map_err(Clone::clone)
}
fn to0(value: &(), scope: &mut Scope) -> Result<u8, Error> {
    scope.charge(1, std::mem::size_of::<u8>())?;
    Ok(0)
}
fn from0(value: &u8, scope: &mut Scope) -> Result<(), Error> {
    checkpoint()?;
    scope.charge(1, std::mem::size_of::<u8>())?;
    Ok(())
}

fn to1(value: &bool, scope: &mut Scope) -> Result<bool, Error> {
    scope.charge(1, std::mem::size_of::<bool>())?;
    Ok(*value)
}
fn from1(value: &bool, scope: &mut Scope) -> Result<bool, Error> {
    checkpoint()?;
    scope.charge(1, std::mem::size_of::<bool>())?;
    Ok(*value)
}

fn to2(value: &u8, scope: &mut Scope) -> Result<u8, Error> {
    scope.charge(1, std::mem::size_of::<u8>())?;
    Ok(*value)
}
fn from2(value: &u8, scope: &mut Scope) -> Result<u8, Error> {
    checkpoint()?;
    scope.charge(1, std::mem::size_of::<u8>())?;
    Ok(*value)
}

fn to3(value: &u16, scope: &mut Scope) -> Result<u16, Error> {
    scope.charge(1, std::mem::size_of::<u16>())?;
    Ok(*value)
}
fn from3(value: &u16, scope: &mut Scope) -> Result<u16, Error> {
    checkpoint()?;
    scope.charge(1, std::mem::size_of::<u16>())?;
    Ok(*value)
}

fn to4(value: &u32, scope: &mut Scope) -> Result<u32, Error> {
    scope.charge(1, std::mem::size_of::<u32>())?;
    Ok(*value)
}
fn from4(value: &u32, scope: &mut Scope) -> Result<u32, Error> {
    checkpoint()?;
    scope.charge(1, std::mem::size_of::<u32>())?;
    Ok(*value)
}

fn to5(value: &u64, scope: &mut Scope) -> Result<u64, Error> {
    scope.charge(1, std::mem::size_of::<u64>())?;
    Ok(*value)
}
fn from5(value: &u64, scope: &mut Scope) -> Result<u64, Error> {
    checkpoint()?;
    scope.charge(1, std::mem::size_of::<u64>())?;
    Ok(*value)
}

fn to6(value: &i8, scope: &mut Scope) -> Result<i8, Error> {
    scope.charge(1, std::mem::size_of::<i8>())?;
    Ok(*value)
}
fn from6(value: &i8, scope: &mut Scope) -> Result<i8, Error> {
    checkpoint()?;
    scope.charge(1, std::mem::size_of::<i8>())?;
    Ok(*value)
}

fn to7(value: &i16, scope: &mut Scope) -> Result<i16, Error> {
    scope.charge(1, std::mem::size_of::<i16>())?;
    Ok(*value)
}
fn from7(value: &i16, scope: &mut Scope) -> Result<i16, Error> {
    checkpoint()?;
    scope.charge(1, std::mem::size_of::<i16>())?;
    Ok(*value)
}

fn to8(value: &i32, scope: &mut Scope) -> Result<i32, Error> {
    scope.charge(1, std::mem::size_of::<i32>())?;
    Ok(*value)
}
fn from8(value: &i32, scope: &mut Scope) -> Result<i32, Error> {
    checkpoint()?;
    scope.charge(1, std::mem::size_of::<i32>())?;
    Ok(*value)
}

fn to9(value: &i64, scope: &mut Scope) -> Result<i64, Error> {
    scope.charge(1, std::mem::size_of::<i64>())?;
    Ok(*value)
}
fn from9(value: &i64, scope: &mut Scope) -> Result<i64, Error> {
    checkpoint()?;
    scope.charge(1, std::mem::size_of::<i64>())?;
    Ok(*value)
}

fn to10(value: &BigUint, scope: &mut Scope) -> Result<T10, Error> {
    scope.charge(1, std::mem::size_of::<T10>())?;
    let length = usize::try_from((value.bits() + 31) / 32).map_err(|_| Error::Limit)?;
    let mut digits = scope.vector::<u32>(length)?;
    digits.extend(value.iter_u32_digits());
    let length = digits.len();
    Ok(T10 { data: scope.keep(digits)?, length, ..Default::default() })
}
fn from10(value: &T10, scope: &mut Scope) -> Result<BigUint, Error> {
    checkpoint()?;
    scope.charge(1, std::mem::size_of::<T10>())?;
    scope.charge(value.length, 8)?;
    let digits = unsafe { checked_slice(value.data, value.length)? };
    if digits.last() == Some(&0) { return Err(Error::InvalidNative); }
    Ok(BigUint::from_slice(digits))
}

fn to11(value: &BigInt, scope: &mut Scope) -> Result<T11, Error> {
    scope.charge(1, std::mem::size_of::<T11>())?;
    let length = usize::try_from((value.magnitude().bits() + 31) / 32).map_err(|_| Error::Limit)?;
    let mut digits = scope.vector::<u32>(length)?;
    digits.extend(value.magnitude().iter_u32_digits());
    let length = digits.len();
    Ok(T11 { data: scope.keep(digits)?, length, negative: value.sign() == num_bigint::Sign::Minus, ..Default::default() })
}
fn from11(value: &T11, scope: &mut Scope) -> Result<BigInt, Error> {
    checkpoint()?;
    scope.charge(1, std::mem::size_of::<T11>())?;
    scope.charge(value.length, 8)?;
    let digits = unsafe { checked_slice(value.data, value.length)? };
    if digits.last() == Some(&0) { return Err(Error::InvalidNative); }
    if digits.is_empty() && value.negative { return Err(Error::InvalidNative); }
    Ok(BigInt::from_slice(if value.negative { num_bigint::Sign::Minus } else { num_bigint::Sign::Plus }, digits))
}

fn to12(value: &f32, scope: &mut Scope) -> Result<f32, Error> {
    scope.charge(1, std::mem::size_of::<f32>())?;
    Ok(*value)
}
fn from12(value: &f32, scope: &mut Scope) -> Result<f32, Error> {
    checkpoint()?;
    scope.charge(1, std::mem::size_of::<f32>())?;
    Ok(*value)
}

fn to13(value: &f64, scope: &mut Scope) -> Result<f64, Error> {
    scope.charge(1, std::mem::size_of::<f64>())?;
    Ok(*value)
}
fn from13(value: &f64, scope: &mut Scope) -> Result<f64, Error> {
    checkpoint()?;
    scope.charge(1, std::mem::size_of::<f64>())?;
    Ok(*value)
}

fn to14(value: &str, scope: &mut Scope) -> Result<T14, Error> {
    scope.charge(1, std::mem::size_of::<T14>())?;
    scope.charge(value.len(), 1)?;
    Ok(T14 { data: value.as_ptr(), length: value.len(), ..Default::default() })
}
fn from14(value: &T14, scope: &mut Scope) -> Result<String, Error> {
    checkpoint()?;
    scope.charge(1, std::mem::size_of::<T14>())?;
    let input = unsafe { checked_slice(value.data, value.length)? };
    let mut result = scope.vector::<u8>(input.len())?;
    result.extend_from_slice(input);
    String::from_utf8(result).map_err(|_| Error::InvalidNative)
}

fn to15(value: &[u8], scope: &mut Scope) -> Result<T15, Error> {
    scope.charge(1, std::mem::size_of::<T15>())?;
    scope.charge(value.len(), 1)?;
    Ok(T15 { data: value.as_ptr(), length: value.len(), ..Default::default() })
}
fn from15(value: &T15, scope: &mut Scope) -> Result<Vec<u8>, Error> {
    checkpoint()?;
    scope.charge(1, std::mem::size_of::<T15>())?;
    let input = unsafe { checked_slice(value.data, value.length)? };
    let mut result = scope.vector::<u8>(input.len())?;
    result.extend_from_slice(input);
    Ok(result)
}

fn to16(value: &char, scope: &mut Scope) -> Result<u32, Error> {
    scope.charge(1, std::mem::size_of::<u32>())?;
    Ok(*value as u32)
}
fn from16(value: &u32, scope: &mut Scope) -> Result<char, Error> {
    checkpoint()?;
    scope.charge(1, std::mem::size_of::<u32>())?;
    char::from_u32(*value).ok_or(Error::InvalidNative)
}

fn to17(value: &u64, scope: &mut Scope) -> Result<u64, Error> {
    scope.charge(1, std::mem::size_of::<u64>())?;
    Ok(*value)
}
fn from17(value: &u64, scope: &mut Scope) -> Result<u64, Error> {
    checkpoint()?;
    scope.charge(1, std::mem::size_of::<u64>())?;
    Ok(*value)
}

fn to18(value: &i64, scope: &mut Scope) -> Result<i64, Error> {
    scope.charge(1, std::mem::size_of::<i64>())?;
    Ok(*value)
}
fn from18(value: &i64, scope: &mut Scope) -> Result<i64, Error> {
    checkpoint()?;
    scope.charge(1, std::mem::size_of::<i64>())?;
    Ok(*value)
}

fn to19(value: &crate::Packet, scope: &mut Scope) -> Result<T19, Error> {
    scope.charge(1, std::mem::size_of::<T19>())?;
    Ok(T19 { unit_value: to0(&value.unit_value, scope)?, bool_value: to1(&value.bool_value, scope)?, uint8_value: to2(&value.uint8_value, scope)?, uint16_value: to3(&value.uint16_value, scope)?, uint32_value: to4(&value.uint32_value, scope)?, uint64_value: to5(&value.uint64_value, scope)?, int8_value: to6(&value.int8_value, scope)?, int16_value: to7(&value.int16_value, scope)?, int32_value: to8(&value.int32_value, scope)?, int64_value: to9(&value.int64_value, scope)?, nat_value: to10(&value.nat_value, scope)?, int_value: to11(&value.int_value, scope)?, float32_value: to12(&value.float32_value, scope)?, float64_value: to13(&value.float64_value, scope)?, text_value: to14(&value.text_value, scope)?, bytes_value: to15(&value.bytes_value, scope)?, char_value: to16(&value.char_value, scope)?, usize_value: to17(&value.usize_value, scope)?, isize_value: to18(&value.isize_value, scope)?, digit: to10(&value.digit, scope)? })
}
fn from19(value: &T19, scope: &mut Scope) -> Result<crate::Packet, Error> {
    checkpoint()?;
    scope.charge(1, std::mem::size_of::<T19>())?;
    Ok(crate::Packet { unit_value: from0(&value.unit_value, scope)?, bool_value: from1(&value.bool_value, scope)?, uint8_value: from2(&value.uint8_value, scope)?, uint16_value: from3(&value.uint16_value, scope)?, uint32_value: from4(&value.uint32_value, scope)?, uint64_value: from5(&value.uint64_value, scope)?, int8_value: from6(&value.int8_value, scope)?, int16_value: from7(&value.int16_value, scope)?, int32_value: from8(&value.int32_value, scope)?, int64_value: from9(&value.int64_value, scope)?, nat_value: from10(&value.nat_value, scope)?, int_value: from11(&value.int_value, scope)?, float32_value: from12(&value.float32_value, scope)?, float64_value: from13(&value.float64_value, scope)?, text_value: from14(&value.text_value, scope)?, bytes_value: from15(&value.bytes_value, scope)?, char_value: from16(&value.char_value, scope)?, usize_value: from17(&value.usize_value, scope)?, isize_value: from18(&value.isize_value, scope)?, digit: from10(&value.digit, scope)? })
}

fn to20(value: &Option<Packet>, scope: &mut Scope) -> Result<T20, Error> {
    scope.charge(1, std::mem::size_of::<T20>())?;
    match value { None => Ok(T20::default()), Some(inner) => Ok(T20 { has_value: 1, value: to19(inner, scope)? }) }
}
fn from20(value: &T20, scope: &mut Scope) -> Result<Option<Packet>, Error> {
    checkpoint()?;
    scope.charge(1, std::mem::size_of::<T20>())?;
    match value.has_value { 0 => Ok(None), 1 => Ok(Some(from19(&value.value, scope)?)), _ => Err(Error::InvalidNative) }
}

fn to21(value: &[Option<Packet>], scope: &mut Scope) -> Result<T21, Error> {
    scope.charge(1, std::mem::size_of::<T21>())?;
    scope.charge(value.len(), 8)?;
    let mut items = scope.vector::<T20>(value.len())?;
    for item in value { items.push(to20(item, scope)?); }
    Ok(T21 { data: scope.keep(items)?, length: value.len(), ..Default::default() })
}
fn from21(value: &T21, scope: &mut Scope) -> Result<Vec<Option<Packet>>, Error> {
    checkpoint()?;
    scope.charge(1, std::mem::size_of::<T21>())?;
    let input = unsafe { checked_slice(value.data, value.length)? };
    scope.charge(input.len(), 8)?;
    let mut items = scope.vector::<Option<Packet>>(input.len())?;
    for item in input { items.push(from20(item, scope)?); }
    Ok(items)
}

fn to22(value: &(Packet, Packet), scope: &mut Scope) -> Result<T22, Error> {
    scope.charge(1, std::mem::size_of::<T22>())?;
    Ok(T22 { fst: to19(&value.0, scope)?, snd: to19(&value.1, scope)? })
}
fn from22(value: &T22, scope: &mut Scope) -> Result<(Packet, Packet), Error> {
    checkpoint()?;
    scope.charge(1, std::mem::size_of::<T22>())?;
    Ok((from19(&value.fst, scope)?, from19(&value.snd, scope)?))
}

fn to23(value: &Result<Packet, Packet>, scope: &mut Scope) -> Result<T23, Error> {
    scope.charge(1, std::mem::size_of::<T23>())?;
    match value { Ok(inner) => Ok(T23 { is_ok: 1, ok: to19(inner, scope)?, ..Default::default() }), Err(inner) => Ok(T23 { error: to19(inner, scope)?, ..Default::default() }) }
}
fn from23(value: &T23, scope: &mut Scope) -> Result<Result<Packet, Packet>, Error> {
    checkpoint()?;
    scope.charge(1, std::mem::size_of::<T23>())?;
    match value.is_ok { 1 => Ok(Ok(from19(&value.ok, scope)?)), 0 => Ok(Err(from19(&value.error, scope)?)), _ => Err(Error::InvalidNative) }
}

fn to24(value: &Option<Result<Packet, Packet>>, scope: &mut Scope) -> Result<T24, Error> {
    scope.charge(1, std::mem::size_of::<T24>())?;
    match value { None => Ok(T24::default()), Some(inner) => Ok(T24 { has_value: 1, value: to23(inner, scope)? }) }
}
fn from24(value: &T24, scope: &mut Scope) -> Result<Option<Result<Packet, Packet>>, Error> {
    checkpoint()?;
    scope.charge(1, std::mem::size_of::<T24>())?;
    match value.has_value { 0 => Ok(None), 1 => Ok(Some(from23(&value.value, scope)?)), _ => Err(Error::InvalidNative) }
}

fn to25(value: &[Option<Result<Packet, Packet>>], scope: &mut Scope) -> Result<T25, Error> {
    scope.charge(1, std::mem::size_of::<T25>())?;
    scope.charge(value.len(), 8)?;
    let mut items = scope.vector::<T24>(value.len())?;
    for item in value { items.push(to24(item, scope)?); }
    Ok(T25 { data: scope.keep(items)?, length: value.len(), ..Default::default() })
}
fn from25(value: &T25, scope: &mut Scope) -> Result<Vec<Option<Result<Packet, Packet>>>, Error> {
    checkpoint()?;
    scope.charge(1, std::mem::size_of::<T25>())?;
    let input = unsafe { checked_slice(value.data, value.length)? };
    scope.charge(input.len(), 8)?;
    let mut items = scope.vector::<Option<Result<Packet, Packet>>>(input.len())?;
    for item in input { items.push(from24(item, scope)?); }
    Ok(items)
}

fn to26(value: &Event, scope: &mut Scope) -> Result<T26, Error> {
    scope.charge(1, std::mem::size_of::<T26>())?;
    match value {
        crate::Event::Empty => Ok(T26 { kind: 0, cases: V26 { case0: B26_0 { empty: 0 } } }),
        crate::Event::Box { value: field0 } => Ok(T26 { kind: 1, cases: V26 { case1: B26_1 { value: to19(field0, scope)? } } }),
        crate::Event::Choices { values: field0 } => Ok(T26 { kind: 2, cases: V26 { case2: B26_2 { values: to25(field0, scope)? } } }),
    }
}
fn from26(value: &T26, scope: &mut Scope) -> Result<Event, Error> {
    checkpoint()?;
    scope.charge(1, std::mem::size_of::<T26>())?;
    match value.kind {
        0 => Ok(crate::Event::Empty),
        1 => {
        // Read this union member only after validating its matching tag.
        let active = unsafe { &value.cases.case1 };
        Ok(crate::Event::Box { value: from19(&active.value, scope)? })
    },
        2 => {
        // Read this union member only after validating its matching tag.
        let active = unsafe { &value.cases.case2 };
        Ok(crate::Event::Choices { values: from25(&active.values, scope)? })
    },
        _ => Err(Error::InvalidNative)
    }
}

fn to27(value: &crate::Pair, scope: &mut Scope) -> Result<T27, Error> {
    scope.charge(1, std::mem::size_of::<T27>())?;
    Ok(T27 { left: to21(&value.left, scope)?, right: to21(&value.right, scope)? })
}
fn from27(value: &T27, scope: &mut Scope) -> Result<crate::Pair, Error> {
    checkpoint()?;
    scope.charge(1, std::mem::size_of::<T27>())?;
    Ok(crate::Pair { left: from21(&value.left, scope)?, right: from21(&value.right, scope)? })
}

fn to28(value: &crate::RawPacket, scope: &mut Scope) -> Result<T28, Error> {
    scope.charge(1, std::mem::size_of::<T28>())?;
    Ok(T28 { unit_value: to0(&value.unit_value, scope)?, bool_value: to1(&value.bool_value, scope)?, uint8_value: to2(&value.uint8_value, scope)?, uint16_value: to3(&value.uint16_value, scope)?, uint32_value: to4(&value.uint32_value, scope)?, uint64_value: to5(&value.uint64_value, scope)?, int8_value: to6(&value.int8_value, scope)?, int16_value: to7(&value.int16_value, scope)?, int32_value: to8(&value.int32_value, scope)?, int64_value: to9(&value.int64_value, scope)?, nat_value: to10(&value.nat_value, scope)?, int_value: to11(&value.int_value, scope)?, float32_value: to12(&value.float32_value, scope)?, float64_value: to13(&value.float64_value, scope)?, text_value: to14(&value.text_value, scope)?, bytes_value: to15(&value.bytes_value, scope)?, char_value: to16(&value.char_value, scope)?, usize_value: to17(&value.usize_value, scope)?, isize_value: to18(&value.isize_value, scope)?, digit: to10(&value.digit, scope)? })
}
fn from28(value: &T28, scope: &mut Scope) -> Result<crate::RawPacket, Error> {
    checkpoint()?;
    scope.charge(1, std::mem::size_of::<T28>())?;
    Ok(crate::RawPacket { unit_value: from0(&value.unit_value, scope)?, bool_value: from1(&value.bool_value, scope)?, uint8_value: from2(&value.uint8_value, scope)?, uint16_value: from3(&value.uint16_value, scope)?, uint32_value: from4(&value.uint32_value, scope)?, uint64_value: from5(&value.uint64_value, scope)?, int8_value: from6(&value.int8_value, scope)?, int16_value: from7(&value.int16_value, scope)?, int32_value: from8(&value.int32_value, scope)?, int64_value: from9(&value.int64_value, scope)?, nat_value: from10(&value.nat_value, scope)?, int_value: from11(&value.int_value, scope)?, float32_value: from12(&value.float32_value, scope)?, float64_value: from13(&value.float64_value, scope)?, text_value: from14(&value.text_value, scope)?, bytes_value: from15(&value.bytes_value, scope)?, char_value: from16(&value.char_value, scope)?, usize_value: from17(&value.usize_value, scope)?, isize_value: from18(&value.isize_value, scope)?, digit: from10(&value.digit, scope)? })
}


pub(super) fn call0(arg0: &[Option<Packet>], arg1: &[Option<Packet>]) -> Result<Vec<Option<Packet>>, Error> {
    let native = runtime()?;
    let mut scope = Scope::new();
    let mut output = Output { value: T21::default(), clear: native.clear21 };
    let mut error = NativeError::default();
    let input0 = to21(&arg0, &mut scope)?;
    let input1 = to21(&arg1, &mut scope)?;
    let status = unsafe { (native.call0)(&input0, &input1, &mut output.value, &mut error) };
    
    check(status, &error)?;
    let result = { from21(&output.value, &mut scope) };
    result
}

pub(super) fn call1(arg0: &Packet, arg1: &Packet) -> Result<(Packet, Packet), Error> {
    let native = runtime()?;
    let mut scope = Scope::new();
    let mut output = Output { value: T22::default(), clear: native.clear22 };
    let mut error = NativeError::default();
    let input0 = to19(&arg0, &mut scope)?;
    let input1 = to19(&arg1, &mut scope)?;
    let status = unsafe { (native.call1)(&input0, &input1, &mut output.value, &mut error) };
    
    check(status, &error)?;
    let result = { from22(&output.value, &mut scope) };
    result
}

pub(super) fn call2(arg0: &Packet) -> Result<Packet, Error> {
    let native = runtime()?;
    let mut scope = Scope::new();
    let mut output = Output { value: T19::default(), clear: native.clear19 };
    let mut error = NativeError::default();
    let input0 = to19(&arg0, &mut scope)?;
    let status = unsafe { (native.call2)(&input0, &mut output.value, &mut error) };
    
    check(status, &error)?;
    let result = { from19(&output.value, &mut scope) };
    result
}

pub(super) fn call3(arg0: &Packet) -> Result<Packet, Error> {
    let native = runtime()?;
    let mut scope = Scope::new();
    let mut output = Output { value: T19::default(), clear: native.clear19 };
    let mut error = NativeError::default();
    let input0 = to19(&arg0, &mut scope)?;
    let status = unsafe { (native.call3)(&input0, &mut output.value, &mut error) };
    
    check(status, &error)?;
    let result = { from19(&output.value, &mut scope) };
    result
}

pub(super) fn call4(arg0: &Event) -> Result<Event, Error> {
    let native = runtime()?;
    let mut scope = Scope::new();
    let mut output = Output { value: T26::default(), clear: native.clear26 };
    let mut error = NativeError::default();
    let input0 = to26(&arg0, &mut scope)?;
    let status = unsafe { (native.call4)(&input0, &mut output.value, &mut error) };
    
    check(status, &error)?;
    let result = { from26(&output.value, &mut scope) };
    result
}

pub(super) fn call5(arg0: &Event) -> Result<Event, Error> {
    let native = runtime()?;
    let mut scope = Scope::new();
    let mut output = Output { value: T26::default(), clear: native.clear26 };
    let mut error = NativeError::default();
    let input0 = to26(&arg0, &mut scope)?;
    let status = unsafe { (native.call5)(&input0, &mut output.value, &mut error) };
    
    check(status, &error)?;
    let result = { from26(&output.value, &mut scope) };
    result
}

pub(super) fn call6(arg0: &Pair) -> Result<Pair, Error> {
    let native = runtime()?;
    let mut scope = Scope::new();
    let mut output = Output { value: T27::default(), clear: native.clear27 };
    let mut error = NativeError::default();
    let input0 = to27(&arg0, &mut scope)?;
    let status = unsafe { (native.call6)(&input0, &mut output.value, &mut error) };
    
    check(status, &error)?;
    let result = { from27(&output.value, &mut scope) };
    result
}

pub(super) fn call7(arg0: &RawPacket) -> Result<Option<Packet>, Error> {
    let native = runtime()?;
    let mut scope = Scope::new();
    let mut output = Output { value: T20::default(), clear: native.clear20 };
    let mut error = NativeError::default();
    let input0 = to28(&arg0, &mut scope)?;
    let status = unsafe { (native.call7)(&input0, &mut output.value, &mut error) };
    
    check(status, &error)?;
    let result = { from20(&output.value, &mut scope) };
    result
}

pub(super) fn call8(arg0: &RawPacket) -> Result<Event, Error> {
    let native = runtime()?;
    let mut scope = Scope::new();
    let mut output = Output { value: T26::default(), clear: native.clear26 };
    let mut error = NativeError::default();
    let input0 = to28(&arg0, &mut scope)?;
    let status = unsafe { (native.call8)(&input0, &mut output.value, &mut error) };
    
    check(status, &error)?;
    let result = { from26(&output.value, &mut scope) };
    result
}

pub(super) fn call9(arg0: &RawPacket) -> Result<Event, Error> {
    let native = runtime()?;
    let mut scope = Scope::new();
    let mut output = Output { value: T26::default(), clear: native.clear26 };
    let mut error = NativeError::default();
    let input0 = to28(&arg0, &mut scope)?;
    let status = unsafe { (native.call9)(&input0, &mut output.value, &mut error) };
    
    check(status, &error)?;
    let result = { from26(&output.value, &mut scope) };
    result
}

pub(super) fn call10(arg0: &RawPacket) -> Result<Vec<Option<Packet>>, Error> {
    let native = runtime()?;
    let mut scope = Scope::new();
    let mut output = Output { value: T21::default(), clear: native.clear21 };
    let mut error = NativeError::default();
    let input0 = to28(&arg0, &mut scope)?;
    let status = unsafe { (native.call10)(&input0, &mut output.value, &mut error) };
    
    check(status, &error)?;
    let result = { from21(&output.value, &mut scope) };
    result
}

pub(super) fn call11(arg0: &RawPacket) -> Result<Pair, Error> {
    let native = runtime()?;
    let mut scope = Scope::new();
    let mut output = Output { value: T27::default(), clear: native.clear27 };
    let mut error = NativeError::default();
    let input0 = to28(&arg0, &mut scope)?;
    let status = unsafe { (native.call11)(&input0, &mut output.value, &mut error) };
    
    check(status, &error)?;
    let result = { from27(&output.value, &mut scope) };
    result
}

pub(super) fn call12(arg0: &Packet) -> Result<Packet, Error> {
    let native = runtime()?;
    let mut scope = Scope::new();
    let mut output = Output { value: T19::default(), clear: native.clear19 };
    let mut error = NativeError::default();
    let input0 = to19(&arg0, &mut scope)?;
    let status = unsafe { (native.call12)(&input0, &mut output.value, &mut error) };
    
    check(status, &error)?;
    let result = { from19(&output.value, &mut scope) };
    result
}

pub(super) fn call13() -> Result<u32, Error> {
    let native = runtime()?;
    let mut scope = Scope::new();
    let mut output: u32 = Default::default();
    let mut error = NativeError::default();

    let status = unsafe { (native.call13)(&mut output, &mut error) };
    
    check(status, &error)?;
    let result = { from4(&output, &mut scope) };
    result
}
