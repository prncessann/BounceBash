'use strict';
const {spawn}=require('node:child_process');
const child=spawn(process.execPath,['--test'],{stdio:'inherit',env:{...process.env,NODE_ENV:'test',DB_DRIVER:'pglite'}});
child.on('exit',code=>{process.exitCode=code??1;});
