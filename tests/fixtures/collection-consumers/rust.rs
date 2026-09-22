// Independent public caller. This file never imports private transport types.
use collections_api as api;
use api::{BigInt, BigUint, Count, Empty, Packet, Pair, Primitives, Reversed, Single};
use std::sync::atomic::{AtomicUsize, Ordering};

static CHECKS: AtomicUsize = AtomicUsize::new(0);
static CALLS: AtomicUsize = AtomicUsize::new(0);
static REJECTIONS: AtomicUsize = AtomicUsize::new(0);

fn check(value: bool) {
    CHECKS.fetch_add(1, Ordering::Relaxed);
    assert!(value);
}
macro_rules! call {
    ($value:expr) => {{
        CALLS.fetch_add(1, Ordering::Relaxed);
        $value.unwrap()
    }};
}

trait Compare {
    fn compare(&self, expected: &Self);
}
macro_rules! scalar_types {
    ($($t:ty),*) => { $(impl Compare for $t {
        fn compare(&self, expected: &Self) { check(self == expected); }
    })* };
}
scalar_types!((), bool, u8, u16, u32, u64, i8, i16, i32, i64, BigUint, BigInt, String, char);
impl Compare for f32 {
    fn compare(&self, expected: &Self) {
        check(self.to_bits() == expected.to_bits() || self.is_nan() && expected.is_nan());
    }
}
impl Compare for f64 {
    fn compare(&self, expected: &Self) {
        check(self.to_bits() == expected.to_bits() || self.is_nan() && expected.is_nan());
    }
}
impl<T: Compare> Compare for Vec<T> {
    fn compare(&self, expected: &Self) {
        check(self.len() == expected.len());
        for (actual, expected) in self.iter().zip(expected) { actual.compare(expected); }
    }
}
macro_rules! record_fields {
    ($record:ty; $($field:ident),*) => { impl Compare for $record {
        fn compare(&self, expected: &Self) { $(self.$field.compare(&expected.$field);)* }
    } };
}
impl Compare for Empty {
    fn compare(&self, expected: &Self) { check(self == expected); }
}
record_fields!(Primitives; unit, flag, u8, u16, u32, u64, i8, i16, i32, i64,
    natural, integer, f32, f64, text, bytes, char_, usize, isize);
record_fields!(Single; value);
record_fields!(Count; value);
record_fields!(Pair; first, second);
record_fields!(Reversed; second, first);
record_fields!(Packet; label, values, empty, single, count, pair, reversed);

fn reverse<T: Clone>(input: &[Vec<T>]) -> Vec<Vec<T>> {
    input.iter().rev().map(|row| row.iter().rev().cloned().collect()).collect()
}
fn arrays<T: Compare + Clone>(function: fn(&[Vec<T>]) -> Result<Vec<Vec<T>>, api::Error>, values: Vec<T>) {
    call!(function(&[])).compare(&vec![]);
    call!(function(&[vec![], vec![]])).compare(&vec![vec![], vec![]]);
    for index in 0..128 {
        let first = values[index % values.len()].clone();
        let second = values[(index + 1) % values.len()].clone();
        let third = values[(index + 2) % values.len()].clone();
        let row = vec![first.clone(), second, third, first];
        let input = vec![row.clone(), vec![], vec![values[0].clone()], row];
        let original = input.clone();
        let output = call!(function(&input));
        output.compare(&reverse(&input));
        input.compare(&original);
    }
}

