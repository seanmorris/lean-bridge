//! Typed copied-value functions from checkedrecordvalueindices@1.0.0.
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
pub struct Ab {
    pub size: BigUint,
}

#[derive(Clone, Debug, PartialEq)]
pub struct EmptySized {
    pub data: Vec<BigUint>,
}

#[derive(Clone, Debug, PartialEq)]
pub struct EmptyToken {
    pub count: BigUint,
}

#[derive(Clone, Debug, PartialEq)]
pub struct Off {
    pub count: BigUint,
}

#[derive(Clone, Debug, PartialEq)]
pub struct On {
    pub count: BigUint,
}

#[derive(Clone, Debug, PartialEq)]
pub struct UnicodeToken {
    pub count: BigUint,
}

#[derive(Clone, Debug, PartialEq)]
pub struct WideToken {
    pub count: BigUint,
}

#[derive(Clone, Debug, PartialEq)]
pub struct ZeroToken {
    pub count: BigUint,
}

/// Lean export: lean:CheckedRecordValueIndices.produceAb.
///
/// Checked Lean Fin bounds: result projects proof-backed record payload fields.
pub fn produce_ab() -> Result<Ab, Error> {
    __runtime::call0()
}

/// Lean export: lean:CheckedRecordValueIndices.produceEmptySized.
///
/// Checked Lean Fin bounds: result projects proof-backed record payload fields.
pub fn produce_empty_sized() -> Result<EmptySized, Error> {
    __runtime::call1()
}

/// Lean export: lean:CheckedRecordValueIndices.produceEmptyString.
///
/// Checked Lean Fin bounds: result projects proof-backed record payload fields.
pub fn produce_empty_string(arg0: &BigUint) -> Result<EmptyToken, Error> {
    __runtime::call2(arg0)
}

/// Lean export: lean:CheckedRecordValueIndices.produceFalseBool.
///
/// Checked Lean Fin bounds: result projects proof-backed record payload fields.
pub fn produce_false_bool() -> Result<Off, Error> {
    __runtime::call3()
}

/// Lean export: lean:CheckedRecordValueIndices.produceTrueBool.
///
/// Checked Lean Fin bounds: result projects proof-backed record payload fields.
pub fn produce_true_bool() -> Result<On, Error> {
    __runtime::call4()
}

/// Lean export: lean:CheckedRecordValueIndices.produceUnicodeString.
///
/// Checked Lean Fin bounds: result projects proof-backed record payload fields.
pub fn produce_unicode_string(arg0: &BigUint) -> Result<UnicodeToken, Error> {
    __runtime::call5(arg0)
}

/// Lean export: lean:CheckedRecordValueIndices.produceWideNat.
///
/// Checked Lean Fin bounds: result projects proof-backed record payload fields.
pub fn produce_wide_nat(arg0: &BigUint) -> Result<WideToken, Error> {
    __runtime::call6(arg0)
}

/// Lean export: lean:CheckedRecordValueIndices.produceZeroNat.
///
/// Checked Lean Fin bounds: result projects proof-backed record payload fields.
pub fn produce_zero_nat(arg0: &BigUint) -> Result<ZeroToken, Error> {
    __runtime::call7(arg0)
}
