
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

class ASTIdentifier{
    constructor(name){
        this.name = name;
    }

    Emit(wasm){
        if(this.localID!=undefined){
            wasm.push(Opcode.get_local, ...unsignedLEB128(this.localID));
        }
        else{
            if(this.globalID == undefined)
                throw "Expecting localID or globalID"
            wasm.push(Opcode.i32_const, ...signedLEB128(0));
            wasm.push(Opcode.f32_load);
            //align and offset???
            wasm.push(...[0x00, 0x00]);
        }
    }

    Traverse(nodes){
        nodes.push(this);
    }
}

class ASTF32Const{
    constructor(value){
        this.value = value;
    }

    Emit(wasm){
        wasm.push(Opcode.f32_const, ...ieee754(this.value));
    }

    Traverse(nodes){
        nodes.push(this);
    }
}

class ASTI32Const{
    constructor(value){
        this.value = value;
    }

    Emit(wasm){
        wasm.push(Opcode.f32_const, ...ieee754(this.value));
    }

    Traverse(nodes){
        nodes.push(this);
    }
}

class ASTBinaryOP{
    constructor(a,b,op){
        this.a=a;
        this.b=b;
        this.op=op;
    }

    Emit(wasm){
        this.a.Emit(wasm);
        this.b.Emit(wasm);
        switch(this.op){
            case '*': wasm.push(Opcode.f32_mul); break;
            case '/': wasm.push(Opcode.f32_div); break;
            case '+': wasm.push(Opcode.f32_add); break;
            case '-': wasm.push(Opcode.f32_sub); break;
            case '<': wasm.push(Opcode.f32_lt); break;
            case '>': wasm.push(Opcode.f32_gt); break;
            default: throw "BinaryOp defaulted: "+this.op;
        }
    }

    Traverse(nodes){
        this.a.Traverse(nodes);
        this.b.Traverse(nodes);
        nodes.push(this);
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

class ASTVar{
    constructor(name, expression){
        this.name = name;
        this.expression = expression;
    }

    Emit(wasm){
        this.expression.Emit(wasm);
        wasm.push(Opcode.set_local, ...unsignedLEB128(this.localID));
    }

    Traverse(nodes){
        this.expression.Traverse(nodes);
        nodes.push(this);
    }
}

class ASTSetVariable{
    constructor(variable, expression){
        this.variable = variable;
        this.expression = expression;
    }

    Emit(wasm){
        if(this.variable.localID!=undefined){
            this.expression.Emit(wasm);
            wasm.push(Opcode.set_local, ...unsignedLEB128(this.variable.localID));
        }
        else{
            wasm.push(Opcode.i32_const, ...signedLEB128(this.variable.globalID));
            this.expression.Emit(wasm);
            wasm.push(Opcode.f32_store);
            //align and offset???
            wasm.push(...[0x00, 0x00]);
        }
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

    IncrementOrDecrement(wasm, opcode){
        var localID = this.expression.localID;
        if(localID !=undefined){
            wasm.push(Opcode.get_local, ...unsignedLEB128(localID));
            wasm.push(Opcode.f32_const, ...ieee754(1));
            wasm.push(opcode);
            wasm.push(Opcode.set_local, ...unsignedLEB128(localID));
        }
        else{
            var globalID = this.expression.globalID;
            if(globalID == undefined)
                throw "local and global ids are undefined";
            wasm.push(Opcode.i32_const, ...signedLEB128(globalID));
            wasm.push(Opcode.i32_const, ...signedLEB128(globalID));
            wasm.push(Opcode.f32_load);
            //align and offset???
            wasm.push(...[0x00, 0x00]);
            wasm.push(Opcode.f32_const, ...ieee754(1));
            wasm.push(opcode);
            wasm.push(Opcode.f32_store);
            //align and offset???
            wasm.push(...[0x00, 0x00]);
        }
    }

    Emit(wasm){
        switch(this.op){
            case 'p': break;
            case 'm': 
                this.expression.Emit(wasm);
                wasm.push(Opcode.f32_neg);
                break;
            case '++':
                this.IncrementOrDecrement(wasm, Opcode.f32_add);
                break;
            case '--':
                this.IncrementOrDecrement(wasm, Opcode.f32_sub);
                break;
            default: throw "UnaryOp defaulted: "+this.op;
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
        wasm.push(Opcode.block);
        wasm.push(Blocktype.void);
        this.expression.Emit(wasm);
        wasm.push(Opcode.i32_eqz);
        wasm.push(Opcode.br_if);
        wasm.push(...signedLEB128(0));
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
    constructor(name, argExpression){
        this.name = name;
        this.argExpression = argExpression;
    }

    Emit(wasm){
        this.argExpression.Emit(wasm);
        wasm.push(Opcode.call, ...unsignedLEB128(this.funcID));
    }

    Traverse(nodes){
        this.argExpression.Traverse(nodes);
        nodes.push(this);
    }
}

class ASTEmptyCall{
    constructor(name){
        this.name = name;
    }

    Emit(wasm){
        wasm.push(Opcode.call, ...unsignedLEB128(this.funcID));
    }

    Traverse(nodes){
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
        var locals = new Map();
        for(var i=0;i<this.args.length;i++){
            locals.set(this.args[i].name, i);
        }

        for(var n of Traverse(this)){
            if(n.constructor.name == 'ASTVar'){
                if(locals.has(n.name))
                    throw "Local already found:"+n.name;
                n.localID = locals.size;
                locals.set(n.name, n.localID);
            }
            else if(n.constructor.name == 'ASTIdentifier'){
                n.localID = locals.get(n.name);
                if(n.localID == undefined){
                    n.globalID = globals.get(n.name);
                    if(n.globalID == undefined)
                        throw "Variable has not declaration: "+n.name;
                }
            }
        }
        this.localCount = locals.size;
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
        
        var funcs = new Map();
        for(var f of importFunctions)
            funcs.set(f.name, f);
        for(var f of functions)
            funcs.set(f.name, f);

        for(var n of Traverse(this)){
            if(n.constructor.name == 'ASTCall' || n.constructor.name == 'ASTEmptyCall'){
                var f = funcs.get(n.name);
                if(f == undefined)
                    throw "Calling Unknown function: "+n.name;
                n.funcID = f.funcID;
            }
        }
    }

    CalcVariables(){
        var vars = this.body.filter(b=>b.constructor.name == 'ASTVar');
        var globals = new Map();
        for(var v of vars){
            if(globals.has(v.name))
                throw "Globals already contains var: "+v.name;
            globals.set(v.name, globals.size*4);
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