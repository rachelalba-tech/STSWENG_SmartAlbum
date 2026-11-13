import { useCallback, useEffect, useState } from "react"
import { createCollage, deleteCollage, listCollages, updateCollage } from "./collageApi"
import type { CollageDraft, CollagesStatus, SavedCollage } from "./collageStore"

export function useCollages() {
  const [collages, setCollages] = useState<SavedCollage[]>([])
  const [status, setStatus] = useState<CollagesStatus>("loading")
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    listCollages(controller.signal)
      .then((list) => {
        setCollages(list)
        setStatus("ready")
      })
      .catch(() => {
        if (!controller.signal.aborted) setStatus("error")
      })
    return () => controller.abort()
  }, [attempt])

  const reload = useCallback(() => {
    setStatus("loading")
    setAttempt((n) => n + 1)
  }, [])

  const save = useCallback(async (draft: CollageDraft): Promise<SavedCollage> => {
    const saved = draft.id ? await updateCollage(draft.id, draft) : await createCollage(draft)
    setCollages((prev) =>
      prev.some((c) => c.id === saved.id) ? prev.map((c) => (c.id === saved.id ? saved : c)) : [...prev, saved],
    )
    return saved
  }, [])

  const remove = useCallback(async (id: string): Promise<void> => {
    await deleteCollage(id)
    setCollages((prev) => prev.filter((c) => c.id !== id))
  }, [])

  return { collages, status, reload, save, remove }
}