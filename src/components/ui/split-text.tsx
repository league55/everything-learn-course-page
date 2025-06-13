import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'

interface SplitTextProps {
  text: string
  className?: string
  delay?: number
}

export function SplitText({ text, className, delay = 0 }: SplitTextProps) {
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(true)
    }, delay)

    return () => clearTimeout(timer)
  }, [delay])

  return (
    <div className={cn('split-text', className)}>
      {text.split('').map((char, index) => (
        <span
          key={index}
          className={cn(
            'inline-block transition-all duration-800 ease-out',
            isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-full'
          )}
          style={{
            animationDelay: isVisible ? `${index * 0.05}s` : undefined,
          }}
        >
          {char === ' ' ? '\u00A0' : char}
        </span>
      ))}
    </div>
  )
}