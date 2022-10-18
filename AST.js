class Type{
    constructor(name, size){
        this.name = name;
        this.size = size;
    }

    IsArray(){
        return this.size!=undefined;
    }
}


class ASTComma{
    constructor(a,b){
        this.a = a;
        this.b = b;
    }

    Emit(wasm){
        this.a.Emit(wasm);
        this.b.Emit(wasm);
    }

    Traverse(nodes){
        this.a.Traverse(nodes);
        this.b.Traverse(nodes);
        nodes.push(this);
    }
}

class ASTIndexIdentifier{
    constructor(name, index){
        this.name = name;
        this.index = index;
    }

    Emit(wasm){
        var indexType = this.index.GetType();
        if(indexType.name != 'i32')
            throw 'ASTIndexIdentifier: Emit: Expecting i32 for indextype';
        if(this.global == undefined)
            throw "ASTIndexIdentifier: Emit: Expecting global";

        wasm.push(Opcode.i32_const, ...signedLEB128(this.global.id));
        this.index.Emit(wasm);
        wasm.push(Opcode.i32_const, ...signedLEB128(4));
        wasm.push(Opcode.i32_mul);
        wasm.push(Opcode.i32_add);
        switch(this.global.type.name){
            case 'i32': wasm.push(Opcode.i32_load); break;
            case 'f32': wasm.push(Opcode.f32_load); break;
            default: throw "ASTIndexIdentifier: Emit: defaulted:"+this.global.type;
        }
        //align and offset???
        wasm.push(...[0x00, 0x00]);
    }

    Traverse(nodes){
        this.index.Traverse(nodes);
        nodes.push(this);
    }

    GetType(){
        return new Type(this.global.type.name);
    }

    SetVariable(wasm, expression){
        var indexType = this.index.GetType();
        if(indexType.name != 'i32')
            throw 'ASTIndexIdentifier: SetVariable: Expecting i32 for indextype';
        if(this.global == undefined)
            throw "ASTIndexIdentifier: SetVariable: Expecting global";

        var from = expression.GetType();
        var to = this.GetType();
        if(from.name != to.name){
            expression = new ASTImplicitConvert(from, to, expression);
        }
        
        wasm.push(Opcode.i32_const, ...signedLEB128(this.global.id));
        this.index.Emit(wasm);
        wasm.push(Opcode.i32_const, ...signedLEB128(4));
        wasm.push(Opcode.i32_mul);
        wasm.push(Opcode.i32_add);
        expression.Emit(wasm);
        switch(to.name){
            case 'i32': wasm.push(Opcode.i32_store); break;
            case 'f32': wasm.push(Opcode.f32_store); break;
            default: throw "ASTIndexIdentifier: SetVariable: defaulted:"+to;
        }
        //align and offset???
        wasm.push(...[0x00, 0x00]);
    }
}

class ASTIdentifier{
    constructor(name){
        this.name = name;
    }

    Emit(wasm){
        if(this.local!=undefined){
            wasm.push(Opcode.get_local, ...unsignedLEB128(this.local.id));
        }
        else{
            if(this.global == undefined)
                throw "ASTIdentifier Expecting local or global"
            wasm.push(Opcode.i32_const, ...signedLEB128(this.global.id));
            switch(this.global.type.name){
                case 'i32': wasm.push(Opcode.i32_load); break;
                case 'f32': wasm.push(Opcode.f32_load); break;
                default: throw "ASTIdentifier defaulted:"+this.global.type;
            }
            //align and offset???
            wasm.push(...[0x00, 0x00]);
        }
    }

    Traverse(nodes){
        nodes.push(this);
    }

    GetType(){
        if(this.local!=undefined)
            return this.local.type;
        else if(this.global!=undefined)
            return this.global.type;
        else
            throw "Expecting local or global";
    }

    SetVariable(wasm, expression){
        if(this.local!=undefined){
            var from = expression.GetType();
            var to = this.local.type;
            if(from.name!=to.name){
                expression = new ASTImplicitConvert(from, to, expression);
            }
            expression.Emit(wasm);
            wasm.push(Opcode.set_local, ...unsignedLEB128(this.local.id));
        }
        else{
            if(this.global==undefined){
                throw "Identifier SetVariable is not local or global";
            }
            var from = expression.GetType();
            var to = this.global.type;
            if(from.name!=to.name){
                expression = new ASTImplicitConvert(from, to, expression);
            }
            wasm.push(Opcode.i32_const, ...signedLEB128(this.global.id));
            expression.Emit(wasm);
            switch(to.name){
                case 'i32': wasm.push(Opcode.i32_store); break;
                case 'f32': wasm.push(Opcode.f32_store); break;
                default: throw 'Identifier SetVariable defaulted';
            }
            //align and offset???
            wasm.push(...[0x00, 0x00]);
        }
    }
}

