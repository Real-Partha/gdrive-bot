import { motion } from 'framer-motion'
import { clsx } from 'clsx'

export function Button({ 
  children, 
  onClick, 
  disabled = false, 
  variant = 'primary',
  loading = false,
  className = '',
  ...props 
}) {
  const variants = {
    primary: 'bg-gradient-to-r from-brand-500 via-purple-600 to-pink-600 hover:from-brand-600 hover:via-purple-700 hover:to-pink-700 text-white shadow-lg shadow-brand-500/50',
    secondary: 'bg-gradient-to-r from-slate-700 to-slate-800 dark:from-slate-600 dark:to-slate-700 hover:from-slate-800 hover:to-slate-900 text-white shadow-lg',
    ghost: 'bg-white/10 dark:bg-slate-800/50 backdrop-blur-sm hover:bg-white/20 dark:hover:bg-slate-700/50 text-slate-900 dark:text-white border border-white/20 dark:border-slate-700',
  }

  return (
    <motion.button
      whileHover={{ scale: disabled ? 1 : 1.02 }}
      whileTap={{ scale: disabled ? 1 : 0.98 }}
      onClick={onClick}
      disabled={disabled || loading}
      className={clsx(
        'relative overflow-hidden rounded-xl px-6 py-3 font-semibold transition-all duration-300',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        'focus:outline-none focus:ring-4 focus:ring-brand-500/50',
        variants[variant],
        className
      )}
      {...props}
    >
      {loading && (
        <motion.div
          className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
          animate={{ x: ['-100%', '200%'] }}
          transition={{ repeat: Infinity, duration: 1.5, ease: 'linear' }}
        />
      )}
      <span className="relative z-10 flex items-center justify-center gap-2">
        {loading && (
          <motion.div
            className="h-5 w-5 rounded-full border-2 border-white border-t-transparent"
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 0.8, ease: 'linear' }}
          />
        )}
        {children}
      </span>
    </motion.button>
  )
}
