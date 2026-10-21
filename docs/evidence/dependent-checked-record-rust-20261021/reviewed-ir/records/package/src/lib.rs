//! Typed copied-value functions from dependentrecords@1.0.0.
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
pub struct Dependent {
    pub bound: BigUint,
    pub below: BigUint,
}

/// Lean export: lean:DependentRecords.dependentResult.
///
/// Checked Lean Fin bounds: result projects proof-backed record payload fields; result.below < result.bound.
pub fn dependent_result(value0: &BigUint) -> Result<Dependent, Error> {
    __runtime::call0(value0)
}

/// Lean export: lean:DependentRecords.dependentRoundtrip.
///
/// Checked Lean Fin bounds: value0 checked by DependentRecords.mkDependent; value0.below < value0.bound; result projects proof-backed record payload fields; result.below < result.bound.
pub fn dependent_roundtrip(value0: &Dependent) -> Result<Dependent, Error> {
    __runtime::call1(value0)
}

/// Lean export: lean:DependentRecords.dependentTotal.
///
/// Checked Lean Fin bounds: value0 checked by DependentRecords.mkDependent; value0.below < value0.bound.
pub fn dependent_total(value0: &Dependent) -> Result<BigUint, Error> {
    __runtime::call2(value0)
}
