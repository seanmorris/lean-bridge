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

/// Lean export: lean:NestedCheckedRecords.produceArray.
///
/// Checked Lean Fin bounds: result[*] projects proof-backed record payload fields; result[*].digit < 10; result[*].word projects the Subtype base value.
pub fn produce_array(arg0: &BigUint) -> Result<Vec<Packet>, Error> {
    __runtime::call0(arg0)
}

/// Lean export: lean:NestedCheckedRecords.produceOption.
///
/// Checked Lean Fin bounds: result? projects proof-backed record payload fields; result?.digit < 10; result?.word projects the Subtype base value.
pub fn produce_option(arg0: &BigUint) -> Result<Option<Packet>, Error> {
    __runtime::call1(arg0)
}
