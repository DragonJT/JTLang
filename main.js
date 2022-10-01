var canvas = document.createElement('canvas');
document.body.appendChild(canvas);
canvas.width = 800;
canvas.height = 600;
var ctx = canvas.getContext('2d');

function Run(wasm){
    WebAssembly.instantiate(wasm, {}).then(
        (obj) => {
            ctx.fillStyle = 'white';
            ctx.fillText("Result: "+obj.instance.exports.run(), 0, 80);
        }
    );
}

function Emit(ast){
    //copied quite a lot from https://github.com/ColinEberhardt/chasm

    const ieee754 = (n) => {
        var data = new Float32Array([n]);
        var buffer = new ArrayBuffer(data.byteLength);
        var floatView = new Float32Array(buffer).set(data);
        return new Uint8Array(buffer);
    };

    const encodeString = (str) => [
        str.length,
        ...str.split("").map(s => s.charCodeAt(0))
    ];

    const signedLEB128 = (n) => {
        const buffer = [];
        let more = true;
        const isNegative = n < 0;
        const bitCount = Math.ceil(Math.log2(Math.abs(n))) + 1;
        while (more) {
            let byte = n & 0x7f;
            n >>= 7;
            if (isNegative) {
                n = n | -(1 << (bitCount - 8));
            }
            if ((n === 0 && (byte & 0x40) === 0) || (n === -1 && (byte & 0x40) !== 0x40)) {
                more = false;
            } else {
                byte |= 0x80;
            }
            buffer.push(byte);
        }
        return buffer;
    };

    const unsignedLEB128 = (n) => {
        const buffer = [];
        do {
            let byte = n & 0x7f;
            n >>>= 7;
            if (n !== 0) {
                byte |= 0x80;
            }
            buffer.push(byte);
        } while (n !== 0);
        return buffer;
    };

    //=============================

    const flatten = (arr) => [].concat.apply([], arr);

    // https://webassembly.github.io/spec/core/binary/modules.html#sections
    const Section = {
        custom: 0,
        type: 1,
        import: 2,
        func: 3,
        table: 4,
        memory: 5,
        global: 6,
        export: 7,
        start: 8,
        element: 9,
        code: 10,
        data: 11
    };

    // https://webassembly.github.io/spec/core/binary/types.html
    const Valtype = {
        i32: 0x7f,
        f32: 0x7d
    };

    // https://webassembly.github.io/spec/core/binary/types.html#binary-blocktype
    const Blocktype = {
        void: 0x40
    }

    // https://webassembly.github.io/spec/core/binary/instructions.html
    const Opcode = {
        block: 0x02,
        loop: 0x03,
        br: 0x0c,
        br_if: 0x0d,
        end: 0x0b,
        call: 0x10,
        get_local: 0x20,
        set_local: 0x21,
        i32_store_8: 0x3a,
        i32_const: 0x41,
        f32_const: 0x43,
        i32_eqz: 0x45,
        i32_eq: 0x46,
        f32_eq: 0x5b,
        f32_lt: 0x5d,
        f32_gt: 0x5e,
        i32_and: 0x71,
        f32_add: 0x92,
        f32_sub: 0x93,
        f32_mul: 0x94,
        f32_div: 0x95,
        i32_trunc_f32_s: 0xa8
    }

    // http://webassembly.github.io/spec/core/binary/modules.html#export-section
    const ExportType = {
        func: 0x00,
        table: 0x01,
        mem: 0x02,
        global: 0x03
    }

    // http://webassembly.github.io/spec/core/binary/types.html#function-types
    const functionType = 0x60;

    const emptyArray = 0x0;

    // https://webassembly.github.io/spec/core/binary/modules.html#binary-module
    const magicModuleHeader = [0x00, 0x61, 0x73, 0x6d];
    const moduleVersion = [0x01, 0x00, 0x00, 0x00];

    // https://webassembly.github.io/spec/core/binary/conventions.html#binary-vec
    // Vectors are encoded with their length followed by their element sequence
    const encodeVector = (data) => [
        ...unsignedLEB128(data.length),
        ...flatten(data)
    ];

    // https://webassembly.github.io/spec/core/binary/modules.html#code-section
    const encodeLocal = (count, valtype) => [
        ...unsignedLEB128(count),
        valtype
    ];

    // https://webassembly.github.io/spec/core/binary/modules.html#sections
    // sections are encoded by their type followed by their vector contents
    const createSection = (sectionType, data) => [
        sectionType,
        ...encodeVector(data)
    ];

    const funcType = [
        functionType,
        emptyArray,
        ...encodeVector([Valtype.f32]),
    ];

    const f32Operator = {
        '+': Opcode.f32_add,
        '-': Opcode.f32_sub,
        '*': Opcode.f32_mul,
        '/': Opcode.f32_div,
    }

    const typeSection = createSection(Section.type, encodeVector([funcType]));

    const importSection = createSection(Section.import, [emptyArray]);

    const funcSection = createSection(Section.func, encodeVector([unsignedLEB128(0)]));

    const exportSection = createSection(
        Section.export,
        encodeVector([
            [
                ...encodeString("run"),
                ExportType.func,
                unsignedLEB128(0),
            ]
        ])
    );

    function EmitOperator(valtype, operator){
        var value = f32Operator[operator];
        if(value == undefined)
            throw "Unknown f32 operator:"+operator;
        return value;
    }

    function EmitNode(node){
        switch(node.type){
            case 'Identifier': return [Opcode.get_local, ...unsignedLEB128(node.local.id)];
            case 'Int': 
                //return [Opcode.i32_const, ...unsignedLEB128(parseInt(node.value))];
                return [Opcode.f32_const, ...ieee754(parseFloat(node.value))];
            case 'Float': return [Opcode.f32_const, ...ieee754(parseFloat(node.value))];
            case 'ExpressionAB': return [...EmitNode(node.a), ...EmitNode(node.b), EmitOperator(Valtype.f32, node.value)];
            case 'SetLocal': return [...EmitNode(node.b), Opcode.set_local, ...unsignedLEB128(node.a.local.id)];
            case 'MultiLine': return [...EmitNode(node.a), ...EmitNode(node.b)];
            default: throw "Unknown node type:"+node.type;
        }
    }

    function FindLocals(locals, node){

        function AddLocal(name){
            var local = locals.find(l=>l.name == name);
            if(local == undefined){
                local = {name:name};
                locals.push(local);
            }
            return local;
        }

        switch(node.type){
            case 'Identifier': node.local = AddLocal(node.value); break;
            case 'Int': break;
            case 'Float': break;
            case 'ExpressionAB':
                FindLocals(locals, node.a); 
                FindLocals(locals, node.b);
                break; 
            case 'SetLocal':
                FindLocals(locals, node.a);
                FindLocals(locals, node.b);
                break;
            case 'MultiLine':
                FindLocals(locals, node.a);
                FindLocals(locals, node.b);
                break;
        }
        return locals;
    }


    function EmitFunction(ast){
        var locals = [];
        FindLocals(locals, ast);
        for(var i=0;i<locals.length;i++)
            locals[i].id = i;
        var encodeLocals = locals.length > 0 ? [encodeLocal(locals.length, Valtype.f32)] : [];        
        return encodeVector([ ...encodeVector(encodeLocals), ...EmitNode(ast), Opcode.end])
    }

    const codeSection = createSection(Section.code, encodeVector([EmitFunction(ast)]));

    return Uint8Array.from([
        ...magicModuleHeader,
        ...moduleVersion,
        ...typeSection,
        ...importSection,
        ...funcSection,
        ...exportSection,
        ...codeSection
    ]);
}

