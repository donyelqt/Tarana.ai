"use client"
import { useEffect, useRef, useState } from 'react'

const MAX_PARTICLES = 30
const SPAWN_INTERVAL = 100 // ms

const SmokeEffect = () => {
  const containerRef = useRef<HTMLDivElement>(null)
  const lastSpawnRef = useRef(0)
  const [count, setCount] = useState(0)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const handleMouseMove = (e: MouseEvent) => {
      const now = Date.now()
      if (now - lastSpawnRef.current < SPAWN_INTERVAL) return
      if (count >= MAX_PARTICLES) return

      lastSpawnRef.current = now

      const smoke = document.createElement('div')
      smoke.className = 'smoke'
      smoke.style.setProperty('--x', `${e.clientX}px`)
      smoke.style.setProperty('--y', `${e.clientY}px`)
      container.appendChild(smoke)
      setCount(prev => prev + 1)

      setTimeout(() => {
        smoke.remove()
        setCount(prev => Math.max(0, prev - 1))
      }, 2000)
    }

    document.addEventListener('mousemove', handleMouseMove)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      container.querySelectorAll('.smoke').forEach(el => el.remove())
      setCount(0)
    }
  }, [count])

  return (
    <div
      id="smoke-container"
      ref={containerRef}
      className="fixed top-0 left-0 w-full h-full pointer-events-none z-50"
      aria-hidden="true"
    />
  )
}

export default SmokeEffect