class ASTConst{
    constructor(value, type){
        this.value = value;
        this.type = type;
    }

    Emit(wasm){
        switch(this.type){
            case 'i32': wasm.push(Opcode.i32_const, ...signedLEB128(this.value)); break;
            case 'f32': wasm.push(Opcode.f32_const, ...ieee754(this.value)); break;
            default: throw 'ASTConst defaulted:'+this.type;
        }
    }

    Traverse(nodes){
        nodes.push(this);
    }

    GetType(){
        return new Type(this.type);
    }
}

class ASTImplicitConvert{
    constructor(from, to, expression){
        this.from = from;
        this.to = to;
        this.expression = expression;
    }

    Emit(wasm){
        this.expression.Emit(wasm);
        var conversion = this.from.name+'->'+this.to.name;
        switch(conversion){
            case 'i32->f32': wasm.push(Opcode.f32_convert_i32_s); break;
            default: throw 'No implicit conversion: '+conversion;
        }
    }

    Traverse(nodes){
        this.expression.Traverse(nodes);
        nodes.push(this);
    }

    GetType(){
        return this.to;
    }
}

class ASTLogicalOp{
    constructor(a,b,op){
        this.a = a;
        this.b = b;
        this.op = op;
    }

    Emit(wasm){
        switch(this.op){
            case '&&':{
                this.a.Emit(wasm);
                wasm.push(Opcode.if);
                wasm.push(Blocktype.i32);
                this.b.Emit(wasm);
                wasm.push(Opcode.else);
                wasm.push(Opcode.i32_const, ...signedLEB128(0));
                wasm.push(Opcode.end);
                break;
            }
            case '||':{
                this.a.Emit(wasm);
                wasm.push(Opcode.if);
                wasm.push(Blocktype.i32);
                wasm.push(Opcode.i32_const, ...signedLEB128(1));
                wasm.push(Opcode.else);
                this.b.Emit(wasm);
                wasm.push(Opcode.end);
                break;
            }
        }
    }

    Traverse(nodes){
        this.a.Traverse(nodes);
        this.b.Traverse(nodes);
        nodes.push(this);
    }

    GetType(){
        return new Type('i32');
    }
}

class ASTBinaryOp{
    constructor(a,b,op){
        this.a=a;
        this.b=b;
        this.op=op;
    }

    Emit(wasm){
        var opType = this.GetOpType();
        this.a.Emit(wasm);
        this.b.Emit(wasm);
        switch(opType.name){
            case 'f32':{
                switch(this.op){
                    case '*': wasm.push(Opcode.f32_mul); break;
                    case '/': wasm.push(Opcode.f32_div); break;
                    case '+': wasm.push(Opcode.f32_add); break;
                    case '-': wasm.push(Opcode.f32_sub); break;
                    case '<': wasm.push(Opcode.f32_lt); break;
                    case '>': wasm.push(Opcode.f32_gt); break;
                    default: throw "BinaryOp f32 Emit defaulted: "+this.op;
                }
                break;
            }
            case 'i32':{
                switch(this.op){
                    case '*': wasm.push(Opcode.i32_mul); break;
                    case '/': wasm.push(Opcode.i32_div); break;
                    case '+': wasm.push(Opcode.i32_add); break;
                    case '-': wasm.push(Opcode.i32_sub); break;
                    case '<': wasm.push(Opcode.i32_lt); break;
                    case '>': wasm.push(Opcode.i32_gt); break;
                    default: throw "BinaryOp i32 Emit defaulted: "+this.op;
                }
                break;
            }
            default:
                throw "BinaryOp optype defaulted"+ opType.name;
        }
        
    }

    Traverse(nodes){
        this.a.Traverse(nodes);
        this.b.Traverse(nodes);
        nodes.push(this);
    }

