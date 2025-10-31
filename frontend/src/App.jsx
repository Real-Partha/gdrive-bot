import { useState, useMemo, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useTheme } from './ThemeContext'
import { Button } from './components/Button'
import { DropZone } from './components/DropZone'
import { FileItem } from './components/FileItem'
import { Link, useLocation } from 'react-router-dom'
import FindPage from './pages/FindPage'
import './index.css'

const API_BASE = 'http://localhost:8000'
const CONCURRENCY = 12 // adjust between 10-20 as needed

export default function App() {
  const { theme, toggleTheme } = useTheme()
  const location = useLocation()
  const [files, setFiles] = useState([])
  const [previews, setPreviews] = useState([])
  const [videoDurations, setVideoDurations] = useState([])
  const [statuses, setStatuses] = useState({})
  const [results, setResults] = useState({})
  const [isUploading, setIsUploading] = useState(false)
  const [previewsDisabled, setPreviewsDisabled] = useState(false)
  const [previewLoading, setPreviewLoading] = useState([])
  const [attempts, setAttempts] = useState({})

  // Generate previews when files change
  useEffect(() => {
    if (!files || files.length === 0) {
      // Cleanup all previews when files are cleared
      previews.forEach(url => {
        if (url && typeof url === 'string' && url.startsWith('blob:')) URL.revokeObjectURL(url)
      })
      setPreviews([])
      setVideoDurations([])
    }
    // Cleanup on unmount
    return () => {
      previews.forEach(url => {
        if (url && typeof url === 'string' && url.startsWith('blob:')) URL.revokeObjectURL(url)
      })
    }
  }, [files])

  const isImageName = (name) => /\.(jpe?g|png|gif|bmp|webp|svg|heic|heif|avif)$/i.test(name || '')
  const isImageType = (type) => typeof type === 'string' && type.startsWith('image/')
  const isVideoName = (name) => /\.(mp4|mov|m4v|webm|avi|mkv)$/i.test(name || '')
  const isVideoType = (type) => typeof type === 'string' && type.startsWith('video/')
  const isHeicName = (name) => /\.(heic|heif|avif)$/i.test(name || '')
  const isHeicType = (type) => /heic|heif|avif/i.test(type || '')

  // Create a video thumbnail and extract duration using an off-DOM <video>
  const getVideoThumb = (file) => new Promise((resolve) => {
    try {
      const url = URL.createObjectURL(file)
      const video = document.createElement('video')
      video.preload = 'metadata'
      video.src = url
      video.muted = true
      const cleanup = () => {
        if (url && url.startsWith('blob:')) URL.revokeObjectURL(url)
        video.remove()
      }
      video.onloadedmetadata = () => {
        const duration = Number.isFinite(video.duration) ? video.duration : 0
        const target = duration && duration > 2 ? Math.min(1, duration / 2) : 0.1
        const seekAndCapture = () => {
          const canvas = document.createElement('canvas')
          const maxW = 160
          const scale = Math.min(1, maxW / (video.videoWidth || maxW))
          canvas.width = Math.max(1, Math.floor((video.videoWidth || maxW) * scale))
          canvas.height = Math.max(1, Math.floor((video.videoHeight || maxW) * scale))
          const ctx = canvas.getContext('2d')
          if (ctx) {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
            try {
              const dataUrl = canvas.toDataURL('image/jpeg', 0.8)
              cleanup()
              resolve({ thumb: dataUrl, duration })
              return
            } catch (e) {
              // fall-through
            }
          }
          cleanup()
          resolve({ thumb: null, duration })
        }
        const handleSeeked = () => {
          video.removeEventListener('seeked', handleSeeked)
          seekAndCapture()
        }
        video.addEventListener('seeked', handleSeeked)
        try {
          video.currentTime = target
        } catch (e) {
          video.removeEventListener('seeked', handleSeeked)
          seekAndCapture()
        }
      }
      video.onerror = () => { cleanup(); resolve({ thumb: null, duration: null }) }
      video.style.position = 'fixed'
      video.style.left = '-9999px'
      document.body.appendChild(video)
    } catch (e) {
      resolve({ thumb: null, duration: null })
    }
  })

  const fileData = useMemo(() =>
    Array.from(files || []).map((f, idx) => {
      const isImg = isImageType(f.type) || isImageName(f.name)
      const isVid = isVideoType(f.type) || isVideoName(f.name)
      return ({ 
        name: f.name, 
        size: f.size, 
        type: f.type,
        isVideo: isVid,
        preview: previews[idx],
        duration: videoDurations[idx] || null,
        previewIsLoading: !!previewLoading[idx],
      })
    }),
    [files, previews, videoDurations, previewLoading]
  )

  const handleFileDrop = async (acceptedFiles) => {
    if (acceptedFiles.length === 0) return
    const currentLength = files.length
    const newFiles = [...files, ...acceptedFiles]

    // Extend arrays for new items
    const newPreviews = [...previews]
    const newDurations = [...videoDurations]
    const newLoading = [...previewLoading]

    // Initialize UI state immediately
    acceptedFiles.forEach((file, i) => {
      const idx = currentLength + i
      const isImg = isImageType(file.type) || isImageName(file.name)
      const isVid = isVideoType(file.type) || isVideoName(file.name)
      if (previewsDisabled) {
        newPreviews[idx] = isVid ? '/video-preview.png' : '/image-preview.png'
        newDurations[idx] = null
        newLoading[idx] = false
      } else {
        if (isImg) {
          if (isHeicType(file.type) || isHeicName(file.name)) {
            newPreviews[idx] = null
            newLoading[idx] = true
          } else {
            newPreviews[idx] = URL.createObjectURL(file)
            newLoading[idx] = false
          }
        } else if (isVid) {
          newPreviews[idx] = null
          newDurations[idx] = null
          newLoading[idx] = true
        }
      }
    })

    setFiles(newFiles)
    setPreviews(newPreviews)
    setVideoDurations(newDurations)
    setPreviewLoading(newLoading)

    // Start async work per-file
    acceptedFiles.forEach((file, i) => {
      const idx = currentLength + i
      const isImg = isImageType(file.type) || isImageName(file.name)
      const isVid = isVideoType(file.type) || isVideoName(file.name)
      if (previewsDisabled) return
      if (isVid) {
        ;(async () => {
          try {
            const { thumb, duration } = await getVideoThumb(file)
            setPreviews(prev => { const arr = [...prev]; arr[idx] = thumb; return arr })
            setVideoDurations(prev => { const arr = [...prev]; arr[idx] = duration; return arr })
          } finally {
            setPreviewLoading(prev => { const arr = [...prev]; arr[idx] = false; return arr })
          }
        })()
      } else if (isImg && (isHeicType(file.type) || isHeicName(file.name))) {
        ;(async () => {
          try {
            const fd = new FormData()
            fd.append('file', file)
            const resp = await fetch(`${API_BASE}/preview_local?w=240&q=80`, { method: 'POST', body: fd })
            if (resp.ok) {
              const blob = await resp.blob()
              const url = URL.createObjectURL(blob)
              setPreviews(prev => { const arr = [...prev]; arr[idx] = url; return arr })
            } else {
              setPreviews(prev => { const arr = [...prev]; arr[idx] = null; return arr })
            }
          } catch (e) {
            setPreviews(prev => { const arr = [...prev]; arr[idx] = null; return arr })
          } finally {
            setPreviewLoading(prev => { const arr = [...prev]; arr[idx] = false; return arr })
          }
        })()
      }
    })

    // Initialize upload statuses for new items
    const newStatuses = { ...statuses }
    const newResults = { ...results }
    const newAttempts = { ...attempts }
    for (let i = 0; i < acceptedFiles.length; i++) newStatuses[currentLength + i] = 'idle'
    setStatuses(newStatuses)
    setResults(newResults)
    // initialize attempts to 0 for new indices
    for (let i = 0; i < acceptedFiles.length; i++) newAttempts[currentLength + i] = 0
    setAttempts(newAttempts)
  }

  const handleRemoveFile = (idx) => {
    // Revoke the object URL to free memory
    if (previews[idx] && previews[idx].startsWith && previews[idx].startsWith('blob:')) {
      URL.revokeObjectURL(previews[idx])
    }
    
    const newFiles = files.filter((_, i) => i !== idx)
    const newPreviews = previews.filter((_, i) => i !== idx)
    const newDur = videoDurations.filter((_, i) => i !== idx)
    const newLoad = previewLoading.filter((_, i) => i !== idx)
    setFiles(newFiles)
    setPreviews(newPreviews)
    setVideoDurations(newDur)
    setPreviewLoading(newLoad)

    // Reindex statuses and results
    const nextStatuses = {}
    const nextResults = {}
    const nextAttempts = {}
    Object.keys(statuses).forEach(key => {
      const oldIdx = parseInt(key)
      if (oldIdx < idx) {
        nextStatuses[oldIdx] = statuses[oldIdx]
        if (results[oldIdx]) nextResults[oldIdx] = results[oldIdx]
        if (typeof attempts[oldIdx] !== 'undefined') nextAttempts[oldIdx] = attempts[oldIdx]
      } else if (oldIdx > idx) {
        nextStatuses[oldIdx - 1] = statuses[oldIdx]
        if (results[oldIdx]) nextResults[oldIdx - 1] = results[oldIdx]
        if (typeof attempts[oldIdx] !== 'undefined') nextAttempts[oldIdx - 1] = attempts[oldIdx]
      }
    })
    setStatuses(nextStatuses)
    setResults(nextResults)
    setAttempts(nextAttempts)
  }

  // Respond to preview toggle changes for current selection
  useEffect(() => {
    // No files -> nothing to do
    if (!files || files.length === 0) return
    const apply = async () => {
      // Revoke old blob URLs
      previews.forEach(url => {
        if (url && typeof url === 'string' && url.startsWith('blob:')) URL.revokeObjectURL(url)
      })
      const basePreviews = Array(files.length).fill(null)
      const baseDur = Array(files.length).fill(null)
      const baseLoading = Array(files.length).fill(false)
      if (previewsDisabled) {
        for (let idx = 0; idx < files.length; idx++) {
          const f = files[idx]
          const isVid = isVideoType(f.type) || isVideoName(f.name)
          basePreviews[idx] = isVid ? '/video-preview.png' : '/image-preview.png'
          baseDur[idx] = null
          baseLoading[idx] = false
        }
        setPreviews(basePreviews)
        setVideoDurations(baseDur)
        setPreviewLoading(baseLoading)
      } else {
        // Regenerate previews quickly
        setPreviews(basePreviews)
        setVideoDurations(baseDur)
        setPreviewLoading(baseLoading)
        files.forEach((f, idx) => {
          const isImg = isImageType(f.type) || isImageName(f.name)
          const isVid = isVideoType(f.type) || isVideoName(f.name)
          if (isImg) {
            if (isHeicType(f.type) || isHeicName(f.name)) {
              setPreviewLoading(prev => { const arr = [...prev]; arr[idx] = true; return arr })
              ;(async () => {
                try {
                  const fd = new FormData(); fd.append('file', f)
                  const resp = await fetch(`${API_BASE}/preview_local?w=240&q=80`, { method: 'POST', body: fd })
                  if (resp.ok) {
                    const blob = await resp.blob()
                    const url = URL.createObjectURL(blob)
                    setPreviews(prev => { const arr = [...prev]; arr[idx] = url; return arr })
                  }
                } finally {
                  setPreviewLoading(prev => { const arr = [...prev]; arr[idx] = false; return arr })
                }
              })()
            } else {
              setPreviews(prev => { const arr = [...prev]; arr[idx] = URL.createObjectURL(f); return arr })
            }
          } else if (isVid) {
            setPreviewLoading(prev => { const arr = [...prev]; arr[idx] = true; return arr })
            ;(async () => {
              try {
                const { thumb, duration } = await getVideoThumb(f)
                setPreviews(prev => { const arr = [...prev]; arr[idx] = thumb; return arr })
                setVideoDurations(prev => { const arr = [...prev]; arr[idx] = duration; return arr })
              } finally {
                setPreviewLoading(prev => { const arr = [...prev]; arr[idx] = false; return arr })
              }
            })()
          }
        })
      }
    }
    apply()
  }
  , [previewsDisabled])

  async function uploadAll() {
    if (!files || files.length === 0) return
    setIsUploading(true)

    // Helper to upload a single file at index with safe state updates
    const uploadOne = async (i) => {
      const file = files[i]
      if (!file) return
      if ((statuses[i] || '') === 'done') return
      let attempt = Number.isInteger(attempts[i]) ? attempts[i] : 0
      // mark uploading
      setStatuses(prev => ({ ...prev, [i]: 'uploading' }))
      const doOnce = async () => {
        const startTime = Date.now()
        const fd = new FormData()
        fd.append('files', file)
        if (typeof file.lastModified === 'number') {
          fd.append('lastModified', String(file.lastModified))
        }
        const resp = await fetch(`${API_BASE}/upload`, { method: 'POST', body: fd })
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
        const data = await resp.json()
        const res = Array.isArray(data.results) ? data.results[0] : null
        const endTime = Date.now()
        const uploadTime = ((endTime - startTime) / 1000).toFixed(2) + 's'
        return { res, uploadTime }
      }

      while (true) {
        try {
          const { res, uploadTime } = await doOnce()
          if (res && res.status === 'ok') {
            setStatuses(prev => ({ ...prev, [i]: 'done' }))
            setResults(prev => ({ ...prev, [i]: { ...res, uploadTime } }))
            // reset attempts on success
            setAttempts(prev => { const n = { ...prev }; delete n[i]; return n })
            break
          } else {
            const errMsg = (res && res.error) || 'Upload failed'
            if (attempt < 1) {
              attempt += 1
              setAttempts(prev => ({ ...prev, [i]: attempt }))
              // brief backoff before retry
              await new Promise(r => setTimeout(r, 1500))
              // continue loop to retry
              continue
            }
            setStatuses(prev => ({ ...prev, [i]: 'error' }))
            setResults(prev => ({ ...prev, [i]: { error: errMsg } }))
            break
          }
        } catch (err) {
          if (attempt < 1) {
            attempt += 1
            setAttempts(prev => ({ ...prev, [i]: attempt }))
            await new Promise(r => setTimeout(r, 1500))
            continue
          }
          setStatuses(prev => ({ ...prev, [i]: 'error' }))
          setResults(prev => ({ ...prev, [i]: { error: String(err) } }))
          break
        }
      }
    }

    // Build a queue of indices to upload
    const queue = []
    for (let i = 0; i < files.length; i++) {
      if ((statuses[i] || '') !== 'done') queue.push(i)
    }
    let idxPtr = 0

    // Worker function to process queue items
    const worker = async () => {
      while (idxPtr < queue.length) {
        const myIdx = idxPtr
        idxPtr += 1
        const fileIndex = queue[myIdx]
        await uploadOne(fileIndex)
      }
    }

    try {
      const workers = Array.from({ length: Math.min(CONCURRENCY, queue.length) }, () => worker())
      await Promise.all(workers)
    } finally {
      setIsUploading(false)
    }
  }

  // Manual per-item retry handler
  const handleRetryUpload = async (idx) => {
    if (!files[idx]) return
    if (statuses[idx] === 'uploading') return
    // clear error and reset attempt counter
    setResults(prev => { const n = { ...prev }; delete n[idx]; return n })
    setAttempts(prev => ({ ...prev, [idx]: 0 }))
    await (async () => {
      // Run single upload for this index
      await (async (i) => {
        const file = files[i]
        if (!file) return
        // mark as idle then call uploadOne which will set uploading and perform retries
        setStatuses(prev => ({ ...prev, [i]: 'idle' }))
        await uploadAllSingle(i)
      })(idx)
    })()
  }

  // small helper to upload a single index using the same logic as workers
  const uploadAllSingle = async (i) => {
    // Inline the same uploadOne used in uploadAll
    const file = files[i]
    if (!file) return
    let attempt = Number.isInteger(attempts[i]) ? attempts[i] : 0
    setStatuses(prev => ({ ...prev, [i]: 'uploading' }))
    const doOnce = async () => {
      const startTime = Date.now()
      const fd = new FormData()
      fd.append('files', file)
      if (typeof file.lastModified === 'number') {
        fd.append('lastModified', String(file.lastModified))
      }
      const resp = await fetch(`${API_BASE}/upload`, { method: 'POST', body: fd })
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
      const data = await resp.json()
      const res = Array.isArray(data.results) ? data.results[0] : null
      const endTime = Date.now()
      const uploadTime = ((endTime - startTime) / 1000).toFixed(2) + 's'
      return { res, uploadTime }
    }
    while (true) {
      try {
        const { res, uploadTime } = await doOnce()
        if (res && res.status === 'ok') {
          setStatuses(prev => ({ ...prev, [i]: 'done' }))
          setResults(prev => ({ ...prev, [i]: { ...res, uploadTime } }))
          setAttempts(prev => { const n = { ...prev }; delete n[i]; return n })
          break
        } else {
          const errMsg = (res && res.error) || 'Upload failed'
          if (attempt < 1) {
            attempt += 1
            setAttempts(prev => ({ ...prev, [i]: attempt }))
            await new Promise(r => setTimeout(r, 1500))
            continue
          }
          setStatuses(prev => ({ ...prev, [i]: 'error' }))
          setResults(prev => ({ ...prev, [i]: { error: errMsg } }))
          break
        }
      } catch (err) {
        if (attempt < 1) {
          attempt += 1
          setAttempts(prev => ({ ...prev, [i]: attempt }))
          await new Promise(r => setTimeout(r, 1500))
          continue
        }
        setStatuses(prev => ({ ...prev, [i]: 'error' }))
        setResults(prev => ({ ...prev, [i]: { error: String(err) } }))
        break
      }
    }
  }

  const doneCount = useMemo(() => Object.values(statuses).filter(s => s === 'done').length, [statuses])
  const counts = useMemo(() => {
    let imgs = 0, vids = 0
    for (const f of fileData) {
      if (f.isVideo) vids++
      else imgs++
    }
    return { imgs, vids }
  }, [fileData])
  const allDone = fileData.length > 0 && doneCount === fileData.length
  const hasUnuploadedFiles = fileData.length > 0 && doneCount < fileData.length

  const isFindMode = location.pathname === '/find'

  return (
    <div className="min-h-screen relative overflow-hidden bg-slate-50 dark:bg-slate-950 transition-colors duration-500">
      {/* Animated gradient background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div
          className="absolute -top-1/2 -left-1/2 w-full h-full bg-gradient-conic from-brand-400 via-purple-500 to-pink-500 opacity-20 dark:opacity-10 blur-3xl"
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 20, ease: 'linear' }}
        />
        <motion.div
          className="absolute -bottom-1/2 -right-1/2 w-full h-full bg-gradient-conic from-pink-400 via-brand-500 to-purple-500 opacity-20 dark:opacity-10 blur-3xl"
          animate={{ rotate: -360 }}
          transition={{ repeat: Infinity, duration: 25, ease: 'linear' }}
        />
      </div>

      {/* Theme toggle + mode switch */}
      <div className="fixed top-6 right-6 z-50 flex items-center gap-3">
        <Link to={isFindMode ? '/' : '/find'}>
          <Button variant="ghost" className="px-4 py-2">
            {isFindMode ? 'Upload Mode' : 'Find Mode'}
          </Button>
        </Link>
        <motion.button
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          onClick={toggleTheme}
          className="p-3 rounded-full bg-white/80 dark:bg-slate-800/80 backdrop-blur-md border border-slate-200 dark:border-slate-700 shadow-lg hover:scale-110 transition-transform"
        >
          <motion.div
            initial={{ rotate: 0 }}
            animate={{ rotate: theme === 'dark' ? 180 : 0 }}
            transition={{ duration: 0.5, type: 'spring' }}
          >
            {theme === 'dark' ? (
              <svg className="w-6 h-6 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" />
              </svg>
            ) : (
              <svg className="w-6 h-6 text-slate-700" fill="currentColor" viewBox="0 0 20 20">
                <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
              </svg>
            )}
          </motion.div>
        </motion.button>
      </div>

  {/* Main content */}
  {!isFindMode ? (
  <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <motion.header
          initial={{ opacity: 0, y: -30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <motion.h1
            className="text-5xl md:text-6xl font-black mb-4 bg-gradient-to-r from-brand-600 via-purple-600 to-pink-600 dark:from-brand-400 dark:via-purple-400 dark:to-pink-400 bg-clip-text text-transparent"
            animate={{ backgroundPosition: ['0%', '100%', '0%'] }}
            transition={{ repeat: Infinity, duration: 5, ease: 'linear' }}
          >
            GDrive Upload Bot
          </motion.h1>
          <p className="text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
            Automatically organize your photos by date. Drop images, we'll read EXIF metadata, rename to{' '}
            <code className="px-2 py-0.5 bg-slate-200 dark:bg-slate-800 rounded font-mono text-sm">
              YYYY-MM-DD_HH-MM-SS
            </code>
            , and upload to Drive in date folders.
          </p>
        </motion.header>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="mb-8"
        >
          <DropZone onDrop={handleFileDrop} disabled={isUploading} />
          {/* Preview toggle */}
          <div className="mt-4 flex items-center justify-center">
            <div className="flex items-center gap-3 px-4 py-2 rounded-xl bg-white/60 dark:bg-slate-800/60 backdrop-blur-md border border-slate-200/60 dark:border-slate-700/60 shadow-sm">
              <span className="text-sm text-slate-600 dark:text-slate-300">Placeholders</span>
              <button
                type="button"
                onClick={() => setPreviewsDisabled(prev => !prev)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-300 ${previewsDisabled ? 'bg-slate-400/70 dark:bg-slate-600' : 'bg-brand-500'}`}
                aria-pressed={!previewsDisabled}
                aria-label="Toggle previews"
              >
                <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform duration-300 ${previewsDisabled ? 'translate-x-1' : 'translate-x-5'}`} />
              </button>
              <span className="text-sm text-slate-600 dark:text-slate-300">Live previews</span>
            </div>
          </div>
        </motion.div>

        {fileData.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.3 }}
            className="mb-8 p-6 rounded-2xl bg-white/50 dark:bg-slate-800/50 backdrop-blur-xl border border-slate-200/50 dark:border-slate-700/50"
          >
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-3">
                <motion.div
                  className="h-12 w-12 rounded-xl bg-gradient-to-br from-brand-500 to-purple-600 flex items-center justify-center text-white font-bold text-lg shadow-lg"
                  animate={{ rotate: [0, 5, -5, 0] }}
                  transition={{ repeat: Infinity, duration: 3 }}
                >
                  {fileData.length}
                </motion.div>
                <div>
                  <p className="font-semibold text-slate-800 dark:text-slate-100">
                    {fileData.length} {fileData.length === 1 ? 'item' : 'items'} selected
                  </p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    {counts.imgs} {counts.imgs === 1 ? 'image' : 'images'} • {counts.vids} {counts.vids === 1 ? 'video' : 'videos'}{doneCount > 0 ? ` • ${doneCount} uploaded` : ''} • {(fileData.reduce((sum, p) => sum + p.size, 0) / 1024 / 1024).toFixed(2)} MB total
                  </p>
                </div>
              </div>
              {hasUnuploadedFiles && (
                <Button
                  onClick={uploadAll}
                  disabled={isUploading || fileData.length === 0}
                  loading={isUploading}
                  variant="primary"
                >
                  {isUploading ? 'Uploading...' : 'Upload to Drive'}
                </Button>
              )}
            </div>
          </motion.div>
        )}

        <AnimatePresence>
          {allDone && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="mb-8 p-6 rounded-2xl bg-gradient-to-r from-emerald-500 to-green-600 text-white shadow-2xl"
            >
              <div className="flex items-center gap-3">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 500 }}
                  className="text-4xl"
                >
                  🎉
                </motion.div>
                <div>
                  <p className="font-bold text-lg">All done!</p>
                  <p className="text-emerald-50">Your images are now organized in Google Drive</p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {fileData.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.4 }}
          >
            <ul className="space-y-3">
              {fileData.map((p, idx) => (
                <FileItem
                  key={idx}
                  file={p}
                  index={idx}
                  status={statuses[idx] || 'idle'}
                  result={results[idx]}
                  preview={p.preview}
                  isVideo={p.isVideo}
                  videoDuration={p.duration}
                  previewIsLoading={p.previewIsLoading}
                  onRemove={() => handleRemoveFile(idx)}
                  onRetry={() => handleRetryUpload(idx)}
                />
              ))}
            </ul>
          </motion.div>
        )}
      </div>
      ) : (
        <FindPage />
      )}
    </div>
  )
}
