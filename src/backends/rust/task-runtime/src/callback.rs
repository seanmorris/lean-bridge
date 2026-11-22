use std::{cell::RefCell, error::Error, fmt, rc::Rc};

/// A declared host failure. If Lean propagates the original IO.Error, the
/// awaiting Rust caller gets this same object back, including its payload.
#[derive(Debug, Clone)]
pub struct CallbackError(Rc<dyn Error>);
impl CallbackError {
    pub fn new(e: impl Error + 'static) -> Self { Self(Rc::new(e)) }
    pub fn downcast_ref<E: Error + 'static>(&self) -> Option<&E> { self.0.downcast_ref() }
    pub fn same_error(&self, other: &Self) -> bool { Rc::ptr_eq(&self.0, &other.0) }
}
impl PartialEq for CallbackError { fn eq(&self, other: &Self) -> bool { self.same_error(other) } }
impl Eq for CallbackError {}
impl fmt::Display for CallbackError { fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result { fmt::Display::fmt(&*self.0, f) } }
impl Error for CallbackError { fn source(&self) -> Option<&(dyn Error + 'static)> { Some(&*self.0) } }

type Action<A,B> = dyn Fn(A) -> Result<B, CallbackError>;
/// Optional explicit close handle. Ordinary closure arguments need no wrapper.
pub struct RetainedCallback<A,B>(Rc<RefCell<Option<Rc<Action<A,B>>>>>);
impl<A,B> Clone for RetainedCallback<A,B> { fn clone(&self) -> Self { Self(self.0.clone()) } }
impl<A:'static,B:'static> RetainedCallback<A,B> {
    pub fn new(f: impl Fn(A) -> Result<B,CallbackError> + 'static) -> Self {
        Self(Rc::new(RefCell::new(Some(Rc::new(f)))))
    }
    pub fn close(&self) { let prev=self.0.borrow_mut().take(); drop(prev); }
    pub fn function(&self) -> impl Fn(A) -> Result<B,CallbackError> + 'static {
        let handle=self.clone();
        move |arg| {
            let action=handle.0.borrow().clone().ok_or_else(|| CallbackError::new(crate::Fault::Closed))?;
            // No borrow spans user code. A call that closes itself may finish.
            action(arg)
        }
    }
}