    GetOpType(){
        var inTypeA = this.a.GetType();
        var inTypeB = this.b.GetType();
        if(inTypeA.name != inTypeB.name){
            if(inTypeA.name == 'f32' && inTypeB.name == 'i32'){
                this.b = new ASTImplicitConvert(inTypeB, inTypeA, this.b);
                return new Type('f32');
            }
            else if(inTypeA.name == 'i32' && inTypeB.name == 'f32'){
                this.a = new ASTImplicitConvert(inTypeA, inTypeB, this.a);
                return new Type('f32');
            }
            else{
                throw 'Cannot implicitly convert: '+inTypeA.name+'->'+inTypeB.name;
            }
        }
        return inTypeA;
    }

    GetType(){
        var opType = this.GetOpType();
        switch(this.op){
            case '*': return opType;
            case '/': return opType;
            case '+': return opType;
            case '-': return opType;
            case '<': return new Type('i32');
            case '>': return new Type('i32');
            default: throw "BinaryOp GetType defaulted: "+this.op;
        }
    }
}

class ASTBody{
    constructor(statements){
        this.statements = statements;
    }

    Emit(wasm){
        for(var s of this.statements){
            s.Emit(wasm);
        }
    }

    Traverse(nodes){
        for(var s of this.statements)
            s.Traverse(nodes);
        nodes.push(this);
    }
}

class ASTArrayInitializer{
    constructor(elementType, size, body){
        this.elementType = elementType;
        this.size = size;
        this.body = body;
    }

    Traverse(nodes){
        this.body.Traverse(nodes);
        nodes.push(this);
    }

    EmitGlobal(wasm, global, opcode){
        for(var i=0;i<this.size;i++){
            wasm.push(Opcode.i32_const, ...signedLEB128(global.id+i*4));
            this.body.Emit(wasm);
            wasm.push(opcode);
            //align and offset???
            wasm.push(...[0x00, 0x00]);
        }
    }

    GetType(){
        return new Type(this.elementType, this.size);
    }
}

class ASTCreateVariable{
    constructor(name, value){
        this.name = name;
        this.value = value;
    }

    EmitPrimitive(wasm, opcode){
        wasm.push(Opcode.i32_const, ...signedLEB128(this.global.id));
        this.value.Emit(wasm);
        wasm.push(opcode);
        //align and offset???
        wasm.push(...[0x00, 0x00]);
    }

    EmitGlobal(wasm){
        if(this.global.type.IsArray()){
            switch(this.global.type.name){
                case 'f32': this.value.EmitGlobal(wasm, this.global, Opcode.f32_store); break;
                case 'i32': this.value.EmitGlobal(wasm, this.global, Opcode.i32_store); break;
                default: 'Array CreateVariable EmitGlobal defaulted';
            }
        }
        else{
            switch(this.global.type.name){
                case 'f32': this.EmitPrimitive(wasm, Opcode.f32_store); break;
                case 'i32': this.EmitPrimitive(wasm, Opcode.i32_store); break;
                default: 'Primitive CreateVariable EmitGlobal defaulted';
            }
        }
        
    }

    Emit(wasm){
        this.value.Emit(wasm);
        wasm.push(Opcode.set_local, ...unsignedLEB128(this.local.id));
    }

    GetType(){
        return this.value.GetType();
    }

    Traverse(nodes){
        this.value.Traverse(nodes);
        nodes.push(this);
    }
}

class ASTSetVariable{
    constructor(variable, expression){
        this.variable = variable;
        this.expression = expression;
    }

    Emit(wasm){
        this.variable.SetVariable(wasm, this.expression);
    }

    Traverse(nodes){
        this.variable.Traverse(nodes);
        this.expression.Traverse(nodes);
        nodes.push(this);
    }
}

class ASTUnaryOp{
    constructor(expression,op){
        this.expression = expression;
        this.op = op;
    }

    Assign(wasm, opcode, constCode, valueBytes, loadCode, storeCode){
        var local = this.expression.local;
        if(local !=undefined){
            wasm.push(Opcode.get_local, ...unsignedLEB128(local.id));
            wasm.push(constCode, ...valueBytes);
            wasm.push(opcode);
            wasm.push(Opcode.set_local, ...unsignedLEB128(local.id));
        }
        else{
            var global = this.expression.global;
            if(global == undefined)
                throw "local and global ids are undefined";
            wasm.push(Opcode.i32_const, ...signedLEB128(global.id));
            wasm.push(Opcode.i32_const, ...signedLEB128(global.id));
            wasm.push(loadCode);
            //align and offset???
            wasm.push(...[0x00, 0x00]);
            wasm.push(constCode, ...valueBytes);
            wasm.push(opcode);
            wasm.push(storeCode);
            //align and offset???
            wasm.push(...[0x00, 0x00]);
        }
    }

