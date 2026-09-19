// Independent installed-crate acceptance. Uses only the generated public API.
use callables_api as api;
use api::{BigInt, BigUint, Error};
use std::sync::atomic::{AtomicUsize, Ordering};
static CHECKS: AtomicUsize = AtomicUsize::new(0);
#[track_caller]
fn check(value: bool) { let count = CHECKS.fetch_add(1, Ordering::Relaxed); assert!(value, "check {} failed", count + 1); }
trait Same { fn same(&self, other: &Self) -> bool; }
macro_rules! same_types { ($($t:ty),*) => { $(impl Same for $t { fn same(&self, other: &Self) -> bool { self == other } })* }; }
same_types!((), bool, char, u8, u16, u32, u64, i8, i16, i32, i64, BigUint, BigInt, String, Vec<u8>);
impl Same for f32 { fn same(&self, other: &Self) -> bool { self.to_bits() == other.to_bits() || self.is_nan() && other.is_nan() } }
impl Same for f64 { fn same(&self, other: &Self) -> bool { self.to_bits() == other.to_bits() || self.is_nan() && other.is_nan() } }
fn same<T: Same>(actual: &T, expected: &T) { check(actual.same(expected)); }
macro_rules! argument { (borrow, $v:ident) => { &$v }; (value, $v:ident) => { $v }; }
macro_rules! exercise {
    ($call:ident, $twice:ident, $make:ident, $borrow:ident, $values:expr) => {{
        let baseline = live();
        let values = $values;
        for iteration in 0..128 {
            let value = values[iteration % values.len()].clone();
            let replacement = values[(iteration + 1) % values.len()].clone();
            let mut seen = Vec::new();
            same(&api::$call(argument!($borrow, value), |item| {
                same(&item, &value); seen.push(item); Ok(replacement.clone())
            })?, &replacement);
            check(seen.len() == 1);
            seen.clear();
            same(&api::$twice(argument!($borrow, value), |item| {
                same(&item, if seen.is_empty() { &value } else { &replacement });
                seen.push(item); Ok(replacement.clone())
            })?, &replacement);
            check(seen.len() == 2);
            let choose = api::$make(argument!($borrow, value))?;
            check(!choose.is_closed());
            same(&choose.call(true, argument!($borrow, replacement))?, &value);
            same(&choose.call(false, argument!($borrow, replacement))?, &replacement);
            choose.close()?; choose.close()?;
            check(choose.is_closed());
            check(matches!(choose.call(true, argument!($borrow, value)), Err(Error::Closed)));
            check(live() == baseline);
        }
        let value = values[0].clone();
        let mut hits = 0;
        let marker = Error::Load("original\0λ".into());
        check(api::$twice(argument!($borrow, value), |_| { hits += 1; Err(marker.clone()) }).err() == Some(marker));
        check(hits == 1);
        hits = 0;
        let marker = Box::new(42u32);
        let address = (&*marker) as *const u32;
        let mut marker = Some(marker);
        let caught = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            api::$twice(argument!($borrow, value), |_| { hits += 1; std::panic::panic_any(marker.take().unwrap()) })
        }));
        let payload = caught.err().unwrap().downcast::<Box<u32>>().unwrap();
        check((&**payload as *const u32) == address);
        check(hits == 1);
        same(&api::$call(argument!($borrow, value), Ok)?, &value);
        check(live() == baseline);
    }};
}

#[repr(C)] #[derive(Default)]
struct Snapshot { abi: u32, state: u32, runs: u32, components: u32, attached: u32, identities: u32, runtime: u64, domain: u64 }
unsafe extern "C" {
    fn dlsym(library: *mut std::ffi::c_void, name: *const std::ffi::c_char) -> *mut std::ffi::c_void;
    fn fork() -> i32;
    fn waitpid(pid: i32, status: *mut i32, flags: i32) -> i32;
    fn _exit(code: i32) -> !;
}
fn live() -> u32 {
    let pointer = unsafe { dlsym(std::ptr::null_mut(), c"lean_bridge_native_snapshot_read".as_ptr()) };
    assert!(!pointer.is_null());
    let read: unsafe extern "C" fn(*mut Snapshot) = unsafe { std::mem::transmute(pointer) };
    let mut state = Snapshot::default(); unsafe { read(&mut state) }; state.identities
}
fn recurse(value: u32) -> Result<u32, Error> { api::call_uint32(value, recurse) }

