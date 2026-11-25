/* Bounded Wasm inputs for installed synchronous and asynchronous runners. */
#ifndef LB_WIT_PEER_IO_H
#define LB_WIT_PEER_IO_H
#include <stdio.h>
#include <wasmtime.h>
#include "application-peer-bytes.h"
static inline bool report(wasmtime_error_t *e){
    if(!e)return true;
    wasm_name_t message;wasmtime_error_message(e,&message);fprintf(stderr,"%.*s\n",(int)message.size,message.data);
    wasm_name_delete(&message);wasmtime_error_delete(e);return false;
}
static inline lb_pg_buf read_guest(const char *path){
    lb_pg_buf b={0};FILE *f=fopen(path,"rb");long n;
    if(!f || fseek(f,0,SEEK_END) || (n=ftell(f))<8 || n>64*1024*1024 || fseek(f,0,SEEK_SET))b.bad=true;
    else if(!(b.p=malloc((size_t)n)))b.bad=true;
    else{b.n=(size_t)n;b.bad=fread(b.p,1,b.n,f)!=b.n || fgetc(f)!=EOF || ferror(f) || memcmp(b.p,"\0asm\15\0\1\0",8);}
    if(f)fclose(f);
    if(b.bad)fprintf(stderr,"invalid Wasm component: %s\n",path);
    return b;
}
#endif
