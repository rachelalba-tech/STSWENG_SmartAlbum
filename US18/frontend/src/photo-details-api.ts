export async function savePhotoDetails(apiBase:string, photoId:string, changes:{title:string;description:string}):Promise<void>{
 const response=await fetch(`${apiBase}/api/photos/${encodeURIComponent(photoId)}`,{method:'PATCH',credentials:'include',headers:{'content-type':'application/json'},body:JSON.stringify(changes)})
 if(!response.ok) throw new Error(response.status===404?'Photo not found':'Could not save photo details')
}
