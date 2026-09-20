// Independent installed-crate checks. Only the generated public API is used.
use lists_api as api;
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
    ($reverse:ident, $t:ty, $values:expr) => {{
        let reverse: fn(&[$t]) -> Result<Vec<$t>, Error> = api::$reverse;
        let values: Vec<$t> = $values;
        same(&reverse(&[])?, &vec![]);
        for iteration in 0..64 {
            let a = values[iteration % values.len()].clone();
            let b = values[(iteration + 1) % values.len()].clone();
            let input = vec![a.clone(), b.clone(), a.clone(), a.clone()];
            let expected = vec![a.clone(), a.clone(), b, a.clone()];
            same(&reverse(&input)?, &expected);
            same(&reverse(&[a.clone()])?, &vec![a]);
            same(&reverse(&input[1..3])?, &input[1..3].iter().cloned().rev().collect());
        }
    }};
}
macro_rules! nest {
    ($value:expr;) => { $value };
    ($value:expr; x $($rest:tt)*) => { vec![nest!($value; $($rest)*)] };
}
macro_rules! deep_cases {
    ($value:expr;) => {};
    ($value:expr; x $($rest:tt)*) => {
        { let value = $value; same(&api::deep(&value)?, &value); }
        deep_cases!(vec![$value]; $($rest)*);
    };
}

