"use client"
import React, { useEffect } from 'react';

const SmokeEffect = () => {
  useEffect(() => {
    const smokeContainer = document.getElementById('smoke-container');

    if (smokeContainer) {
      const handleMouseMove = (e: MouseEvent) => {
        let smoke = document.createElement('div');
        smoke.className = 'smoke';
        smoke.style.left = e.clientX + 'px';
        smoke.style.top = e.clientY + 'px';
        smokeContainer.appendChild(smoke);

        setTimeout(() => {
          smoke.remove();
        }, 2000);
      };

      document.addEventListener('mousemove', handleMouseMove);

      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
      };
    }
  }, []);

  return <div id="smoke-container" className="fixed top-0 left-0 w-full h-full pointer-events-none z-50"></div>;
};

export default SmokeEffect;