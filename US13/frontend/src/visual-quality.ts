/** Browser-only heuristic. Returns review warnings; it is not a definitive quality classifier. */
export async function inspectVisualQuality(src: string): Promise<string[]> {
 return new Promise(resolve=>{
  const image=new Image(); image.crossOrigin='anonymous'
  image.onload=()=>{try{
   const canvas=document.createElement('canvas'); canvas.width=96; canvas.height=96
   const ctx=canvas.getContext('2d',{willReadFrequently:true}); if(!ctx){resolve([]);return}
   ctx.drawImage(image,0,0,96,96); const pixels=ctx.getImageData(0,0,96,96).data
   const gray=new Float32Array(96*96); let sum=0,clipped=0
   for(let i=0,p=0;i<pixels.length;i+=4,p++){const v=.2126*pixels[i]+.7152*pixels[i+1]+.0722*pixels[i+2];gray[p]=v;sum+=v;if(v<8||v>247)clipped++}
   const mean=sum/gray.length; let s=0,sq=0,n=0
   for(let y=1;y<95;y++)for(let x=1;x<95;x++){const i=y*96+x;const lap=gray[i-96]+gray[i-1]-4*gray[i]+gray[i+1]+gray[i+96];s+=lap;sq+=lap*lap;n++}
   const variance=sq/n-(s/n)**2;const reasons:string[]=[]
   if(variance<85)reasons.push('Possible blur / low sharpness')
   if(mean<42||mean>218||clipped/gray.length>.28)reasons.push('Possible poor exposure or strong backlight')
   resolve(reasons)
  }catch{resolve([])}}
  image.onerror=()=>resolve([]); image.src=src
 })
}
