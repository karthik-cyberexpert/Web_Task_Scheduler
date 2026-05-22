import React from "react";

interface SplitTextProps {
  text: string;
  className?: string;
  delay?: number;
}

export const SplitText: React.FC<SplitTextProps> = ({
  text,
  className = "",
  delay = 30,
}) => {
  const words = text.split(" ");

  return (
    <span className={`split-text ${className}`}>
      {words.map((word, wordIdx) => (
        <span
          key={wordIdx}
          className="split-word"
          style={{ display: "inline-block", whiteSpace: "nowrap" }}
        >
          {word.split("").map((char, charIdx) => {
            const index = wordIdx * 5 + charIdx;
            return (
              <span
                key={charIdx}
                className="split-char animate-reveal"
                style={{
                  display: "inline-block",
                  animationDelay: `${index * delay}ms`,
                }}
              >
                {char}
              </span>
            );
          })}
          {wordIdx < words.length - 1 && (
            <span className="split-space">&nbsp;</span>
          )}
        </span>
      ))}
    </span>
  );
};

export default SplitText;
