var code = `
import void Init() #{
    var canvas = document.createElement('canvas');
    output.appendChild(canvas);
    canvas.width = 800;
    canvas.height = 600;
    global.ctx = canvas.getContext('2d');

    addEventListener('keydown', e=>{
        if(e.key == 'ArrowLeft')
            exports.KeyLeft(2);
        if(e.key == 'ArrowRight')
            exports.KeyRight(2);
    });
    addEventListener('keyup', e=>{
        if(e.key == 'ArrowLeft')
            exports.KeyLeft(0);
        if(e.key == 'ArrowRight')
            exports.KeyRight(0);
    });
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

import void DrawGameOver() #{
    var ctx = global.ctx;
    ctx.fillStyle = 'red';
    ctx.font = '200px Arial';
    ctx.fillText("GAME", 100, 200);
    ctx.fillText("OVER", 100, 400);

}#

import void DrawTriangle(f32 x, f32 y, f32 radius, f32 r, f32 g, f32 b) #{
    var ctx = global.ctx;
    ctx.fillStyle = 'rgb('+r*255+','+g*255+','+b*255+')';
    ctx.beginPath();
    ctx.moveTo(x-radius, y+radius);
    ctx.lineTo(x, y-radius);
    ctx.lineTo(x+radius, y+radius);
    ctx.fill();
}#

import void DrawSpeed(f32 x, f32 y, f32 value) #{
    var ctx = global.ctx;
    ctx.fillStyle = 'white';
    ctx.font = '30px Arial';
    ctx.fillText("Speed:"+value, x, y);
}#

import void CallNextUpdateFunc() #{
    requestAnimationFrame(exports.Update);
}#

import f32 Random() #{
    return Math.random();
}#

export void KeyLeft(f32 value){
    keyLeft = value;
}

export void KeyRight(f32 value){
    keyRight = value;
}

export void Update(){
    DrawRect(0,0,800,600,0,0,0);
    playerX = playerX - keyLeft + keyRight;
    if(playerX<0)
        playerX = 0;
    if(playerX>800)
        playerX = 800;
    for(i := 0; i < 10 ; i++){
        DrawCircle(rockX[i], rockY[i], 40, i/5.,0,1);
        rockY[i] = rockY[i]+speed;
        if(rockY[i]>600){
            rockY[i] = 0;
            rockX[i] = Random()*800;
        }
        if(rockX[i]>playerX-40 && rockX[i]<playerX+40 && rockY[i]>460 && rockY[i]<540)
            dead=1;
    }
    DrawTriangle(playerX, 500, 25, 0,1,0);
    speed = speed + 0.0005;
    DrawSpeed(50,50,speed);
    if(dead<1)
        CallNextUpdateFunc();
    if(dead>0)
        DrawGameOver();
}

dead := 0;
speed := 1.;
playerX := 400.;
keyLeft := 0.;
keyRight := 0.;
rockX := array<f32>(10){ Random()*800; }
rockY := array<f32>(10){ Random()*600; }

export void main(){
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