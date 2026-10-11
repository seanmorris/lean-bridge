//! Typed copied-value functions from structuralsubtypes@1.0.0.
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



/// Lean export: lean:StructuralSubtypes.aliasArguments.
///
/// Checked Lean Fin bounds: value0[*]? checked by StructuralSubtypes.checkedPositive; value1[*]? checked by StructuralSubtypes.normalizePositive; result[*]? checked by StructuralSubtypes.checkedPositive.
pub fn alias_arguments(value0: &[Option<BigUint>], value1: &[Option<BigUint>]) -> Result<Vec<Option<BigUint>>, Error> {
    __runtime::call0(value0, value1)
}

/// Lean export: lean:StructuralSubtypes.aliasPair.
///
/// Checked Lean Fin bounds: value0.0[*]? checked by StructuralSubtypes.checkedPositive; value0.1[*]? checked by StructuralSubtypes.normalizePositive; result.0[*]? checked by StructuralSubtypes.checkedPositive; result.1[*]? checked by StructuralSubtypes.normalizePositive.
pub fn alias_pair(value0: &(Vec<Option<BigUint>>, Vec<Option<BigUint>>)) -> Result<(Vec<Option<BigUint>>, Vec<Option<BigUint>>), Error> {
    __runtime::call1(value0)
}

/// Lean export: lean:StructuralSubtypes.arrays.
///
/// Checked Lean Fin bounds: value0[*] checked by StructuralSubtypes.checkedPositive; result[*] checked by StructuralSubtypes.checkedPositive.
pub fn arrays(value0: &[BigUint]) -> Result<Vec<BigUint>, Error> {
    __runtime::call2(value0)
}

/// Lean export: lean:StructuralSubtypes.branch.
///
/// Checked Lean Fin bounds: value0.ok checked by StructuralSubtypes.checkedPositive; value0.error checked by StructuralSubtypes.checkedWord; result.ok checked by StructuralSubtypes.checkedPositive; result.error checked by StructuralSubtypes.checkedWord.
pub fn branch(value0: &Result<BigUint, String>) -> Result<Result<BigUint, String>, Error> {
    __runtime::call3(value0)
}

/// Lean export: lean:StructuralSubtypes.byteBranches.
///
/// Checked Lean Fin bounds: value0[*]?.0 checked by StructuralSubtypes.checkedByte; value0[*]?.1 checked by StructuralSubtypes.checkedPositive; result[*]?.0 checked by StructuralSubtypes.checkedByte; result[*]?.1 checked by StructuralSubtypes.checkedPositive.
pub fn byte_branches(value0: &[Option<(u8, BigUint)>]) -> Result<Vec<Option<(u8, BigUint)>>, Error> {
    __runtime::call4(value0)
}

/// Lean export: lean:StructuralSubtypes.lists.
///
/// Checked Lean Fin bounds: value0[*] checked by StructuralSubtypes.checkedPositive; result[*] checked by StructuralSubtypes.checkedPositive.
pub fn lists(value0: &[BigUint]) -> Result<Vec<BigUint>, Error> {
    __runtime::call5(value0)
}

/// Lean export: lean:StructuralSubtypes.nested.
///
/// Checked Lean Fin bounds: value0[*][*]?.0 checked by StructuralSubtypes.checkedPositive; value0[*][*]?.1 < 184467440737095516170.
pub fn nested(value0: &[Vec<Option<(BigUint, BigUint)>>]) -> Result<BigUint, Error> {
    __runtime::call6(value0)
}

/// Lean export: lean:StructuralSubtypes.options.
///
/// Checked Lean Fin bounds: value0? checked by StructuralSubtypes.checkedPositive; result? checked by StructuralSubtypes.checkedPositive.
pub fn options(value0: &Option<BigUint>) -> Result<Option<BigUint>, Error> {
    __runtime::call7(value0)
}

/// Lean export: lean:StructuralSubtypes.plainFin.
///
/// Checked Lean Fin bounds: value0[*]? < 10.
pub fn plain_fin(value0: &[Option<BigUint>]) -> Result<BigUint, Error> {
    __runtime::call8(value0)
}

/// Lean export: lean:StructuralSubtypes.product.
///
/// Checked Lean Fin bounds: value0.0 checked by StructuralSubtypes.checkedPositive; value0.1 checked by StructuralSubtypes.checkedWord; result.0 checked by StructuralSubtypes.checkedPositive; result.1 checked by StructuralSubtypes.checkedWord.
pub fn product(value0: &(BigUint, String)) -> Result<(BigUint, String), Error> {
    __runtime::call9(value0)
}

/// Lean export: lean:StructuralSubtypes.scalar.
///
/// Checked Lean Fin bounds: value0 checked by StructuralSubtypes.checkedPositive; result checked by StructuralSubtypes.checkedPositive.
pub fn scalar(value0: &BigUint) -> Result<BigUint, Error> {
    __runtime::call10(value0)
}

/// Lean export: lean:StructuralSubtypes.specialized.
///
/// Checked Lean Fin bounds: value0[*] checked by StructuralSubtypes.checkedPositive; result[*] checked by StructuralSubtypes.checkedPositive.
pub fn specialized(value0: &[BigUint]) -> Result<Vec<BigUint>, Error> {
    __runtime::call11(value0)
}
