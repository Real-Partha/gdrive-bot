import { useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '../components/Button'
import { GalleryGrid } from '../components/GalleryGrid'
import { DatePicker } from '../components/DatePicker'
import { DateTimePicker } from '../components/DateTimePicker'
import { EventDropdown } from '../components/EventDropdown'

const API_BASE = import.meta.env.VITE_API_BASE || window.location.origin

export default function FindPage() {
  const today = new Date().toISOString().slice(0, 10)
  const [startDate, setStartDate] = useState(today)
  const [endDate, setEndDate] = useState(today)
  const [loading, setLoading] = useState(false)
  const [items, setItems] = useState([])
  const [folders, setFolders] = useState([])
  const [mode, setMode] = useState('date') // 'date' | 'events'
  const [events, setEvents] = useState([])
  const [evLoading, setEvLoading] = useState(false)
  const [selectedEventIds, setSelectedEventIds] = useState([])
  const MAX_SELECTED_EVENTS = 5
  const [evName, setEvName] = useState('')
  const [evStart, setEvStart] = useState('') // ISO datetime string
  const [evEnd, setEvEnd] = useState('')
  const [addingEvent, setAddingEvent] = useState(false)

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

  const loadEvents = async () => {
    setEvLoading(true)
    try {
      const resp = await fetch(`${API_BASE}/events`)
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
      const data = await resp.json()
      setEvents(Array.isArray(data.events) ? data.events : [])
    } catch (e) {
      console.error(e)
    } finally {
      setEvLoading(false)
    }
  }

  useEffect(() => {
    if (mode === 'events') loadEvents()
  }, [mode])

  const onAddEvent = async () => {
    if (!evName || !evStart || !evEnd) return
    setAddingEvent(true)
    try {
      const body = { name: evName, start: evStart, end: evEnd }
      const resp = await fetch(`${API_BASE}/events`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
      const data = await resp.json()
      setEvents(Array.isArray(data.events) ? data.events : [])
      setEvName(''); setEvStart(''); setEvEnd('')
    } catch (e) {
      console.error(e)
    } finally {
      setAddingEvent(false)
    }
  }

  const onDeleteEvent = async (id) => {
    try {
      const resp = await fetch(`${API_BASE}/events/${id}`, { method: 'DELETE' })
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
      const data = await resp.json()
      setEvents(Array.isArray(data.events) ? data.events : [])
      // Remove from selection if it was selected
      setSelectedEventIds(prev => prev.filter(x => x !== id))
    } catch (e) {
      console.error(e)
    }
  }

  const toggleSelectEvent = (id) => {
    setSelectedEventIds(prev => {
      const has = prev.includes(id)
      if (has) return prev.filter(x => x !== id)
      if (prev.length >= MAX_SELECTED_EVENTS) return prev // max reached
      return [...prev, id]
    })
  }

  const onSearchEvents = async () => {
    if (selectedEventIds.length === 0) return
    setLoading(true)
    try {
      const resp = await fetch(`${API_BASE}/find_by_events`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ eventIds: selectedEventIds }) })
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

  const summary = useMemo(() => {
    const vids = items.filter(it => it.isVideo).length
    const imgs = items.length - vids
    return { vids, imgs }
  }, [items])

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
            Browse images and videos by date range or by your saved events.
          </p>
        </motion.header>

        {/* Controls */}
        <div className="mb-6 p-6 rounded-2xl bg-white/50 dark:bg-slate-800/50 backdrop-blur-xl border border-slate-200/50 dark:border-slate-700/50 relative z-[101]">
          {/* Mode switch */}
          <div className="flex items-center justify-center gap-4 mb-5">
            <motion.button
              onClick={() => setMode('date')}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              className={`px-6 py-2.5 rounded-lg border font-medium transition-all duration-300 ${mode==='date' ? 'bg-gradient-to-r from-brand-500 to-purple-600 text-white border-brand-500 shadow-lg shadow-brand-500/30' : 'bg-white/70 dark:bg-slate-800/70 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-600 hover:border-brand-400'}`}
            >
              By Date
            </motion.button>
            <motion.button
              onClick={() => setMode('events')}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              className={`px-6 py-2.5 rounded-lg border font-medium transition-all duration-300 ${mode==='events' ? 'bg-gradient-to-r from-brand-500 to-purple-600 text-white border-brand-500 shadow-lg shadow-brand-500/30' : 'bg-white/70 dark:bg-slate-800/70 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-600 hover:border-brand-400'}`}
            >
              By Events
            </motion.button>
          </div>

          <AnimatePresence mode="wait">
            {mode === 'date' ? (
              <motion.div
                key="date-mode"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.3, ease: "easeInOut" }}
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <DatePicker label="Start date" value={startDate} onChange={setStartDate} />
                  <DatePicker label="End date" value={endDate} onChange={setEndDate} />
                </div>
                <div className="flex justify-center">
                  <Button onClick={onSearch} loading={loading} variant="primary" className="px-8">
                    {loading ? 'Searching...' : 'Search Photos'}
                  </Button>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="events-mode"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3, ease: "easeInOut" }}
              >
                {/* Add event form */}
                <div className="mb-4 p-4 rounded-xl bg-gradient-to-br from-brand-50 to-purple-50 dark:from-slate-800/50 dark:to-slate-900/50 border border-brand-200 dark:border-slate-700">
                  <div className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">Add New Event</div>
                  <div className="grid grid-cols-1 gap-3 mb-3">
                    <input 
                      value={evName} 
                      onChange={e=>setEvName(e.target.value)} 
                      placeholder="Event name (e.g., Birthday Party)" 
                      className="px-4 py-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <DateTimePicker label="Start" value={evStart} onChange={setEvStart} />
                      <DateTimePicker label="End" value={evEnd} onChange={setEvEnd} />
                    </div>
                  </div>
                  <Button 
                    onClick={onAddEvent} 
                    disabled={!evName||!evStart||!evEnd||addingEvent} 
                    loading={addingEvent}
                    variant="primary"
                    className="w-full"
                  >
                    {addingEvent ? 'Adding...' : 'Add Event'}
                  </Button>
                </div>

                {/* Event selection dropdown */}
                <div className="mb-4">
                  <div className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Select Events (up to {MAX_SELECTED_EVENTS})
                  </div>
                  {evLoading ? (
                    <div className="p-8 text-center text-slate-500">
                      <svg className="animate-spin h-8 w-8 mx-auto mb-2 text-brand-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
                      </svg>
                      Loading events...
                    </div>
                  ) : (
                    <EventDropdown 
                      events={events}
                      selected={selectedEventIds}
                      onSelectionChange={setSelectedEventIds}
                      maxSelected={MAX_SELECTED_EVENTS}
                      onDelete={onDeleteEvent}
                    />
                  )}
                </div>

                <div className="flex justify-center">
                  <Button 
                    onClick={onSearchEvents} 
                    loading={loading} 
                    disabled={selectedEventIds.length === 0}
                    variant="primary" 
                    className="px-8"
                  >
                    {loading ? 'Searching...' : 'Search by Events'}
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {folders.length > 0 && (
            <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700 text-center text-sm text-slate-600 dark:text-slate-400">
              Found {folders.length} folder{folders.length === 1 ? '' : 's'} with {summary.imgs} {summary.imgs === 1 ? 'image' : 'images'} and {summary.vids} {summary.vids === 1 ? 'video' : 'videos'}
            </div>
          )}
        </div>

        {/* Grid */}
        <GalleryGrid items={items} />
      </div>
    </div>
  )
}