fn interpreted() -> Primitives {
    Primitives {
        unit: (), flag: true, u8: u8::MAX, u16: u16::MAX, u32: u32::MAX, u64: u64::MAX,
        i8: i8::MIN, i16: i16::MIN, i32: i32::MIN, i64: i64::MIN,
        natural: BigUint::from(1u8) << 200usize, integer: -(BigInt::from(1u8) << 200usize),
        f32: -0.0, f64: 3.25, text: "🌱\0".into(), bytes: vec![255, 0, 128], char_: '🌱',
        usize: u64::MAX, isize: i32::MIN as i64,
    }
}
fn inspect_arrays(value: &Primitives) -> bool {
    call!(api::array_check_elements(
        &[value.unit], &[value.flag], &[value.u8], &[value.u16], &[value.u32], &[value.u64],
        &[value.i8], &[value.i16], &[value.i32], &[value.i64],
        &[value.natural.clone()], &[value.integer.clone()], &[value.f32], &[value.f64],
        &[value.text.clone()], &[value.bytes.clone()], &[value.char_], &[value.usize], &[value.isize]
    ))
}
fn packet() -> Packet {
    Packet {
        label: "parcel\0".into(), values: vec![vec![interpreted()], vec![], vec![interpreted(), interpreted()]],
        empty: Empty {}, single: Single { value: u64::MAX },
        count: Count { value: (BigUint::from(1u8) << 5120usize) + BigUint::from(17u8) },
        pair: Pair { first: u32::MAX, second: "a\0".into() },
        reversed: Reversed { second: "b\0".into(), first: u32::MAX },
    }
}
fn shuffled(input: &Packet) -> Packet {
    let mut expected = input.clone();
    expected.label.push('!'); expected.values = reverse(&input.values);
    expected.single.value = expected.single.value.wrapping_add(1);
    expected.count.value += BigUint::from(7u8);
    expected.pair.first = expected.pair.first.wrapping_add(1); expected.pair.second.push('p');
    expected.reversed.first = expected.reversed.first.wrapping_add(2); expected.reversed.second.push('r');
    expected
}
macro_rules! nest {
    ($value:expr;) => { $value };
    ($value:expr; x $($rest:tt)*) => { vec![nest!($value; $($rest)*)] };
}
macro_rules! empty_levels {
    ($value:expr;) => {};
    ($value:expr; x $($rest:tt)*) => {
        { let input = $value; call!(api::deep(&input)).compare(&input); }
        empty_levels!(vec![$value]; $($rest)*);
    };
}
fn reject<T>(result: Result<T, api::Error>, native: bool) {
    CALLS.fetch_add(1, Ordering::Relaxed);
    check(if native { matches!(result, Err(api::Error::Native { .. })) }
        else { matches!(result, Err(api::Error::Limit)) });
    REJECTIONS.fetch_add(1, Ordering::Relaxed);
    call!(api::array_reverse_uint32(&[vec![1, 2, 3]])).compare(&vec![vec![3, 2, 1]]);
}

