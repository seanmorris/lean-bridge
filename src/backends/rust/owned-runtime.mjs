/**
 * Rust ownership leases over the checked C session and result boundary.
 *
 * @file
 */
import { ownedRustTransferRuntime } from "./owned-transfers.mjs";
import { ownedRustAnchoredTransferRuntime } from "./owned-borrows.mjs";

/**
 * Emit nominal resources, scoped borrows and thread-confined result ownership.
 * This foundation does not admit resource-bearing Cargo packages by itself.
 *
 * @param prefix - Validated public C package identifier.
 * @param options - Prepared-package native loading policy.
 * @param options.dynamic - Resolve the authenticated embedded library table.
 * @param options.transferredInputs - Observe input consumption during callbacks.
 * @param options.anchoredResults - Validate whole-value result owners.
 */
export const ownedRustRuntime = (prefix, { dynamic = false, transferredInputs = false, anchoredResults = false } = {}) => {
	if(!/^[a-z][a-z0-9_]*$/u.test(prefix) || prefix.includes("__")) throw new TypeError("Invalid owned Rust prefix");
	return `
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum Error {
    InvalidArgument, Limit, Allocation, Closed, WrongThread, WrongProcess,
    Unavailable, CallOrder, MalformedResult, CallbackFailed, Native(u32), Load(String),
}
impl std::fmt::Display for Error {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self { Self::Load(message) => f.write_str(message), _ => write!(f, "Lean ownership boundary: {self:?}") }
    }
}
impl std::error::Error for Error {}

#[allow(dead_code)]
pub(crate) mod owned_runtime {
    use super::Error;
    use std::cell::{Cell, RefCell};
    use std::ffi::c_void;
    use std::rc::{Rc, Weak};
    use std::thread::ThreadId;

    ${dynamic ? ["session_open", "session_close", "result_release"].map(name => `unsafe fn ${name}(value: *mut *mut c_void) -> u32 {
        match crate::owned_values::owned_native_api() {
            Ok(api) => unsafe { (api.${name})(value) }, Err(_) => 7,
        }
    }`).join("\n    ") : `unsafe extern "C" {
        #[link_name = "${prefix}_session_open"] fn session_open(out: *mut *mut c_void) -> u32;
        #[link_name = "${prefix}_session_close"] fn session_close(value: *mut *mut c_void) -> u32;
        #[link_name = "${prefix}_result_release"] fn result_release(value: *mut *mut c_void) -> u32;
    }`}${anchoredResults ? dynamic ? `
    unsafe fn result_validate(session: *mut c_void, owner: *mut c_void) -> u32 {
        match crate::owned_values::owned_native_api() {
            Ok(api) => unsafe { (api.result_validate)(session, owner) }, Err(_) => 7,
        }
    }` : `
    unsafe extern "C" {
        #[link_name = "${prefix}_result_validate"] fn result_validate(session: *mut c_void, owner: *mut c_void) -> u32;
    }` : ""}
    pub(crate) fn checked(status: u32) -> Result<(), Error> {
        match status {
            0 => Ok(()), 1 => Err(Error::InvalidArgument), 2 => Err(Error::Limit),
            3 => Err(Error::Allocation), 4 => Err(Error::Closed),
            5 => Err(Error::WrongThread), 6 => Err(Error::WrongProcess),
            7 => Err(Error::Unavailable), 8 => Err(Error::CallOrder),
            9 => Err(Error::MalformedResult), 10 => Err(Error::CallbackFailed),
            other => Err(Error::Native(other)),
        }
    }

    pub(crate) struct NativeOwner {
        pub(crate) value: *mut c_void,
        process: u32,
        thread: ThreadId,
        confined: std::marker::PhantomData<Rc<()>>,
    }
    impl NativeOwner {
        pub(crate) fn new() -> Self {
            Self { value: std::ptr::null_mut(), process: std::process::id(),
                thread: std::thread::current().id(), confined: std::marker::PhantomData }
        }
    }
    impl Drop for NativeOwner {
        fn drop(&mut self) {
            if self.process == std::process::id() && self.thread == std::thread::current().id() && !self.value.is_null() {
                let _ = unsafe { result_release(&mut self.value) };
            }
        }
    }

    struct Slot { owner: Cell<*mut c_void>, state: Rc<State> }
    impl Drop for Slot {
        fn drop(&mut self) {
            if self.state.affinity().is_ok() {
                let mut owner = self.owner.replace(std::ptr::null_mut());
                if !owner.is_null() { let _ = unsafe { result_release(&mut owner) }; }
            }
        }
    }
    pub(crate) struct State {
        session: Cell<*mut c_void>, process: u32, thread: ThreadId,
        owners: RefCell<Vec<Weak<Slot>>>,
    }
    impl State {
        pub(crate) fn new() -> Result<Rc<Self>, Error> {
            ${dynamic ? "crate::owned_values::owned_native_api()?;" : ""}
            let state = Rc::new(Self { session: Cell::new(std::ptr::null_mut()),
                process: std::process::id(), thread: std::thread::current().id(),
                owners: RefCell::new(Vec::new()) });
            let mut session = std::ptr::null_mut();
            checked(unsafe { session_open(&mut session) })?;
            if session.is_null() { return Err(Error::MalformedResult); }
            state.session.set(session); Ok(state)
        }
        fn affinity(&self) -> Result<(), Error> {
            if self.process != std::process::id() { return Err(Error::WrongProcess); }
            if self.thread != std::thread::current().id() { return Err(Error::WrongThread); }
            Ok(())
        }
        pub(crate) fn require(&self) -> Result<*mut c_void, Error> {
            self.affinity()?;
            let session = self.session.get();
            if session.is_null() { Err(Error::Closed) } else { Ok(session) }
        }
        pub(crate) fn close(&self) -> Result<(), Error> {
            self.affinity()?;
            let mut session = self.session.get();
            if !session.is_null() {
                checked(unsafe { session_close(&mut session) })?;
                self.session.set(session);
            }
            // Result release can run native finalizers. Never hold a RefCell
            // borrow across that boundary or while a slot is being destroyed.
            let owners = std::mem::take(&mut *self.owners.borrow_mut());
            for weak in owners {
                if let Some(slot) = weak.upgrade() {
                    let mut owner = slot.owner.replace(std::ptr::null_mut());
                    if !owner.is_null() { let _ = unsafe { result_release(&mut owner) }; }
                }
            }
            Ok(())
        }
        pub(crate) fn adopt(self: &Rc<Self>, owner: &mut NativeOwner${anchoredResults ? ", borrowed_result: bool" : ""}) -> Result<Rc<Lease>, Error> {
            self.require()?;
            if owner.process != self.process { return Err(Error::WrongProcess); }
            if owner.thread != self.thread { return Err(Error::WrongThread); }
            if owner.value.is_null() { return Err(Error::InvalidArgument); }
            let mut owners = self.owners.borrow_mut();
            owners.retain(|weak| weak.strong_count() != 0);
            owners.try_reserve(1).map_err(|_| Error::Allocation)?;
            let slot = Rc::new(Slot { owner: Cell::new(std::ptr::null_mut()), state: Rc::clone(self) });
            let lease = Rc::new(Lease { state: Rc::clone(self), kind: LeaseKind::Owned(Rc::clone(&slot))${transferredInputs ? ", input_move: RefCell::new(None)" : ""}${anchoredResults ? ", borrowed_result" : ""} });
            owners.push(Rc::downgrade(&slot));
            slot.owner.set(std::mem::replace(&mut owner.value, std::ptr::null_mut()));
            Ok(lease)
        }
    }
    impl Drop for State { fn drop(&mut self) { let _ = self.close(); } }
    std::thread_local! { static CURRENT: RefCell<Weak<State>> = const { RefCell::new(Weak::new()) }; }
    pub(crate) fn current_state() -> Result<Rc<State>, Error> {
        CURRENT.with(|cached| {
            let existing = cached.borrow().upgrade();
            if let Some(state) = existing { state.require()?; return Ok(state); }
            let state = State::new()?;
            *cached.borrow_mut() = Rc::downgrade(&state); Ok(state)
        })
    }

    enum LeaseKind { Owned(Rc<Slot>), Borrowed(Rc<Cell<bool>>) }
    pub(crate) struct Lease { pub(crate) state: Rc<State>, kind: LeaseKind${transferredInputs ? ", input_move: RefCell<Option<Rc<InputMoveSignal>>>" : ""}${anchoredResults ? ", borrowed_result: bool" : ""} }
    impl Lease {
        pub(crate) fn require(&self) -> Result<(), Error> {
            self.state.require()?;${transferredInputs ? "\n            if self.input_move.borrow().as_ref().is_some_and(|signal| signal.consumed()) { return Err(Error::Closed); }" : ""}
            let active = match &self.kind {
                LeaseKind::Owned(slot) => ${anchoredResults ? `{
                    let owner = ${transferredInputs ? "self.input_move.borrow().as_ref().map_or(slot.owner.get(), |signal| signal.owner.get())" : "slot.owner.get()"};
                    if owner.is_null() { return Err(Error::Closed); }
                    checked(unsafe { result_validate(self.state.require()?, owner) })?; true
                }` : "!slot.owner.get().is_null()"},
                LeaseKind::Borrowed(active) => active.get(),
            };
            if active { Ok(()) } else { Err(Error::Closed) }
        }${anchoredResults ? `
        pub(crate) fn owner(&self, state: &Rc<State>) -> Result<*mut c_void, Error> {
            self.require()?;
            if !Rc::ptr_eq(&self.state, state) { return Err(Error::InvalidArgument); }
            match &self.kind {
                LeaseKind::Owned(slot) => Ok(${transferredInputs ? "self.input_move.borrow().as_ref().map_or(slot.owner.get(), |signal| signal.owner.get())" : "slot.owner.get()"}),
                LeaseKind::Borrowed(_) => Err(Error::InvalidArgument),
            }
        }` : ""}
    }
${transferredInputs ? anchoredResults ? ownedRustAnchoredTransferRuntime : ownedRustTransferRuntime : ""}    pub(crate) struct BorrowFrame { active: Rc<Cell<bool>>, pub(crate) lease: Rc<Lease> }
    impl BorrowFrame {
        pub(crate) fn new(state: &Rc<State>) -> Result<Self, Error> {
            state.require()?;
            let active = Rc::new(Cell::new(true));
            let lease = Rc::new(Lease { state: Rc::clone(state), kind: LeaseKind::Borrowed(Rc::clone(&active))${transferredInputs ? ", input_move: RefCell::new(None)" : ""}${anchoredResults ? ", borrowed_result: true" : ""} });
            Ok(Self { active, lease })
        }
    }
    impl Drop for BorrowFrame { fn drop(&mut self) { self.active.set(false); } }
}

pub struct Resource<Kind> {
    lease: Option<std::rc::Rc<owned_runtime::Lease>>,
    handle: *mut std::ffi::c_void,
    kind: std::marker::PhantomData<fn() -> Kind>,
}
impl<Kind> Resource<Kind> {
    pub(crate) fn from_owned(lease: std::rc::Rc<owned_runtime::Lease>, handle: *mut std::ffi::c_void) -> Result<Self, Error> {
        lease.require()?;
        if handle.is_null() { return Err(Error::InvalidArgument); }
        Ok(Self { lease: Some(lease), handle, kind: std::marker::PhantomData })
    }
    pub(crate) fn raw(&self, state: &std::rc::Rc<owned_runtime::State>) -> Result<*mut std::ffi::c_void, Error> {
        let lease = self.lease.as_ref().ok_or(Error::Closed)?;
        lease.require()?;
        if self.handle.is_null() { return Err(Error::Closed); }
        if !std::rc::Rc::ptr_eq(&lease.state, state) { return Err(Error::InvalidArgument); }
        Ok(self.handle)
    }
${transferredInputs && !anchoredResults ? `    pub(crate) fn transfer_lease(&self, state: &std::rc::Rc<owned_runtime::State>) -> Result<std::rc::Rc<owned_runtime::Lease>, Error> {
        self.raw(state)?;
        self.lease.as_ref().cloned().ok_or(Error::Closed)
    }
` : ""}    pub fn close(&mut self) { self.handle = std::ptr::null_mut(); self.lease = None; }
    pub fn is_closed(&self) -> bool {
        self.handle.is_null() || self.lease.as_ref().is_none_or(|lease| lease.require().is_err())
    }
}
impl<Kind> Default for Resource<Kind> {
    fn default() -> Self { Self { lease: None, handle: std::ptr::null_mut(), kind: std::marker::PhantomData } }
}
impl<Kind> Clone for Resource<Kind> {
    fn clone(&self) -> Self { Self { lease: self.lease.clone(), handle: self.handle, kind: std::marker::PhantomData } }
}
${anchoredResults ? "" : `impl<Kind> PartialEq for Resource<Kind> {
    fn eq(&self, other: &Self) -> bool {
        self.handle == other.handle && match (&self.lease, &other.lease) {
            (None, None) => true,
            (Some(a), Some(b)) => std::rc::Rc::ptr_eq(&a.state, &b.state),
            _ => false,
        }
    }
}
impl<Kind> Eq for Resource<Kind> {}`}
impl<Kind> std::fmt::Debug for Resource<Kind> {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("Resource").field("closed", &self.is_closed()).finish_non_exhaustive()
    }
}
`;
};
