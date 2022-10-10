const TokenType = {
    Call:'Call',
    EmptyCall:'EmptyCall',
    Identifier:'Identifier',
    Float:'Float',
    Int:'Int',
    Javascript:'Javascript',
};

class Token{
    constructor(type, value){
        this.type = type;
        this.value = value;
    }
}

function Tokenizer(code){
    var index = 0;
    var charTokens = new Set(['=','+','-','*','/','<','>',';','(',')','{','}',',']);
    var char2Tokens = new Set(['++', '--']);
    var keywords = new Set(['if', 'while', 'for', 'return', 'import']);

    function IsDigit(c){
        return c>='0' && c<='9';
    }

    function IsCharacter(c){
        return (c>='a' && c<='z') || (c>='A' && c<='Z') || (c=='_');
    }

    function IsAlphaNumeric(c){
        return IsCharacter(c) || IsDigit(c);
    }

    function CreateToken(type, start){
         return new Token(type, code.substring(start, index));
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
            if(IsAlphaNumeric(code[index])){
                index++;
            }
            else{
                var token = TryCreateToken(keywords, start, index);
                if(token!=undefined)
                    return token;
                return CreateToken('Identifier', start);
            }
        }
    }

    function TryCreateToken(set, start, end){
        var key = code.substring(start, end);
        if(set.has(key)){
            var token = new Token(key, key);
            index = end;
            return token;
        }
        else
            return undefined;
    }

    function TokenizeJavascript(){
        var start = index;
        while(index<code.length){
            var c2 = code.substring(index, index+2);
            if(c2=='}#'){
                index+=2;
                return new Token(TokenType.Javascript, code.substring(start+2, index-2));
            }
            index++;
        }
        throw "Expecing }# at end of javascript";
    }

    function NextToken(){
        while(true){
            var c = code[index];
            if(c == undefined)
                return undefined;
            if(IsDigit(c))
                return TokenizeNumber();
            if(IsCharacter(c))
                return TokenizeIdentifier();
            switch(c){
                case ' ': index++; continue;
                case '\n': index++; continue;
                case '\t': index++; continue;
                case '\r': index++; continue;
            }
            var c2 = code.substring(index, index+2);
            if(c2 == '#{'){
                return TokenizeJavascript();
            }
            var token = TryCreateToken(char2Tokens, index, index+2);
            if(token!=undefined)
                return token;
            var token = TryCreateToken(charTokens, index, index+1);
            if(token!=undefined)
                return token;
            throw "Cant tokenize:"+c;
        }
    }

    var tokens = []
    while(true){
        var token = NextToken();
        if(token == undefined)
            return tokens;
        tokens.push(token);
    }
}

function CompileAndRun(code, output){
    output.innerHTML = '';
    var tokens = Tokenizer(code);
    var ast = Parser(new TokenReader(tokens));
    EmitAndRun(ast, output);
}

