var code = `

f32 Six(){
    6;
}

f32 Sub(f32 a,f32 b){
    a-b;
}

f32 Test(f32 a, f32 b, f32 c){
    a+b+c;
}

f32 main(){
    x=Sub(Six(),Test(-4+2*4,Sub(-4-2*5,3),3));
    x;
} 
`;

CompileAndRun(code);