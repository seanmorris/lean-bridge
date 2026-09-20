// Independent installed-crate checks. Only the generated public API is used.
use compounds_api as api;
use api::{BigInt, BigUint, Error};
use std::sync::atomic::{AtomicUsize, Ordering};
static CHECKS: AtomicUsize = AtomicUsize::new(0);
#[track_caller]
fn check(value: bool) { let count = CHECKS.fetch_add(1, Ordering::Relaxed); assert!(value, "check {} failed", count + 1); }
trait Same { fn same(&self, other: &Self) -> bool; }
macro_rules! same_types { ($($t:ty),*) => { $(impl Same for $t { fn same(&self, other: &Self) -> bool { self == other } })* }; }
same_types!((), bool, char, u8, u16, u32, u64, i8, i16, i32, i64, BigUint, BigInt, String);
impl Same for f32 { fn same(&self, other: &Self) -> bool { self.to_bits() == other.to_bits() || self.is_nan() && other.is_nan() } }
impl Same for f64 { fn same(&self, other: &Self) -> bool { self.to_bits() == other.to_bits() || self.is_nan() && other.is_nan() } }
impl<T: Same> Same for Option<T> {
    fn same(&self, other: &Self) -> bool { match (self, other) { (None, None) => true, (Some(a), Some(b)) => a.same(b), _ => false } }
}
impl<T: Same, E: Same> Same for Result<T, E> {
    fn same(&self, other: &Self) -> bool { match (self, other) { (Ok(a), Ok(b)) => a.same(b), (Err(a), Err(b)) => a.same(b), _ => false } }
}
impl<A: Same, B: Same> Same for (A, B) { fn same(&self, other: &Self) -> bool { self.0.same(&other.0) && self.1.same(&other.1) } }
impl<T: Same> Same for Vec<T> { fn same(&self, other: &Self) -> bool { self.len() == other.len() && self.iter().zip(other).all(|(a,b)| a.same(b)) } }
fn same<T: Same>(actual: &T, expected: &T) { check(actual.same(expected)); }
macro_rules! exercise {
    ($option:ident, $result:ident, $tuple:ident, $t:ty, $values:expr) => {{
        // These signatures are specified independently of the generator.
        let option: fn(&Option<$t>) -> Result<Option<$t>, Error> = api::$option;
        let result: fn(&Result<$t, $t>) -> Result<Result<$t, $t>, Error> = api::$result;
        let tuple: fn(&($t, $t)) -> Result<($t, $t), Error> = api::$tuple;
        let values: Vec<$t> = $values;
        same(&option(&None)?, &None);
        for iteration in 0..64 {
            let a = values[iteration % values.len()].clone();
            let b = values[(iteration + 1) % values.len()].clone();
            same(&option(&Some(a.clone()))?, &Some(a.clone()));
            same(&result(&Ok(a.clone()))?, &Err(a.clone()));
            same(&result(&Err(a.clone()))?, &Ok(a.clone()));
            same(&tuple(&(a.clone(), b.clone()))?, &(b, a));
        }
    }};
}
macro_rules! nest {
    ($value:expr;) => { $value };
    ($value:expr; x $($rest:tt)*) => { Some(nest!($value; $($rest)*)) };
}
macro_rules! deep_cases {
    ($value:expr;) => {};
    ($value:expr; x $($rest:tt)*) => {
        { let value = $value; same(&api::deep(&value)?, &value); }
        deep_cases!(Some($value); $($rest)*);
    };
}

