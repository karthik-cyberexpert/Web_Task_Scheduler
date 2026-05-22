import React from "react";

interface BlurRevealProps {
  text: string;
  className?: string;
  duration?: number;
  delay?: number;
}

export const BlurReveal: React.FC<BlurRevealProps> = ({
  text,
  className = "",
  duration = 0.8,
  delay = 0,
}) => {
  return (
    <span
      className={`blur-reveal ${className}`}
      style={{
        animationDuration: `${duration}s`,
        animationDelay: `${delay}s`,
      }}
    >
      {text}
    </span>
  );
};

export default BlurReveal;
