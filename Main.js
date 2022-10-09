var code = `

f32 Six(){
    6;
}

f32 Sub(f32 a, f32 b){
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

var div= document.createElement('div');
document.body.appendChild(div);
var button = document.createElement('button');
div.appendChild(button);
button.innerHTML = 'Compile and run';
button.onclick = ()=>{
    CompileAndRun(textarea.value);
};

var textarea = document.createElement('textarea');
textarea.rows = '20';
textarea.cols = '100';
textarea.value = code;
textarea.addEventListener('keydown', (e)=>{
    if (e.key == 'Tab') {
        e.preventDefault();
        var start = textarea.selectionStart;
        var end = textarea.selectionEnd;
    
        textarea.value = textarea.value.substring(0, start) + "\t" + textarea.value.substring(end);
    
        textarea.selectionStart =
        textarea.selectionEnd = start + 1;
    }
});
document.body.appendChild(textarea);


