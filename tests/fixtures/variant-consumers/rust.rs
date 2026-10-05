// Public installed-crate checks. No private ABI layouts, tags or unsafe code.
use variants_api as api;
use api::{Anonymous, BigInt, BigUint, Buffers, Error, Mode, Nested, One, Packet, Scalars, Signal};
use std::sync::atomic::{AtomicUsize, Ordering};
static CHECKS: AtomicUsize = AtomicUsize::new(0);
static CALLS: AtomicUsize = AtomicUsize::new(0);
#[track_caller]
fn check(value: bool) {
    let count = CHECKS.fetch_add(1, Ordering::Relaxed);
    assert!(value, "check {} failed", count + 1);
}
macro_rules! call { ($value:expr) => {{ CALLS.fetch_add(1, Ordering::Relaxed); $value }}; }
macro_rules! changed {
    ($value:expr, $field:ident, $other:expr) => {{
        let mut changed = $value.clone();
        if let Scalars::All { $field, .. } = &mut changed { *$field = $other; }
        check(!call!(api::inspect(&changed))?);
    }};
}
fn scalars() -> Scalars {
    Scalars::All { unit: (), bool_: true, u8: u8::MAX, u16: u16::MAX,
        u32: u32::MAX, u64: u64::MAX, i8: i8::MIN, i16: i16::MIN,
        i32: i32::MIN, i64: i64::MIN,
        natural: (BigUint::from(1u8) << 5120usize) + BigUint::from(19u8),
        integer: -((BigInt::from(1u8) << 5120usize) + BigInt::from(31u8)),
        f32: 1.5, f64: -2.25, text: "A\0🌱".into(), bytes: vec![0, 255, 1],
        char_: '🌱', word: u32::MAX as u64, signed_word: i32::MIN as i64 }
}
fn describe(value: &Signal) -> String {
    match value {
        Signal::Idle => "idle".into(), Signal::Stopped => "stopped".into(),
        Signal::Data { count, label } => format!("{count}:{label}"),
        Signal::Marker { value: () } => "marker".into(),
    }
}
fn main() -> Result<(), Error> {
    let echo: fn(&Signal) -> Result<Signal, Error> = api::echo;
    let nested: fn(&Nested) -> Result<Nested, Error> = api::echo_nested;
    let scalar = scalars();
    check(call!(api::inspect(&scalar))?);
    changed!(scalar, bool_, false); changed!(scalar, u8, 0); changed!(scalar, u16, 0);
    changed!(scalar, u32, 0); changed!(scalar, u64, 0); changed!(scalar, i8, 0);
    changed!(scalar, i16, 0); changed!(scalar, i32, 0); changed!(scalar, i64, 0);
    changed!(scalar, natural, BigUint::from(0u8)); changed!(scalar, integer, BigInt::from(0u8));
    changed!(scalar, f32, 0.); changed!(scalar, f64, 0.); changed!(scalar, text, String::new());
    changed!(scalar, bytes, vec![]); changed!(scalar, char_, 'A');
    changed!(scalar, word, 0); changed!(scalar, signed_word, 0);
    let cases = [Signal::Idle, Signal::Stopped, Signal::Data { count: 42, label: "A\0🌱".into() }, Signal::Marker { value: () }];
    for repeat in 0..128 {
        for value in &cases { check(call!(echo(value))? == *value); }
        check(call!(api::next(&cases[0]))? == Signal::Stopped);
        check(call!(api::next(&cases[1]))? == Signal::Marker { value: () });
        check(call!(api::next(&cases[2]))? == Signal::Data { count: 43, label: "A\0🌱!".into() });
        check(call!(api::next(&cases[3]))? == Signal::Data { count: 42, label: "ready".into() });
        for (value, code) in cases.iter().zip([7, 13, 48, 29]) { check(call!(api::code(value))? == code); }
        for value in [Mode::First, Mode::Second, Mode::Third] { check(call!(api::echo_mode(&value))? == value); }
        let mut packet = Packet { current: cases[2].clone(), events: cases.to_vec(), fallback: Some(cases[3].clone()), modes: vec![Mode::First, Mode::Third] };
        let copied = call!(nested(&Nested::Packet { value: packet.clone() }))?;
        check(copied == Nested::Packet { value: packet.clone() });
        packet.events[0] = Signal::Data { count: 99, label: "changed".into() };
        if let Nested::Packet { value } = copied {
            check(value.events[0] == Signal::Idle);
            check(value.events.as_ptr() != packet.events.as_ptr());
        } else { panic!("wrong constructor"); }
        for value in [Nested::Empty,
            Nested::Packet { value: Packet { current: Signal::Idle, events: vec![], fallback: None, modes: vec![] } },
            Nested::Outcome { value: Ok((Signal::Marker { value: () }, Mode::Second)) },
            Nested::Outcome { value: Err("A\0🌱".into()) }] { check(call!(nested(&value))? == value); }
        let input = vec![vec![], cases.to_vec(), vec![cases[2].clone(), cases[2].clone()]];
        let mut result = call!(api::signals(&input))?;
        check(result == vec![vec![], cases.iter().rev().cloned().collect(), input[2].clone()]);
        result[1][0] = Signal::Stopped; check(input[1][3] == Signal::Marker { value: () });
        check(call!(api::echo_scalars(&scalar))? == scalar);
        check(call!(api::echo_scalars(&Scalars::Absent))? == Scalars::Absent);
        for value in [Anonymous::Number { arg0: 13 }, Anonymous::Pair { arg0: 17, arg1: "A\0🌱".into() },
            Anonymous::Collision { arg1: 19, arg1_: "A\0🌱".into() }] { check(call!(api::echo_anonymous(&value))? == value); }
        check(call!(api::echo_one(&One::Only { value: repeat }))? == One::Only { value: repeat + 1 });
        for value in [Buffers::Empty, Buffers::Pair { first: vec![], second: vec![] },
            Buffers::Pair { first: vec![0, 255], second: b"abc".to_vec() }] { check(call!(api::echo_buffers(&value))? == value); }
        let mut result = call!(api::duplicate(&[0, 255, 1]))?;
        check(result == Buffers::Pair { first: vec![0, 255, 1], second: vec![0, 255, 1] });
        if let Buffers::Pair { first, second } = &mut result {
            check(first.as_ptr() != second.as_ptr()); first[0] = 42; check(second[0] == 0);
        } else { panic!("wrong constructor"); }
    }
    for value in [0., -0., f64::INFINITY, f64::NEG_INFINITY, f64::NAN, 1./3., f64::from_bits(1)] {
        let mut input = scalar.clone();
        if let Scalars::All { f32, f64, word, signed_word, .. } = &mut input {
            *f32 = value as f32; *f64 = value; *word = u64::MAX; *signed_word = i64::MIN;
        }
        match call!(api::echo_scalars(&input))? {
            Scalars::All { f32, f64, word, signed_word, .. } => {
                check(f32.to_bits() == (value as f32).to_bits() || f32.is_nan() && value.is_nan());
                check(f64.to_bits() == value.to_bits() || f64.is_nan() && value.is_nan());
                check(word == u64::MAX); check(signed_word == i64::MIN);
            }
            _ => panic!("wrong scalar constructor"),
        }
    }
    for character in ['\0', '\u{d7ff}', '\u{e000}', '\u{10ffff}'] {
        let mut input = scalar.clone(); if let Scalars::All { char_, .. } = &mut input { *char_ = character; }
        check(call!(api::echo_scalars(&input))? == input);
    }
    check(call!(api::echo_one(&One::Only { value: u32::MAX }))? == One::Only { value: 0 });
    check(call!(api::next(&Signal::Data { count: u32::MAX, label: String::new() }))? == Signal::Data { count: 0, label: "!".into() });
    for _ in 0..3 {
        check(matches!(call!(echo(&Signal::Data { count: 0, label: "x".repeat(17 * 1024 * 1024) })), Err(Error::Limit)));
        check(matches!(call!(api::duplicate(&vec![0; 9 * 1024 * 1024])), Err(Error::Native { code: 1, .. })));
        check(matches!(call!(api::produce(&BigUint::from(17u32 * 1024 * 1024))), Err(Error::Native { code: 1, .. })));
        check(call!(api::make(0))? == Signal::Idle);
        check(call!(api::make(7))? == Signal::Data { count: 7, label: "made".into() });
        check(call!(api::produce(&BigUint::from(30_000u32)))? == Buffers::Pair { first: vec![17; 30_000], second: vec![1] });
    }
    check(cases.iter().map(describe).collect::<Vec<_>>() == ["idle", "stopped", "42:A\0🌱", "marker"]);
    std::thread::scope(|scope| {
        for lane in 0..4 { scope.spawn(move || {
            for index in 0..64 {
                let count = lane * 64 + index;
                check(call!(api::next(&Signal::Data { count, label: "thread".into() })).unwrap()
                    == Signal::Data { count: count + 1, label: "thread!".into() });
            }
        }); }
    });
    println!("variant-rust-ok:{}:{}", CHECKS.load(Ordering::Relaxed), CALLS.load(Ordering::Relaxed));
    Ok(())
}
