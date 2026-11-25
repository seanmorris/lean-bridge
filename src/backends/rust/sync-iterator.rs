#[derive(Clone, Copy, Default)]
#[repr(C)]
struct Handle { id: u64, domain: u64 }

/// A fused, synchronous iterator over an application-owned Lean cursor.
/// Dropping it on early exit runs the finalizer. It cannot move to a worker thread.
pub struct Cursor<T, E = Infallible> {
    api: &'static Api,
    handle: Handle,
    pid: u32,
    pull: fn(&Api, &mut Handle) -> Result<Option<T>, CallError<E>>,
    release: unsafe extern "C" fn(*mut Handle) -> i32,
    local: std::marker::PhantomData<std::rc::Rc<()>>,
}
impl<T, E> Cursor<T, E> {
    fn new(api: &'static Api, handle: Handle,
        pull: fn(&Api, &mut Handle) -> Result<Option<T>, CallError<E>>,
        release: unsafe extern "C" fn(*mut Handle) -> i32) -> Self {
        Self {api, handle, pull, release, pid: std::process::id(), local: std::marker::PhantomData}
    }
    pub fn close(&mut self) -> Result<(), Fault> {
        if self.handle.id == 0 { return Ok(()); }
        if self.pid != std::process::id() { return Err(Fault::WrongContext); }
        abi::status(unsafe { (self.release)(&mut self.handle) })
    }
}
impl<T, E> Iterator for Cursor<T, E> {
    type Item = Result<T, CallError<E>>;
    fn next(&mut self) -> Option<Self::Item> {
        if self.handle.id == 0 { return None; }
        if self.pid != std::process::id() {
            self.handle.id = 0; // Only the parent owns the inherited Lean reference.
            return Some(Err(Fault::WrongContext.into()));
        }
        match (self.pull)(self.api, &mut self.handle) {
            Ok(value) => value.map(Ok),
            Err(e) => { let _ = self.close(); Some(Err(e)) }
        }
    }
}
impl<T, E> std::iter::FusedIterator for Cursor<T, E> {}
impl<T, E> Drop for Cursor<T, E> {
    fn drop(&mut self) { let _ = self.close(); }
}
