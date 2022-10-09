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
        wasm.push(Opcode.get_local, ...unsignedLEB128(this.localID));
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

class ASTSetLocal{
    constructor(local, expression){
        this.local = local;
        this.expression = expression;
    }

    Emit(wasm){
        this.expression.Emit(wasm);
        wasm.push(Opcode.set_local, ...unsignedLEB128(this.local.localID));
    }

    Traverse(nodes){
        this.local.Traverse(nodes);
        this.expression.Traverse(nodes);
        nodes.push(this);
    }
}

class ASTUnaryOp{
    constructor(expression,op){
        this.expression = expression;
        this.op = op;
    }

    Emit(wasm){
        this.expression.Emit(wasm);
        switch(this.op){
            case 'p': break;
            case 'm': wasm.push(Opcode.f32_neg); break;
            default: throw "UnaryOp defaulted: "+this.op;
        }
    }

    Traverse(nodes){
        this.expression.Traverse(nodes);
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
    constructor(name, args, returnType, body){
        this.name = name;
        this.args = args;
        this.returnType = returnType;
        this.body = body;
    }

    Traverse(nodes){
        this.body.Traverse(nodes);
        nodes.push(this);
    }

    CalcLocals(){
        var vars = new Map();
        for(var i=0;i<this.args.length;i++){
            vars.set(this.args[i].name, i);
        }

        for(var n of Traverse(this)){
            if(n.constructor.name == 'ASTIdentifier'){
                n.localID = vars.get(n.name);
                if(n.localID==undefined){
                    n.localID = vars.size;
                    vars.set(n.name, vars.size);
                }
            }
        }
        return vars.size;
    }
}

class AST{
    constructor(body){
        this.body = body;
    } 

    CalcCalls(){
        var functions = ast.body.filter(b=>b.constructor.name == 'ASTFunction');
        var importFunctions = ast.body.filter(b=>b.constructor.name == 'ASTImportFunction');

        var funcs = new Map();
        for(var f of importFunctions)
            funcs.set(f.name, funcs.size);
        for(var f of functions)
            funcs.set(f.name, funcs.size);

        for(var n of Traverse(this)){
            if(n.constructor.name == 'ASTCall' || n.constructor.name == 'ASTEmptyCall'){
                var id = funcs.get(n.name);
                if(id == undefined)
                    throw "Calling Unknown function: "+n.name;
                n.funcID = id;
                console.log(n.name, n.funcID);
            }
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