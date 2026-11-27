import {useState} from 'react'
type Props={apiBase:string;albumId:string;photoId:string;onChanged:()=>void|Promise<void>}
export function PhotoManagementActions({apiBase,albumId,photoId,onChanged}:Props){
 const [busy,setBusy]=useState(false);const [error,setError]=useState('')
 async function run(action:()=>Promise<unknown>){setBusy(true);setError('');try{await action();await onChanged()}catch(e){setError(e instanceof Error?e.message:'Photo operation failed')}finally{setBusy(false)}}
 return <div aria-label="Photo management actions"><button disabled={busy} onClick={()=>void run(async()=>{const {detachFromAlbum}=await import('./photo-management-api');await detachFromAlbum(apiBase,albumId,photoId)})}>Remove from album</button><button disabled={busy} onClick={()=>{if(window.confirm('Permanently delete this photo from your library and all albums?'))void run(async()=>{const {permanentlyDeletePhoto}=await import('./photo-management-api');await permanentlyDeletePhoto(apiBase,photoId)})}}>Delete permanently</button>{error&&<p role="alert">{error}</p>}</div>
}
