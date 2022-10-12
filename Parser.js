

class TokenReader{
    constructor(tokens){
        this.tokens = tokens;
        this.index = 0;
        this.current = this.tokens[this.index];
    }

    Scan(){
        this.index++;
        this.current = this.tokens[this.index];
    }
}

function Parser(reader){

    function Error(expecting){
        var tokenText = "";
        for(var i=0;i<reader.index;i++){
            tokenText+=reader.tokens[i].value+' ';
        }
        throw "Expecting: "+expecting+" Got: "+tokenText
    }

    function NotExpectingEndOfInput(expecting){
        if(reader.current == undefined)
            throw "Expecting: "+expecting+" Got: End of input";
    }

    function Expect(type){
        NotExpectingEndOfInput(type);
        if(type == reader.current.type){
            var value = reader.current.value;
            reader.Scan();
            return value;
        }
        else
            throw Error(type);
    }

    function ParseArgs(){
        Expect('(');
        var args = [];
        NotExpectingEndOfInput('typename )')
        while(reader.current.type == TokenType.Identifier){
            var type = reader.current.value;
            reader.Scan();
            var name = Expect(TokenType.Identifier);
            args.push(new ASTArg(type, name));
            NotExpectingEndOfInput(', )')
            if(reader.current.type == ','){
                reader.Scan();
            }
            else if(reader.current.type == ')'){
                break;
            }
            else 
                Error('typename , )');
        }
        if(reader.current.type == ')'){
            reader.Scan();
            return args;
        }
        else
            Error('typename )');
    }

    function ParseBody(){
        Expect('{');
        var statements = [];
        while(true){
            NotExpectingEndOfInput('statements');
            if(reader.current.type == '}'){
                reader.Scan();
                return new ASTBody(statements);
            }
            statements.push(ParseStatement()); 
        }
    }


    function ParseIf(){
        Expect('if');
        Expect('(');
        var expression = ParseExpression(ParseExpressionTokens(')'));
        var body = ParseStatement();
        return new ASTIf(expression, body);
    }

    function ParseWhile(){
        Expect('while');
        Expect('(');
        var expression = ParseExpression(ParseExpressionTokens(')'));
        var body = ParseStatement();
        return new ASTWhile(expression, body);
    }

    function ParseFor(){
        Expect('for');
        Expect('(');
        var init = ParseExpression(ParseExpressionTokens(';'));
        var condition = ParseExpression(ParseExpressionTokens(';'));
        var post = ParseExpression(ParseExpressionTokens(')'));
        var body = ParseStatement();
        return new ASTFor(init, condition, post, body);
    }

    function ParseStatement(){
        NotExpectingEndOfInput('statement');
        switch(reader.current.type){
            case '{': return ParseBody();
            case 'if': return ParseIf();
            case 'while': return ParseWhile();
            case 'for': return ParseFor();
            default: return ParseExpression(ParseExpressionTokens(';'));
        }
    }

    function ParseExpressionTokens(end){
        var start = reader.index;
        while(true){
            NotExpectingEndOfInput(end)
            if(reader.current.type == end){
                var tokens = reader.tokens.slice(start, reader.index);
                reader.Scan();
                return tokens;
            }
            else
                reader.Scan();
        }
    }

    function ParseFunction(_export){
        var returnType = Expect(TokenType.Identifier);
        var name = Expect(TokenType.Identifier);
        var args = ParseArgs();
        var body = ParseBody();
        return new ASTFunction(_export, name, args, returnType, body);
    }

    function ParseImportFunction(){
        Expect('import');
        var returnType = Expect(TokenType.Identifier);
        var name = Expect(TokenType.Identifier);
        var args = ParseArgs();
        var body = Expect(TokenType.Javascript);
        return new ASTImportFunction(name, args, returnType, body);
    }

    function ParseExportFunction(){
        Expect('export');
        return ParseFunction(true);
    }

    function ParseAST(){
        var body = [];
        while(true){
            if(reader.current == undefined)
                return new AST(body);
            switch(reader.current.type){
                case TokenType.Identifier: body.push(ParseFunction(false)); break;
                case 'import': body.push(ParseImportFunction()); break;
                case 'export': body.push(ParseExportFunction()); break;
                default: Error(TokenType.Identifier);
            }
        }
    }

    return ParseAST();
}