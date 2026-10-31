import React, { useEffect } from 'react'

export function SnowEffect() {
  useEffect(() => {
    const container = document.getElementById('snow-container')
    if (!container) return

    const numFlakes = 30
    for (let i = 0; i < numFlakes; i++) {
      const flake = document.createElement('div')
      flake.classList.add('snowflake')

      const size = Math.random() * 4 + 2
      const left = Math.random() * 100
      const duration = Math.random() * 10 + 10
      const delay = Math.random() * 10

      flake.style.width = `${size}px`
      flake.style.height = `${size}px`
      flake.style.left = `${left}%`
      flake.style.animationDuration = `${duration}s`
      flake.style.animationDelay = `-${delay}s`

      container.appendChild(flake)
    }

    return () => {
      container.innerHTML = ''
    }
  }, [])

  return (
    <>
      {/* Atmospheric Elements */}
      <div className="fixed top-[-10%] right-[-5%] w-[400px] h-[400px] bg-[#3b82f6]/20 blur-[120px] rounded-full -z-10 pointer-events-none"></div>
      <div className="fixed bottom-[-10%] left-[-5%] w-[500px] h-[500px] bg-[#6366f1]/20 blur-[120px] rounded-full -z-10 pointer-events-none"></div>
      <div id="snow-container" className="fixed inset-0 z-0 pointer-events-none mix-blend-overlay"></div>
    </>
  )
}
