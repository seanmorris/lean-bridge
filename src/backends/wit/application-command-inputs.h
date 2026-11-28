/* Shared binary assembly for the synchronous and turn-based release launchers. */
#ifndef LB_WIT_COMMAND_INPUTS_H
#define LB_WIT_COMMAND_INPUTS_H
static bool report(wasmtime_error_t *e){
    if(!e)return true;
    wasm_name_t msg;wasmtime_error_message(e,&msg);fprintf(stderr,"%.*s\n",(int)msg.size,msg.data);
    wasm_name_delete(&msg);wasmtime_error_delete(e);return false;
}
static wasmtime_component_t *compose(wasm_engine_t *engine,char **paths){
    static const uint8_t magic[]={0,97,115,109,13,0,1,0};
    FILE *files[LB_INPUTS]={0};size_t sizes[LB_INPUTS],size=0,at=0;uint8_t *bytes=NULL;
    wasmtime_component_t *component=NULL;
    for(unsigned i=0;i<=LB_INPUTS;i++)size+=fixed[i].n;
    for(unsigned i=0;i<LB_INPUTS;i++){
        FILE *f=files[i]=fopen(paths[i],"rb");long length;
        if(!f || fseek(f,0,SEEK_END) || (length=ftell(f))<8 || length>64*1024*1024 || fseek(f,0,SEEK_SET)){
            fprintf(stderr,"cannot read %s component (8 bytes to 64 MiB): %s\n",input_roles[i],paths[i]);goto done;
        }
        sizes[i]=(size_t)length;if(size>SIZE_MAX-sizes[i]-6)goto done;size+=sizes[i]+6;
    }
    bytes=malloc(size);if(!bytes){fputs("insufficient memory for component graph\n",stderr);goto done;}
    for(unsigned i=0;i<=LB_INPUTS;i++){
        memcpy(bytes+at,fixed[i].p,fixed[i].n);at+=fixed[i].n;if(i==LB_INPUTS)break;
        bytes[at++]=4;for(uint32_t n=(uint32_t)sizes[i];;n>>=7){bytes[at++]=(n&127)|(n>=128?128:0);if(n<128)break;}
        if(fread(bytes+at,1,sizes[i],files[i])!=sizes[i] || fgetc(files[i])!=EOF || ferror(files[i]) || memcmp(bytes+at,magic,8)){
            fprintf(stderr,"invalid %s component: %s\n",input_roles[i],paths[i]);goto done;
        }
        at+=sizes[i];
    }
    (void)report(wasmtime_component_new(engine,bytes,at,&component));
done:
    free(bytes);for(unsigned i=0;i<LB_INPUTS;i++)if(files[i])fclose(files[i]);return component;
}
#endif
