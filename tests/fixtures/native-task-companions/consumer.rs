use std::{future::Future, sync::Arc, task::{Context, Poll, Wake, Waker}, thread};

struct Notify(thread::Thread);
impl Wake for Notify {
    fn wake(self: Arc<Self>) { self.0.unpark() }
}
fn main() {
    assert_eq!(companions::plain(41).unwrap(), 42);
    assert_eq!(companions::bump(3).unwrap(), 3);
    let waker = Waker::from(Arc::new(Notify(thread::current())));
    let mut cx = Context::from_waker(&waker);
    let mut task = std::pin::pin!(companions::doubled(21).unwrap());
    loop {
        match task.as_mut().poll(&mut cx) {
            Poll::Ready(v) => { assert_eq!(v.unwrap(), 42); break; }
            Poll::Pending => thread::park(),
        }
    }
    assert_eq!(companions::bump(4).unwrap(), 7);
    companions::finish("state").unwrap();
}
