// Owner-side private transport for generated application-object workers. A
// scoped object word is not an application ticket or a persistent task handle.
use super::*;
use crate::{abi, CallbackError, Source};
use std::{os::fd::{AsFd,BorrowedFd,OwnedFd}, rc::Weak, task::Waker};

pub type Visit = unsafe extern "C" fn(usize,u64,Dispatch,i32,unsafe extern "C" fn(u64)->i32)->i32;
pub type Object = unsafe extern "C" fn(usize,i32,u32,u64,*mut u64,*mut u64)->i32;
pub type Start = unsafe extern "C" fn(*const u64,*mut u64,*mut u64,*mut u8)->i32;
pub type Take = unsafe extern "C" fn(*mut u64,*mut u64,*mut u8)->i32;
pub type Poll = unsafe extern "C" fn(*mut u64,*mut i32)->i32;
pub type Act = unsafe extern "C" fn(*mut u64)->i32;
pub type Next = unsafe extern "C" fn(*mut u64,*mut u32)->i32;
pub type Arg = unsafe extern "C" fn(*mut u64,u32,*mut u64)->i32;
pub type Reply = unsafe extern "C" fn(*mut u64,u32,*const u64)->i32;
pub type Fail = unsafe extern "C" fn(*mut u64,*const u64,*mut u32)->i32;
pub type Trap = unsafe extern "C" fn();
pub type WaitOpen = unsafe extern "C" fn(i32,i32,*mut i32)->i32;
pub type WaitClose = unsafe extern "C" fn(*mut i32);
#[derive(Clone,Copy)]
pub struct Wait {pub open:WaitOpen,pub close:WaitClose}
#[derive(Clone,Copy)]
pub struct CallbackFns {pub fd:Poll,pub next:Next,pub arg:Arg,pub reply:Reply,pub fail:Fail,pub trap:Trap}
#[derive(Clone,Copy)]
pub struct Methods {pub start:Start,pub take:Take,pub poll:Poll,pub close:Act,pub pull:Option<Act>,pub callbacks:Option<CallbackFns>}

