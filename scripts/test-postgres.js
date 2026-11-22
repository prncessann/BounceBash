'use strict';
const path=require('node:path'),{spawn}=require('node:child_process');
const child=spawn(process.execPath,[path.join(__dirname,'run-tests.js'),'--serial'],{stdio:'inherit',env:{...process.env,NODE_ENV:'test',DB_DRIVER:'pglite'}});
child.on('error',error=>{console.error(error.message);process.exitCode=1;});
child.on('exit',code=>{process.exitCode=code??1;});
