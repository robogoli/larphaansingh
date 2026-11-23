import { useEffect, useState } from 'react';

interface QuoteMarqueeProps {
  quotes: string[];
  visible: boolean;
}

export default function QuoteMarquee({ quotes, visible }: QuoteMarqueeProps) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (!quotes.length || !visible) return;
    setIndex(Math.floor(Math.random() * quotes.length));
    const timer = window.setInterval(() => {
      setIndex((prev) => (prev + 1) % quotes.length);
    }, 6000);
    return () => window.clearInterval(timer);
  }, [quotes, visible]);

  if (!visible || quotes.length === 0) return null;

  const text = quotes[index] || 'WELCOME TO DAKNUX';

  return (
    <div
      className="w-full overflow-hidden border-b border-purple-500/15 dark:border-purple-500/20 bg-purple-500/5 py-1.5"
      aria-live="off"
    >
      <div className="rainbow-marquee-track text-2xl sm:text-3xl leading-none select-none">
        {text}
      </div>
    </div>
  );
}
