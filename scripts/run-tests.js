'use strict';
// Enumerate test files explicitly for Windows and Unix. Never discover helper scripts as tests.
const fs=require('node:fs'),path=require('node:path'),{spawn}=require('node:child_process');
const directory=path.join(__dirname,'..','test');
const files=fs.readdirSync(directory).filter(name=>name.endsWith('.test.js')).sort().map(name=>path.join(directory,name));
if(!files.length)throw new Error('No test suites found.');
const args=['--test',...(process.argv.includes('--serial')?['--test-concurrency=1']:[]),...files];
const child=spawn(process.execPath,args,{stdio:'inherit',env:process.env});
child.on('error',error=>{console.error(error.message);process.exitCode=1;});
child.on('exit',code=>{process.exitCode=code??1;});
