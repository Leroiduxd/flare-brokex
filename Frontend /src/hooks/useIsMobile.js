import { useState, useEffect } from 'react';

/**
 * Custom hook to detect if the viewport width is below a specific breakpoint (default 768px)
 * @param {number} breakpoint - The width in pixels to treat as mobile threshold
 * @returns {boolean} - True if viewport is mobile, false otherwise
 */
export default function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth <= breakpoint;
    }
    return false;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleResize = () => {
      setIsMobile(window.innerWidth <= breakpoint);
    };

    // Listen for resize events
    window.addEventListener('resize', handleResize);
    
    // Clean up
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [breakpoint]);

  return isMobile;
}
