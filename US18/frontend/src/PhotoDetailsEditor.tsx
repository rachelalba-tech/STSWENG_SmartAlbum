import { useState } from 'react'
export type EditablePhotoDetails={id:string;title:string;description?:string}
type Props={photo:EditablePhotoDetails; onSave:(id:string,changes:{title:string;description:string})=>Promise<void>; onCancel:()=>void}
export function PhotoDetailsEditor({photo,onSave,onCancel}:Props){
 const [title,setTitle]=useState(photo.title); const [caption,setCaption]=useState(photo.description??''); const [busy,setBusy]=useState(false); const [error,setError]=useState('')
 async function submit(e:React.FormEvent){e.preventDefault();setBusy(true);setError('');try{await onSave(photo.id,{title:title.trim(),description:caption})}catch(err){setError(err instanceof Error?err.message:'Could not save photo details')}finally{setBusy(false)}}
 return <form onSubmit={submit} aria-label="Edit photo details"><label>Photo title<input value={title} maxLength={200} required onChange={e=>setTitle(e.target.value)}/></label><label>Caption<textarea value={caption} maxLength={2000} onChange={e=>setCaption(e.target.value)}/></label>{error&&<p role="alert">{error}</p>}<button type="submit" disabled={busy||!title.trim()}>Save details</button><button type="button" disabled={busy} onClick={onCancel}>Cancel</button></form>
}