fn main() -> Result<(), Error> {
    let huge = (BigUint::from(1u8) << 5120usize) + (BigUint::from(1u8) << 255usize) + BigUint::from(17u8);
    exercise!(option_unit, result_unit, tuple_unit, (), vec![()]);
    exercise!(option_bool, result_bool, tuple_bool, bool, vec![false, true]);
    exercise!(option_char, result_char, tuple_char, char, vec!['\0', '\u{7f}', '\u{d7ff}', '\u{e000}', '\u{ffff}', '\u{10000}', '🌿', '\u{10ffff}']);
    exercise!(option_uint8, result_uint8, tuple_uint8, u8, vec![0, 1, u8::MAX]);
    exercise!(option_uint16, result_uint16, tuple_uint16, u16, vec![0, 1, u16::MAX]);
    exercise!(option_uint32, result_uint32, tuple_uint32, u32, vec![0, 1, u32::MAX]);
    exercise!(option_uint64, result_uint64, tuple_uint64, u64, vec![0, 1, 1<<31, 1<<32, (1<<53)-1, (1<<53)+1, u64::MAX]);
    exercise!(option_usize, result_usize, tuple_usize, u64, vec![0, 1, 1<<31, 1<<32, (1<<53)+1, u64::MAX]);
    exercise!(option_int8, result_int8, tuple_int8, i8, vec![i8::MIN, -1, 0, i8::MAX]);
    exercise!(option_int16, result_int16, tuple_int16, i16, vec![i16::MIN, -1, 0, i16::MAX]);
    exercise!(option_int32, result_int32, tuple_int32, i32, vec![i32::MIN, -1, 0, i32::MAX]);
    exercise!(option_int64, result_int64, tuple_int64, i64, vec![i64::MIN, -1, 0, (1<<53)+1, i64::MAX]);
    exercise!(option_isize, result_isize, tuple_isize, i64, vec![i64::MIN, -1, 0, (1<<53)+1, i64::MAX]);
    exercise!(option_nat, result_nat, tuple_nat, BigUint, vec![BigUint::from(0u8), BigUint::from(u64::MAX), huge.clone()]);
    exercise!(option_int, result_int, tuple_int, BigInt, vec![BigInt::from(0u8), BigInt::from(i64::MIN), BigInt::from(huge.clone()), -BigInt::from(huge.clone())]);
    exercise!(option_float32, result_float32, tuple_float32, f32, vec![0., -0., 1.25, -1.25, 1./3., f32::from_bits(1), -f32::from_bits(1), f32::INFINITY, f32::NEG_INFINITY, f32::NAN]);
    exercise!(option_float64, result_float64, tuple_float64, f64, vec![0., -0., 1.25, -1.25, 1./3., f64::from_bits(1), -f64::from_bits(1), f64::INFINITY, f64::NEG_INFINITY, f64::NAN]);
    exercise!(option_string, result_string, tuple_string, String, vec![String::new(), "a\0λ🌿".into(), "\0".into(), "\u{10ffff}".into(), "e\u{301}".into()]);
    exercise!(option_bytes, result_bytes, tuple_bytes, Vec<u8>, vec![vec![], vec![0,255,128], (0..=255).collect()]);

    let classify: fn(&Option<Option<()>>) -> Result<u32, Error> = api::classify;
    let next: fn(&Option<Option<()>>) -> Result<Option<Option<()>>, Error> = api::next;
    let states = [None, Some(None), Some(Some(()))];
    let mut state = None;
    for step in 0..30 { same(&state, &states[step % 3]); check(classify(&state)? == (step % 3) as u32); state = next(&state)?; }
    same(&api::make()?, &Some(Ok((u64::MAX, ()))));
    same(&api::flip(&Ok((42, Some(()))))?, &Err((42, Some(()))));
    same(&api::flip(&Ok((0, None)))?, &Err((0, None)));
    same(&api::flip(&Err(Some("a\0λ".into())))?, &Ok(Some("a\0λ".into())));
    same(&api::flip(&Err(None))?, &Ok(None));
    for choice in [None, Some(Ok((huge.clone(), ()))), Some(Err("oops\0".into()))] {
        for nested in [Ok(None), Ok(Some(Ok((42, ())))), Ok(Some(Err("bad".into()))), Err(None), Err(Some(huge.clone()))] {
            let packet = api::Packet { choice: choice.clone(), products: ((4, "a\0".into()), (true, '🌱')),
                rows: vec![None, Some(Ok(("x\0🌱".into(), u64::MAX))), Some(Err((vec![0,255], -BigInt::from(huge.clone()))))], nested };
            let mut copied = api::transform(&packet)?;
            let expected = match &choice { None => None, Some(Ok((n, ()))) => Some(Ok((n + BigUint::from(1u8), ()))), Some(Err(s)) => Some(Err(s.clone() + "!")) };
            same(&copied.choice, &expected);
            same(&copied.products, &((5, "a\0!".into()), (false, '🌱')));
            same(&copied.rows, &packet.rows.iter().cloned().rev().collect());
            same(&copied.nested, &packet.nested);
            if let Some(Err((bytes, _))) = &mut copied.rows[0] { bytes[0] = 7; } else { check(false); }
            check(packet.rows[2].as_ref().unwrap().as_ref().unwrap_err().0 == vec![0,255]);
        }
    }
    deep_cases!(None; x x x x x x x x x x x x x x x x x x x x x x x x);
    let deepest = nest!(Ok((42, ())); x x x x x x x x x x x x x x x x x x x x x x x x);
    same(&api::deep(&deepest)?, &deepest);
    let deepest = nest!(Err("deep\0λ".into()); x x x x x x x x x x x x x x x x x x x x x x x x);
    same(&api::deep(&deepest)?, &deepest);

    same(&api::duplicate(&None)?, &Err("empty".into()));
    let bytes = Some(vec![0,255]);
    let mut copies = api::duplicate(&bytes)?.unwrap().unwrap();
    same(&copies, &vec![vec![0,255], vec![0,255]]);
    copies[0][0] = 7;
    check(copies[1][0] == 0 && bytes.unwrap()[0] == 0);
    check(matches!(api::option_bytes(&Some(vec![0; 16*1024*1024])), Err(Error::Limit)));
    check(matches!(api::duplicate(&Some(vec![0; 6*1024*1024])), Err(Error::Native { code: 1, .. })));
    same(&api::duplicate(&Some(vec![1,2,3]))?, &Ok(Some(vec![vec![1,2,3], vec![1,2,3]])));
    std::thread::scope(|scope| {
        for lane in 0..4 {
            let huge = &huge;
            scope.spawn(move || { for i in 0..64 { let n = Some(huge + BigUint::from((lane * 64 + i) as u32)); same(&api::option_nat(&n).unwrap(), &n); } });
        }
    });
    println!("compound-rust-ok:{}", CHECKS.load(Ordering::Relaxed));
    Ok(())
}
