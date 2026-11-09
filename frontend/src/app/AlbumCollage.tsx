import { useMemo, useState } from "react"
import type { CSSProperties} from "react"
import { templatesFor, supportedCounts} from "./collageTemplates"
import type { CollageTemplate} from "./collageTemplates"
import type { Photo } from "./AlbumManager" 
import "../styles/AlbumCollage.css" 

const plural = (n: number, word: string) => `${n} ${word}${n !== 1 ? "s" : ""}`

interface LayoutProps {
    template: CollageTemplate // collageTemplates.ts 
    photos?: Photo[]
    pickedIndex?: number | null 
    onSlotClick?: (index: number) => void
    onSwap?: (from: number, to: number) => void
}

function CollageLayout({ template, photos, pickedIndex, onSlotClick, onSwap }: LayoutProps) {
    const [dragFrom, setDragFrom] = useState<number | null>(null) 
    const editable = Boolean(onSlotClick)

    return (
        <div 
            className = "ac-layout"
            style = {{
                gridTemplateColumns: `repeat(${template.cols}, 1fr)`,
                gridTemplateRows: `repeat(${template.rows}, 1fr)`, 
            }}
        >
            {template.cells.map((c, i) => {
                const photo = photos?.[i]
                const style: CSSProperties = {
                    gridColumn: `${c.col} / span ${c.colSpan ?? 1}`, 
                    gridRow: `${c.row} / span ${c.rowSpan ?? 1}`, 
                }
                const cls = `ac-slot${pickedIndex === i ? " is-picked" : ""}${dragFrom === i ? " is-dragging" : ""}`

                if (!editable) return <div key = {i} className = {cls} style = {style} /> 

                return (
                    <div 
                        key = {i}
                        className = {cls}
                        style = {style}
                        role = "button" 
                        tabIndex = {0}
                        draggable
                        aria-pressed = {pickedIndex === i}
                        aria-label = {`${photo?.title ?? "Photo"}, position ${i + 1}`}
                        
                        // controls for image swapping (drag & click)
                        onClick = {() => onSlotClick?.(i)}
                        onKeyDown = {(e) => {
                            if (e.key === "Enter" || e.key === " "){
                                e.preventDefault()
                                onSlotClick?.(i)
                            }
                        }}
                        onDragStart = {(e) => {
                            setDragFrom(i)
                            e.dataTransfer.effectAllowed = "move"
                            e.dataTransfer.setData("text/plain", String(i)) 
                        }}
                        onDragEnd = {() => setDragFrom(null)}
                        onDragOver = {(e) => e.preventDefault()}
                        onDrop = {(e) => {
                            e.preventDefault()
                            if (dragFrom !== null && dragFrom !== i) onSwap?.(dragFrom, i)
                                setDragFrom(null)
                        }}
                    >
                        {photo && <img src = {photo.src} alt = {photo.title} draggable = {false} />}
                    </div> 
                )
            })}
        </div> 
    )
}

// this feature places an album's photos into a collage template

// photos of one album in order 
interface AlbumCollageProps {
    photos: Photo[]
    onClose?: () => void 
}

export function AlbumCollage({ photos, onClose}: AlbumCollageProps) {
    const count = photos.length
    const matches = useMemo(() => templatesFor(count), [count])

    // if the number of photos do not match the number of slots on any template 
    if (matches.length === 0) return <NoTemplateFit count = {count} onClose = {onClose} /> 

    // if the number of photos in the album fit at least one template
    return <CollageEditor photos = {photos} matches = {matches} onClose = {onClose} /> 
}

function CollageEditor({
    photos, matches, onClose, 
}: { photos: Photo[]; matches: CollageTemplate[]; onClose?: () => void}) {
    const [templateId, setTemplateId] = useState(matches[0].id)
    const [order, setOrder] = useState<Photo[]>(photos)
    const [picked, setPicked] = useState<number | null>(null)
    const [status, setStatus] = useState("") 

    const template = matches.find((t) => t.id === templateId) ?? matches[0] 

    // swap image positions in the collage 
    const swap = (a: number, b: number) => {
        setOrder((prev) => {
            const next = [...prev]
            ;[next[a], next[b]] = [next[b], next[a]]
            return next
        })
        setStatus(`Swapped position ${a + 1} with position ${b + 1}`)
    }

    /* handles image swapping. when the user clicks one photo, and then another, their positions swap. this feature also works on keyboard */

    const handleSlotClick = (i: number) => {
        if (picked === null) {
            setPicked(i) 
            setStatus(`Selected position ${i + 1}. Choose another photo to swap with.`)
        } else if (picked === i) {
            setPicked(null) 
            setStatus("Selection cleared")
        } else {
            swap(picked, i) 
            setPicked(null) 
        }
    }

    return (
        <div className = "ac">
            <div className = "ac-stage">
                <CollageLayout 
                    template = {template}
                    photos = {order}
                    pickedIndex = {picked}
                    onSlotClick = {handleSlotClick} 
                    onSwap = {swap}
                />
            </div>

            <p className = "am-muted ac-hint">
                Drag a photo onto another to swap them, or select two photos.  
            </p> 

            {matches.length > 1 && (
                <div role = "radiogroup" aria-label = "Collage layout" className = "ac-picker"> 
                    {matches.map((t) => (
                        <button
                            key = {t.id}
                            type = "button"
                            role = "radio"
                            aria-checked = {t.id === template.id}
                            aria-label = {t.name}
                            className = "ac-thumb"
                            onClick ={() => { setTemplateId(t.id); setPicked(null) }}
                        >
                            <CollageLayout template = {t} />
                        </button>
                    ))}
                </div> 
            )}

            <p className="ac-sr" role="status" aria-live="polite">{status}</p> 
            
            <div className="am-dialog-actions">
                {onClose && <button className="am-btn am-btn--outline" onClick={onClose}>Close</button>}
            </div> 
        </div> 
    )
}

function NoTemplateFit({ count, onClose }: { count: number; onClose?: () => void }) {
  const counts = supportedCounts()
  const fewer = [...counts].reverse().find((n) => n < count)
  const more = counts.find((n) => n > count)
 
  const suggestions: string[] = []

  if (more !== undefined && count > 0) suggestions.push(`add ${plural(more - count, "photo")} for a ${more}-photo layout`)
  
    if (fewer !== undefined) suggestions.push(`remove ${plural(count - fewer, "photo")} for a ${fewer}-photo layout`)
 
  return (
    <div className="ac ac-nofit" role="alert">
        <h3>Can’t make a collage from this album</h3>
        <p>
        This album has {plural(count, "photo")}, and every layout needs an exact number of photos:{" "}
        {counts.join(", ")}.
        </p>
        {count === 0 ? (
        <p>Add photos to the album to get started.</p>
        ) : (
        <p>To make a collage, {suggestions.join(", or ")}.</p>
        )}
        <div className="am-dialog-actions">
        {onClose && <button className="am-btn am-btn--primary" onClick={onClose}>OK</button>}
        </div>
    </div>
  )
}
 