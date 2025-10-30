import { motion } from 'framer-motion'
import { clsx } from 'clsx'
import { useState, useEffect } from 'react'

export function FileItem({ file, index, status, result, onRemove, preview, isVideo = false, videoDuration = null, previewIsLoading = false }) {
    const [imgOk, setImgOk] = useState(true)
    useEffect(() => {
        // Reset image state when preview changes
        setImgOk(true)
    }, [preview])
    const formatDuration = (seconds) => {
        if (!seconds || seconds <= 0) return null
        const s = Math.floor(seconds % 60)
        const m = Math.floor((seconds / 60) % 60)
        const h = Math.floor(seconds / 3600)
        const pad = (n) => String(n).padStart(2, '0')
        return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`
    }
    const statusConfig = {
        idle: {
            label: 'Pending',
            color: 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300',
            icon: '⏳'
        },
        uploading: {
            label: 'Uploading',
            color: 'bg-gradient-to-r from-amber-400 to-orange-500 text-white animate-pulse',
            icon: '📤'
        },
        done: {
            label: 'Done',
            color: 'bg-gradient-to-r from-emerald-400 to-green-500 text-white',
            icon: '✓'
        },
        error: {
            label: 'Error',
            color: 'bg-gradient-to-r from-rose-400 to-red-500 text-white',
            icon: '×'
        },
    }

    const config = statusConfig[status] || statusConfig.idle

    return (
        <motion.li
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: index * 0.05 }}
            className={clsx(
                'group relative overflow-hidden rounded-xl p-4 transition-all duration-300',
                'bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm',
                'border border-slate-200/50 dark:border-slate-700/50',
                'hover:shadow-lg hover:scale-[1.01]'
            )}
        >
            {/* Animated gradient border on hover */}
            <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-brand-500 via-purple-500 to-pink-500 opacity-0 group-hover:opacity-20 blur-xl transition-opacity duration-300" />

            {/* Remove button - only show if not uploaded yet */}
            {status !== 'done' && onRemove && (
                <motion.button
                    initial={{ opacity: 0, scale: 0 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.2 }}
                    onClick={onRemove}
                    disabled={status === 'uploading'}
                    className={clsx(
                        'absolute top-2 right-2 z-20 w-7 h-7 rounded-full flex items-center justify-center',
                        'bg-white/60 dark:bg-slate-800/60 backdrop-blur-sm',
                        'border border-slate-300/50 dark:border-slate-600/50',
                        'hover:bg-white dark:hover:bg-slate-700/50 hover:border-rose-400 dark:hover:border-rose-600',
                        'transition-all duration-200',
                        'disabled:opacity-50 disabled:cursor-not-allowed',
                        'hover:scale-110'
                    )}
                    aria-label="Remove file"
                >
                    <svg className="w-3.5 h-3.5 text-slate-600 dark:text-slate-300 hover:text-rose-600 dark:hover:text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </motion.button>
            )}

            <div className="relative z-10 flex items-start gap-4 pr-20">
                {/* Image/Video preview thumbnail */}
                {preview && imgOk ? (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.3 }}
                        className="relative shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 border-slate-200/50 dark:border-slate-700/50 shadow-md"
                    >
                        <img
                            src={preview}
                            alt={file.name}
                            className="w-full h-full object-cover"
                            onError={() => setImgOk(false)}
                        />
                        {previewIsLoading && (
                          <div className="absolute inset-0 bg-black/20 backdrop-blur-[1px] flex items-center justify-center">
                            <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
                            </svg>
                          </div>
                        )}
                        {isVideo && (
                            <div className="absolute top-1 left-1 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-black/60 text-white backdrop-blur-sm">
                                <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
                                {formatDuration(videoDuration) || 'video'}
                            </div>
                        )}
                    </motion.div>
                ) : (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.3 }}
                        className="relative shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 border-slate-300/60 dark:border-slate-600/60 shadow-md bg-slate-100 dark:bg-slate-800"
                    >
                        {/* Loader for pending previews */}
                        {previewIsLoading ? (
                          <div className="absolute inset-0 flex items-center justify-center">
                            <svg className="animate-spin h-5 w-5 text-slate-500 dark:text-slate-300" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
                            </svg>
                          </div>
                        ) : (
                          <div className="absolute inset-0 flex items-center justify-center text-slate-500 dark:text-slate-400">
                            {isVideo ? (
                              <img src="/video-preview.png" alt="video placeholder" className="w-full h-full object-cover" />
                            ) : (
                              <img src="/image-preview.png" alt="image placeholder" className="w-full h-full object-cover" />
                            )}
                          </div>
                        )}
                    </motion.div>
                )}

                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                        <motion.span
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                            className="text-xl"
                        >
                            {isVideo ? '🎬' : '📷'}
                        </motion.span>
                        <p className="font-semibold text-slate-800 dark:text-slate-100 truncate">
                            {file.name}
                        </p>
                    </div>

                    <p className="text-sm text-slate-500 dark:text-slate-400 mb-2">
                        {(file.size / 1024).toFixed(1)} KB • {file.type || 'image'}
                    </p>

                    {/* Preview not available badge */}
                    {preview && !imgOk && (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9, y: -5 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            transition={{ duration: 0.3 }}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/50 mb-2"
                        >
                            <motion.span
                                animate={{ rotate: [-8, -4, 4, -4, -8] }} // Less rotation (-4/4 degrees)
                                transition={{
                                    repeat: Infinity,
                                    duration: 0.8, // Much slower (1.5 seconds)
                                    ease: "easeInOut",
                                }}
                            >
                                ⚠️
                            </motion.span>
                            Preview not available (HEIC?)
                        </motion.div>
                    )}

                    {status === 'uploading' && (
                        <motion.div
                            className="h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden mb-2"
                            initial={{ width: 0 }}
                            animate={{ width: '100%' }}
                        >
                            <motion.div
                                className="h-full bg-gradient-to-r from-brand-500 via-purple-500 to-pink-500"
                                initial={{ x: '-100%' }}
                                animate={{ x: '100%' }}
                                transition={{ repeat: Infinity, duration: 1.5, ease: 'linear' }}
                            />
                        </motion.div>
                    )}

                    {result?.newName && (
                        <motion.p
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="text-sm text-emerald-600 dark:text-emerald-400 font-medium"
                        >
                            → {result.newName} in <span className="font-mono">{result.dateFolder}</span>
                            {result.uploadTime && (
                                <span className="ml-2 text-xs text-slate-500 dark:text-slate-400">
                                    ({result.uploadTime})
                                </span>
                            )}
                        </motion.p>
                    )}

                    {result?.error && (
                        <motion.p
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="text-sm text-rose-600 dark:text-rose-400"
                        >
                            {result.error}
                        </motion.p>
                    )}
                </div>

                {/* Status badge - positioned absolutely on the right */}
                <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 25, delay: 0.1 }}
                    className={clsx(
                        'absolute top-1/2 right-3 -translate-y-1/2',
                        'shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5',
                        config.color
                    )}
                >
                    {status === 'done' ? (
                        // Animated checkmark with circle
                        <div className="relative w-5 h-5 flex items-center justify-center">
                            <motion.svg
                                className="absolute inset-0 w-5 h-5"
                                viewBox="0 0 24 24"
                                fill="none"
                                initial={{ pathLength: 0, opacity: 0 }}
                                animate={{ pathLength: 1, opacity: 1 }}
                                transition={{ duration: 0.5, ease: "easeInOut" }}
                            >
                                <motion.circle
                                    cx="12"
                                    cy="12"
                                    r="10"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    fill="none"
                                    initial={{ pathLength: 0, rotate: -90 }}
                                    animate={{ pathLength: 1, rotate: 0 }}
                                    transition={{ duration: 0.6, ease: "easeOut" }}
                                    style={{ originX: "50%", originY: "50%" }}
                                />
                            </motion.svg>
                            <motion.svg
                                className="relative w-3 h-3 text-white"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="3"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                initial={{ pathLength: 0, opacity: 0 }}
                                animate={{ pathLength: 1, opacity: 1 }}
                                transition={{ duration: 0.3, delay: 0.3, ease: "easeOut" }}
                            >
                                <motion.path d="M20 6L9 17l-5-5" />
                            </motion.svg>
                        </div>
                    ) : (
                        <span className="text-base">{config.icon}</span>
                    )}
                    {config.label}
                </motion.div>
            </div>

            {status === 'done' && (
                <motion.div
                    className="absolute inset-0 bg-gradient-to-r from-emerald-500/20 to-green-500/20 pointer-events-none"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: [0, 1, 0] }}
                    transition={{ duration: 1 }}
                />
            )}
        </motion.li>
    )
}