function Parse(tokens){
    function Precedence(op){
        switch(op){
            case '=': return 3;
            case '+': return 2;
            case '-': return 2;
            case '*': return 1;
            case '/': return 1;
        }
        throw "operator not found: "+op;
    }

    function ASTType(op){
        switch(op){
            case '=': return "SetLocal";
            default: return "ExpressionAB";
        }
    }

    function FindNextOperator(tokens){
        var minPrecedence = Number.MAX_VALUE;
        var minIndex = -1;
        var minOp = undefined;
        for(var i=tokens.length-1;i>=0;i--){
            if(tokens[i].type == 'operator'){
                var precedence = Precedence(tokens[i].value);
                if(precedence<minPrecedence){
                    minPrecedence = precedence;
                    minIndex = i;
                    minOp = tokens[i].value;
                }
            }
        }
        var noOpPrecedence = 4;
        if(minPrecedence>noOpPrecedence){
            for(var i=tokens.length-2;i>=0;i--){
                if(tokens[i].type != 'operator' && tokens[i+1].type != 'operator'){
                    return {index:i, operator:''};
                }
            }
        }
        return {index:minIndex, operator:minOp};
    }

    function RemoveWhitespace(tokens){
        var result = [];
        for(var t of tokens){
            if(t.type != 'whitespace')
                result.push(t);
        }
        return result;
    }

    function ReplaceOperator(tokens, index, value){
        var result = [];
        result.push(...tokens.slice(0, index-1));
        result.push(value);
        result.push(...tokens.slice(index+2));
        return result;
    }

    function ReplaceEmptyOperator(tokens, index, value){
        var result = [];
        result.push(...tokens.slice(0, index));
        result.push(value);
        result.push(...tokens.slice(index+2));
        return result;
    }

    function ParseExpression(tokens){
        while(tokens.length>1){
            var op = FindNextOperator(tokens);
            var index = op.index;
            if(index==-1){
                console.log("cant parse:",tokens);
                throw "cant parse expression:"+tokens;
            }
            if(op.operator == ''){
                tokens = ReplaceEmptyOperator(tokens, index, {type:'MultiLine', a:tokens[index], b:tokens[index+1] });
            }
            else{
                tokens = ReplaceOperator(tokens, index, {type:ASTType(op.operator), value:tokens[index].value, a:tokens[index-1], b:tokens[index+1]});
            }
        }
        return tokens[0];
    }

    tokens = RemoveWhitespace(tokens);
    return ParseExpression(tokens);
}

