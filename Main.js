var code = `
import void Init() #{
    var canvas = document.createElement('canvas');
    output.appendChild(canvas);
    canvas.width = 800;
    canvas.height = 600;
    global.ctx = canvas.getContext('2d');
}#

import void DrawRect(f32 x, f32 y, f32 w, f32 h, f32 r, f32 g, f32 b) #{
    var ctx = global.ctx;
    ctx.fillStyle = 'rgb('+r*255+','+g*255+','+b*255+')';
    ctx.fillRect(x,y,w,h);
}#

import void DrawCircle(f32 x, f32 y, f32 radius, f32 r, f32 g, f32 b) #{
    var ctx = global.ctx;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, 2 * Math.PI, false);
    ctx.fillStyle = 'rgb('+r*255+','+g*255+','+b*255+')';
    ctx.fill();
}#

import void DrawFloat(f32 x, f32 y, f32 value) #{
    var ctx = global.ctx;
    ctx.fillStyle = 'white';
    ctx.font = '30px Arial';
    ctx.fillText("Float:"+value, x, y);
}#

import void DrawInt(f32 x, f32 y, i32 value) #{
    var ctx = global.ctx;
    ctx.fillStyle = 'white';
    ctx.font = '30px Arial';
    ctx.fillText("Int:"+value, x, y);
}#

import void CallNextUpdateFunc() #{
    requestAnimationFrame(exports.Update);
}#

export void Update(){
    DrawRect(0,0,800,600,0,0,0);
    DrawCircle(100,100,50,1,0,0);
    DrawCircle(150,175,50,0,1,0);
    DrawCircle(200,175,25,0,0,1);
    DrawCircle(250,100,75,1,1,0);

    var x = 0.;
    for(x=0;x<10;x++){
        DrawCircle(100+x*50,10+y,50,x/10,1,0);
    }
    for(x=0;x<10;x++){
        DrawCircle(100+x*50,40+y2,50,0,x/10,1);
    }
    DrawFloat(100,100,y);
    DrawFloat(100,200,y2);

    CallNextUpdateFunc();
    y++;
    y2=y2+1.5;

    if(y>600)
        y=0;
    if(y2>600)
        y2=0;
}

export void main(){
    global_var y = 0.;
    global_var y2 = 300.;
    Init();
    CallNextUpdateFunc();
}
`;

var div= document.createElement('div');
document.body.appendChild(div);
var button = document.createElement('button');
div.appendChild(button);
button.innerHTML = 'Compile and run';
button.onclick = ()=>{
    CompileAndRun(textarea.value, output);
};

var textarea = document.createElement('textarea');
textarea.rows = '20';
textarea.cols = '100';
textarea.spellCheck = 'false';
textarea.value = code;
textarea.addEventListener('keydown', (e)=>{
    if (e.key == 'Tab') {
        e.preventDefault();
        var start = textarea.selectionStart;
        var end = textarea.selectionEnd;
    
        textarea.value = textarea.value.substring(0, start) + "    " + textarea.value.substring(end);
    
        textarea.selectionStart =
        textarea.selectionEnd = start + 4;
    }
});
document.body.appendChild(textarea);
var output = document.createElement('div');
document.body.appendChild(output);