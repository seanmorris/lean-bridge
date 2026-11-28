use std::{future::Future, sync::Arc, task::{Context, Poll, Wake, Waker}, thread};

struct WakeThread(thread::Thread);
impl Wake for WakeThread {
    fn wake(self: Arc<Self>) { self.0.unpark(); }
}
fn wait<F: Future>(f: F) -> F::Output {
    let w = Waker::from(Arc::new(WakeThread(thread::current())));
    let mut cx = Context::from_waker(&w);
    let mut f = std::pin::pin!(f);
    loop {
        match f.as_mut().poll(&mut cx) {
            Poll::Ready(v) => return v,
            Poll::Pending => thread::park(),
        }
    }
}
fn main() {
    assert_eq!(effects::read_boot().unwrap(), "from-app");
    assert_eq!(effects::observe("state").unwrap(), 37);
    assert_eq!(wait(effects::worker("state").unwrap()).unwrap(), 37);
    let mut cursor = effects::walk("state").unwrap();
    assert_eq!(wait(cursor.next()), Some(Ok(37)));
    cursor.close().unwrap();
    assert_eq!(effects::observe("state").unwrap(), 0);
}
