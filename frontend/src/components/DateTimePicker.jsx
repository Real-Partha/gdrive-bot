import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
]

export function DateTimePicker({ value, onChange, label }) {
  const [isOpen, setIsOpen] = useState(false)
  const [viewDate, setViewDate] = useState(() => {
    if (value) {
      try {
        const dt = new Date(value)
        return { year: dt.getFullYear(), month: dt.getMonth() }
      } catch (e) {
        // fallthrough
      }
    }
    const now = new Date()
    return { year: now.getFullYear(), month: now.getMonth() }
  })
  
  // Parse current value into date + time (12-hour)
  const parsed = value ? (() => {
    try {
      const dt = new Date(value)
      const year = dt.getFullYear()
      const month = dt.getMonth()
      const day = dt.getDate()
      let hour = dt.getHours()
      const minute = dt.getMinutes()
      const period = hour >= 12 ? 'PM' : 'AM'
      if (hour === 0) hour = 12
      else if (hour > 12) hour -= 12
      return { year, month, day, hour, minute, period }
    } catch (e) {
      return null
    }
  })() : null

  const [timeHour, setTimeHour] = useState(parsed?.hour || 12)
  const [timeMinute, setTimeMinute] = useState(parsed?.minute || 0)
  const [timePeriod, setTimePeriod] = useState(parsed?.period || 'AM')

  const containerRef = useRef(null)

  const displayText = parsed
    ? `${parsed.day} ${MONTHS[parsed.month]} ${parsed.year}, ${String(parsed.hour).padStart(2,'0')}:${String(parsed.minute).padStart(2,'0')} ${parsed.period}`
    : 'Select date & time'

  // Close on outside click
  useEffect(() => {
    const handleClick = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false)
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClick)
      return () => document.removeEventListener('mousedown', handleClick)
    }
  }, [isOpen])

  // Calendar logic
  const firstDay = new Date(viewDate.year, viewDate.month, 1).getDay()
  const daysInMonth = new Date(viewDate.year, viewDate.month + 1, 0).getDate()
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1)
  const blanks = Array.from({ length: firstDay }, (_, i) => i)

  const handleDayClick = (day) => {
    // Convert to 24-hour
    let h24 = timeHour
    if (timePeriod === 'PM' && h24 !== 12) h24 += 12
    if (timePeriod === 'AM' && h24 === 12) h24 = 0
    // Build ISO local datetime string
    const m = String(viewDate.month + 1).padStart(2, '0')
    const d = String(day).padStart(2, '0')
    const hh = String(h24).padStart(2, '0')
    const mm = String(timeMinute).padStart(2, '0')
    const iso = `${viewDate.year}-${m}-${d}T${hh}:${mm}`
    onChange(iso)
    setIsOpen(false)
  }

  const prevMonth = () => {
    if (viewDate.month === 0) {
      setViewDate({ year: viewDate.year - 1, month: 11 })
    } else {
      setViewDate({ ...viewDate, month: viewDate.month - 1 })
    }
  }

  const nextMonth = () => {
    if (viewDate.month === 11) {
      setViewDate({ year: viewDate.year + 1, month: 0 })
    } else {
      setViewDate({ ...viewDate, month: viewDate.month + 1 })
    }
  }

  const isSelectedDay = (day) => {
    return parsed && parsed.year === viewDate.year && parsed.month === viewDate.month && parsed.day === day
  }

  const isToday = (day) => {
    const now = new Date()
    return now.getFullYear() === viewDate.year && now.getMonth() === viewDate.month && now.getDate() === day
  }

  const incHour = () => {
    setTimeHour(h => (h === 12 ? 1 : h + 1))
  }
  const decHour = () => {
    setTimeHour(h => (h === 1 ? 12 : h - 1))
  }
  const incMinute = () => {
    setTimeMinute(m => (m + 5) % 60)
  }
  const decMinute = () => {
    setTimeMinute(m => (m - 5 + 60) % 60)
  }
  const togglePeriod = () => {
    setTimePeriod(p => (p === 'AM' ? 'PM' : 'AM'))
  }

  return (
    <div ref={containerRef} className="relative">
      {label && (
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
          {label}
        </label>
      )}
      
      {/* Trigger button */}
      <motion.button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        whileHover={{ scale: 1.01 }}
        whileTap={{ scale: 0.99 }}
        className="w-full px-4 py-3 rounded-xl border-2 border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 font-medium text-left flex items-center justify-between shadow-sm hover:border-brand-400 dark:hover:border-brand-500 transition-colors"
      >
        <span className="flex items-center gap-2">
          <svg className="w-5 h-5 text-brand-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className={parsed ? '' : 'text-slate-400 dark:text-slate-500'}>{displayText}</span>
        </span>
        <motion.svg
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          className="w-5 h-5 text-slate-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </motion.svg>
      </motion.button>

      {/* Dropdown calendar + time */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="absolute z-[100] mt-2 w-full md:w-[520px] p-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl backdrop-blur-xl"
          >
            {/* Month/Year header */}
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-200 dark:border-slate-700">
              <motion.button
                type="button"
                onClick={prevMonth}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </motion.button>
              
              <div className="text-center flex-1">
                <div className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-1">
                  {MONTHS[viewDate.month]}
                </div>
                <div className="flex items-center justify-center gap-2">
                  <motion.button
                    type="button"
                    onClick={() => setViewDate({ ...viewDate, year: viewDate.year - 1 })}
                    whileHover={{ scale: 1.15 }}
                    whileTap={{ scale: 0.9 }}
                    className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 transition-colors"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                  </motion.button>
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300 min-w-[3rem] tabular-nums">
                    {viewDate.year}
                  </span>
                  <motion.button
                    type="button"
                    onClick={() => setViewDate({ ...viewDate, year: viewDate.year + 1 })}
                    whileHover={{ scale: 1.15 }}
                    whileTap={{ scale: 0.9 }}
                    className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 transition-colors"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </motion.button>
                </div>
              </div>

              <motion.button
                type="button"
                onClick={nextMonth}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </motion.button>
            </div>

            {/* Day labels */}
            <div className="grid grid-cols-7 gap-1 mb-2">
              {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => (
                <div key={d} className="text-center text-xs font-semibold text-slate-500 dark:text-slate-400 py-1">
                  {d}
                </div>
              ))}
            </div>

            {/* Main content: calendar + time side by side */}
            <div className="flex flex-col md:flex-row gap-4">
              {/* Calendar grid */}
              <div className="flex-1">
                <div className="grid grid-cols-7 gap-1">
                  {blanks.map(i => (
                    <div key={`blank-${i}`} />
                  ))}
                  {days.map(day => {
                    const selected = isSelectedDay(day)
                    const today = isToday(day)
                    return (
                      <motion.button
                        key={day}
                        type="button"
                        onClick={() => handleDayClick(day)}
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.95 }}
                        className={`
                          aspect-square rounded-lg text-sm font-medium transition-all
                          ${selected 
                            ? 'bg-gradient-to-br from-brand-500 to-purple-600 text-white shadow-lg shadow-brand-500/30' 
                            : today
                              ? 'bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300 border border-brand-300 dark:border-brand-700'
                              : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                          }
                        `}
                      >
                        {day}
                      </motion.button>
                    )
                  })}
                </div>
              </div>

              {/* Time picker */}
              <div className="flex flex-col justify-center items-center border-t md:border-t-0 md:border-l border-slate-200 dark:border-slate-700 pt-3 md:pt-0 md:pl-4">
                <div className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-3 text-center">
                  Select Time
                </div>
                <div className="flex items-center justify-center gap-3">
                  {/* Hour */}
                  <div className="flex flex-col items-center">
                    <motion.button type="button" onClick={incHour} whileHover={{scale:1.1}} whileTap={{scale:0.9}} className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>
                    </motion.button>
                    <div className="w-12 text-center text-lg font-bold text-slate-800 dark:text-slate-100 my-1 tabular-nums">
                      {String(timeHour).padStart(2,'0')}
                    </div>
                    <motion.button type="button" onClick={decHour} whileHover={{scale:1.1}} whileTap={{scale:0.9}} className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                    </motion.button>
                  </div>
                  <div className="text-2xl font-bold text-slate-400 dark:text-slate-600">:</div>
                  {/* Minute */}
                  <div className="flex flex-col items-center">
                    <motion.button type="button" onClick={incMinute} whileHover={{scale:1.1}} whileTap={{scale:0.9}} className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>
                    </motion.button>
                    <div className="w-12 text-center text-lg font-bold text-slate-800 dark:text-slate-100 my-1 tabular-nums">
                      {String(timeMinute).padStart(2,'0')}
                    </div>
                    <motion.button type="button" onClick={decMinute} whileHover={{scale:1.1}} whileTap={{scale:0.9}} className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                    </motion.button>
                  </div>
                  {/* Period */}
                  <motion.button type="button" onClick={togglePeriod} whileHover={{scale:1.05}} whileTap={{scale:0.95}} className="ml-2 px-3 py-2 rounded-lg bg-gradient-to-br from-brand-500 to-purple-600 text-white font-bold text-sm shadow-md">
                    {timePeriod}
                  </motion.button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