    GetType(){
        return this.expression.GetType();
    }

    Emit(wasm){
        switch(this.GetType().name){
            case 'i32':{
                switch(this.op){
                    case 'p': break;
                    case 'm': 
                        wasm.push(i32_const, ...signedLEB128(0));
                        this.expression.Emit(wasm);
                        wasm.push(Opcode.i32_sub);
                        break;
                    case '++':
                        this.Assign(wasm, Opcode.i32_add, Opcode.i32_const, signedLEB128(1), Opcode.i32_load, Opcode.i32_store);
                        break;
                    case '--':
                        this.Assign(wasm, Opcode.i32_sub, Opcode.i32_const, signedLEB128(1), Opcode.i32_load, Opcode.i32_store);
                        break;
                    default: throw "UnaryOp defaulted: "+this.op;
                }
                break;
            }
            case 'f32':{
                switch(this.op){
                    case 'p': break;
                    case 'm': 
                        this.expression.Emit(wasm);
                        wasm.push(Opcode.f32_neg);
                        break;
                    case '++':
                        this.Assign(wasm, Opcode.f32_add, Opcode.f32_const, ieee754(1), Opcode.f32_load, Opcode.f32_store);
                        break;
                    case '--':
                        this.Assign(wasm, Opcode.f32_sub, Opcode.f32_const, ieee754(1), Opcode.f32_load, Opcode.f32_store);
                        break;
                    default: throw "UnaryOp defaulted: "+this.op;
                }
                break;
            }
        }
    }

    Traverse(nodes){
        this.expression.Traverse(nodes);
        nodes.push(this);
    }
}

class ASTIf{
    constructor(expression, body){
        this.expression = expression;
        this.body = body;
    }

    Emit(wasm){
        this.expression.Emit(wasm);
        wasm.push(Opcode.if);
        wasm.push(Blocktype.void);
        this.body.Emit(wasm);
        wasm.push(Opcode.end);
    }

    Traverse(nodes){
        this.expression.Traverse(nodes);
        this.body.Traverse(nodes);
        nodes.push(this);
    }
}

class ASTWhile{
    constructor(expression, body){
        this.expression = expression;
        this.body = body;
    }

    Emit(wasm){
        wasm.push(Opcode.block);
        wasm.push(Blocktype.void);
        wasm.push(Opcode.loop);
        wasm.push(Blocktype.void);
        this.expression.Emit(wasm);
        wasm.push(Opcode.i32_eqz);
        wasm.push(Opcode.br_if);
        wasm.push(...signedLEB128(1));
        this.body.Emit(wasm);
        wasm.push(Opcode.br);
        wasm.push(...signedLEB128(0));
        wasm.push(Opcode.end);
        wasm.push(Opcode.end);
    }

    Traverse(nodes){
        this.expression.Traverse(nodes);
        this.body.Traverse(nodes);
        nodes.push(this);
    }
}

class ASTFor{
    constructor(init, condition, post, body){
        this.init = init;
        this.condition = condition;
        this.post = post;
        this.body = body;
    }

    Emit(wasm){
        this.init.Emit(wasm);
        wasm.push(Opcode.block);
        wasm.push(Blocktype.void);
        wasm.push(Opcode.loop);
        wasm.push(Blocktype.void);
        this.condition.Emit(wasm);
        wasm.push(Opcode.i32_eqz);
        wasm.push(Opcode.br_if);
        wasm.push(...signedLEB128(1));
        this.body.Emit(wasm);
        this.post.Emit(wasm);
        wasm.push(Opcode.br);
        wasm.push(...signedLEB128(0));
        wasm.push(Opcode.end);
        wasm.push(Opcode.end);
    }

    Traverse(nodes){
        this.init.Traverse(nodes);
        this.condition.Traverse(nodes);
        this.post.Traverse(nodes);
        this.body.Traverse(nodes);
        nodes.push(this);
    }
}

class ASTCall{
    constructor(name, args){
        this.name = name;
        this.args = args;
    }

