export async function compressBrandImage(file,maxDimension=1920){
 if(!['image/jpeg','image/png','image/webp'].includes(file?.type)||file.size>12*1024*1024)throw Error('請選擇 12 MiB 以內的 JPG、PNG 或 WebP。');
 const image=await createImageBitmap(file);
 try{
  const canvas=document.createElement('canvas');
  const ratio=Math.min(1,maxDimension/Math.max(image.width,image.height));
  canvas.width=Math.max(1,Math.round(image.width*ratio));
  canvas.height=Math.max(1,Math.round(image.height*ratio));
  canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);
  for(const quality of [.85,.73,.6]){
   const output=await new Promise(resolve=>canvas.toBlob(resolve,'image/webp',quality));
   if(output?.type==='image/webp'&&output.size<=2*1024*1024)return output;
  }
  throw Error('圖片壓縮後仍超過 2 MiB，請選擇較小的圖片。');
 }finally{image.close();}
}
