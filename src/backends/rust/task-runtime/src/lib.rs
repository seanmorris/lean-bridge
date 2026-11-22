//! Owner-thread delivery of compiled Lean tasks. Only readiness notifications
//! cross threads. The executor never has to poll on a timer or run Lean FFI.
use async_io::Async;
use futures_core::stream::FusedStream;
pub use futures_core::Stream;
use std::{
    convert::Infallible, fmt, future::{poll_fn, Future}, marker::PhantomData,
    os::fd::{BorrowedFd, OwnedFd}, pin::Pin, rc::Rc, sync::{Arc, Mutex}, task::{Context, Poll, Wake, Waker},
};
mod resource;
pub use resource::Resource;
#[doc(hidden)]
pub use resource::abi;

/// A boundary or runtime failure, distinct from an application's typed errors.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Fault {
    Io { declaration: &'static str, message: String },
    Load(String), Readiness(String), InvalidValue, Closed, Cancelled, Busy,
    WrongContext, Unavailable, Allocation, Limit, Protocol,
}
impl fmt::Display for Fault {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Io { declaration, message } => write!(f, "{declaration}: {message}"),
            Self::Load(s) | Self::Readiness(s) => f.write_str(s),
            x => write!(f, "{x:?}"),
        }
    }
}
impl std::error::Error for Fault {}

/// Synchronous factory rejection, terminal stream failure, and transport
/// failure are three different outcomes. A Lean `Except` *value* is a normal
/// nested Rust `Result`, not one of these errors.
#[derive(Debug, PartialEq, Eq)]
pub enum Error<E = Infallible> { Start(E), Step(E), Boundary(Fault) }
impl<E> From<Fault> for Error<E> {
    fn from(f: Fault) -> Self { Self::Boundary(f) }
}
impl<E: fmt::Debug> fmt::Display for Error<E> {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Start(e) => write!(f, "Lean factory rejected: {e:?}"),
            Self::Step(e) => write!(f, "Lean stream failed: {e:?}"),
            Self::Boundary(e) => e.fmt(f),
        }
    }
}
impl<E: fmt::Debug> std::error::Error for Error<E> {}

/// Implementation interface for generated bindings. Component handles, ABI
/// pointers and symbol lookup remain private to the component.
#[doc(hidden)]
pub trait Source<T, E> {
    fn request(&mut self) -> Result<(), Fault>;
    /// None means ready; a borrowed descriptor signals readiness without reads.
    fn readiness(&mut self) -> Result<Option<BorrowedFd<'_>>, Fault>;
    fn take(&mut self) -> Result<Option<T>, Error<E>>;
    fn close(&mut self) -> Result<(), Fault>;
}

// async-io may notify a previous task on waker replacement. Register one
// stable relay with the reactor and only forward readiness to the latest
// executor waker. No user wake/drop/clone runs while its lock is held.
#[derive(Default)]
struct Relay(Mutex<Option<Waker>>);
impl Wake for Relay {
    fn wake(self: Arc<Self>) {self.wake_by_ref()}
    fn wake_by_ref(self: &Arc<Self>) {
        let latest=self.0.lock().unwrap().take();
        if let Some(w)=latest {w.wake();}
    }
}
struct Registration {io:Async<OwnedFd>,relay:Arc<Relay>,stable:Waker}
impl Registration {
    fn new(io:Async<OwnedFd>)->Self {
        let relay=Arc::new(Relay::default()); let stable=Waker::from(relay.clone()); Self{io,relay,stable}
    }
    fn poll(&self,cx:&Context<'_>)->Poll<std::io::Result<()>> {
        let next=cx.waker().clone();
        let previous=self.relay.0.lock().unwrap().replace(next);drop(previous);
        self.io.poll_readable(&mut Context::from_waker(&self.stable))
    }
}
impl Drop for Registration {
    fn drop(&mut self){let previous=self.relay.0.lock().unwrap().take();drop(previous);}
}
struct Driver<T, E> {
    source: Option<Box<dyn Source<T, E>>>,
    watch: Option<Registration>,
    pid: u32,
    // Both native calls and destruction belong to the process main thread.
    _local: PhantomData<Rc<()>>,
}
impl<T, E> Driver<T, E> {
    fn new(source: impl Source<T, E> + 'static) -> Self {
        Self { source: Some(Box::new(source)), watch: None, pid: std::process::id(), _local: PhantomData }
    }
    fn close(&mut self) -> Result<(), Fault> {
        if self.pid != std::process::id() {
            // The child cannot touch the parent's reactor or Lean's locks.
            // Its kernel descriptors are reclaimed on exec/exit.
            std::mem::forget(self.watch.take());
            std::mem::forget(self.source.take());
            return Err(Fault::WrongContext);
        }
        self.watch.take();
        self.source.take().map_or(Ok(()), |mut s| s.close())
    }
    fn request(&mut self) -> Result<(), Fault> {
        if self.pid != std::process::id() { return Err(Fault::WrongContext); }
        self.source.as_mut().ok_or(Fault::Closed)?.request()
    }
    fn poll_value(&mut self, cx: &mut Context<'_>) -> Poll<Result<Option<T>, Error<E>>> {
        if self.pid != std::process::id() { return Poll::Ready(Err(Fault::WrongContext.into())); }
        let s = self.source.as_mut().ok_or(Fault::Closed)?;
        if let Some(fd) = s.readiness()? {
            if self.watch.is_none() {
                // The native owner retains its fd. The reactor owns only a
                // duplicate, so close/reuse cannot redirect a stale wakeup.
                let watch = fd.try_clone_to_owned().and_then(Async::new_nonblocking)
                    .map_err(|e| Fault::Readiness(e.to_string()))?;
                self.watch = Some(Registration::new(watch));
            }
            match self.watch.as_ref().unwrap().poll(cx) {
                Poll::Pending => return Poll::Pending,
                Poll::Ready(Err(e)) => return Poll::Ready(Err(Fault::Readiness(e.to_string()).into())),
                Poll::Ready(Ok(())) => {
                    // Only the completion observer signals this eventfd. A
                    // permanently readable wrong fd is an error, not a spin.
                    if s.readiness()?.is_some() { return Poll::Ready(Err(Fault::Protocol.into())); }
                }
            }
        }
        self.watch.take();
        Poll::Ready(s.take())
    }
}
impl<T, E> Drop for Driver<T, E> {
    fn drop(&mut self) { let _ = self.close(); }
}

