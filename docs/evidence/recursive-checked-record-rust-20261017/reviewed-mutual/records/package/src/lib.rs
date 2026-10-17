//! Typed copied-value functions from mutualcheckedrecords@1.0.0.
#[cfg(not(all(target_os = "linux", target_arch = "x86_64", target_env = "gnu")))]
compile_error!("This Lean crate requires Linux x86-64 with glibc");
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
            Self::Limit => formatter.write_str("Copied value depth, node or storage limit exceeded"),
            Self::Allocation => formatter.write_str("Conversion allocation failed"),
            Self::InvalidNative => formatter.write_str("Native result violates its copied-value contract"),
            Self::Load(message) => formatter.write_str(message),
            Self::Native { code, message } => write!(formatter, "Lean native error {code}: {message}"),
        }
    }
}
impl std::error::Error for Error {}

pub use num_bigint::{BigInt, BigUint};

pub type Graph6586a61fcab9df3e21b7 = Vec<Option<Envelope>>;
#[derive(Clone, Debug, PartialEq)]
pub struct Envelope {
    pub value: BigUint,
    pub mode: BigUint,
    pub next: Option<Box<Step>>,
}

pub type Graphc8c78faf2eecb4e21389 = Option<Envelope>;
pub type Graphd2fe45ba488df4ece96d = Option<Box<Step>>;
#[derive(Clone, Debug, PartialEq)]
pub enum Step {
    Stop,
    More { packet: Box<Envelope> },
}

pub type EnvelopeAlias = Envelope;

/// Lean export: lean:MutualCheckedRecords.echo.
pub fn echo(arg0: &Envelope) -> Result<Envelope, Error> {
    __runtime::call0(arg0)
}

/// Lean export: lean:MutualCheckedRecords.echoGroups.
pub fn echo_groups(arg0: &[Graphc8c78faf2eecb4e21389]) -> Result<Graph6586a61fcab9df3e21b7, Error> {
    __runtime::call1(arg0)
}

/// Lean export: lean:MutualCheckedRecords.first.
pub fn first(arg0: &Envelope) -> Result<BigUint, Error> {
    __runtime::call2(arg0)
}

/// Lean export: lean:MutualCheckedRecords.groups.
pub fn groups(arg0: &[Graphc8c78faf2eecb4e21389]) -> Result<BigUint, Error> {
    __runtime::call3(arg0)
}

/// Lean export: lean:MutualCheckedRecords.produce.
pub fn produce(arg0: &BigUint) -> Result<Envelope, Error> {
    __runtime::call4(arg0)
}

/// Lean export: lean:MutualCheckedRecords.second.
pub fn second(arg0: &Envelope) -> Result<BigUint, Error> {
    __runtime::call5(arg0)
}
