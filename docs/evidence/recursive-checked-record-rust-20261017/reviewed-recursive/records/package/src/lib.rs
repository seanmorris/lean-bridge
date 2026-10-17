//! Typed copied-value functions from recursivecheckedrecords@1.0.0.
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

pub type Graphbf065e9a21862d87767f = Vec<Option<Box<Packet>>>;
pub type Graph2c3080f9e24fa7c11cff = Option<Box<Packet>>;
#[derive(Clone, Debug, PartialEq)]
pub struct Packet {
    pub value: BigUint,
    pub digit: BigUint,
    pub tail: Graph2c3080f9e24fa7c11cff,
}

pub type PacketAlias = Packet;

/// Lean export: lean:RecursiveCheckedRecords.echo.
pub fn echo(arg0: &Packet) -> Result<Packet, Error> {
    __runtime::call0(arg0)
}

/// Lean export: lean:RecursiveCheckedRecords.echoGroups.
pub fn echo_groups(arg0: &[Graph2c3080f9e24fa7c11cff]) -> Result<Graphbf065e9a21862d87767f, Error> {
    __runtime::call1(arg0)
}

/// Lean export: lean:RecursiveCheckedRecords.first.
pub fn first(arg0: &Packet) -> Result<BigUint, Error> {
    __runtime::call2(arg0)
}

/// Lean export: lean:RecursiveCheckedRecords.groups.
pub fn groups(arg0: &[Graph2c3080f9e24fa7c11cff]) -> Result<BigUint, Error> {
    __runtime::call3(arg0)
}

/// Lean export: lean:RecursiveCheckedRecords.produce.
pub fn produce(arg0: &BigUint) -> Result<Packet, Error> {
    __runtime::call4(arg0)
}

/// Lean export: lean:RecursiveCheckedRecords.second.
pub fn second(arg0: &Packet) -> Result<BigUint, Error> {
    __runtime::call5(arg0)
}
