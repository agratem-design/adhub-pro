import {readFile, mkdir, writeFile} from 'node:fs/promises';
import JSZip from 'jszip';
const zip = new JSZip();
const files=['manifest.json','queue.js','bridge.js','background.js','whatsapp.js','popup.html','popup.css','popup.js','README.md'];
for(const name of files) zip.file(name,await readFile(new URL(`../extensions/alfares-whatsapp/${name}`,import.meta.url)));
const output=new URL('../public/downloads/',import.meta.url);
await mkdir(output,{recursive:true});
await writeFile(new URL('alfares-whatsapp.zip',output),await zip.generateAsync({type:'nodebuffer',compression:'DEFLATE'}));
console.log('Packaged alfares-whatsapp.zip');
