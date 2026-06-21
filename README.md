# Project Amethyst Binary Compiler (amtc)
This is a C-style "compiler" and linker for JavaScript. It outputs binaries with a `AMT\x00` header and should be used for compiling your Amethyst apps.
## CLI
The main binary is `amtc`. To install it, run `npm i amtc -g`.
 * `out` - The binary's name (example: `--out=hello`)
 * `in` - (optional) The main JS file (example: `--in=index.js`)
 * `include` - (optional) Additional libraries to include (example: `--include=util.js;something.js`)
 * `sections` - (optional) The additional sections you want to include (example: `--sections=resource=rsrc.json;program=index.js`)
## JS
There are several additions to plain JS.
1. Some comments act as preprocessor directives (examples: `//#include <util.js>`, `//#define DATE Date.now()`)
2. You can use `await` in the main scope