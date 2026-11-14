const sharp=require('sharp');
const [,, out, h, ...files]=process.argv;
(async()=>{const bufs=await Promise.all(files.map(f=>sharp(f).resize({height:+h}).toBuffer()));const meta=await Promise.all(bufs.map(b=>sharp(b).metadata()));
let x=0;const comp=bufs.map((b,i)=>{const o={input:b,left:x,top:0};x+=meta[i].width;return o});
await sharp({create:{width:x,height:+h,channels:3,background:'#ccd'}}).composite(comp).png().toFile(out)})()
