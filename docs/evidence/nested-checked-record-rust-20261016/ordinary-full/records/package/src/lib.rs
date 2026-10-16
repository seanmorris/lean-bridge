//! Typed copied-value functions from nestedcheckedrecords@1.0.0.
#[cfg(not(all(target_os = "linux", target_arch = "x86_64", target_env = "gnu")))]
compile_error!("This Lean crate requires Linux x86-64 with glibc");
pub use num_bigint::{BigInt, BigUint};
mod __runtime;

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum Error {
    Limit,
    Allocation,
    InvalidNative,

    Load(String),
    Native { code: i32, message: String },
}
impl std::fmt::Display for Error {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Limit => formatter.write_str("16 MiB conversion limit exceeded"),
            Self::Allocation => formatter.write_str("Conversion allocation failed"),
            Self::InvalidNative => formatter.write_str("Native result violates its copied-value contract"),

            Self::Load(message) => formatter.write_str(message),
            Self::Native { code, message } => write!(formatter, "Lean native error {code}: {message}"),
        }
    }
}
impl std::error::Error for Error {}


#[derive(Clone, Debug, PartialEq)]
pub struct Packet {
    pub digit: BigUint,
    pub word: BigUint,
}

#[derive(Clone, Debug, PartialEq)]
pub enum Choice {
    Empty,
    Packet { value: Packet },
}

#[derive(Clone, Debug, PartialEq)]
pub struct Holder {
    pub packet: Packet,
    pub tag: BigUint,
}

/// Lean export: lean:NestedCheckedRecords.echoArray.
///
/// Checked Lean Fin bounds: arg0[*] checked by NestedCheckedRecords.mkPacket; arg0[*].digit < 10; arg0[*].word checked by NestedCheckedRecords.mkWord; result[*] projects proof-backed record payload fields; result[*].digit < 10; result[*].word projects the Subtype base value.
pub fn echo_array(arg0: &[Packet]) -> Result<Vec<Packet>, Error> {
    __runtime::call0(arg0)
}

/// Lean export: lean:NestedCheckedRecords.first.
///
/// Checked Lean Fin bounds: arg0 checked by NestedCheckedRecords.mkPacket; arg0.digit < 10; arg0.word checked by NestedCheckedRecords.mkWord.
pub fn first(arg0: &Packet) -> Result<BigUint, Error> {
    __runtime::call1(arg0)
}

/// Lean export: lean:NestedCheckedRecords.inArray.
///
/// Checked Lean Fin bounds: arg0[*] checked by NestedCheckedRecords.mkPacket; arg0[*].digit < 10; arg0[*].word checked by NestedCheckedRecords.mkWord.
pub fn in_array(arg0: &[Packet]) -> Result<BigUint, Error> {
    __runtime::call2(arg0)
}

/// Lean export: lean:NestedCheckedRecords.inChoice.
///
/// Checked Lean Fin bounds: arg0.packet.value checked by NestedCheckedRecords.mkPacket; arg0.packet.value.digit < 10; arg0.packet.value.word checked by NestedCheckedRecords.normalizeWord.
pub fn in_choice(arg0: &Choice) -> Result<BigUint, Error> {
    __runtime::call3(arg0)
}

/// Lean export: lean:NestedCheckedRecords.inExcept.
///
/// Checked Lean Fin bounds: arg0.ok checked by NestedCheckedRecords.normalizePacket; arg0.ok.digit < 10; arg0.ok.word checked by NestedCheckedRecords.mkWord; arg0.error checked by NestedCheckedRecords.mkPacket; arg0.error.digit < 10; arg0.error.word checked by NestedCheckedRecords.normalizeWord.
pub fn in_except(arg0: &Result<Packet, Packet>) -> Result<BigUint, Error> {
    __runtime::call4(arg0)
}

/// Lean export: lean:NestedCheckedRecords.inHolder.
///
/// Checked Lean Fin bounds: arg0.packet checked by NestedCheckedRecords.normalizePacket; arg0.packet.digit < 10; arg0.packet.word checked by NestedCheckedRecords.mkWord.
pub fn in_holder(arg0: &Holder) -> Result<BigUint, Error> {
    __runtime::call5(arg0)
}

/// Lean export: lean:NestedCheckedRecords.inList.
///
/// Checked Lean Fin bounds: arg0[*] checked by NestedCheckedRecords.normalizePacket; arg0[*].digit < 10; arg0[*].word checked by NestedCheckedRecords.normalizeWord.
pub fn in_list(arg0: &[Packet]) -> Result<BigUint, Error> {
    __runtime::call6(arg0)
}

/// Lean export: lean:NestedCheckedRecords.inOption.
///
/// Checked Lean Fin bounds: arg0? checked by NestedCheckedRecords.mkPacket; arg0?.digit < 10; arg0?.word checked by NestedCheckedRecords.normalizeWord.
pub fn in_option(arg0: &Option<Packet>) -> Result<BigUint, Error> {
    __runtime::call7(arg0)
}

/// Lean export: lean:NestedCheckedRecords.inProduct.
///
/// Checked Lean Fin bounds: arg0.0 checked by NestedCheckedRecords.mkPacket; arg0.0.digit < 10; arg0.0.word checked by NestedCheckedRecords.mkWord; arg0.1 checked by NestedCheckedRecords.normalizePacket; arg0.1.digit < 10; arg0.1.word checked by NestedCheckedRecords.normalizeWord.
pub fn in_product(arg0: &(Packet, Packet)) -> Result<BigUint, Error> {
    __runtime::call8(arg0)
}

/// Lean export: lean:NestedCheckedRecords.pair.
///
/// Checked Lean Fin bounds: arg0 checked by NestedCheckedRecords.mkPacket; arg0.digit < 10; arg0.word checked by NestedCheckedRecords.mkWord; arg1 checked by NestedCheckedRecords.normalizePacket; arg1.digit < 10; arg1.word checked by NestedCheckedRecords.normalizeWord.
pub fn pair(arg0: &Packet, arg1: &Packet) -> Result<BigUint, Error> {
    __runtime::call9(arg0, arg1)
}

/// Lean export: lean:NestedCheckedRecords.produceArray.
///
/// Checked Lean Fin bounds: result[*] projects proof-backed record payload fields; result[*].digit < 10; result[*].word projects the Subtype base value.
pub fn produce_array(arg0: &BigUint) -> Result<Vec<Packet>, Error> {
    __runtime::call10(arg0)
}

/// Lean export: lean:NestedCheckedRecords.produceOption.
///
/// Checked Lean Fin bounds: result? projects proof-backed record payload fields; result?.digit < 10; result?.word projects the Subtype base value.
pub fn produce_option(arg0: &BigUint) -> Result<Option<Packet>, Error> {
    __runtime::call11(arg0)
}

/// Lean export: lean:NestedCheckedRecords.second.
///
/// Checked Lean Fin bounds: arg0 checked by NestedCheckedRecords.normalizePacket; arg0.digit < 10; arg0.word checked by NestedCheckedRecords.normalizeWord.
pub fn second(arg0: &Packet) -> Result<BigUint, Error> {
    __runtime::call12(arg0)
}
