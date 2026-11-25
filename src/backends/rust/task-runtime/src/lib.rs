//! Shared owner-thread boundary and resource types for compiled Lean.
use std::{convert::Infallible, fmt};
mod resource;
#[doc(hidden)]
#[cfg(feature = "host-objects")]
pub mod owner;
#[doc(hidden)]
#[cfg(feature = "host-objects")]
pub mod port;
pub use resource::Resource;
#[doc(hidden)]
pub use resource::abi;
#[cfg(feature = "async")]
mod callback;
#[cfg(feature = "async")]
pub use callback::{CallbackError,RetainedCallback};
#[cfg(feature = "async")]
mod delivery;
#[cfg(feature = "async")]
pub use delivery::*;

/// A boundary or runtime failure, distinct from an application's typed errors.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Fault {
    Io { declaration: &'static str, message: String },
    TaskIo { declaration: &'static str, message: String },
    CallbackPanic { declaration: &'static str },
    Load(String), Readiness(String), InvalidValue, Closed, Cancelled, Busy,
    WrongContext, Unavailable, Allocation, Limit, Protocol,
}
impl fmt::Display for Fault {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Io { declaration, message } | Self::TaskIo { declaration, message } => write!(f, "{declaration}: {message}"),
            Self::CallbackPanic { declaration } => write!(f, "{declaration}: Rust callback panicked; Lean runtime retired"),
            Self::Load(s) | Self::Readiness(s) => f.write_str(s),
            x => write!(f, "{x:?}"),
        }
    }
}
impl std::error::Error for Fault {}

/// Immediate failure of a synchronous export. A returned Lean Except, including
/// an error arm, is ordinary data in the outer Ok, never a Declared failure.
#[derive(Debug, PartialEq, Eq)]
pub enum CallError<E = Infallible> {
    Declared { declaration: &'static str, payload: E },
    Io { declaration: &'static str, message: String },
    Boundary(Fault),
}
impl<E> From<Fault> for CallError<E> {
    fn from(f: Fault) -> Self { match f {
        Fault::Io { declaration, message } => Self::Io { declaration, message },
        boundary => Self::Boundary(boundary),
    } }
}
impl<E: fmt::Debug> fmt::Display for CallError<E> {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result { match self {
        Self::Declared{declaration,payload} => write!(f, "{declaration}: {payload:?}"),
        Self::Io{declaration,message} => write!(f, "{declaration}: {message}"),
        Self::Boundary(e) => e.fmt(f),
    } }
}
impl<E: fmt::Debug> std::error::Error for CallError<E> {
    fn source(&self) -> Option<&(dyn std::error::Error + 'static)> {
        match self { Self::Boundary(e) => Some(e), _ => None }
    }
}
