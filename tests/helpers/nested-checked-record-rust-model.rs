//! Source-only nested checked-record stand-in for testing the Rust caller, never an installed crate.
//! It implements the independently fixed constructor table of nested-checked-record-fixture.mjs.
pub use num_bigint::BigUint;

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum Error {
    Limit,
    Allocation,
    InvalidNative,
    Load(String),
    Native { code: i32, message: String },
}

#[derive(Clone, Debug, PartialEq)]
pub struct Packet { pub digit: BigUint, pub word: BigUint }
#[derive(Clone, Debug, PartialEq)]
pub struct Holder { pub packet: Packet, pub tag: BigUint }
#[derive(Clone, Debug, PartialEq)]
pub enum Choice { Empty, Packet { value: Packet } }

fn fault(label: &str) -> bool { std::env::var("NESTED_RUST_FAULT").map_or(false, |value| value == label) }
fn prefix() -> String { std::env::var("NESTED_RUST_PREFIX").unwrap_or_else(|_| "arg".into()) }
fn path(tail: &str) -> String { prefix() + tail }
fn n(value: u64) -> BigUint { BigUint::from(value) }

#[derive(Clone, Copy, PartialEq)]
enum Choose { Mk, Normalize }
use Choose::{Mk, Normalize};

fn reject(message: String) -> Error {
    if fault("wrong-error-kind") { return Error::InvalidNative; }
    let suffix = if fault("diagnostic-suffix") { "." } else { "" };
    Error::Native { code: if fault("wrong-status") { 2 } else { 1 }, message: message + suffix }
}

/// Check one packet: Fin 10 digit, then the word constructor, then the packet constructor.
fn accept(value: &Packet, at: &str, site: (Choose, Choose)) -> Result<BigUint, Error> {
    let (packet_choice, mut word_choice) = site;
    let digit_ok = value.digit < n(10);
    if !fault("missing-fin") && !fault("fin-after-constructor") && !digit_ok {
        return Err(reject(format!("{at}.digit is not below its Fin 10 bound")));
    }
    if fault("missing-normalization") { word_choice = Mk; }
    let mut word = value.word.clone();
    if word_choice == Mk && word == n(0) {
        return Err(reject(format!("{at}.word was rejected by NestedCheckedRecords.mkWord")));
    }
    if word_choice == Normalize { word += n(1); }
    if fault("fin-after-constructor") && !digit_ok {
        return Err(reject(format!("{at}.digit is not below its Fin 10 bound")));
    }
    let packet_choice = if fault("conflated-constructor") { Mk } else { packet_choice };
    if packet_choice == Mk && value.digit > word {
        return Err(reject(format!("{at} was rejected by NestedCheckedRecords.mkPacket")));
    }
    Ok(if packet_choice == Normalize { &value.digit + n(1) } else { word })
}

fn total(values: &[Packet], site: (Choose, Choose)) -> Result<BigUint, Error> {
    let mut sum = n(0);
    for (index, value) in values.iter().enumerate() {
        let at = if fault("wrong-path") { path(&format!("0.{index}")) } else { path(&format!("0[{index}]")) };
        sum += accept(value, &at, site)?;
    }
    Ok(sum)
}

fn produced(value: &BigUint, offset: u64) -> Packet {
    Packet { digit: n(0), word: value + n(offset + if fault("produce-offset") { 1 } else { 0 }) }
}

pub fn first(value0: &Packet) -> Result<BigUint, Error> { accept(value0, &path("0"), (Mk, Mk)) }
pub fn second(value0: &Packet) -> Result<BigUint, Error> { accept(value0, &path("0"), (Normalize, Normalize)) }
pub fn pair(value0: &Packet, value1: &Packet) -> Result<BigUint, Error> {
    Ok(accept(value0, &path("0"), (Mk, Mk))? + accept(value1, &path("1"), (Normalize, Normalize))?)
}
pub fn in_array(value0: &[Packet]) -> Result<BigUint, Error> { total(value0, (Mk, Mk)) }
pub fn in_list(value0: &[Packet]) -> Result<BigUint, Error> {
    total(value0, if fault("list-as-array") { (Mk, Mk) } else { (Normalize, Normalize) })
}
pub fn in_option(value0: &Option<Packet>) -> Result<BigUint, Error> {
    match value0 { None => Ok(n(0)), Some(value) => accept(value, &path("0?"), (Mk, Normalize)) }
}
pub fn in_product(value0: &(Packet, Packet)) -> Result<BigUint, Error> {
    Ok(accept(&value0.0, &path("0.0"), (Mk, Mk))? + accept(&value0.1, &path("0.1"), (Normalize, Normalize))?)
}
pub fn in_except(value0: &Result<Packet, Packet>) -> Result<BigUint, Error> {
    let (value, ok) = match value0 { Ok(value) => (value, true), Err(value) => (value, false) };
    let ok = ok != fault("except-swapped");
    if ok { accept(value, &path("0.ok"), (Normalize, Mk)) } else { accept(value, &path("0.error"), (Mk, Normalize)) }
}
pub fn in_holder(value0: &Holder) -> Result<BigUint, Error> {
    let word = accept(&value0.packet, &path("0.packet"), (Normalize, Mk))?;
    Ok(if fault("holder-tag") { word } else { word + &value0.tag })
}
pub fn in_choice(value0: &Choice) -> Result<BigUint, Error> {
    match value0 {
        Choice::Empty => Ok(n(if fault("wrong-choice") { 1 } else { 0 })),
        Choice::Packet { value } => accept(value, &path("0.packet.value"), (Mk, Normalize)),
    }
}
pub fn echo_array(value0: &[Packet]) -> Result<Vec<Packet>, Error> {
    total(value0, (Mk, Mk))?;
    let mut items: Vec<Packet> = value0.iter().map(|item| if fault("echo-swapped-fields") {
        Packet { digit: item.word.clone(), word: item.digit.clone() } } else { item.clone() }).collect();
    if fault("echo-normalizes") && !items.is_empty() { items[0].word = n(1); }
    Ok(items)
}
pub fn produce_option(value0: &BigUint) -> Result<Option<Packet>, Error> {
    if fault("produce-absent") { return Ok(None); }
    Ok(Some(produced(value0, 1)))
}
pub fn produce_array(value0: &BigUint) -> Result<Vec<Packet>, Error> {
    let mut items = vec![produced(value0, 1), produced(value0, 2)];
    if fault("produce-array-length") { items.pop(); }
    if fault("produce-refused") { return Err(Error::Limit); }
    Ok(items)
}
