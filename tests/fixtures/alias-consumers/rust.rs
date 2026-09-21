// Independent installed-crate checks through public aliases, with no ABI glue.
use aliases_api as api;
use api::{BigInt, BigUint, Error};
use std::sync::atomic::{AtomicUsize, Ordering};
static CHECKS: AtomicUsize = AtomicUsize::new(0);
#[track_caller]
fn check(value: bool) {
    let count = CHECKS.fetch_add(1, Ordering::Relaxed);
    assert!(value, "check {} failed", count + 1);
}
macro_rules! scalar {
    ($name:ident, $alias:ident, $values:expr) => {{
        let echo: fn(api::$alias) -> Result<api::$alias, Error> = api::$name;
        for value in $values { let result: api::$alias = echo(value)?; check(result == value); }
    }};
}
macro_rules! changed {
    ($value:expr, $field:ident, $other:expr) => {{
        let mut changed: api::ScalarsView = $value.clone();
        changed.$field = $other;
        check(!api::inspect(&changed)?);
    }};
}
fn main() -> Result<(), Error> {
    scalar!(echo_unit, AUnit, [()]);
    scalar!(echo_bool, ABool, [false, true]);
    scalar!(echo_uint8, AU8, [0, 1, u8::MAX]);
    scalar!(echo_uint16, AU16, [0, 1, u16::MAX]);
    scalar!(echo_uint32, AU32, [0, 1, u32::MAX]);
    scalar!(echo_uint64, AU64, [0, 1, 1<<32, (1<<53)+1, u64::MAX]);
    scalar!(echo_usize, AWord, [0, 1, 1<<32, (1<<53)+1, u64::MAX]);
    scalar!(echo_int8, AI8, [i8::MIN, -1, 0, i8::MAX]);
    scalar!(echo_int16, AI16, [i16::MIN, -1, 0, i16::MAX]);
    scalar!(echo_int32, AI32, [i32::MIN, -1, 0, i32::MAX]);
    scalar!(echo_int64, AI64, [i64::MIN, -1, 0, (1<<53)+1, i64::MAX]);
    scalar!(echo_isize, ASignedWord, [i64::MIN, -1, 0, (1<<53)+1, i64::MAX]);
    scalar!(echo_char, AChar, ['\0', '\u{7f}', '\u{d7ff}', '\u{e000}', '\u{ffff}', '\u{10000}', '🌱', '\u{10ffff}']);
    let float32: fn(api::AF32) -> Result<api::AF32, Error> = api::echo_float32;
    for value in [0., -0., 1.5, -2.25, 1./3., f32::from_bits(1), -f32::from_bits(1), f32::INFINITY, f32::NEG_INFINITY, f32::NAN] {
        let result = float32(value)?;
        check(result.to_bits() == value.to_bits() || result.is_nan() && value.is_nan());
    }
    let float64: fn(api::AF64) -> Result<api::AF64, Error> = api::echo_float64;
    for value in [0., -0., 1.5, -2.25, 1./3., f64::from_bits(1), -f64::from_bits(1), f64::INFINITY, f64::NEG_INFINITY, f64::NAN] {
        let result = float64(value)?;
        check(result.to_bits() == value.to_bits() || result.is_nan() && value.is_nan());
    }
    let natural: fn(&api::ANat) -> Result<api::ANat, Error> = api::echo_nat;
    let integer: fn(&api::AInt) -> Result<api::AInt, Error> = api::echo_int;
    for bit in [0, 7, 31, 32, 53, 64, 255, 1024, 5120] {
        let value: api::ANat = (BigUint::from(1u8) << bit) + BigUint::from(19u8);
        check(natural(&value)? == value);
        let signed: api::AInt = -BigInt::from(value);
        check(integer(&signed)? == signed);
        check(integer(&-signed.clone())? == -signed);
    }
    check(natural(&BigUint::from(0u8))? == BigUint::from(0u8));
    check(integer(&BigInt::from(0u8))? == BigInt::from(0u8));
    let text: fn(&str) -> Result<api::AText, Error> = api::echo_string;
    for value in ["", "A\0🌱", "\0", "\u{10ffff}", "e\u{301}"] {
        let result: api::AText = text(value)?; check(result == value);
    }
    let bytes: fn(&[u8]) -> Result<api::ABytes, Error> = api::echo_bytes;
    let input: api::ABytes = (0..=255).collect();
    for slice in [&input[..], &input[17..231], &input[0..0]] { check(bytes(slice)? == slice); }
    let make: fn() -> Result<api::Count, Error> = api::make;
    let increment: fn(api::Count) -> Result<api::OtherCount, Error> = api::increment;
    check(make()? == 41);
    check(api::label()? == "alias🌱");
    check(increment(u32::MAX)? == 0);
    for value in 0..512 { check(increment(value)? == value + 1); }

    let fields = api::ScalarsView {
        v_unit: (), v_bool: true, v_uint8: u8::MAX, v_uint16: u16::MAX,
        v_uint32: u32::MAX, v_uint64: u64::MAX, v_int8: i8::MIN,
        v_int16: i16::MIN, v_int32: i32::MIN, v_int64: i64::MIN,
        v_nat: (BigUint::from(1u8) << 5120usize) + BigUint::from(19u8),
        v_int: -((BigInt::from(1u8) << 5120usize) + BigInt::from(31u8)),
        v_float32: 1.5, v_float64: -2.25, v_string: "A\0🌱".into(),
        v_bytes: vec![0, 255, 1], v_char: '🌱', v_usize: u32::MAX as u64,
        v_isize: i32::MIN as i64,
    };
    check(api::inspect(&fields)?);
    let echo: fn(&api::ScalarsView) -> Result<api::ScalarsView, Error> = api::echo_scalars;
    let mut copied: api::ScalarsView = echo(&fields)?;
    check(copied == fields);
    changed!(fields, v_bool, false);
    changed!(fields, v_uint8, 0); changed!(fields, v_uint16, 0);
    changed!(fields, v_uint32, 0); changed!(fields, v_uint64, 0);
    changed!(fields, v_int8, 0); changed!(fields, v_int16, 0);
    changed!(fields, v_int32, 0); changed!(fields, v_int64, 0);
    changed!(fields, v_nat, BigUint::from(0u8)); changed!(fields, v_int, BigInt::from(0u8));
    changed!(fields, v_float32, 0.); changed!(fields, v_float64, 0.);
    changed!(fields, v_string, String::new()); changed!(fields, v_bytes, vec![]);
    changed!(fields, v_char, '\0'); changed!(fields, v_usize, 0); changed!(fields, v_isize, 0);
    check(copied.v_bytes.as_ptr() != fields.v_bytes.as_ptr());
    check(copied.v_string.as_ptr() != fields.v_string.as_ptr());
    copied.v_nat += BigUint::from(1u8); copied.v_int += BigInt::from(1u8);
    copied.v_bytes[0] = 17; copied.v_string.clear();
    check(api::inspect(&fields)?);

    let rows: fn(&[Vec<api::Count>]) -> Result<api::Rows, Error> = api::reverse_rows;
    let maybe: fn(&api::Maybe) -> Result<api::Maybe, Error> = api::echo_maybe;
    let outcome: fn(&api::Outcome) -> Result<api::Outcome, Error> = api::echo_outcome;
    let change: fn(&api::PacketView) -> Result<api::PacketView, Error> = api::change_packet;
    let packets: fn(&[api::PacketView]) -> Result<api::Packets, Error> = api::reverse_packets;
    check(rows(&[])?.is_empty()); check(packets(&[])?.is_empty());
    for present in [None, Some(None), Some(Some(()))] {
        let value: api::Maybe = present; check(maybe(&value)? == value);
        for branch in [Ok((7, vec![0, 255, 1])), Ok((0, vec![])), Err(String::new()), Err("no\0🌱".into())] {
            let value: api::Outcome = branch; check(outcome(&value)? == value);
            let packet = api::PacketView { count: 41, text: "packet\0🌱".into(),
                rows: vec![vec![1, 2, 3], vec![], vec![1, 1]], maybe: present, outcome: value };
            let mut changed: api::PacketView = change(&packet)?;
            check(changed.count == 42 && packet.count == 41);
            check(changed.rows == packet.rows && changed.maybe == present && changed.outcome == packet.outcome);
            changed.rows[0][0] = 99; changed.text.clear();
            check(packet.rows[0][0] == 1 && packet.text == "packet\0🌱");
            let input: api::Packets = vec![packet.clone(), changed.clone()];
            let mut result = packets(&input)?;
            check(result == vec![changed, packet.clone()]);
            result[1].rows[0][0] = 17;
            check(input[0].rows[0][0] == 1);
            let mut reversed: api::Rows = rows(&packet.rows[..2])?;
            check(reversed == vec![vec![3, 2, 1], vec![]]);
            reversed[0].clear(); check(packet.rows[0].len() == 3);
        }
    }
    for _ in 0..3 {
        check(matches!(bytes(&vec![0; 16 * 1024 * 1024 + 1]), Err(Error::Limit)));
        check(matches!(api::duplicate(&vec![0; 9 * 1024 * 1024]), Err(Error::Native { code: 1, .. })));
        check(matches!(api::produce(&BigUint::from(16u32 * 1024 * 1024 + 1)), Err(Error::Native { code: 1, .. })));
        check(api::duplicate(&[0, 255])? == Ok((7, vec![0, 255, 0, 255])));
        check(api::produce(&BigUint::from(3u8))? == vec![7, 7, 7]);
        check(make()? == 41);
    }
    std::thread::scope(|scope| {
        for lane in 0..4 {
            let fields = &fields;
            scope.spawn(move || { for index in 0..64 {
                let value: api::ANat = &fields.v_nat + BigUint::from((lane * 64 + index) as u32);
                check(api::echo_nat(&value).unwrap() == value);
                check(api::inspect(fields).unwrap());
            } });
        }
    });
    println!("alias-rust-ok:{}", CHECKS.load(Ordering::Relaxed));
    Ok(())
}
