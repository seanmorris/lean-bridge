//! Optional executor-facing task and stream delivery.
use super::{CallbackError,Fault};
use async_io::Async;
use futures_core::stream::FusedStream;
pub use futures_core::Stream;
use std::{
    convert::Infallible, fmt, future::{poll_fn, Future}, marker::PhantomData,
    os::fd::{BorrowedFd, OwnedFd}, pin::Pin, rc::Rc, sync::{Arc, Mutex}, task::{Context, Poll, Wake, Waker},
};

/// Synchronous factory rejection, terminal stream failure, and transport
/// failure are three different outcomes. A Lean `Except` *value* is a normal
/// nested Rust `Result`, not one of these errors.
#[derive(Debug, PartialEq, Eq)]
pub enum Error<E = Infallible, H = Infallible> { Start(E), Step(E), Callback { declaration: &'static str, error: H }, Boundary(Fault) }
/// Only callback-capable tasks carry an owner-local Rust error. Errors from
/// callback-free APIs retain their original Send/Sync bounds.
pub type CallbackTaskError<E = Infallible> = Error<E,CallbackError>;
pub type CallbackTask<T,E = Infallible> = Task<T,E,CallbackError>;
impl<E> From<Error> for CallbackTaskError<E> {
    fn from(e:Error)->Self { match e {
        Error::Boundary(f)=>Self::Boundary(f), Error::Start(x)|Error::Step(x)|Error::Callback{error:x,..}=>match x {},
    } }
}
impl<E,H> From<Fault> for Error<E,H> {
    fn from(f: Fault) -> Self { Self::Boundary(f) }
}
impl<E: fmt::Debug,H: fmt::Display> fmt::Display for Error<E,H> {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Start(e) => write!(f, "Lean factory rejected: {e:?}"),
            Self::Step(e) => write!(f, "Lean stream failed: {e:?}"),
            Self::Callback { declaration, error } => write!(f, "{declaration}: {error}"),
            Self::Boundary(e) => e.fmt(f),
        }
    }
}
impl<E: fmt::Debug,H: std::error::Error + 'static> std::error::Error for Error<E,H> {
    fn source(&self)->Option<&(dyn std::error::Error + 'static)> {match self {
        Self::Callback{error,..}=>Some(error),Self::Boundary(f)=>Some(f),_=>None,
    }}
}

/// Implementation interface for generated bindings. Component handles, ABI
/// pointers and symbol lookup remain private to the component.
#[doc(hidden)]
pub trait Source<T, E, H = Infallible> {
    fn request(&mut self) -> Result<(), Fault>;
    /// None means ready; a borrowed descriptor signals readiness without reads.
    fn readiness(&mut self) -> Result<Option<BorrowedFd<'_>>, Fault>;
    fn take(&mut self) -> Result<Option<T>, Error<E,H>>;
    fn close(&mut self) -> Result<(), Fault>;
    fn callback_fd(&self) -> Result<Option<BorrowedFd<'_>>, Fault> { Ok(None) }
    fn dispatch_callbacks(&mut self) -> Result<(), Fault> { Err(Fault::Protocol) }
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
    fn for_fd(fd:BorrowedFd<'_>) -> Result<Self,Fault> {
        fd.try_clone_to_owned().and_then(Async::new_nonblocking).map(Self::new)
            .map_err(|e| Fault::Readiness(e.to_string()))
    }
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
struct Driver<T, E, H = Infallible> {
    source: Option<Box<dyn Source<T, E,H>>>,
    watch: Option<Registration>,
    callbacks: Option<Registration>,
    pid: u32,
    // Both native calls and destruction belong to the process main thread.
    _local: PhantomData<Rc<()>>,
}
impl<T,E,H> Driver<T,E,H> {
    fn new(source: impl Source<T,E,H> + 'static) -> Self {
        Self { source: Some(Box::new(source)), watch: None, callbacks: None, pid: std::process::id(), _local: PhantomData }
    }
    fn close(&mut self) -> Result<(), Fault> {
        if self.pid != std::process::id() {
            // The child cannot touch the parent's reactor or Lean's locks.
            // Its kernel descriptors are reclaimed on exec/exit.
            std::mem::forget(self.watch.take());
            std::mem::forget(self.callbacks.take());
            std::mem::forget(self.source.take());
            return Err(Fault::WrongContext);
        }
        self.watch.take();
        self.callbacks.take();
        self.source.take().map_or(Ok(()), |mut s| s.close())
    }
    fn request(&mut self) -> Result<(), Fault> {
        if self.pid != std::process::id() { return Err(Fault::WrongContext); }
        self.source.as_mut().ok_or(Fault::Closed)?.request()
    }
    fn poll_value(&mut self, cx: &mut Context<'_>) -> Poll<Result<Option<T>, Error<E,H>>> {
        if self.pid != std::process::id() { return Poll::Ready(Err(Fault::WrongContext.into())); }
        let s = self.source.as_mut().ok_or(Fault::Closed)?;
        if let Some(fd) = s.readiness()? {
            if self.watch.is_none() {
                // The native owner retains its fd. The reactor owns only a
                // duplicate, so close/reuse cannot redirect a stale wakeup.
                self.watch = Some(Registration::for_fd(fd)?);
            }
            if self.callbacks.is_none() {
                if let Some(fd)=s.callback_fd()? { self.callbacks=Some(Registration::for_fd(fd)?); }
            }
            if let Some(reg)=&self.callbacks {
                if let Poll::Ready(r)=reg.poll(cx) {
                    r.map_err(|e| Fault::Readiness(e.to_string()))?;
                    s.dispatch_callbacks()?;
                    // Readiness is one-shot. Re-poll to rearm after a bounded
                    // batch; unread requests stay level-readable on the fd.
                    cx.waker().wake_by_ref();
                }
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
impl<T,E,H> Drop for Driver<T,E,H> {
    fn drop(&mut self) { let _ = self.close(); }
}

/// A started Lean task. Await or drop it on the main thread. Dropping does
/// not wait for non-cooperative work to finish.
pub struct Task<T,E = Infallible,H = Infallible> { owner: Driver<T,E,H>, cancelled: bool }
impl<T,E,H> Task<T,E,H> {
    #[doc(hidden)]
    pub fn from_source(s: impl Source<T,E,H> + 'static) -> Self {
        Self { owner: Driver::new(s), cancelled: false }
    }
    pub fn cancel(&mut self) -> Result<(), Fault> {
        self.cancelled = true;
        self.owner.close()
    }
}
impl<T,E,H> Future for Task<T,E,H> {
    type Output = Result<T, Error<E,H>>;
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
