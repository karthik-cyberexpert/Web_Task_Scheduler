import React, { useEffect, useState } from "react";

interface CountUpProps {
  from?: number;
  to: number;
  duration?: number;
  suffix?: string;
}

export const CountUp: React.FC<CountUpProps> = ({
  from = 0,
  to,
  duration = 1.5,
  suffix = "",
}) => {
  const [count, setCount] = useState(from);

  useEffect(() => {
    let startTimestamp: number | null = null;
    const step = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / (duration * 1000), 1);
      setCount(Math.floor(progress * (to - from) + from));
      if (progress < 1) {
        window.requestAnimationFrame(step);
      }
    };
    window.requestAnimationFrame(step);
  }, [from, to, duration]);

  return (
    <span>
      {count}
      {suffix}
    </span>
  );
};

export default CountUp;
