import 'dotenv/config';
import express from 'express';
import {existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {app,errorHandler} from './app.js';
if(existsSync('dist/index.html')){app.use(express.static('dist'));app.get('*',(_req,res)=>res.sendFile(resolve('dist/index.html')));}else{const {createServer}=await import('vite');const vite=await createServer({server:{middlewareMode:true},appType:'spa'});app.use(vite.middlewares);}
app.use(errorHandler);
const port=Number(process.env.PORT||3000);app.listen(port,process.env.HOST||'127.0.0.1',()=>console.log(`Career Quest ready: http://127.0.0.1:${port}`));
