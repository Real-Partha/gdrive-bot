import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
]

function formatDateDisplay(dateStr) {
  // Convert YYYY-MM-DD to "14 October 2025"
  const [year, month, day] = dateStr.split('-').map(Number)
  return `${day} ${MONTHS[month - 1]} ${year}`
}

export function GalleryGrid({ items = [] }) {
  // Group items by date folder
  const grouped = useMemo(() => {
    const map = {}
    for (const it of items) {
      const folder = it.folder || 'Unknown'
      if (!map[folder]) map[folder] = []
      map[folder].push(it)
    }
    // Sort date keys descending (most recent first)
    const sorted = Object.keys(map).sort((a, b) => b.localeCompare(a))
    return sorted.map(date => ({ date, items: map[date] }))
  }, [items])

  const [expanded, setExpanded] = useState(() => {
    // By default, expand all groups
    const initial = {}
    grouped.forEach(g => { initial[g.date] = true })
    return initial
  })

  const toggleDate = (date) => {
    setExpanded(prev => ({ ...prev, [date]: !prev[date] }))
  }

  if (!items || items.length === 0) {
    return (
      <div className="text-center text-slate-500 dark:text-slate-400 py-8">
        No images found for the selected dates.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {grouped.map(({ date, items: dateItems }) => {
        const isExpanded = expanded[date]
        return (
          <div key={date} className="relative z-[0] rounded-2xl border border-slate-200/60 dark:border-slate-700/60 bg-white/40 dark:bg-slate-800/40 backdrop-blur-sm overflow-hidden">
            {/* Date header */}
            <button
              onClick={() => toggleDate(date)}
              className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-slate-100/50 dark:hover:bg-slate-700/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <motion.div
                  animate={{ rotate: isExpanded ? 90 : 0 }}
                  transition={{ duration: 0.2 }}
                  className="text-slate-600 dark:text-slate-400"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </motion.div>
                <div>
                  <h3 className="font-semibold text-slate-800 dark:text-slate-100">{formatDateDisplay(date)}</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400">{dateItems.length} image{dateItems.length === 1 ? '' : 's'}</p>
                </div>
              </div>
            </button>

            {/* Collapsible grid */}
            <AnimatePresence initial={false}>
              {isExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3, ease: 'easeInOut' }}
                  className="overflow-hidden"
                >
                  <div className="p-4 pt-0">
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                      {dateItems.map((it) => (
                        <motion.a
                          key={it.id}
                          href={it.webViewLink || '#'}
                          target="_blank"
                          rel="noreferrer"
                          className="group block rounded-xl overflow-hidden border border-slate-200/60 dark:border-slate-700/60 bg-white/60 dark:bg-slate-800/60 backdrop-blur-sm"
                          whileHover={{ scale: 1.01 }}
                          transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                          title={it.name}
                        >
                          <div className="aspect-square w-full relative bg-slate-100 dark:bg-slate-900">
                            <img
                              decoding="async"
                              src={`http://localhost:8000/preview/${it.id}`}
                              alt={it.name}
                              className="absolute inset-0 w-full h-full object-cover"
                            />
                            <div className="absolute bottom-0 left-0 right-0 p-1.5 text-[11px] truncate bg-gradient-to-t from-black/60 via-black/20 to-transparent text-white opacity-0 group-hover:opacity-100 transition-opacity">
                              {it.name}
                            </div>
                          </div>
                        </motion.a>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )
      })}
    </div>
  )
}
