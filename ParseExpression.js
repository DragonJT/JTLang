//binaryop = 2 values
//unaryop = 1 value

function ParseUnaryOperators(tokens){
    function IsTerminal(i){
        if(i<0)
            return false;
        return (tokens[i].type == TokenType.Identifier || tokens[i].type == TokenType.Int || tokens[i].type == TokenType.Float || tokens[i].type == ')')
    }

    for(var i=0;i<tokens.length;i++){
        if(tokens[i].type == '-' && !IsTerminal(i-1))
            tokens[i].type = 'm';
        else if(tokens[i].type == '+' && !IsTerminal(i-1))
            tokens[i].type = 'p';
    }
}

function ParseFunctionCalls(tokens){
    for(var i=0;i<tokens.length-2;i++){
        if(tokens[i].type == TokenType.Identifier && tokens[i+1].type == '('){
            if(tokens[i+2].type == ')')
                tokens[i].type = TokenType.EmptyCall;
            else
                tokens[i].type = TokenType.Call;
        }
    }
}

//shunting yard algorithm
//https://www.andr.mu/logs/the-shunting-yard-algorithm/
function ParseExpression(tokens){
    ParseUnaryOperators(tokens);
    ParseFunctionCalls(tokens);
    var stack = [];
    var output = [];

    const AssociativeType={
        Left:0,
        Right:1,
    };

    const TermType={
        Operand:0,
        UnaryPostfixOperator:1,
        UnaryPrefixOperator:2,
        Operator:3,
        LeftParenthesis:4,
        RightParenthesis:5,
        Call:6,
    };

    function Term(type){
        switch(type){
            case TokenType.Call: return TermType.Call;
            case TokenType.EmptyCall: return TermType.Operand;
            case TokenType.Identifier: return TermType.Operand;
            case TokenType.Int: return TermType.Operand;
            case TokenType.Float: return TermType.Operand;
            case '=': return TermType.Operator;
            case '+': return TermType.Operator;
            case '-': return TermType.Operator;
            case 'p': return TermType.UnaryPrefixOperator;
            case 'm': return TermType.UnaryPrefixOperator;
            case '*': return TermType.Operator;
            case '/': return TermType.Operator;
            case '(': return TermType.LeftParenthesis;
            case ')': return TermType.RightParenthesis;
            case ',': return TermType.Operator;
            default: throw "Type defaulted:"+type;
        }
    }

    function Precedence(type){
        switch(type){
            case '=': return 0;
            case '(': return 1;
            case ')': return 1;
            case ',': return 1;
            case '+': return 2;
            case '-': return 2;
            case 'p': return 3;
            case 'm': return 3;
            case '*': return 4;
            case '/': return 4;
            default: throw "Precedence defaulted:"+type;
        }
    }

    function Associative(type){
        switch(type){
            case '=': return AssociativeType.Left;
            case '+': return AssociativeType.Left;
            case '-': return AssociativeType.Left;
            case 'p': return AssociativeType.Right;
            case 'm': return AssociativeType.Right;
            case '*': return AssociativeType.Left;
            case '/': return AssociativeType.Left;
            case ',': return AssociativeType.Left;
            default: throw "Associative defaulted:"+type;
        }
    }

    for(var t of tokens){
        var term = Term(t.type);
        switch(term){
            case TermType.Operand: output.push(t); break;
            case TermType.UnaryPostfixOperator: output.push(t); break;
            case TermType.UnaryPrefixOperator: stack.push(t); break;
            case TermType.Call: stack.push(t); break;
            case TermType.Operator:
                var top = stack[stack.length-1];
                var associative = Associative(t.type);
                while(stack.length>0){
                    if(associative == AssociativeType.Left){
                        if(!(Precedence(t.type) < Precedence(top.type)))
                            break;
                    }
                    else{
                        if((Precedence(t.type) <= Precedence(top.type)))
                            break;
                    }
                    output.push(stack.pop());
                    top = stack[stack.length-1];
                }
                stack.push(t);
                break;
            case TermType.LeftParenthesis: stack.push(t); break;
            case TermType.RightParenthesis:
                while(true){
                    if(stack.length<=0)
                        throw "Expecting to find matching () operators";
                    var topType = stack[stack.length-1].type;
                    if(topType == '('){
                        stack.pop();
                        break;
                    }
                    else
                        output.push(stack.pop());
                }
                if(stack[stack.length-1].type == TokenType.Call){
                    output.push(stack.pop());
                }
                break;
            default:
                throw "Term defaulted:"+term;
        }
    }
    while(stack.length>0){
        output.push(stack.pop());
    }

    function CreateBinaryOp(op){
        var b = stack.pop();
        var a = stack.pop();
        stack.push(new ASTBinaryOP(a,b,op))
    }

    function CreateUnaryOp(op){
        stack.push(new ASTUnaryOp(stack.pop(), op));
    }

    function CreateSetLocal(){
        var expression = stack.pop();
        var local = stack.pop();
        stack.push(new ASTSetLocal(local, expression));
    }

    function CreateCall(name){
        stack.push(new ASTCall(name, stack.pop()));
    }

    function CreateComma(){
        var b = stack.pop();
        var a = stack.pop();
        stack.push(new ASTComma(a,b));
    }

    console.log(output);
    for(var t of output){
        switch(t.type){
            case TokenType.Call: CreateCall(t.value); break;
            case TokenType.EmptyCall: stack.push(new ASTEmptyCall(t.value)); break;
            case TokenType.Identifier: stack.push(new ASTIdentifier(t.value)); break;
            case TokenType.Int: stack.push(new ASTI32Const(t.value)); break;
            case TokenType.Float: stack.push(new ASTF32Const(t.value)); break;
            case '=': CreateSetLocal(); break;
            case '*': CreateBinaryOp('*'); break;
            case '/': CreateBinaryOp('/'); break;
            case '+': CreateBinaryOp('+'); break;
            case '-': CreateBinaryOp('-'); break;
            case 'm': CreateUnaryOp('m'); break;
            case 'p': CreateUnaryOp('p'); break;
            case ',': CreateComma(); break;
            default: throw "opcodes defaulted:"+t.type;
        }
    }
    if(stack.length>1){
        throw "Expecting 1 item on stack";
    }
    return stack[0];
}