pub struct Scope<'a>{frame:&'a Frame,object:Object,scratch:Scratch,inputs:Vec<(u32,[u64;2])>}
impl Scope<'_>{
    fn object(&self,op:i32,kind:u32,input:u64,h:&mut [u64;2])->Result<u64,Fault>{
        let mut out=0;let rc=unsafe{(self.object)(crate::owner::instance(),op,kind,input,h.as_mut_ptr(),&mut out)};
        if rc!=0{return Err(status(rc))} Ok(out)
    }
    pub fn input<T:'static>(&mut self,k:u32,v:&impl AsHost<T>)->Result<Word,Fault>{
        self.inputs.try_reserve(1).map_err(|_|Fault::Allocation)?;
        let ticket=self.frame.session.pin(k as usize,&v.host_ref())?;
        let input=self.scratch.ticket(ticket)[0];let mut h=[0;2];self.object(0,k,input,&mut h)?;
        self.inputs.push((k,h));Ok([h[0],h[1],0])
    }
    fn admit(&mut self)->Result<(),Fault>{
        for (k,mut h) in std::mem::take(&mut self.inputs){self.object(2,k,0,&mut h)?;}
        Ok(())
    }
    pub fn scratch(&mut self)->&mut Scratch{&mut self.scratch}
    pub fn output<T:'static>(&self,k:u32,o:&Output)->Result<HostRef<T>,Fault>{
        let w=o.tagged(3+u64::from(k))?;
        if w[2]!=0{return Err(Fault::Protocol)}
        let ticket=self.object(1,k,0,&mut [w[0],w[1]])?;
        Ok(self.frame.session.take(k as usize,ticket)?)
    }
}
impl Output {
    pub fn tagged(&self,expected:u64)->Result<Word,Fault>{
        if self.raw[3]!=expected{return Err(Fault::Protocol)} Ok(self.word())
    }
}
// The native frame uses this address both for dispatch (which reads the
// first field) and for the one synchronous visit. No Rust borrow is mutable
// across the FFI call; a registry operation may re-enter another binding.
#[repr(C)]
struct Job<F,R>{frame:Frame,action:RefCell<Option<F>>,result:RefCell<Option<R>>,object:Object}
unsafe extern "C" fn enter<F:FnOnce(&mut Scope<'_>)->R,R>(id:u64)->i32{
    let job=unsafe{&*(id as *const Job<F,R>)};
    match catch_unwind(AssertUnwindSafe(||{
        let Some(f)=job.action.take() else{return -1};
        let mut scope=Scope{frame:&job.frame,object:job.object,scratch:Scratch::default(),inputs:Vec::new()};
        job.result.replace(Some(f(&mut scope)));0
    })){Ok(rc)=>rc,Err(payload)=>{job.frame.panic.set(true);discard_panic(payload);-1}}
}
fn discard_panic(payload:Box<dyn std::any::Any+Send>){
    if let Err(second)=catch_unwind(AssertUnwindSafe(||drop(payload))){std::mem::forget(second);}
}
pub struct Workers {port:Rc<Connection>,visit:Visit,object:Object,clear:Clear,wait:Wait,slots:RefCell<Vec<Weak<Slot>>>,closing:Cell<bool>,deferred:Cell<bool>}
struct WorkerGuard<'a>(&'a Workers);
impl Drop for WorkerGuard<'_>{
    fn drop(&mut self){
        let owner=self.0;let depth=owner.port.depth.get()-1;owner.port.depth.set(depth);
        if depth==0 && owner.deferred.replace(false){let _=owner.close();}
    }
}
impl Workers {
    /// # Safety
    /// All symbols must belong to this connection's authenticated worker wire.
    pub unsafe fn new(port:Rc<Connection>,visit:Visit,object:Object,clear:Clear,wait:Wait)->Rc<Self>{
        Rc::new(Self{port,visit,object,clear,wait,slots:Default::default(),closing:Cell::new(false),deferred:Cell::new(false)})
    }
    fn guard(&self)->Result<WorkerGuard<'_>,Fault>{
        self.port.session()?.validate()?;
        let n=self.port.depth.get().checked_add(1).ok_or(Fault::Limit)?;
        self.port.depth.set(n);Ok(WorkerGuard(self))
    }
    fn run<F:FnOnce(&mut Scope<'_>)->R,R>(&self,cleanup:bool,d:&'static str,f:F)->Result<R,Fault>{
        if self.closing.get() && !cleanup{return Err(Fault::Closed)}
        let _guard=self.guard()?;
        let frame=Frame{session:self.port.session()?,member:self.port.member,replies:Default::default(),errors:Default::default(),panic:Cell::new(false)};
        let job=Job{frame,action:RefCell::new(Some(f)),result:RefCell::new(None),object:self.object};
        let rc=unsafe{(self.visit)(crate::owner::instance(),&job as *const _ as u64,dispatch,cleanup.into(),enter::<F,R>)};
        if job.frame.panic.get(){return Err(Fault::CallbackPanic{declaration:d})}
        if rc!=0{return Err(status(rc))}
        job.result.into_inner().ok_or(Fault::Protocol)
    }
    fn output(&self)->Output{Output{raw:[0;4],tags:[0;65],clear:self.clear}}
    // Explicit reentrant close reports Busy. Drop has no caller to retry:
    // revoke the pending channels on returning from the outermost worker
    // callback, after its last native reply and its handler borrow.
    pub fn shutdown(&self){
        if self.closing.get(){return}
        if self.port.depth.get()!=0{self.deferred.set(true);}else{let _=self.close();}
    }
    pub fn close(&self)->Result<(),Fault>{
        if self.port.depth.get()!=0{return Err(Fault::Busy)}
        crate::owner::check_context()?;
        if self.closing.replace(true){return Err(Fault::Busy)}
        struct Reset<'a>(&'a Cell<bool>); impl Drop for Reset<'_>{fn drop(&mut self){self.0.set(false)}}
        let _reset=Reset(&self.closing);
        let slots=self.slots.take();let mut result=Ok(());
        for s in slots.into_iter().filter_map(|w|w.upgrade()){
            if let Err(e)=s.close(){result=result.and(Err(e));}
        }
        let close=self.port.close();result.and(close)
    }
    /// # Safety
    /// Methods, ordered input words, and both decoders must match this
    /// compiled declaration. Input buffers must remain live through start.
    pub unsafe fn start<T:'static,E:'static,H:'static,S:'static>(self:&Rc<Self>,d:&'static str,m:Methods,
        args:impl FnOnce(&mut Scope<'_>)->Result<Vec<Word>,Fault>,bad:DecodeStart<S>,take:Decode<T,E,H>,
        callbacks:Option<Box<Handler>>)->Result<Channel<T,E,H>,crate::Error<S>>{
        if self.closing.get(){return Err(Fault::Closed.into())}
        let s=Rc::new(Slot{owner:self.clone(),d,m,h:Cell::new([0;2]),handler:RefCell::new(callbacks),
            errors:Default::default(),wake:Default::default(),gate:Default::default()});
        {let mut slots=self.slots.borrow_mut();slots.retain(|w|w.strong_count()!=0);
        slots.try_reserve(1).map_err(|_|Fault::Allocation)?;slots.push(Rc::downgrade(&s));}
        self.run(false,d,|ctx|->Result<(),crate::Error<S>>{
            let ws=args(ctx)?;let mut o=self.output();let mut h=[0;2];
            let rc=unsafe{(m.start)(ws.as_ptr().cast(),h.as_mut_ptr(),o.raw.as_mut_ptr(),o.tags.as_mut_ptr())};
            s.h.set(h);
            if matches!(rc,0|3|4){ctx.admit()?;}
            if rc!=0{bad(ctx,&o,rc)?;return Err(Fault::Protocol.into())}
            if h[0]==0{return Err(Fault::Protocol.into())} Ok(())
        })??;
        Ok(Channel{s,take,watch:None,callbacks:None})
    }
}
pub type DecodeStart<S> = fn(&Scope<'_>,&Output,i32)->Result<(),crate::Error<S>>;
pub type Decode<T,E,H> = fn(&Scope<'_>,&Output,i32,&[CallbackError])->Result<Option<T>,crate::Error<E,H>>;
pub type Handler = dyn Fn(&Slot,u32)->Result<(),DispatchError>;
pub enum DispatchError {Boundary(Fault),Callback(CallbackError)}
impl From<Fault> for DispatchError{fn from(f:Fault)->Self{Self::Boundary(f)}}
impl From<CallbackError> for DispatchError{fn from(e:CallbackError)->Self{Self::Callback(e)}}
pub struct Slot{owner:Rc<Workers>,d:&'static str,m:Methods,h:Cell<[u64;2]>,handler:RefCell<Option<Box<Handler>>>,
    errors:RefCell<Vec<CallbackError>>,wake:RefCell<Option<Waker>>,gate:RefCell<Option<Gate>>}
impl Slot{
    fn handle(&self)->Result<[u64;2],Fault>{let h=self.h.get();if h[0]==0{Err(Fault::Closed)}else{Ok(h)}}
    fn close(&self)->Result<(),Fault>{
        // Release the native retirement subscription even if the caller
        // keeps the cancelled future around without polling it again.
        self.gate.take();
        let mut h=self.h.get();
        if h[0]!=0{
            self.owner.run(true,self.d,|_|{
                let n=unsafe{(self.m.close)(h.as_mut_ptr())};self.h.set(h);
                if n==6{self.h.set([0;2]);Ok(())}else{abi::status(n)}
            })??;
        }
        drop(self.handler.take());drop(self.errors.take());
        let w=self.wake.take();if let Some(w)=w{w.wake();} Ok(())
    }
    pub fn arg<T>(&self,slot:u32,f:impl FnOnce(&Scope<'_>,&Output)->Result<T,Fault>)->Result<T,Fault>{
        let cb=self.m.callbacks.ok_or(Fault::Protocol)?;let mut h=self.handle()?;
        self.owner.run(false,self.d,|ctx|{let mut o=self.owner.output();
            abi::status(unsafe{(cb.arg)(h.as_mut_ptr(),slot,o.raw.as_mut_ptr())})?;f(ctx,&o)})?
    }
    /// # Safety
    /// The reply word must match this callback's checked parameter slot;
    /// any pointed-to input must remain live through the call.
    pub unsafe fn reply(&self,slot:u32,f:impl FnOnce(&mut Scope<'_>)->Result<Word,Fault>)->Result<(),Fault>{
        let cb=self.m.callbacks.ok_or(Fault::Protocol)?;let mut h=self.handle()?;
        self.owner.run(false,self.d,|ctx|{let word=f(ctx)?;
            abi::status(unsafe{(cb.reply)(h.as_mut_ptr(),slot,word.as_ptr())})?;ctx.admit()})?
    }
}
impl Drop for Slot{fn drop(&mut self){let _=self.close();}}
// Native completion alone is insufficient: a different component can
// retire the runtime while this worker is waiting for an owner callback.
// The gate also observes retirement. Application callbacks retain their
// separate registration and never masquerade as a completion notification.
struct Gate {fds:[i32;2],close:WaitClose}
impl Drop for Gate{fn drop(&mut self){unsafe{(self.close)(self.fds.as_mut_ptr())};}}
impl Gate{
    fn new(wait:Wait,fd:i32)->Result<Self,Fault>{
        if fd<0{return Err(Fault::Protocol)}
        let mut fds=[-1;2];abi::status(unsafe{(wait.open)(fd,-1,fds.as_mut_ptr())})?;
        let gate=Self{fds,close:wait.close};
        if fds[0]<0 || fds[1]<0{return Err(Fault::Protocol)} Ok(gate)
    }
    fn fd(&self)->BorrowedFd<'_>{unsafe{BorrowedFd::borrow_raw(self.fds[0])}}
}
pub struct Channel<T,E,H>{s:Rc<Slot>,take:Decode<T,E,H>,watch:Option<OwnedFd>,callbacks:Option<OwnedFd>}
fn duplicate(fd:i32)->Result<OwnedFd,Fault>{
    if fd<0{return Err(Fault::Protocol)}
    unsafe{BorrowedFd::borrow_raw(fd)}.try_clone_to_owned().map_err(|e|Fault::Readiness(e.to_string()))
}
impl<T,E,H> Source<T,E,H> for Channel<T,E,H>{
    fn request(&mut self)->Result<(),Fault>{
        let s=&self.s;let mut h=s.handle()?;let pull=s.m.pull.ok_or(Fault::Protocol)?;
        s.owner.run(false,s.d,|_|abi::status(unsafe{pull(h.as_mut_ptr())}))?
    }
    fn readiness(&mut self)->Result<Option<BorrowedFd<'_>>,Fault>{
        let s=&self.s;let mut h=s.handle()?;let mut fd=-1;
        let n=s.owner.run(false,s.d,|_|unsafe{(s.m.poll)(h.as_mut_ptr(),&mut fd)})?;
        if n==0{return Ok(None)} if n!=1{abi::status(n)?;return Err(Fault::Protocol)}
        if self.watch.is_none(){
            let gate=Gate::new(s.owner.wait,fd)?;
            self.watch=Some(gate.fd().try_clone_to_owned().map_err(|e|Fault::Readiness(e.to_string()))?);
            s.gate.replace(Some(gate));
        }
        if let Some(cb)=s.m.callbacks{if self.callbacks.is_none(){let mut fd=-1;
            s.owner.run(false,s.d,|_|abi::status(unsafe{(cb.fd)(h.as_mut_ptr(),&mut fd)}))??;
            self.callbacks=Some(duplicate(fd)?);}}
        Ok(self.watch.as_ref().map(AsFd::as_fd))
    }
    fn observe(&mut self,w:&Waker){
        if self.s.wake.borrow().as_ref().is_some_and(|old|old.will_wake(w)){return}
        let next=w.clone();let prev=self.s.wake.replace(Some(next));drop(prev);
    }
    fn callback_fd(&self)->Result<Option<BorrowedFd<'_>>,Fault>{Ok(self.callbacks.as_ref().map(AsFd::as_fd))}
    fn take(&mut self)->Result<Option<T>,crate::Error<E,H>>{
        let s=&self.s;let mut h=s.handle()?;self.watch.take();s.gate.take();
        s.owner.run(false,s.d,|ctx|{let mut o=s.owner.output();
            let rc=unsafe{(s.m.take)(h.as_mut_ptr(),o.raw.as_mut_ptr(),o.tags.as_mut_ptr())};
            s.h.set(h);(self.take)(ctx,&o,rc,&s.errors.borrow())})?
    }
    fn dispatch_callbacks(&mut self)->Result<(),Fault>{
        let s=&self.s;let cb=s.m.callbacks.ok_or(Fault::Protocol)?;
        // Hold the disposal guard, not a native visit, during application code.
        let _active=s.owner.guard()?;
        for _ in 0..16{let mut h=s.handle()?;let mut slot=0;
            let n=s.owner.run(false,s.d,|_|unsafe{(cb.next)(h.as_mut_ptr(),&mut slot)})?;
            if n==1{break} abi::status(n)?;
            match catch_unwind(AssertUnwindSafe(||{
                let handler=s.handler.borrow();
                match handler.as_ref().ok_or(Fault::Closed)?(s,slot){
                    Ok(())=>Ok(None),Err(DispatchError::Boundary(e))=>Err(e),
                    Err(DispatchError::Callback(e))=>{let msg=e.to_string();Ok(Some((e,msg)))}
                }
            })){
                Ok(Ok(None))=>(),Ok(Err(e))=>return Err(e),
                Ok(Ok(Some((e,msg))))=>{
                    let mut id=0;let mut errors=s.errors.borrow_mut();
                    errors.try_reserve(1).map_err(|_|Fault::Allocation)?;
                    let word=[msg.as_ptr() as u64,msg.len() as u64,0];
                    s.owner.run(false,s.d,|_|abi::status(unsafe{(cb.fail)(h.as_mut_ptr(),word.as_ptr(),&mut id)}))??;
                    if id as usize!=errors.len()+1{return Err(Fault::Protocol)}errors.push(e);
                }
                Err(payload)=>{unsafe{(cb.trap)()};discard_panic(payload);return Err(Fault::CallbackPanic{declaration:s.d})}
            }
            if s.owner.deferred.get(){break}
        } Ok(())
    }
    fn close(&mut self)->Result<(),Fault>{self.s.wake.take();self.watch.take();self.callbacks.take();self.s.close()}
}
