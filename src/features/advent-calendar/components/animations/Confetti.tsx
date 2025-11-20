import { motion } from "framer-motion";
import { useEffect, useState } from "react";

const COLORS = ["#FFC700", "#FF0000", "#2E3192", "#41BBC7"];

export function Confetti() {
  const [particles, setParticles] = useState<{ id: number; x: number; color: string; delay: number }[]>([]);

  useEffect(() => {
    const newParticles = Array.from({ length: 50 }).map((_, i) => ({
      id: i,
      x: Math.random() * 100,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      delay: Math.random() * 2,
    }));
    setParticles(newParticles);
  }, []);

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-10">
      {particles.map((p) => (
        <motion.div
          key={p.id}
          initial={{ y: -20, rotate: 0 }}
          animate={{ y: "120vh", rotate: 360 }}
          transition={{
            duration: 2.5,
            delay: p.delay,
            repeat: Infinity,
            ease: "linear",
          }}
          style={{
            position: "absolute",
            left: `${p.x}%`,
            top: 0,
            width: "10px",
            height: "10px",
            backgroundColor: p.color,
          }}
        />
      ))}
    </div>
  );
}