    Emit(wasm){
        if(this.args.length != this.func.args.length)
            throw "wrong number of arguments: "+this.name;
        for(var i=0;i<this.args.length;i++){
            var from = this.args[i].GetType();
            var to = new Type(this.func.args[i].type);
            if(from.name != to.name){
                this.args[i] = new ASTImplicitConvert(from, to, this.args[i]);
            }
        }
        for(var a of this.args)
            a.Emit(wasm);
        wasm.push(Opcode.call, ...unsignedLEB128(this.func.funcID));
    }

    GetType(){
        return new Type(this.func.returnType);
    }

    Traverse(nodes){
        for(var a of this.args)
            a.Traverse(nodes);
        nodes.push(this);
    }
}

class ASTArg{
    constructor(type, name){
        this.type = type;
        this.name = name;
    }
}

class ASTImportFunction{
    constructor(name, args, returnType, body){
        this.name = name;
        this.args = args;
        this.returnType = returnType;
        this.body = body;
    }

    Traverse(nodes){
        nodes.push(this);
    }
}

class Variable{
    constructor(id, type){
        this.id = id;
        this.type = type;
    }
}

class ASTFunction{
    constructor(_export, name, args, returnType, body){
        this._export = _export;
        this.name = name;
        this.args = args;
        this.returnType = returnType;
        this.body = body;
    }

    Traverse(nodes){
        this.body.Traverse(nodes);
        nodes.push(this);
    }

    CalcVariables(globals){
        var args = new Map();
        var locals = new Map();
        for(var i=0;i<this.args.length;i++){
            args.set(this.args[i].name, new Variable(i, new Type(this.args[i].type)));
        }

        for(var n of Traverse(this)){
            if(n.constructor.name == 'ASTCreateVariable'){
                if(locals.has(n.name))
                    throw "Local already found:"+n.name;
                n.local = new Variable(-1, n.GetType());
                locals.set(n.name, n.local);
            }
            else if(n.constructor.name == 'ASTIdentifier' || n.constructor.name == 'ASTIndexIdentifier'){
                n.local = args.get(n.name);
                if(n.local == undefined){
                    n.local = locals.get(n.name);
                    if(n.local == undefined){
                        n.global = globals.get(n.name);
                        if(n.global == undefined)
                            throw "Variable has no declaration: "+n.name;
                    }
                }
            }
        }
        var id = this.args.length;
        this.f32LocalCount = 0;
        for(var l of locals.values()){
            if(l.type.name == 'f32'){
                l.id = id;
                id++;
                this.f32LocalCount++;
            }
        }
        this.i32LocalCount = 0;
        for(var l of locals.values()){
            if(l.type.name == 'i32'){
                l.id = id;
                id++;
                this.i32LocalCount++;
            }
        }
    }
}

class AST{
    constructor(body){
        this.body = body;
    } 

    CalcCalls(){
        var importFunctions = this.body.filter(b=>b.constructor.name == 'ASTImportFunction');
        var functions = this.body.filter(b=>b.constructor.name == 'ASTFunction');
        for(var i=0;i<importFunctions.length;i++)
            importFunctions[i].funcID = i;
        for(var i=0;i<functions.length;i++)
            functions[i].funcID = i+importFunctions.length;
        
        var funcMap = new Map();
        for(var f of importFunctions)
            funcMap.set(f.name, f);
        for(var f of functions)
            funcMap.set(f.name, f);

        for(var n of Traverse(this)){
            if(n.constructor.name == 'ASTCall' || n.constructor.name == 'ASTEmptyCall'){
                n.func = funcMap.get(n.name);
                if(n.func == undefined)
                    throw "Calling Unknown function: "+n.name;
            }
        }
    }

    CalcVariables(){
        var globals = new Map();
        var id = 0;
        for(var n of this.body){
            if(n.constructor.name == 'ASTCreateVariable'){
                if(globals.has(n.name))
                    throw "Globals already contains var: "+v.name;
                var type = n.GetType();
                n.global = new Variable(id, type);
                globals.set(n.name, n.global);
                
                if(type.IsArray())
                    id+=parseInt(type.size*4);
                else
                    id+=4;
            }
        }

        var functions = this.body.filter(b=>b.constructor.name == 'ASTFunction');
        for(var f of functions){
            f.CalcVariables(globals);
        }
    }

    Traverse(nodes){
        for(var o of this.body){
            o.Traverse(nodes);
        }
        nodes.push(this);
    }
}

function Traverse(ast){
    var nodes = [];
    ast.Traverse(nodes);
    return nodes;
}