fn main() -> Result<(), Error> {
    let original_hook = std::panic::take_hook();
    std::panic::set_hook(Box::new(move |info| { if !info.payload().is::<Box<u32>>() { original_hook(info); } }));
    check(api::word_bits()? == 64);
    let baseline = live();
    let huge = (BigUint::from(1u8) << 5120usize) + (BigUint::from(1u8) << 255usize) + BigUint::from(17u8);
    exercise!(call_unit, twice_unit, make_unit, value, vec![()]);
    exercise!(call_bool, twice_bool, make_bool, value, vec![false, true]);
    exercise!(call_char, twice_char, make_char, value, vec!['\0', '\u{7f}', '\u{d7ff}', '\u{e000}', '\u{ffff}', '\u{10000}', '🌿', '\u{10ffff}']);
    exercise!(call_uint8, twice_uint8, make_uint8, value, vec![0u8, 1, u8::MAX]);
    exercise!(call_uint16, twice_uint16, make_uint16, value, vec![0u16, 1, u16::MAX]);
    exercise!(call_uint32, twice_uint32, make_uint32, value, vec![0u32, 1, u32::MAX]);
    exercise!(call_uint64, twice_uint64, make_uint64, value, vec![0u64, 1, 1<<31, 1<<32, (1<<53)-1, (1<<53)+1, u64::MAX]);
    exercise!(call_usize, twice_usize, make_usize, value, vec![0u64, 1, 1<<31, 1<<32, (1<<53)+1, u64::MAX]);
    exercise!(call_int8, twice_int8, make_int8, value, vec![i8::MIN, -1, 0, i8::MAX]);
    exercise!(call_int16, twice_int16, make_int16, value, vec![i16::MIN, -1, 0, i16::MAX]);
    exercise!(call_int32, twice_int32, make_int32, value, vec![i32::MIN, -1, 0, i32::MAX]);
    exercise!(call_int64, twice_int64, make_int64, value, vec![i64::MIN, -1, 0, (1<<53)+1, i64::MAX]);
    exercise!(call_isize, twice_isize, make_isize, value, vec![i64::MIN, -1, 0, (1<<53)+1, i64::MAX]);
    exercise!(call_nat, twice_nat, make_nat, borrow, vec![BigUint::from(0u8), BigUint::from(u64::MAX), huge.clone()]);
    exercise!(call_int, twice_int, make_int, borrow, vec![BigInt::from(0u8), BigInt::from(i64::MIN), BigInt::from(huge.clone()), -BigInt::from(huge)]);
    exercise!(call_float32, twice_float32, make_float32, value, vec![0f32, -0., 1.25, -1.25, 1./3., f32::from_bits(1), -f32::from_bits(1), f32::INFINITY, f32::NEG_INFINITY, f32::NAN]);
    exercise!(call_float, twice_float, make_float, value, vec![0f64, -0., 1.25, -1.25, 1./3., f64::from_bits(1), -f64::from_bits(1), f64::INFINITY, f64::NEG_INFINITY, f64::NAN]);
    exercise!(call_string, twice_string, make_string, borrow, vec![String::new(), "a\0λ🌿".into(), "\0".into(), "\u{10ffff}".into(), "e\u{301}".into()]);
    exercise!(call_bytes, twice_bytes, make_bytes, borrow, vec![vec![], vec![0u8, 255, 128], (0..=255).collect()]);
    check(api::combine("hello\0", u64::MAX, |text, n| Ok(format!("{text}{n}")), |text| Ok(text + "🌿"))? == "hello\018446744073709551615🌿");
    let mut second = false;
    check(api::combine("", 1, |_, _| Err(Error::Allocation), |_| { second = true; Ok("".into()) }).err() == Some(Error::Allocation));
    check(!second);
    check(api::twice_uint32(40, |value| {
        check(api::call_uint32(value, |_| Err(Error::Allocation)).err() == Some(Error::Allocation));
        api::call_uint32(value, |n| Ok(n + 1))
    })? == 42);
    {
        let choose = api::make_uint32(42)?;
        check(api::call_uint32(0, |value| choose.call(true, value))? == 42);
    }
    check(api::call_uint32(1, recurse).unwrap_err().to_string().contains("64"));
    check(api::call_uint32(41, |v| Ok(v + 1))? == 42);
    for _ in 0..8 {
        let escaped = api::retain_callback(|v| Ok(v + 1))?;
        check(escaped.call(41).is_err());
        check(escaped.call(41).is_err());
        check(api::call_uint32(41, |v| Ok(v + 1))? == 42);
    }
    check(live() == baseline);
    check(matches!(api::call_bytes(&[], |_| Ok(vec![1u8; 16*1024*1024+1])), Err(Error::Limit)));
    check(matches!(api::call_string(&"x".repeat(16*1024*1024), Ok), Err(Error::Limit)));
    check(api::twice_string(&"x".repeat(3_500_000), Ok).is_err());
    check(api::call_string("still healthy", Ok)? == "still healthy");
    {
        let choose = api::make_string("inherited")?;
        let child = unsafe { fork() };
        check(child >= 0);
        if child == 0 {
            let safe = matches!(choose.call(true, ""), Err(Error::Load(_)))
                && matches!(choose.close(), Err(Error::Load(_)))
                && matches!(api::word_bits(), Err(Error::Load(_)));
            drop(choose);
            unsafe { _exit(if safe { 0 } else { 1 }) };
        }
        let mut status = 0;
        check(unsafe { waitpid(child, &mut status, 0) } == child && status == 0);
        check(choose.call(true, "")? == "inherited");
    }
    for _ in 0..8 {
        std::thread::spawn(|| -> Result<(), Error> {
            let choose = api::make_uint32(42)?;
            check(choose.call(true, 0)? == 42);
            check(api::call_uint32(41, |value| Ok(value+1))? == 42); Ok(())
        }).join().unwrap()?;
    }
    check(live() == baseline);
    {
        let leases: Vec<_> = (0..4096).map(|i| api::make_uint32(i).unwrap()).collect();
        check(live() == baseline + 4096);
        check(api::make_uint32(0).is_err());
        check(leases[4095].call(true, 0)? == 4095);
    }
    check(live() == baseline);
    for i in 0..4096 { let choose = api::make_uint32(i)?; check(choose.call(true, 0)? == i); }
    check(live() == baseline);
    println!("callable-rust-ok:{}", CHECKS.load(Ordering::Relaxed));
    Ok(())
}
