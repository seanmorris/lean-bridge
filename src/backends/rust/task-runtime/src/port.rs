//! Private synchronous port used by generated Rust components. No Rust
//! unwinding or application references cross the C calling convention.
use crate::{Fault,owner::{Borrowed,HostRef,Kind,OwnerError,Session,Ticket}};
use std::{cell::{Cell,RefCell},convert::Infallible,error::Error,fmt,panic::{catch_unwind,AssertUnwindSafe},rc::Rc};

pub type HostError=Rc<dyn Error>;
pub type MemberResult<T>=Result<T,HostError>;
pub trait IntoReply<T> {fn into_reply(self)->MemberResult<T>;}
impl<T> IntoReply<T> for T {fn into_reply(self)->MemberResult<T>{Ok(self)}}
impl<T> IntoReply<T> for MemberResult<T> {fn into_reply(self)->MemberResult<T>{self}}
#[derive(Debug)]
pub enum HostCallError<E=Infallible> {
    Boundary(Fault), Host(HostError), Io{declaration:&'static str,message:String}, Declared{declaration:&'static str,payload:E},
}
impl<E> From<Fault> for HostCallError<E> {fn from(v:Fault)->Self {Self::Boundary(v)}}
impl<E:fmt::Debug> fmt::Display for HostCallError<E> {
    fn fmt(&self,f:&mut fmt::Formatter<'_>)->fmt::Result {match self {
        Self::Host(e)=>fmt::Display::fmt(e,f), Self::Boundary(e)=>fmt::Display::fmt(e,f),
        Self::Io{declaration,message}=>write!(f,"{declaration}: {message}"),
        Self::Declared{declaration,payload}=>write!(f,"{declaration}: {payload:?}"),
    }}
}
impl<E:fmt::Debug> Error for HostCallError<E> {
    fn source(&self)->Option<&(dyn Error+'static)>{match self {Self::Host(e)=>Some(e.as_ref()),Self::Boundary(e)=>Some(e),_=>None}}
}
impl From<OwnerError> for Fault {
    fn from(e:OwnerError)->Self {match e {OwnerError::WrongContext=>Self::WrongContext,OwnerError::Invalid=>Self::InvalidValue,
        OwnerError::Closed=>Self::Closed,OwnerError::Limit=>Self::Limit}}
}
pub trait AsHost<T:'static> {fn host_ref(&self)->HostRef<T>;}
impl<T:'static> AsHost<T> for Rc<T> {fn host_ref(&self)->HostRef<T>{HostRef::from(self.clone())}}
impl<T:'static> AsHost<T> for HostRef<T> {fn host_ref(&self)->HostRef<T>{self.clone()}}

pub type Word=[u64;3];
pub type Dispatch=unsafe extern "C" fn(u64,i32,*const u64,usize,*mut u64,*mut u32)->i32;
pub type Call=unsafe extern "C" fn(usize,u64,Dispatch,i32,*const u64,usize,*mut u64,*mut u8,*mut u32)->i32;
pub type Clear=unsafe extern "C" fn(*mut u64);
pub type Member=unsafe fn(&Frame,i32,&[Word])->Result<Word,Failure>;
pub enum Failure {Boundary(Fault),Host(HostError)}
impl From<Fault> for Failure {fn from(v:Fault)->Self{Self::Boundary(v)}}
impl From<HostError> for Failure {fn from(v:HostError)->Self{Self::Host(v)}}

#[derive(Default)]
pub struct Scratch { tickets:Vec<Ticket>, bytes:Vec<Vec<u8>>, limbs:Vec<Vec<u64>>, charge:usize }
impl Scratch {
    const LIMIT:usize=16*1024*1024;
    fn bill(&mut self,n:usize)->Result<(),Fault>{
        if n>Self::LIMIT-self.charge {return Err(Fault::Limit)}
        self.charge+=n;Ok(())
    }
    pub fn bytes(&mut self,v:Vec<u8>)->Result<Word,Fault> {
        self.bill(v.len())?;let w=[v.as_ptr() as u64,v.len() as u64,0];self.bytes.push(v);Ok(w)
    }
    pub fn copy_bytes(&mut self,v:&[u8])->Result<Word,Fault> {
        if v.len()>Self::LIMIT-self.charge{return Err(Fault::Limit)}
        self.bytes(v.to_vec())
    }
    pub fn integer(&mut self,v:Vec<u64>,negative:bool)->Result<Word,Fault> {
        self.bill(v.len().checked_mul(8).ok_or(Fault::Limit)?)?;
        if v.last()==Some(&0) || (v.is_empty() && negative) {return Err(Fault::InvalidValue)}
        let w=[v.as_ptr() as u64,v.len() as u64,negative.into()];self.limbs.push(v);Ok(w)
    }
    fn ticket(&mut self,t:Ticket)->Word {let w=[t.id(),0,0];self.tickets.push(t);w}
}
/// Safety: nonempty buffers must point into a live native result or active member call.
pub unsafe fn bytes(w:Word)->Result<Vec<u8>,Fault> {
    if w[2]!=0 || w[1]>Scratch::LIMIT as u64 || (w[1]!=0 && w[0]==0) {return Err(Fault::Protocol)}
    Ok(if w[1]==0 {Vec::new()}else{unsafe{std::slice::from_raw_parts(w[0] as *const u8,w[1] as usize)}.to_vec()})
}
/// Safety: same lifetime requirement as bytes(); nonempty limbs must be aligned.
pub unsafe fn limbs(w:Word,nat:bool)->Result<Vec<u64>,Fault> {
    if w[2]>1 || (nat && w[2]!=0) || w[1]>Scratch::LIMIT as u64/8 || (w[1]!=0 && (w[0]==0 || w[0]%8!=0)) {return Err(Fault::Protocol)}
    let v=if w[1]==0{Vec::new()}else{unsafe{std::slice::from_raw_parts(w[0] as *const u64,w[1] as usize)}.to_vec()};
    if v.last()==Some(&0) || (v.is_empty() && w[2]!=0) {return Err(Fault::Protocol)}
    Ok(v)
}
pub fn single(w:Word,max:u64)->Result<u64,Fault> {if w[1]!=0 || w[2]!=0 || w[0]>max {Err(Fault::Protocol)}else{Ok(w[0])}}
pub struct Frame {session:Rc<Session>, member:Member, replies:RefCell<Scratch>, errors:RefCell<Vec<HostError>>, panic:Cell<bool>}
impl Frame {
    pub fn object<T:'static>(&self,kind:usize,w:Word)->Result<HostRef<T>,Fault> {
        Ok(self.session.get(kind,single(w,u64::MAX)?)?)
    }
    pub fn reply_object<T:'static>(&self,kind:usize,v:Rc<T>)->Result<Word,Fault> {
        let t=self.session.pin(kind,&v.into())?;Ok(self.replies.borrow_mut().ticket(t))
    }
    pub fn reply_borrow<T:'static,A:'static>(&self,kind:usize,v:Borrowed<T>,parent:&HostRef<A>)->Result<Word,Fault> {
        let t=self.session.borrowed(kind,v,parent)?;Ok(self.replies.borrow_mut().ticket(t))
    }
    pub fn reply_bytes(&self,v:Vec<u8>)->Result<Word,Fault> {self.replies.borrow_mut().bytes(v)}
    pub fn reply_integer(&self,v:Vec<u64>,sign:bool)->Result<Word,Fault>{self.replies.borrow_mut().integer(v,sign)}
}
unsafe extern "C" fn dispatch(id:u64,op:i32,args:*const u64,n:usize,out:*mut u64,fault:*mut u32)->i32 {
    if id==0 || n>64 || (n!=0 && args.is_null()) || out.is_null() || fault.is_null(){return 2}
    let f=unsafe{&*(id as *const Frame)};
    match catch_unwind(AssertUnwindSafe(||->Result<i32,Fault>{
        if op<0 {
            if n!=2{return Err(Fault::Protocol)}
            unsafe { *out=f.session.refop(op,*args,*args.add(1))?; }return Ok(0);
        }
        // The native wrapper has already read the preceding successful reply.
        // Drop its owners outside a RefCell borrow: Drop can re-enter the bridge.
        drop(f.replies.replace(Scratch::default()));
        let vals=if n==0{&[]}else{unsafe{std::slice::from_raw_parts(args.cast::<Word>(),n)}};
        match unsafe{(f.member)(f,op,vals)} {
            Ok(w)=>{unsafe{std::ptr::copy_nonoverlapping(w.as_ptr(),out,3)};Ok(0)}
            Err(Failure::Host(e))=>{
                let mut es=f.errors.borrow_mut();if es.len()>=u32::MAX as usize-1{return Err(Fault::Limit)}
                es.try_reserve(1).map_err(|_|Fault::Allocation)?;es.push(e);unsafe{*fault=es.len() as u32};Ok(1)
            }
            Err(Failure::Boundary(e))=>Err(e),
        }
    })) {Ok(Ok(s))=>s,Ok(Err(_))=>2,Err(_)=>{f.panic.set(true);2}}
}
pub struct Output {raw:[u64;4],tags:[u8;65],clear:Clear}
impl Output {
    pub fn word(&self)->Word {[self.raw[0],self.raw[1],self.raw[2]]}
    pub fn branch(&self,i:usize)->Result<bool,Fault> {match self.tags.get(i){Some(0)=>Ok(false),Some(1)=>Ok(true),_=>Err(Fault::Protocol)}}
}
impl Drop for Output {fn drop(&mut self){unsafe{(self.clear)(self.raw.as_mut_ptr())}}}
pub struct Connection {session:RefCell<Option<Rc<Session>>>,call:Call,clear:Clear,member:Member,depth:Cell<usize>,returned:bool,closing:Cell<bool>}
struct Active<'a>(&'a Cell<usize>);
impl Drop for Active<'_> {fn drop(&mut self){self.0.set(self.0.get()-1)}}
impl Connection {
    /// Safety: the entry and clear functions must come from the same checked
    /// component and use this exact protocol and member table.
    pub unsafe fn open(d:&'static str,k:Vec<Kind>,call:Call,clear:Clear,member:Member)->Result<Self,Fault> {
        unsafe {Self::open_inner(d,k,call,clear,member,false)}
    }
    /// Safety: same contract as open; the component must also implement
    /// binding-local retirement (-3) independently of ordinary call readiness.
    pub unsafe fn open_with_returned_functions(d:&'static str,k:Vec<Kind>,call:Call,clear:Clear,member:Member)->Result<Self,Fault> {
        unsafe {Self::open_inner(d,k,call,clear,member,true)}
    }
    unsafe fn open_inner(d:&'static str,k:Vec<Kind>,call:Call,clear:Clear,member:Member,returned:bool)->Result<Self,Fault> {
        let s=Rc::new(Session::new(d,k)?);
        let c=Self{session:RefCell::new(Some(s.clone())),call,clear,member,depth:Cell::new(0),returned,closing:Cell::new(false)};
        let (f,_,rc,_)=c.invoke(s,-2,&[]);drop(f);
        if rc!=0 {c.session.take();return Err(status(rc))}
        Ok(c)
    }
    fn session(&self)->Result<Rc<Session>,Fault> {
        if self.closing.get(){return Err(Fault::Busy)}
        self.session.borrow().clone().ok_or(Fault::Closed)
    }
    fn invoke(&self,s:Rc<Session>,op:i32,ws:&[Word])->(Frame,Output,i32,u32) {
        let f=Frame{session:s,member:self.member,replies:Default::default(),errors:Default::default(),panic:Cell::new(false)};
        let mut o=Output{raw:[0;4],tags:[0;65],clear:self.clear};let mut fault=0;
        self.depth.set(self.depth.get()+1);let _active=Active(&self.depth);
        let rc=unsafe{(self.call)(crate::owner::instance(),&f as *const Frame as u64,dispatch,op,ws.as_ptr().cast(),ws.len(),o.raw.as_mut_ptr(),o.tags.as_mut_ptr(),&mut fault)};
        (f,o,rc,fault)
    }
    pub fn close(&self)->Result<(),Fault>{
        if self.depth.get()!=0 {return Err(Fault::Busy)}
        let Some(s)=self.session.borrow().clone() else{return Ok(())};
        s.validate()?;
        struct Closing<'a>(&'a Cell<bool>);
        impl Drop for Closing<'_>{fn drop(&mut self){self.0.set(false)}}
        if self.closing.replace(self.returned){return Err(Fault::Busy)}
        let _guard=Closing(&self.closing);
        if self.returned {
            let (_,_,rc,_)=self.invoke(s.clone(),-3,&[]);
            if rc!=0{return Err(status(rc))}
        }
        let (_,_,rc,_)=self.invoke(s,-1,&[]);
        if rc!=0{return Err(status(rc))}
        self.session.take();Ok(())
    }
    pub fn input<T:'static>(&self,i:usize,v:&impl AsHost<T>,a:&mut Scratch)->Result<Word,Fault>{
        Ok(a.ticket(self.session()?.pin(i,&v.host_ref())?))
    }
    pub fn output<T:'static>(&self,i:usize,w:Word)->Result<HostRef<T>,Fault>{Ok(self.session()?.take(i,single(w,u64::MAX)?)?)}
    /// Safety: the opcode, carriers, lengths and storage lifetimes must match the generated entry.
    pub unsafe fn execute<E>(&self,op:i32,ws:&[Word],declaration:&'static str)->Result<(Output,bool),HostCallError<E>> {
        let s=self.session()?;s.validate().map_err(Fault::from)?;
        let (f,o,rc,id)=self.invoke(s,op,ws);
        match rc {
            0|3=>Ok((o,rc==3)),
            4=>Err(HostCallError::Io{declaration,message:String::from_utf8(unsafe{bytes(o.word())?}).map_err(|_|Fault::Protocol)?}),
            13=>Err(HostCallError::Host(f.errors.borrow().get(id.wrapping_sub(1) as usize).cloned().ok_or(Fault::Protocol)?)),
            _=>Err(if f.panic.get(){Fault::CallbackPanic{declaration}}else{status(rc)}.into()),
        }
    }
}
impl Drop for Connection {fn drop(&mut self){let _=self.close();}}
fn status(rc:i32)->Fault {match rc {5=>Fault::InvalidValue,9=>Fault::WrongContext,10|15=>Fault::Unavailable,11=>Fault::Allocation,12=>Fault::Limit,14=>Fault::Busy,16=>Fault::Closed,_=>Fault::Protocol}}

#[cfg(feature="async")]
#[doc(hidden)]
pub mod worker { include!("worker.rs"); }
