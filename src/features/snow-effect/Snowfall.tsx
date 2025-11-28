import { motion } from "framer-motion";
import { useMemo } from "react";
import { useSnowEffectStore } from "../../store/snow-effect-store";

interface SnowflakeProps {
  delay: number;
  duration: number;
  x: number;
  size: number;
  opacity: number;
  rotation: number;
}

const IceSnowflake = () => (
  <svg
    viewBox="0 0 32 32"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <line x1="16" y1="4" x2="16" y2="28" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
    <line x1="6" y1="9.5" x2="26" y2="22.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
    <line x1="6" y1="22.5" x2="26" y2="9.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" />

    <line x1="16" y1="8" x2="13" y2="11" stroke="white" strokeWidth="1" strokeLinecap="round" />
    <line x1="16" y1="8" x2="19" y2="11" stroke="white" strokeWidth="1" strokeLinecap="round" />
    <line x1="16" y1="24" x2="13" y2="21" stroke="white" strokeWidth="1" strokeLinecap="round" />
    <line x1="16" y1="24" x2="19" y2="21" stroke="white" strokeWidth="1" strokeLinecap="round" />

    <line x1="10" y1="12" x2="12" y2="9" stroke="white" strokeWidth="1" strokeLinecap="round" />
    <line x1="10" y1="12" x2="8" y2="14" stroke="white" strokeWidth="1" strokeLinecap="round" />
    <line x1="22" y1="20" x2="24" y2="18" stroke="white" strokeWidth="1" strokeLinecap="round" />
    <line x1="22" y1="20" x2="20" y2="23" stroke="white" strokeWidth="1" strokeLinecap="round" />

    <line x1="10" y1="20" x2="8" y2="18" stroke="white" strokeWidth="1" strokeLinecap="round" />
    <line x1="10" y1="20" x2="12" y2="23" stroke="white" strokeWidth="1" strokeLinecap="round" />
    <line x1="22" y1="12" x2="20" y2="9" stroke="white" strokeWidth="1" strokeLinecap="round" />
    <line x1="22" y1="12" x2="24" y2="14" stroke="white" strokeWidth="1" strokeLinecap="round" />

    <circle cx="16" cy="16" r="2.5" stroke="white" strokeWidth="1" fill="none" />
  </svg>
);

function Snowflake({ delay, duration, x, size, opacity, rotation }: SnowflakeProps) {
  return (
    <motion.div
      className="absolute pointer-events-none"
      initial={{
        top: "-5%",
        left: `${x}%`,
        opacity: 0,
        rotate: rotation,
      }}
      animate={{
        top: "105%",
        opacity: [0, opacity, opacity, 0],
        rotate: rotation + 360,
      }}
      transition={{
        duration,
        delay,
        repeat: Infinity,
        ease: "linear",
      }}
      style={{
        width: size,
        height: size,
        filter: "drop-shadow(0 0 4px rgba(255, 255, 255, 0.6))",
      }}
    >
      <IceSnowflake />
    </motion.div>
  );
}

export function Snowfall() {
  const { snowIntensity } = useSnowEffectStore();

  const snowflakeCount = Math.round(20 + (snowIntensity / 100) * 180);

  const snowflakes = useMemo(() => {
    return Array.from({ length: snowflakeCount }, (_, i) => ({
      id: i,
      delay: Math.random() * 10,
      duration: Math.random() * 10 + 14,
      x: Math.random() * 100,
      size: Math.random() * 22 + 10,
      opacity: Math.random() * 0.6 + 0.25,
      rotation: Math.random() * 360,
    }));
  }, [snowflakeCount]);

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-50">
      {snowflakes.map((flake) => (
        <Snowflake key={flake.id} {...flake} />
      ))}
    </div>
  );
}
