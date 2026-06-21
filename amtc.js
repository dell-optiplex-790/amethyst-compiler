var fs = require('fs');
var terser = require('terser');
var cfg = (function parseArgs(argv) {
    function parseValue(x) {
        var res = x.split(';');
        if(res.length < 2) {
            res = res[0];
        } else {
            res = res.map(e => !isNaN(Number(e)) ? Number(e) : e);
        }
        return res;
    }
    var settings = {}, args = argv.split(' '), split = [];
    for(var i = 0; i < args.length; i++) {
        split = args[i].split('=');
        while(split[0][0] == '-') {
            split[0] = split[0].slice(1);
        }
        if(split.length < 2) {
            settings[split[0]] = true;
        } else {
            settings[split[0]] = parseValue(split.slice(1).join('='));
        }
    }
    return settings;
})(process.argv.slice(2).join(' '));

var compileStack = [], included = [];

function int8(x) {
    return [
        Math.floor(x / 255),
        x % 255
    ];
}

if(typeof cfg.include == 'string') {
    cfg.include = [cfg.include];
}

if(typeof cfg.include == 'object' && cfg.include instanceof Array) {
    for(var i = 0; i < cfg.include.length; i++) {
        if(included.indexOf(cfg.include[i]) != -1) {
            continue;
        }
        compileStack.push(fs.readFileSync(cfg.include[i], 'utf8'))
        console.log('INCLUDE: ' + cfg.include[i]);
        included.push(cfg.include[i]);
    }
}

if(typeof cfg.in == 'string') {
    if(included.indexOf(cfg.in) == -1) {
        compileStack.push(fs.readFileSync(cfg.in, 'utf8'));
        console.log('INCLUDE: ' + cfg.in);
        included.push(cfg.in);
    }
}

if(typeof cfg.out != 'string') {
    process.exit(console.log('ERR: No output specified. Use --out=[file].'));
}

function compile(idx) {
    var lines = compileStack[idx].replaceAll('\r\n', '\n').replaceAll('\r', '\n').split('\n'), fn = '', value, tmp = [];
    for(var i = 0; i < lines.length; i++) {
        if(lines[i].startsWith('//include <') && lines[i].endsWith('>')) {
            fn = lines[i].slice(11, -1);
            if(included.indexOf(fn) != -1) {
                continue;
            }
            console.log('INCLUDE: ' + fn);
            included.push(fn);
            compileStack = [fs.readFileSync(fn, 'utf8'), ...compileStack];
            compile(0);
        } else if(lines[i].startsWith('//define ')) {
            tmp = lines[i].split(' ').slice(1);
            if(tmp.length < 2) {
                continue;
            }
            value = eval(tmp.slice(1).join(' '));
            console.log('DEFINE: ' + tmp[0] + ' = ' +  JSON.stringify(value));
            compileStack = ['const ' + tmp[0] + ' = ' + JSON.stringify(value) + ';', ...compileStack];
        }
    }
}

compile(compileStack.length - 1);
var compiled = compileStack.join('\n');

var code = (terser.minify_sync('(async function (ctx) {\n' + compiled + '})();', {
    ie8: true,
    safari10: true,
    mangle: {
        toplevel: true,
        eval: true,
    },
    ecma: 2017,
    compress: {
        arguments: true,
        arrows: true,
        booleans_as_integers: true,
        booleans: true,
        collapse_vars: true,
        comparisons: true,
        computed_props: true,
        evaluate: true
    }
}).code || '').slice(1, -3);

if(!code) {
    process.exit(console.log('ERR: No code generated.'));
}

code = '(' + code + ')';

var header = [65, 77, 84, 0];
var sections = {text: code};
var split = [];
if(typeof cfg.sections == 'string') {
    cfg.sections = [cfg.sections];
}
if(cfg.sections instanceof Array) {
    for(var i = 0; i < cfg.sections.length; i++) {
        split = cfg.sections[i].split('=');
        if(split.length != 2) {
            process.exit(console.log('LINK: Invalid section at index', i));
        }
        console.log('LINK: Adding section:', split[0]);
        if(!fs.existsSync(split[1])) {
            process.exit(console.log('LINK: File not found:', split[1]));
        }
        sections[split[0]] = new Uint8Array(fs.readFileSync(split[1]));
    }
}

console.log('LINK: Generating binary...');
var keys = Object.keys(sections);
var parts = [new Uint8Array(header)];
for(var i = 0; i < keys.length; i++) {
    parts.push(new Uint8Array(int8(keys[i].length)));
    parts.push(keys[i]);
    parts.push(new Uint8Array(int8(sections[keys[i]].length)));
    parts.push(sections[keys[i]]);
}
var totalLen = parts.map(e => e.length).reduce((a, b) => a + b);
var bin = new Uint8Array(totalLen), tmp, _i = 0;
for(var i = 0; i < parts.length; i++) {
    if(typeof parts[i] == 'string') {
        tmp = new Uint8Array(parts[i].split('').map(e => e.charCodeAt()))
    } else {
        tmp = parts[i];
    }
    for(var j = 0; j < tmp.length; j++) {
        bin[_i + j] = tmp[j];
    }
    _i += tmp.length;
}
console.log('LINK: Writing binary...');
fs.writeFileSync(cfg.out, Buffer.from(bin));
console.log('LINK: Done!');