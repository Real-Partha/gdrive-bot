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
  const [statuses, setStatuses] = useState({})
  const [results, setResults] = useState({})
  const [isUploading, setIsUploading] = useState(false)

  // Generate previews when files change
  useEffect(() => {
    if (!files || files.length === 0) {
      // Cleanup all previews when files are cleared
      previews.forEach(url => {
        if (url) URL.revokeObjectURL(url)
      })
      setPreviews([])
    }
    // Cleanup on unmount
    return () => {
      previews.forEach(url => {
        if (url) URL.revokeObjectURL(url)
      })
    }
  }, [files])

  const fileData = useMemo(() =>
    Array.from(files || []).map((f, idx) => ({ 
      name: f.name, 
      size: f.size, 
      type: f.type,
      preview: previews[idx]
    })),
    [files, previews]
  )

  const handleFileDrop = (acceptedFiles) => {
    if (acceptedFiles.length === 0) return
    const currentLength = files.length
    const newFiles = [...files, ...acceptedFiles]
    
    // Generate previews immediately for new files
    const newPreviews = [...previews]
    for (let i = 0; i < acceptedFiles.length; i++) {
      const file = acceptedFiles[i]
      const idx = currentLength + i
      const isImage = file.type.startsWith('image/') || 
                     /\.(jpe?g|png|gif|bmp|webp|svg|heic|heif|avif)$/i.test(file.name)
      if (isImage) {
        const url = URL.createObjectURL(file)
        newPreviews[idx] = url
      }
    }
    
    setFiles(newFiles)
    setPreviews(newPreviews)
    
    const newStatuses = { ...statuses }
    const newResults = { ...results }
    for (let i = 0; i < acceptedFiles.length; i++) {
      newStatuses[currentLength + i] = 'idle'
    }
    setStatuses(newStatuses)
    setResults(newResults)
  }

  const handleRemoveFile = (idx) => {
    // Revoke the object URL to free memory
    if (previews[idx]) {
      URL.revokeObjectURL(previews[idx])
    }
    
    const newFiles = files.filter((_, i) => i !== idx)
    const newPreviews = previews.filter((_, i) => i !== idx)
    setFiles(newFiles)
    setPreviews(newPreviews)
    
    // Reindex statuses and results
    const newStatuses = {}
    const newResults = {}
    Object.keys(statuses).forEach(key => {
      const oldIdx = parseInt(key)
      if (oldIdx < idx) {
        newStatuses[oldIdx] = statuses[oldIdx]
        if (results[oldIdx]) newResults[oldIdx] = results[oldIdx]
      } else if (oldIdx > idx) {
        newStatuses[oldIdx - 1] = statuses[oldIdx]
        if (results[oldIdx]) newResults[oldIdx - 1] = results[oldIdx]
      }
    })
    setStatuses(newStatuses)
    setResults(newResults)
  }

  async function uploadAll() {
    if (!files || files.length === 0) return
    setIsUploading(true)

    // Helper to upload a single file at index with safe state updates
    const uploadOne = async (i) => {
      const file = files[i]
      if (!file) return
      if ((statuses[i] || '') === 'done') return
      const startTime = Date.now()
      // mark uploading
      setStatuses(prev => ({ ...prev, [i]: 'uploading' }))
      const fd = new FormData()
      fd.append('files', file)
      if (typeof file.lastModified === 'number') {
        fd.append('lastModified', String(file.lastModified))
      }
      try {
        const resp = await fetch(`${API_BASE}/upload`, { method: 'POST', body: fd })
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
        const data = await resp.json()
        const res = Array.isArray(data.results) ? data.results[0] : null
        const endTime = Date.now()
        const uploadTime = ((endTime - startTime) / 1000).toFixed(2) + 's'

        if (res && res.status === 'ok') {
          setStatuses(prev => ({ ...prev, [i]: 'done' }))
          setResults(prev => ({ ...prev, [i]: { ...res, uploadTime } }))
        } else {
          setStatuses(prev => ({ ...prev, [i]: 'error' }))
          setResults(prev => ({ ...prev, [i]: { error: (res && res.error) || 'Upload failed' } }))
        }
      } catch (err) {
        setStatuses(prev => ({ ...prev, [i]: 'error' }))
        setResults(prev => ({ ...prev, [i]: { error: String(err) } }))
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

  const doneCount = useMemo(() => Object.values(statuses).filter(s => s === 'done').length, [statuses])
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
                    {fileData.length} {fileData.length === 1 ? 'image' : 'images'} selected
                  </p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    {doneCount > 0 && `${doneCount} uploaded • `}
                    {(fileData.reduce((sum, p) => sum + p.size, 0) / 1024 / 1024).toFixed(2)} MB total
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
                  onRemove={() => handleRemoveFile(idx)}
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
