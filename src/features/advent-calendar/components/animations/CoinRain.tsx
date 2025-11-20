import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { Icon } from "@iconify/react";

export function CoinRain() {
  const [coins, setCoins] = useState<{ id: number; x: number; delay: number }[]>([]);

  useEffect(() => {
    const newCoins = Array.from({ length: 50 }).map((_, i) => ({
      id: i,
      x: Math.random() * 100, // percent
      delay: Math.random() * 2,
    }));
    setCoins(newCoins);
  }, []);

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-10">
      {coins.map((coin) => (
        <motion.div
          key={coin.id}
          initial={{ y: -50, opacity: 0 }}
          animate={{ y: "120vh", opacity: 1 }}
          transition={{
            duration: 2,
            delay: coin.delay,
            repeat: Infinity,
            ease: "linear",
          }}
          style={{
            position: "absolute",
            left: `${coin.x}%`,
            top: 0,
          }}
        >
          <Icon icon="ph:coins-fill" className="text-yellow-400 w-8 h-8 drop-shadow-md" />
        </motion.div>
      ))}
    </div>
  );
}
