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

/// Lean export: lean:CheckedRecordValueIndices.abStringIndex.
///
/// Checked Lean Fin bounds: arg0 checked by CheckedRecordValueIndices.mkAb.
pub fn ab_string_index(arg0: &Ab) -> Result<BigUint, Error> {
    __runtime::call0(arg0)
}

/// Lean export: lean:CheckedRecordValueIndices.emptySizedIndex.
///
/// Checked Lean Fin bounds: arg0 checked by CheckedRecordValueIndices.mkEmptySized.
pub fn empty_sized_index(arg0: &EmptySized) -> Result<BigUint, Error> {
    __runtime::call1(arg0)
}

/// Lean export: lean:CheckedRecordValueIndices.emptyStringIndex.
///
/// Checked Lean Fin bounds: arg0 checked by CheckedRecordValueIndices.mkEmptyToken.
pub fn empty_string_index(arg0: &EmptyToken) -> Result<BigUint, Error> {
    __runtime::call2(arg0)
}

/// Lean export: lean:CheckedRecordValueIndices.falseBoolIndex.
///
/// Checked Lean Fin bounds: arg0 checked by CheckedRecordValueIndices.mkOff.
pub fn false_bool_index(arg0: &Off) -> Result<BigUint, Error> {
    __runtime::call3(arg0)
}

/// Lean export: lean:CheckedRecordValueIndices.produceAb.
///
/// Checked Lean Fin bounds: result projects proof-backed record payload fields.
pub fn produce_ab() -> Result<Ab, Error> {
    __runtime::call4()
}

/// Lean export: lean:CheckedRecordValueIndices.produceEmptySized.
///
/// Checked Lean Fin bounds: result projects proof-backed record payload fields.
pub fn produce_empty_sized() -> Result<EmptySized, Error> {
    __runtime::call5()
}

/// Lean export: lean:CheckedRecordValueIndices.produceEmptyString.
///
/// Checked Lean Fin bounds: result projects proof-backed record payload fields.
pub fn produce_empty_string(arg0: &BigUint) -> Result<EmptyToken, Error> {
    __runtime::call6(arg0)
}

/// Lean export: lean:CheckedRecordValueIndices.produceFalseBool.
///
/// Checked Lean Fin bounds: result projects proof-backed record payload fields.
pub fn produce_false_bool() -> Result<Off, Error> {
    __runtime::call7()
}

/// Lean export: lean:CheckedRecordValueIndices.produceTrueBool.
///
/// Checked Lean Fin bounds: result projects proof-backed record payload fields.
pub fn produce_true_bool() -> Result<On, Error> {
    __runtime::call8()
}

/// Lean export: lean:CheckedRecordValueIndices.produceUnicodeString.
///
/// Checked Lean Fin bounds: result projects proof-backed record payload fields.
pub fn produce_unicode_string(arg0: &BigUint) -> Result<UnicodeToken, Error> {
    __runtime::call9(arg0)
}

/// Lean export: lean:CheckedRecordValueIndices.produceWideNat.
///
/// Checked Lean Fin bounds: result projects proof-backed record payload fields.
pub fn produce_wide_nat(arg0: &BigUint) -> Result<WideToken, Error> {
    __runtime::call10(arg0)
}

/// Lean export: lean:CheckedRecordValueIndices.produceZeroNat.
///
/// Checked Lean Fin bounds: result projects proof-backed record payload fields.
pub fn produce_zero_nat(arg0: &BigUint) -> Result<ZeroToken, Error> {
    __runtime::call11(arg0)
}

/// Lean export: lean:CheckedRecordValueIndices.trueBoolIndex.
///
/// Checked Lean Fin bounds: arg0 checked by CheckedRecordValueIndices.mkOn.
pub fn true_bool_index(arg0: &On) -> Result<BigUint, Error> {
    __runtime::call12(arg0)
}

/// Lean export: lean:CheckedRecordValueIndices.unicodeStringIndex.
///
/// Checked Lean Fin bounds: arg0 checked by CheckedRecordValueIndices.mkUnicodeToken.
pub fn unicode_string_index(arg0: &UnicodeToken) -> Result<BigUint, Error> {
    __runtime::call13(arg0)
}

/// Lean export: lean:CheckedRecordValueIndices.wideNatIndex.
///
/// Checked Lean Fin bounds: arg0 checked by CheckedRecordValueIndices.mkWideToken.
pub fn wide_nat_index(arg0: &WideToken) -> Result<BigUint, Error> {
    __runtime::call14(arg0)
}

/// Lean export: lean:CheckedRecordValueIndices.zeroNatIndex.
///
/// Checked Lean Fin bounds: arg0 checked by CheckedRecordValueIndices.mkZeroToken.
pub fn zero_nat_index(arg0: &ZeroToken) -> Result<BigUint, Error> {
    __runtime::call15(arg0)
}
