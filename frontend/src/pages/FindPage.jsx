import { useState } from 'react'
import { motion } from 'framer-motion'
import { Button } from '../components/Button'
import { GalleryGrid } from '../components/GalleryGrid'
import { DatePicker } from '../components/DatePicker'

const API_BASE = 'http://localhost:8000'

export default function FindPage() {
  const today = new Date().toISOString().slice(0, 10)
  const [startDate, setStartDate] = useState(today)
  const [endDate, setEndDate] = useState(today)
  const [loading, setLoading] = useState(false)
  const [items, setItems] = useState([])
  const [folders, setFolders] = useState([])

  const onSearch = async () => {
    if (!startDate) return
    setLoading(true)
    try {
      const params = new URLSearchParams({ start: startDate })
      if (endDate) params.set('end', endDate)
      const resp = await fetch(`${API_BASE}/find_photos?${params.toString()}`)
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
      const data = await resp.json()
      setItems(Array.isArray(data.items) ? data.items : [])
      setFolders(Array.isArray(data.folders) ? data.folders : [])
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

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

      <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <motion.header
          initial={{ opacity: 0, y: -30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-8"
        >
          <motion.h1
            className="text-4xl md:text-5xl font-black mb-2 bg-gradient-to-r from-brand-600 via-purple-600 to-pink-600 dark:from-brand-400 dark:via-purple-400 dark:to-pink-400 bg-clip-text text-transparent"
            animate={{ backgroundPosition: ['0%', '100%', '0%'] }}
            transition={{ repeat: Infinity, duration: 5, ease: 'linear' }}
          >
            Find Photos
          </motion.h1>
          <p className="text-slate-600 dark:text-slate-400">
            Select a date or range to browse images and videos from your date folders in Drive.
          </p>
        </motion.header>

        {/* Controls */}
        <div className="mb-6 p-6 rounded-2xl bg-white/50 dark:bg-slate-800/50 backdrop-blur-xl border border-slate-200/50 dark:border-slate-700/50 relative z-[101]">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <DatePicker 
              label="Start date" 
              value={startDate} 
              onChange={setStartDate} 
            />
            <DatePicker 
              label="End date" 
              value={endDate} 
              onChange={setEndDate} 
            />
          </div>
          <div className="flex justify-center">
            <Button onClick={onSearch} loading={loading} variant="primary" className="px-8">
              {loading ? 'Searching...' : 'Search Photos'}
            </Button>
          </div>
          {folders.length > 0 && (() => {
            const vids = items.filter(it => it.isVideo).length
            const imgs = items.length - vids
            return (
              <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700 text-center text-sm text-slate-600 dark:text-slate-400">
                Found {folders.length} folder{folders.length === 1 ? '' : 's'} with {imgs} {imgs === 1 ? 'image' : 'images'} and {vids} {vids === 1 ? 'video' : 'videos'}
              </div>
            )
          })()}
        </div>

        {/* Grid */}
        <GalleryGrid items={items} />
      </div>
    </div>
  )
}
