//! Typed copied-value functions from zeropayloadcheckedrecords@1.0.0.
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
pub struct Witness {

}

#[derive(Clone, Debug, PartialEq)]
pub enum Mark {
    Blank,
    Marked { witness: Witness },
}

#[derive(Clone, Debug, PartialEq)]
pub struct Marker {

}

#[derive(Clone, Debug, PartialEq)]
pub struct Token {
    pub tag: (),
}

/// Lean export: lean:ZeroPayloadCheckedRecords.absentCount.
///
/// Checked Lean Fin bounds: value0 checked by ZeroPayloadCheckedRecords.mkAbsent.
pub fn absent_count(value0: &Witness) -> Result<BigUint, Error> {
    __runtime::call0(value0)
}

/// Lean export: lean:ZeroPayloadCheckedRecords.markCount.
///
/// Checked Lean Fin bounds: value0.marked.witness checked by ZeroPayloadCheckedRecords.mkWitness.
pub fn mark_count(value0: &Mark) -> Result<BigUint, Error> {
    __runtime::call1(value0)
}

/// Lean export: lean:ZeroPayloadCheckedRecords.markerCount.
pub fn marker_count(value0: &Marker) -> Result<BigUint, Error> {
    __runtime::call2(value0)
}

/// Lean export: lean:ZeroPayloadCheckedRecords.maybeWitness.
///
/// Checked Lean Fin bounds: result? projects proof-backed record payload fields.
pub fn maybe_witness(value0: bool) -> Result<Option<Witness>, Error> {
    __runtime::call3(value0)
}

/// Lean export: lean:ZeroPayloadCheckedRecords.produceMark.
///
/// Checked Lean Fin bounds: result.marked.witness projects proof-backed record payload fields.
pub fn produce_mark(value0: bool) -> Result<Mark, Error> {
    __runtime::call4(value0)
}

/// Lean export: lean:ZeroPayloadCheckedRecords.produceMarker.
pub fn produce_marker() -> Result<Marker, Error> {
    __runtime::call5()
}

/// Lean export: lean:ZeroPayloadCheckedRecords.produceToken.
///
/// Checked Lean Fin bounds: result projects proof-backed record payload fields.
pub fn produce_token() -> Result<Token, Error> {
    __runtime::call6()
}

/// Lean export: lean:ZeroPayloadCheckedRecords.produceWitness.
///
/// Checked Lean Fin bounds: result projects proof-backed record payload fields.
pub fn produce_witness() -> Result<Witness, Error> {
    __runtime::call7()
}

/// Lean export: lean:ZeroPayloadCheckedRecords.tokenTag.
///
/// Checked Lean Fin bounds: value0 checked by ZeroPayloadCheckedRecords.mkToken.
pub fn token_tag(value0: &Token) -> Result<(), Error> {
    __runtime::call8(value0)
}

/// Lean export: lean:ZeroPayloadCheckedRecords.witnessCount.
///
/// Checked Lean Fin bounds: value0 checked by ZeroPayloadCheckedRecords.mkWitness.
pub fn witness_count(value0: &Witness) -> Result<BigUint, Error> {
    __runtime::call9(value0)
}

/// Lean export: lean:ZeroPayloadCheckedRecords.witnesses.
///
/// Checked Lean Fin bounds: result[*] projects proof-backed record payload fields.
pub fn witnesses(value0: &BigUint) -> Result<Vec<Witness>, Error> {
    __runtime::call10(value0)
}
