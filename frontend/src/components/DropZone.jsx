import { useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { motion } from 'framer-motion'
import { clsx } from 'clsx'

export function DropZone({ onDrop, disabled = false }) {
  const onDropCallback = useCallback((acceptedFiles) => {
    if (onDrop) onDrop(acceptedFiles)
  }, [onDrop])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: onDropCallback,
    accept: { 'image/*': [], 'video/*': [] },
    disabled,
    multiple: true,
  })

  return (
    <motion.div
      {...getRootProps()}
      className={clsx(
        'relative overflow-hidden rounded-2xl border-2 border-dashed transition-all duration-300 cursor-pointer',
        'bg-gradient-to-br from-white/50 to-white/30 dark:from-slate-800/50 dark:to-slate-900/30',
        'backdrop-blur-xl',
        isDragActive
          ? 'border-brand-500 bg-brand-50/50 dark:bg-brand-900/20 scale-[1.02]'
          : 'border-slate-300 dark:border-slate-700 hover:border-brand-400 dark:hover:border-brand-600',
        disabled && 'opacity-50 cursor-not-allowed'
      )}
      whileHover={{ scale: disabled ? 1 : 1.01 }}
      transition={{ duration: 0.2 }}
    >
      <input {...getInputProps()} />
      <div className="p-12 text-center">
        <motion.div
          animate={isDragActive ? { scale: 1.1, rotate: 5 } : { scale: 1, rotate: 0 }}
          transition={{ duration: 0.2 }}
        >
          <svg
            className={clsx(
              'mx-auto h-16 w-16 mb-4 transition-colors',
              isDragActive
                ? 'text-brand-500'
                : 'text-slate-400 dark:text-slate-600'
            )}
            stroke="currentColor"
            fill="none"
            viewBox="0 0 48 48"
          >
            <path
              d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </motion.div>
        <p className="text-lg font-semibold text-slate-700 dark:text-slate-200 mb-2">
          {isDragActive ? 'Drop files here...' : 'Drag & drop images or videos'}
        </p>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          or click to browse • Supports JPEG, PNG, HEIC, MP4, MOV
        </p>
      </div>

      {/* Animated background gradient */}
      <motion.div
        className="absolute inset-0 bg-gradient-to-r from-brand-500/10 via-purple-500/10 to-pink-500/10 opacity-0"
        animate={isDragActive ? { opacity: 1 } : { opacity: 0 }}
        transition={{ duration: 0.3 }}
      />
    </motion.div>
  )
}