fn main() {
    let huge = (BigUint::from(1u8) << 5120usize) + (BigUint::from(1u8) << 255usize) + BigUint::from(17u8);
    arrays(api::array_reverse_unit, vec![()]);
    arrays(api::array_reverse_bool, vec![false, true]);
    arrays(api::array_reverse_uint8, vec![0u8, 1, u8::MAX]);
    arrays(api::array_reverse_uint16, vec![0u16, 1, u16::MAX]);
    arrays(api::array_reverse_uint32, vec![0u32, 1, u32::MAX]);
    arrays(api::array_reverse_uint64, vec![0u64, 1, (1 << 53) + 1, u64::MAX]);
    arrays(api::array_reverse_int8, vec![i8::MIN, -1, 0, i8::MAX]);
    arrays(api::array_reverse_int16, vec![i16::MIN, -1, 0, i16::MAX]);
    arrays(api::array_reverse_int32, vec![i32::MIN, -1, 0, i32::MAX]);
    arrays(api::array_reverse_int64, vec![i64::MIN, -1, 0, i64::MAX]);
    arrays(api::array_reverse_nat, vec![BigUint::from(0u8), huge.clone()]);
    arrays(api::array_reverse_int, vec![BigInt::from(0u8), BigInt::from(huge.clone()), -BigInt::from(huge.clone())]);
    arrays(api::array_reverse_float32, vec![0.0f32, -0.0, f32::from_bits(1), f32::from_bits(0x007fffff), f32::from_bits(0x00800000), f32::MAX, f32::INFINITY, f32::NEG_INFINITY, f32::NAN]);
    arrays(api::array_reverse_float64, vec![0.0f64, -0.0, f64::from_bits(1), f64::from_bits(0x000fffffffffffff), f64::from_bits(0x0010000000000000), f64::MAX, f64::INFINITY, f64::NEG_INFINITY, f64::NAN]);
    arrays(api::array_reverse_string, vec![String::new(), "A\0B🌱".into(), "\u{feff}e\u{301}".into(), "\u{10ffff}".into()]);
    arrays(api::array_reverse_bytes, vec![vec![], vec![0u8, 255], (0u8..=255).collect()]);
    arrays(api::array_reverse_char, vec!['\0', '🌱', '\u{301}', '\u{d7ff}', '\u{e000}', '\u{ffff}', '\u{10ffff}']);
    arrays(api::array_reverse_usize, vec![0u64, (1 << 53) + 1, u64::MAX]);
    arrays(api::array_reverse_isize, vec![i64::MIN, -((1 << 53) + 1), 0, i64::MAX]);
    for index in 0..128 {
        let a = interpreted(); let mut b = a.clone(); let mut c = a.clone();
        b.u32 = index; b.text = format!("{index}\0"); b.f32 = f32::NAN;
        c.integer = -BigInt::from(huge.clone()); c.f64 = f64::NAN;
        call!(api::record_reverse(&[a.clone(), b.clone(), c.clone()])).compare(&vec![c, b, a]);
    }
    call!(api::record_reverse(&[])).compare(&vec![]);
    check(inspect_arrays(&interpreted())); check(call!(api::record_inspect(&interpreted())));
    macro_rules! changed {
        ($field:ident, $value:expr) => {{
            let mut value = interpreted(); value.$field = $value;
            check(!inspect_arrays(&value)); check(!call!(api::record_inspect(&value)));
        }};
    }
    changed!(flag, false); changed!(u8, 0); changed!(u16, 0); changed!(u32, 0); changed!(u64, 0);
    changed!(i8, 0); changed!(i16, 0); changed!(i32, 0); changed!(i64, 0);
    changed!(natural, BigUint::from(0u8)); changed!(integer, BigInt::from(0u8));
    changed!(f32, 0.0); changed!(f64, 0.0); changed!(text, "wrong".into());
    changed!(bytes, vec![]); changed!(char_, 'x'); changed!(usize, 0); changed!(isize, 0);
    call!(api::array_add(&BigInt::from(7u8), &[vec![-BigInt::from(huge.clone()), BigInt::from(huge.clone())], vec![]]))
        .compare(&vec![vec![-BigInt::from(huge.clone()) + BigInt::from(7u8), BigInt::from(huge.clone()) + BigInt::from(7u8)], vec![]]);
    call!(api::array_total(&[vec![huge.clone(), BigUint::from(1u8)], vec![], vec![huge.clone()]]))
        .compare(&(huge.clone() * BigUint::from(2u8) + BigUint::from(1u8)));
    call!(api::array_total(&[])).compare(&BigUint::from(0u8));
    call!(api::array_words()).compare(&vec![vec!["\u{feff}Lean".into(), "🌱\0".into()], vec![]]);
    call!(api::array_size(&[(), ()])).compare(&2); call!(api::array_size(&[])).compare(&0);
    call!(api::record_empty(&Empty {})).compare(&Empty {});
    call!(api::record_single(&Single { value: u64::MAX })).compare(&Single { value: 0 });
    call!(api::record_count(&Count { value: huge.clone() })).compare(&Count { value: huge + BigUint::from(1u8) });
    call!(api::record_make()).compare(&Pair { first: 42, second: "\u{feff}🌱\0".into() });
    for _ in 0..32 {
        let mut input = packet(); let original = input.clone();
        let expected = shuffled(&input); let mut output = call!(api::record_shuffle(&input));
        output.compare(&expected); check(output == expected);
        let mut copies = call!(api::record_duplicate(&input));
        copies.compare(&vec![original.clone(), original.clone()]);
        input.label.clear(); input.values[0][0].bytes.clear();
        input.values[0][0].natural += BigUint::from(1u8);
        output.compare(&expected); copies[0].compare(&original);
        copies[0].values[0][0].bytes[0] = 7; copies[0].count.value += BigUint::from(1u8);
        copies[1].compare(&original);
        output.values[0][0].text.clear(); copies[1].compare(&original);
    }
    let mut bytes = vec![vec![0u8, 255]]; let mut copies = call!(api::array_duplicate(&bytes));
    copies.compare(&vec![vec![0, 255], vec![0, 255]]);
    bytes[0][0] = 7; copies[0][0] = 9; copies[1].compare(&vec![0, 255]);
    let deep = nest!(42u32; x x x x x x x x x x x x x x x x x x x x x x x x);
    call!(api::deep(&deep)).compare(&deep);
    empty_levels!(vec![]; x x x x x x x x x x x x x x x x x x x x x x x x);
    for _ in 0..3 {
        reject(api::array_reverse_bytes(&[vec![vec![0; 16 * 1024 * 1024]]]), false);
        reject(api::array_size(&vec![(); 2_097_153]), false);
        reject(api::array_duplicate(&[vec![0; 6 * 1024 * 1024]]), true);
        reject(api::generate(&BigUint::from(17u32 * 1024 * 1024)), true);
    }
    call!(api::generate(&BigUint::from(30_000u32))).compare(&vec![(); 30_000]);
    let a = Pair { first: 42, second: "value".into() }; check(a == a.clone());
    let workers: Vec<_> = (0..4).map(|thread| std::thread::spawn(move || {
        for index in 0..64 {
            call!(api::array_reverse_uint32(&[vec![thread, index]])).compare(&vec![vec![index, thread]]);
            let input = packet(); call!(api::record_shuffle(&input)).compare(&shuffled(&input));
        }
    })).collect();
    for worker in workers { worker.join().unwrap(); }
    println!("collections-rust-ok:{}:{}:{}", CHECKS.load(Ordering::Relaxed), CALLS.load(Ordering::Relaxed), REJECTIONS.load(Ordering::Relaxed));
}
