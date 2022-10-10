

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

    function ParseStatement(){
        NotExpectingEndOfInput('statement');
        switch(reader.current.type){
            case '{': return ParseBody();
            default: return ParseExpression(ParseExpressionTokens());
        }
    }

    function ParseExpressionTokens(){
        var start = reader.index;
        while(true){
            NotExpectingEndOfInput(';')
            if(reader.current.type == ';'){
                var tokens = reader.tokens.slice(start, reader.index);
                reader.Scan();
                return tokens;
            }
            else
                reader.Scan();
        }
    }

    function ParseFunction(){
        var returnType = Expect(TokenType.Identifier);
        var name = Expect(TokenType.Identifier);
        var args = ParseArgs();
        var body = ParseBody();
        return new ASTFunction(name, args, returnType, body);
    }

    function ParseImportFunction(){
        reader.Scan();
        var returnType = Expect(TokenType.Identifier);
        var name = Expect(TokenType.Identifier);
        var args = ParseArgs();
        var body = Expect(TokenType.Javascript);
        return new ASTImportFunction(name, args, returnType, body);
    }

    function ParseAST(){
        var body = [];
        while(true){
            if(reader.current == undefined)
                return new AST(body);
            switch(reader.current.type){
                case TokenType.Identifier: body.push(ParseFunction()); break;
                case 'import': body.push(ParseImportFunction()); break;
                default: Error(TokenType.Identifier);
            }
        }
    }

    return ParseAST();
}