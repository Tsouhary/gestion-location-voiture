import { useEffect, useState } from 'react';

const prefersReducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** Fait défiler un nombre de 0 jusqu'à `target` (ease-out). Sans animation si l'utilisateur la désactive. */
export default function useCountUp(target, duration = 900) {
  const [value, setValue] = useState(prefersReducedMotion() ? target : 0);

  useEffect(() => {
    if (prefersReducedMotion() || !target) {
      setValue(target);
      return undefined;
    }
    let frame;
    let start;
    const tick = (now) => {
      start ??= now;
      const progress = Math.min((now - start) / duration, 1);
      setValue(Math.round(target * (1 - (1 - progress) ** 3)));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, duration]);

  return value;
}