function Tokenize(code){
    var index = 0;
    code+='\0';

    function IsDigit(c){
        return c>='0' && c<='9';
    }

    function IsCharacter(c){
        return (c>='a' && c<='z') || (c>='A' && c<='Z') || (c=='_');
    }

    function CreateToken(type, start){
         return {type:type, value:code.substring(start, index), start:start, end:index};
    }

    function TokenizeOperator(value){
        var token = {type:"operator", value:value, start:index, end:index+value.length};
        index+=value.length;
        return token;
    }

    function TokenizeWhitespace(value){
        var token = {type:"whitespace", value:value, start:index, end:index+value.length};
        index+=value.length;
        return token;
    }

    function TokenizeNumber(){
        var start = index;
        var decimalPoint = false;
        while(true){
            if(code[index]=='.'){
                if(decimalPoint)
                    throw "Only one decimal point allowed";
                decimalPoint=true;
                index++;
            }
            else if(IsDigit(code[index])){
                index++;
            }
            else{
                if(decimalPoint)
                    return CreateToken('Float', start);
                else
                    return CreateToken('Int', start);
            }
        }
    }

    function TokenizeIdentifier(){
        var start = index;
        while(true){
            if(IsCharacter(code[index])){
                index++;
            }
            else{
                return CreateToken('Identifier', start);
            }
        }
    }

    function NextToken(){
        var c = code[index];
        if(IsDigit(c))
            return TokenizeNumber();
        if(IsCharacter(c))
            return TokenizeIdentifier();
        switch(c){
            case ' ': return TokenizeWhitespace(' ');
            case '=': return TokenizeOperator('=');
            case '+': return TokenizeOperator('+');
            case '-': return TokenizeOperator('-');
            case '*': return TokenizeOperator('*');
            case '/': return TokenizeOperator('/');
            case '\0': return {type:'EOF'};
        }
        throw "Cant tokenize:"+c;
    }

    var tokens = []
    while(true){
        var token = NextToken();
        if(token.type == 'EOF')
            return tokens;
        tokens.push(token);
    }
}

function CodeEditor(){
    var lastCode = "";
    var code = "";
    var fontSize = 20;

    function Update(){
        try{
            var tokens = Tokenize(code);
            var x = 0;
            ctx.fillStyle = 'black';
            ctx.fillRect(0,0,canvas.width,canvas.height);
            ctx.font = fontSize+'px Arial';

            for(var t of tokens){
                if(t.type == 'Whitespace'){
                    if(t.value == ' ')
                        x+=ctx.measureText(' ').width;
                }
                else{
                    if(t.type == 'Float' || t.type == 'Int'){
                        ctx.fillStyle = 'rgb(100,200,255)';
                    }
                    else{
                        ctx.fillStyle = 'white';
                    }
                    ctx.fillText(t.value, x, fontSize);
                    x+=ctx.measureText(t.value).width;
                }
            }
            lastCode = code;
            try{
                var ast = Parse(tokens);
                console.log(ast);
                var wasm = Emit(ast);
                Run(wasm);
            }
            catch(e){
                console.log(e);
            }
        }
        catch(e){
            console.log(e);
            code = lastCode;
        }
    }

    function OnKeyDown(e){
        if(e.key.length == 1){
            code+=e.key;
        }
        else if(e.key == 'Backspace'){
            if(code.length>0)
                code=code.substring(0, code.length-1)
        }
        else
            console.log(e.key);
        Update();
    }

    document.addEventListener('keydown', OnKeyDown);
    Update();
}

CodeEditor();