fn main() -> Result<(), Error> {
    let huge = (BigUint::from(1u8) << 5120usize) + (BigUint::from(1u8) << 255usize) + BigUint::from(17u8);
    exercise!(reverse_unit, (), vec![()]);
    exercise!(reverse_bool, bool, vec![false, true]);
    exercise!(reverse_char, char, vec!['\0', '\u{7f}', '\u{d7ff}', '\u{e000}', '\u{ffff}', '\u{10000}', '🌿', '\u{10ffff}']);
    exercise!(reverse_uint8, u8, vec![0, 1, u8::MAX]);
    exercise!(reverse_uint16, u16, vec![0, 1, u16::MAX]);
    exercise!(reverse_uint32, u32, vec![0, 1, u32::MAX]);
    exercise!(reverse_uint64, u64, vec![0, 1, 1<<31, 1<<32, (1<<53)-1, (1<<53)+1, u64::MAX]);
    exercise!(reverse_usize, u64, vec![0, 1, 1<<31, 1<<32, (1<<53)+1, u64::MAX]);
    exercise!(reverse_int8, i8, vec![i8::MIN, -1, 0, i8::MAX]);
    exercise!(reverse_int16, i16, vec![i16::MIN, -1, 0, i16::MAX]);
    exercise!(reverse_int32, i32, vec![i32::MIN, -1, 0, i32::MAX]);
    exercise!(reverse_int64, i64, vec![i64::MIN, -1, 0, (1<<53)+1, i64::MAX]);
    exercise!(reverse_isize, i64, vec![i64::MIN, -1, 0, (1<<53)+1, i64::MAX]);
    exercise!(reverse_nat, BigUint, vec![BigUint::from(0u8), BigUint::from(u64::MAX), huge.clone()]);
    exercise!(reverse_int, BigInt, vec![BigInt::from(0u8), BigInt::from(i64::MIN), BigInt::from(huge.clone()), -BigInt::from(huge.clone())]);
    exercise!(reverse_float32, f32, vec![0., -0., 1.25, -1.25, 1./3., f32::from_bits(1), -f32::from_bits(1), f32::INFINITY, f32::NEG_INFINITY, f32::NAN]);
    exercise!(reverse_float64, f64, vec![0., -0., 1.25, -1.25, 1./3., f64::from_bits(1), -f64::from_bits(1), f64::INFINITY, f64::NEG_INFINITY, f64::NAN]);
    exercise!(reverse_string, String, vec![String::new(), "a\0λ🌿".into(), "\0".into(), "\u{10ffff}".into(), "e\u{301}".into()]);
    exercise!(reverse_bytes, Vec<u8>, vec![vec![], vec![0,255,128], (0..=255).collect()]);

    let join: fn(&[String]) -> Result<String, Error> = api::join;
    let mix: fn(&[Vec<u32>]) -> Result<Vec<Vec<u32>>, Error> = api::mix;
    same(&join(&["a\0".into(), "".into(), "🌿".into()])?, &"a\0🌱🌱🌿".into());
    same(&join(&[])?, &"".into());
    same(&mix(&[vec![1, 2, 3], vec![], vec![4]])?, &vec![vec![4], vec![], vec![3, 2, 1]]);
    for index in 0..20 {
        let mut packet = api::Packet {
            sequences: vec![vec![1, 2, 3], vec![], vec![index]],
            branches: vec![None, Some(Ok((huge.clone(), ()))), Some(Err("oops\0".into()))],
            buffers: vec![vec![0, 255], vec![]],
            arrays: vec![vec![(true, '🌿'), (false, '\0')], vec![]],
        };
        let mut copied = api::transform(&packet)?;
        same(&copied.sequences, &vec![vec![index], vec![], vec![3, 2, 1]]);
        same(&copied.branches, &vec![Some(Err("oops\0!".into())), Some(Ok((huge.clone() + BigUint::from(1u8), ()))), None]);
        same(&copied.buffers, &vec![vec![], vec![0, 255]]);
        same(&copied.arrays, &vec![vec![], vec![(false, '\0'), (true, '🌿')]]);
        copied.buffers[1][0] = 9;
        check(packet.buffers[0][0] == 0);
        packet.sequences[0][0] = 99;
        packet.branches.clear();
        packet.arrays[0].clear();
        same(&copied.sequences[2], &vec![3, 2, 1]);
        same(&copied.arrays[1], &vec![(false, '\0'), (true, '🌿')]);
        check(copied.branches.len() == 3);
    }
    let nest: fn(&Option<Vec<Result<Vec<()>, String>>>) -> Result<Option<Vec<Result<Vec<()>, String>>>, Error> = api::nest;
    let swap: fn(&Result<(Vec<BigUint>, Vec<u32>), Vec<String>>) -> Result<Result<Vec<String>, (Vec<BigUint>, Vec<u32>)>, Error> = api::swap;
    same(&nest(&None)?, &None);
    same(&nest(&Some(vec![]))?, &Some(vec![]));
    same(&nest(&Some(vec![Ok(vec![(), ()]), Err("bad\0".into()), Ok(vec![])]))?,
         &Some(vec![Ok(vec![]), Err("bad\0!".into()), Ok(vec![(), ()])]));
    same(&swap(&Err(vec!["first".into(), "last".into()]))?, &Ok(vec!["last".into(), "first".into()]));
    same(&swap(&Ok((vec![huge.clone(), BigUint::from(42u8)], vec![1, 2, 3])))?,
         &Err((vec![BigUint::from(42u8), huge.clone()], vec![3, 2, 1])));
    deep_cases!(vec![]; x x x x x x x x x x x x x x x x x x x x x x x x);
    let deepest = nest!(42u32; x x x x x x x x x x x x x x x x x x x x x x x x);
    same(&api::deep(&deepest)?, &deepest);

    let bytes = vec![0u8, 255];
    let mut copies = api::duplicate(&bytes)?;
    same(&copies, &vec![vec![0, 255], vec![0, 255]]);
    copies[0][0] = 7;
    check(copies[1][0] == 0 && bytes[0] == 0);
    same(&api::duplicate(&[])?, &vec![vec![], vec![]]);
    check(matches!(api::reverse_unit(&vec![(); 2usize.pow(21) + 1]), Err(Error::Limit)));
    check(matches!(api::reverse_bytes(&[vec![0; 16 * 1024 * 1024]]), Err(Error::Limit)));
    for _ in 0..3 {
        check(matches!(api::duplicate(&vec![0; 6 * 1024 * 1024]), Err(Error::Native { code: 1, .. })));
        same(&api::duplicate(&[1, 2, 3])?, &vec![vec![1, 2, 3], vec![1, 2, 3]]);
    }
    check(matches!(api::generate(&BigUint::from(2097153u32)), Err(Error::Native { code: 1, .. })));
    same(&api::generate(&BigUint::from(1u8))?, &vec![7]);
    let generated = api::generate(&BigUint::from(30000u32))?;
    check(generated.len() == 30000);
    for value in generated { check(value == 7); }
    std::thread::scope(|scope| {
        for lane in 0..4 {
            let huge = &huge;
            scope.spawn(move || { for i in 0..64 {
                let n = huge + BigUint::from((lane * 64 + i) as u32);
                same(&api::reverse_nat(&[n.clone(), BigUint::from(42u8)]).unwrap(), &vec![BigUint::from(42u8), n]);
            } });
        }
    });
    println!("list-rust-ok:{}", CHECKS.load(Ordering::Relaxed));
    Ok(())
}