/// A started Lean task. Await or drop it on the main thread. Dropping does
/// not wait for non-cooperative work to finish.
pub struct Task<T> { owner: Driver<T, Infallible>, cancelled: bool }
impl<T> Task<T> {
    #[doc(hidden)]
    pub fn from_source(s: impl Source<T, Infallible> + 'static) -> Self {
        Self { owner: Driver::new(s), cancelled: false }
    }
    pub fn cancel(&mut self) -> Result<(), Fault> {
        self.cancelled = true;
        self.owner.close()
    }
}
impl<T> Future for Task<T> {
    type Output = Result<T, Error>;
    fn poll(self: Pin<&mut Self>, cx: &mut Context<'_>) -> Poll<Self::Output> {
        let this = self.get_mut();
        if this.cancelled { return Poll::Ready(Err(Fault::Cancelled.into())); }
        let result = match this.owner.poll_value(cx) {
            Poll::Pending => return Poll::Pending,
            Poll::Ready(r) => r.and_then(|v| v.ok_or_else(|| Fault::Protocol.into())),
        };
        let close = this.owner.close();
        Poll::Ready(result.and_then(|v| close.map(|_| v).map_err(Error::from)))
    }
}

/// One outstanding pull at a time. Exhaustion is fused; a terminal failure
/// is returned exactly once as an item, then the stream is exhausted.
pub struct Items<T, E = Infallible> { owner: Driver<T, E>, pulling: bool }
impl<T, E> Items<T, E> {
    #[doc(hidden)]
    pub fn from_source(s: impl Source<T, E> + 'static) -> Self {
        Self { owner: Driver::new(s), pulling: false }
    }
    pub fn close(&mut self) -> Result<(), Fault> { self.owner.close() }
    pub async fn next(&mut self) -> Option<Result<T, Error<E>>> {
        poll_fn(|cx| Pin::new(&mut *self).poll_next(cx)).await
    }
}
impl<T, E> Stream for Items<T, E> {
    type Item = Result<T, Error<E>>;
    fn poll_next(self: Pin<&mut Self>, cx: &mut Context<'_>) -> Poll<Option<Self::Item>> {
        let this = self.get_mut();
        if this.owner.source.is_none() { return Poll::Ready(None); }
        let result = if !this.pulling { this.owner.request() } else { Ok(()) };
        let result = match result {
            Ok(()) => {
                this.pulling = true;
                match this.owner.poll_value(cx) {
                    Poll::Pending => return Poll::Pending,
                    Poll::Ready(v) => v,
                }
            }
            Err(e) => Err(e.into()),
        };
        this.pulling = false;
        match result {
            Ok(Some(v)) => Poll::Ready(Some(Ok(v))),
            Ok(None) => Poll::Ready(this.owner.close().err().map(|e| Err(e.into()))),
            Err(e) => { let _ = this.owner.close(); Poll::Ready(Some(Err(e))) }
        }
    }
}
impl<T, E> FusedStream for Items<T, E> {
    fn is_terminated(&self) -> bool { self.owner.source.is_none() }
}
