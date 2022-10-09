//copied quite a lot from https://github.com/ColinEberhardt/chasm

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
    f32_neg: 0x8c,
    i32_trunc_f32_s: 0xa8
};

// https://webassembly.github.io/spec/core/binary/types.html
const Valtype = {
    i32: 0x7f,
    f32: 0x7d
};

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

function EmitAndRun(ast){
    var functions = ast.body.filter(b=>b.constructor.name == 'ASTFunction');
    var importFunctions = ast.body.filter(b=>b.constructor.name == 'ASTImportFunction');
    ast.CalcCalls();
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


    // https://webassembly.github.io/spec/core/binary/types.html#binary-blocktype
    const Blocktype = {
        void: 0x40
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

    function GetValtype(typeName){
        switch(typeName){
            case 'f32': return Valtype.f32;
            case 'i32': return Valtype.i32;
            default: throw "GetValtype defaulted:"+typeName;
        }
    }

    function GetReturnArray(returnType){
        if(returnType == 'void')
            return [];
        else{
            return [GetValtype(returnType)];
        }
    }

    function EmitTypes(functions){
        return functions.map(f=>[
            functionType,
            ...encodeVector(f.args.map(a=>GetValtype(a.type))),
            ...encodeVector(GetReturnArray(f.returnType)),
        ]);
    }

    function EmitImportFunctions(importFunctions){
        return encodeVector(importFunctions.map((f,i)=>[
            ...encodeString("env"),
            ...encodeString(f.name),
            ExportType.func,
            ...unsignedLEB128(i)
        ]));
    }

    function EmitFuncs(functions){
        return encodeVector(functions.map((_,i)=>unsignedLEB128(i+importFunctions.length)));
    }

    const typeSection = createSection(Section.type, encodeVector([...EmitTypes(importFunctions), ...EmitTypes(functions)]));

    const importSection = createSection(Section.import, EmitImportFunctions(importFunctions));

    const funcSection = createSection(Section.func, EmitFuncs(functions));

    const mainIndex = functions.findIndex(f=>f.name == "main") + importFunctions.length;
    const exportSection = createSection(
        Section.export,
        encodeVector([
            [
                ...encodeString("main"),
                ExportType.func,
                unsignedLEB128(mainIndex),
            ]
        ])
    );

    function GetBlocktype(asm){
        switch(asm){
            case 'void': return Blocktype.void;
            default: throw 'Blocktype defaulted';
        }
    }

    function ImportObject(){
        var importObject = {env:{}};
        for(var f of importFunctions){
            importObject.env[f.name] = new Function(...f.args.map(a=>a.name), f.body);
        }
        return importObject;
    }

    function EmitFunction(f){
        const localCount = f.CalcLocals();
        var wasm = [];
        f.body.Emit(wasm);
        const locals = localCount > 0 ? [encodeLocal(localCount, Valtype.f32)] : [];
        return encodeVector([...encodeVector(locals), ...wasm, Opcode.end])
    }

    const codeSection = createSection(Section.code, encodeVector(functions.map(f=>EmitFunction(f))));

    const wasm = Uint8Array.from([
        ...magicModuleHeader,
        ...moduleVersion,
        ...typeSection,
        ...importSection,
        ...funcSection,
        ...exportSection,
        ...codeSection
    ]);

    WebAssembly.instantiate(wasm, ImportObject()).then(
        (obj) => {
            var div = document.createElement('div');
            div.innerHTML = obj.instance.exports.main();
            document.body.appendChild(div);
        }
    );
}



/*
function EmitAndRun2(code){
    var ast = new AST([
        new ASTImportFunction('Print', [new ASTArg('f32', 'i')], 'void', `
            var div = document.createElement('div');
            div.innerHTML = i;
            document.body.appendChild(div);`),
        new ASTFunction('main', [], 'f32', code),
    ]);
    EmitAndRun(ast);
}
*/

