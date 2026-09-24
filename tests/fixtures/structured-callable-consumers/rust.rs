// Installed acceptance through the generated public crate, without raw ABI calls.
use structured_api as api;
use api::{BigInt, BigUint, Error};
use std::sync::atomic::{AtomicUsize, Ordering};
static CHECKS: AtomicUsize = AtomicUsize::new(0);
#[track_caller]
fn check(value: bool) { CHECKS.fetch_add(1, Ordering::Relaxed); assert!(value); }
fn same<T: PartialEq + std::fmt::Debug>(actual: &T, expected: &T) {
    CHECKS.fetch_add(1, Ordering::Relaxed); assert_eq!(actual, expected);
}
type Array = Vec<Option<String>>;
type List = Vec<Result<(u32, String), String>>;
type OptionValue = Option<Option<()>>;
type ResultValue = Result<Option<u32>, Vec<String>>;
type Tuple = (String, (Vec<u8>, BigUint));
const TEXT: &str = "a\0λ🌿";
fn array_value(seed: u32) -> Array {
    match seed % 4 {
        0 => vec![], 1 => vec![None], 2 => vec![Some(String::new()), Some(TEXT.into())],
        _ => vec![Some(TEXT.into()), None, Some(String::new()), Some("\0".into())],
    }
}
fn list_value(seed: u32) -> List {
    match seed % 4 {
        0 => vec![], 1 => vec![Err(TEXT.into())],
        _ => vec![Ok((u32::MAX, TEXT.into())), Err(String::new()), Ok((seed, String::new()))],
    }
}
fn option_value(seed: u32) -> OptionValue {
    match seed % 3 { 0 => None, 1 => Some(None), _ => Some(Some(())) }
}
fn result_value(seed: u32) -> ResultValue {
    match seed % 4 {
        0 => Ok(None), 1 => Ok(Some(u32::MAX)), 2 => Err(vec![]),
        _ => Err(vec![String::new(), TEXT.into(), "\0".into()]),
    }
}
fn tuple_value(seed: u32) -> Tuple {
    (if seed % 2 == 0 { String::new() } else { TEXT.into() },
        (if seed % 2 == 0 { vec![] } else { vec![0, 255, 128, 1] },
        if seed % 3 == 0 { BigUint::from(0u8) } else { (BigUint::from(1u8) << 4097usize) + seed }))
}
fn record_value(seed: u32) -> api::Payload {
    api::Payload { text: TEXT.into(), rows: array_value(seed), count: (BigUint::from(1u8) << 257usize) + seed,
        nested: match seed % 3 { 0 => None, 1 => Some(Ok((u64::MAX, ()))), _ => Some(Err(TEXT.into())) } }
}
fn variant_value(seed: u32) -> api::Packet {
    match seed % 3 {
        0 => api::Packet::Empty,
        1 => api::Packet::Payload { label: TEXT.into(), rows: array_value(seed) },
        _ => { let huge = (BigUint::from(1u8) << 8193usize) + seed;
            api::Packet::Counts { positive: huge.clone(), negative: -BigInt::from(huge) } },
    }
}
macro_rules! exercise {
    ($call:ident, $twice:ident, $make:ident, $factory:ident, $seed:expr) => {{
        let baseline = live();
        let value = $factory($seed); let replacement = $factory($seed + 1);
        let mut seen = Vec::new();
        same(&api::$call(&value, |item| {
            same(&item, &value); seen.push(item); Ok(replacement.clone())
        })?, &replacement); check(seen.len() == 1);
        seen.clear();
        same(&api::$twice(&value, |item| {
            same(&item, if seen.is_empty() { &value } else { &replacement });
            seen.push(item); Ok(replacement.clone())
        })?, &replacement); check(seen.len() == 2);
        // Inputs are copied into Lean; later changes to the Rust source are independent.
        let mut captured = value.clone(); let closure = api::$make(&captured)?;
        captured = replacement.clone();
        same(&closure.call(true, &captured)?, &value);
        same(&closure.call(false, &captured)?, &replacement);
        let moved = closure; check(!moved.is_closed());
        same(&moved.call(true, &replacement)?, &value);
        moved.close()?; moved.close()?; check(moved.is_closed());
        check(matches!(moved.call(true, &value), Err(Error::Closed)));
        let mut hits = 0; let marker = Error::Load(TEXT.into());
        same(&api::$twice(&value, |_| { hits += 1; Err(marker.clone()) }).err(), &Some(marker));
        check(hits == 1);
        let marker = Box::new(42u32); let address = (&*marker) as *const u32;
        let mut marker = Some(marker); hits = 0;
        let caught = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            api::$twice(&value, |_| { hits += 1; std::panic::panic_any(marker.take().unwrap()) })
        }));
        let payload = caught.err().unwrap().downcast::<Box<u32>>().unwrap();
        check((&**payload as *const u32) == address); check(hits == 1);
        same(&api::$call(&value, |item| {
            same(&api::$call(&item, |_| Err(Error::Allocation)).err(), &Some(Error::Allocation));
            api::$call(&item, Ok)
        })?, &value);
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
    let raw = unsafe { dlsym(std::ptr::null_mut(), c"lean_bridge_native_snapshot_read".as_ptr()) };
    assert!(!raw.is_null());
    let read: unsafe extern "C" fn(*mut Snapshot) = unsafe { std::mem::transmute(raw) };
    let mut snapshot = Snapshot::default(); unsafe { read(&mut snapshot) }; snapshot.identities
}
fn recurse(value: api::Payload) -> Result<api::Payload, Error> { api::call_record(&value, recurse) }
fn main() -> Result<(), Error> {
    let original_hook = std::panic::take_hook();
    std::panic::set_hook(Box::new(move |info| { if !info.payload().is::<Box<u32>>() { original_hook(info); } }));
    api::call_option(&None, Ok)?;
    let baseline = live();
    for seed in 0..12 {
        exercise!(call_array, twice_array, make_array, array_value, seed);
        exercise!(call_list, twice_list, make_list, list_value, seed);
        exercise!(call_option, twice_option, make_option, option_value, seed);
        exercise!(call_result, twice_result, make_result, result_value, seed);
        exercise!(call_tuple, twice_tuple, make_tuple, tuple_value, seed);
        exercise!(call_record, twice_record, make_record, record_value, seed);
        exercise!(call_variant, twice_variant, make_variant, variant_value, seed);
        exercise!(call_alias, twice_alias, make_alias, record_value, seed);
    }
    let value = record_value(7);
    check(api::call_record(&value, recurse).unwrap_err().to_string().contains("64"));
    for _ in 0..8 {
        let escaped = api::retain_record(Ok)?;
        check(escaped.call(&value).is_err()); check(escaped.call(&value).is_err());
        same(&api::call_record(&value, Ok)?, &value);
    }
    same(&api::after_failure(&value, |_| Err(Error::Allocation)).err(), &Some(Error::Allocation));
    check(matches!(api::call_record(&value, |mut item| {
        item.rows = vec![Some("x".repeat(16 * 1024 * 1024 + 1))]; Ok(item)
    }), Err(Error::Limit)));
    let mut large = value.clone(); large.text = "x".repeat(3_500_000);
    check(api::twice_record(&large, Ok).is_err());
    same(&api::call_record(&value, Ok)?, &value);
    {
        let closure = api::make_record(&value)?;
        same(&api::call_record(&value, |item| closure.call(true, &item))?, &value);
        let child = unsafe { fork() }; check(child >= 0);
        if child == 0 {
            let safe = matches!(closure.call(true, &value), Err(Error::Load(_)))
                && matches!(closure.close(), Err(Error::Load(_)))
                && matches!(api::call_record(&value, Ok), Err(Error::Load(_)));
            drop(closure); unsafe { _exit(if safe { 0 } else { 1 }) };
        }
        let mut status = 0; check(unsafe { waitpid(child, &mut status, 0) } == child && status == 0);
        same(&closure.call(true, &value)?, &value);
    }
    for _ in 0..8 {
        std::thread::spawn(|| -> Result<(), Error> {
            let value = record_value(5); let closure = api::make_record(&value)?;
            same(&closure.call(true, &value)?, &value);
            same(&api::call_record(&value, Ok)?, &value); Ok(())
        }).join().unwrap()?;
    }
    check(live() == baseline);
    println!("structured-rust-ok:{}", CHECKS.load(Ordering::Relaxed));
    Ok(())
}
