import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';

// Amicro FadeIn: https://github.com/Subhan-code/Amicro--Micro-transitions-
// Adapted to a short fade and rise with reduced-motion support.

interface FadeInProps {
  children: React.ReactNode;
  duration?: number;
  delay?: number;
  className?: string;
}

export function FadeIn({
  children,
  duration = 0.24,
  delay = 0,
  className = '',
}: FadeInProps) {
  const reducedMotion = useReducedMotion();
  return (
    <motion.div
      initial={reducedMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: reducedMotion ? 0 : duration,
        delay: reducedMotion ? 0 : delay,
        ease: [0.215, 0.61, 0.355, 1], // easeOutCubic
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
