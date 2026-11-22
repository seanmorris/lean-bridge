use crate::Fault;
use std::{fmt, marker::PhantomData, rc::Rc};

/// One independently disposable lease. The four const parameters together
/// are the complete hash of the compiler-checked nominal Lean type.
pub struct Resource<const A: u64, const B: u64, const C: u64, const D: u64> {
    lease: abi::Lease, ops: abi::Ops, pid: u32, _local: PhantomData<Rc<()>>,
}
impl<const A: u64, const B: u64, const C: u64, const D: u64> Resource<A,B,C,D> {
    fn check(&self) -> Result<(), Fault> {
        if self.pid != std::process::id() { Err(Fault::WrongContext) }
        else if self.lease.0[0] == 0 { Err(Fault::Closed) }
        else { Ok(()) }
    }
    /// Create a separate lease, not a copy of a disposable handle.
    pub fn try_clone(&self) -> Result<Self, Fault> {
        self.check()?;
        let mut out = abi::Lease::default();
        abi::status(unsafe { (self.ops.retain)(self.lease, &mut out) })?;
        Ok(unsafe { abi::attach(out, self.ops) })
    }
    /// Compare Lean object identity rather than values or lease numbers.
    pub fn same_object(&self, other: &Self) -> Result<bool, Fault> {
        self.check()?; other.check()?;
        let mut same = false;
        abi::status(unsafe { (self.ops.same)(self.lease, other.lease, &mut same) })?;
        Ok(same)
    }
    pub fn close(&mut self) -> Result<(), Fault> {
        if self.lease.0[0] == 0 { return Ok(()); }
        self.check()?;
        abi::status(unsafe { (self.ops.release)(&mut self.lease) })
    }
}
impl<const A: u64, const B: u64, const C: u64, const D: u64> Drop for Resource<A,B,C,D> {
    fn drop(&mut self) { let _ = self.close(); }
}
impl<const A: u64, const B: u64, const C: u64, const D: u64> fmt::Debug for Resource<A,B,C,D> {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result { f.write_str("Lean resource") }
}

// Not reexported by public component crates. No safe API exposes pointers or
// lets callers fabricate, adopt or release someone else's lease.
#[doc(hidden)]
pub mod abi {
    use super::*;
    #[repr(C)]
    #[derive(Clone, Copy, Default)]
    pub struct Lease(pub(super) [u64; 2]);
    #[derive(Copy, Clone)]
    pub struct Ops {
        pub retain: unsafe extern "C" fn(Lease, *mut Lease) -> i32,
        pub same: unsafe extern "C" fn(Lease, Lease, *mut bool) -> i32,
        pub release: unsafe extern "C" fn(*mut Lease) -> i32,
    }
    pub fn status(s: i32) -> Result<(), Fault> {
        match s {
            0 => Ok(()), 5 => Err(Fault::InvalidValue), 6 => Err(Fault::Closed),
            7 => Err(Fault::Busy), 9 => Err(Fault::WrongContext), 10 => Err(Fault::Unavailable),
            11 => Err(Fault::Allocation), 12 => Err(Fault::Limit), _ => Err(Fault::Protocol),
        }
    }
    /// # Safety
    /// The output must be a fresh lease from the verified nominal adapter. Its
    /// function pointers must remain valid throughout the process.
    pub unsafe fn attach<const A:u64,const B:u64,const C:u64,const D:u64>(lease: Lease, ops: Ops) -> Resource<A,B,C,D> {
        Resource {lease, ops, pid: std::process::id(), _local: PhantomData}
    }
    /// # Safety
    /// Only pass this lease as a borrow to the matching checked adapter. Never
    /// store it, release it, or adopt it as a new independent owner.
    pub unsafe fn borrow<const A:u64,const B:u64,const C:u64,const D:u64>(r: &Resource<A,B,C,D>) -> Result<Lease, Fault> {
        r.check()?; Ok(r.lease)
    }
}
