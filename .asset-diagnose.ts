import { db } from './src/backend/lib/db'
import { storeDb } from './src/backend/lib/tenancy'
import { figmaAuth } from './src/backend/lib/figma/connection'
import { figmaRequest } from './src/backend/lib/figma/client'
import { safeFetch,FIGMA_ASSET_HOSTS,processImage } from './src/backend/lib/design-import/assets'
import { cloudinary } from './src/backend/integrations/cloudinary'
import { createHash } from 'node:crypto'
const s=storeDb('legacy')
try {
 await s.designImport.updateMany({where:{id:'cmv9brpkz0001p89gaw6cfcf5',status:'ASSETS'},data:{status:'FAILED',lockedAt:null,error:'Stopped while switching verification to Jouri. Retry to resume; copied assets are retained.'}})
 const auth=await figmaAuth({db:s,store:{id:'legacy'}})
 const fills:any=await figmaRequest('/v1/files/LGkAKTpG4Ipt4JJJieZqax/images',auth)
 const url=fills.meta.images['df89d321e27a8c824fd20aef9b50892eb5133290']
 const {data}=await safeFetch(url,FIGMA_ASSET_HOSTS)
 const image=await processImage(data)
 const hash=createHash('sha256').update(image.data).digest('hex').slice(0,40)
 console.log(JSON.stringify({bytes:image.data.length,format:image.format,width:image.width,height:image.height}))
 const config=cloudinary.config()
 const params={timestamp:Math.floor(Date.now()/1000),public_id:'tenants/legacy/assets/'+hash,format:image.format,overwrite:'false',type:'upload'}
 const body=new FormData()
 for(const [key,value] of Object.entries(params)) body.set(key,String(value))
 body.set('api_key',config.api_key!)
 body.set('signature',cloudinary.utils.api_sign_request(params,config.api_secret!))
 body.set('file',new Blob([new Uint8Array(image.data)],{type:image.mime}),'asset.'+image.format)
 const response=await fetch('https://api.cloudinary.com/v1_1/'+config.cloud_name+'/image/upload',{method:'POST',body,signal:AbortSignal.timeout(90000)})
 const uploaded:any=await response.json()
 console.log(JSON.stringify({status:response.status,success:response.ok,format:uploaded.format,bytes:uploaded.bytes,error:uploaded.error?.message}))

} catch(e:any) { console.log(JSON.stringify({error:e.message??String(e),code:e.http_code}));process.exitCode=1 } finally {await db.$disconnect()}
