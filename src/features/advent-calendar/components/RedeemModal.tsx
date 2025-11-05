import { AnimatePresence, motion } from "framer-motion";
import { Icon } from "@iconify/react";
import { Card } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/buttons/Button";
import { useThemeStore } from "../../../store/useThemeStore";
import { createRadiusStyle } from "../../../components/ui/design-system";
import type { RedeemFeedback } from "../types";

interface RedeemModalProps {
  feedback: RedeemFeedback | null;
  onDismiss: () => void;
}

const backdropVariants = {
  hidden: { opacity: 0, backdropFilter: "blur(0px)" },
  visible: {
    opacity: 1,
    backdropFilter: "blur(8px)",
    transition: { duration: 0.25, ease: "easeOut" },
  },
  exit: {
    opacity: 0,
    backdropFilter: "blur(0px)",
    transition: { duration: 0.2, ease: "easeIn" },
  },
};

const modalVariants = {
  hidden: {
    opacity: 0,
    scale: 0.75,
    y: 60,
    rotateX: 15,
    filter: "blur(12px)",
  },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    rotateX: 0,
    filter: "blur(0px)",
    transition: {
      type: "spring",
      stiffness: 200,
      damping: 18,
      duration: 0.5,
    },
  },
  exit: {
    opacity: 0,
    scale: 0.5,
    y: -100,
    rotateX: -25,
    rotateY: 15,
    rotateZ: -10,
    filter: "blur(20px)",
    transition: { 
      type: "spring",
      stiffness: 250,
      damping: 25,
      duration: 0.6,
    },
  },
};

const iconVariants = {
  hidden: { scale: 0, rotate: -180, opacity: 0 },
  visible: {
    scale: 1,
    rotate: 0,
    opacity: 1,
    transition: {
      type: "spring",
      stiffness: 180,
      damping: 12,
      delay: 0.15,
    },
  },
  exit: {
    scale: 0.3,
    rotate: 180,
    opacity: 0,
    transition: {
      type: "spring",
      stiffness: 200,
      damping: 20,
      duration: 0.5,
    },
  },
};

const glowVariants = {
  animate: {
    scale: [1, 1.4, 1],
    opacity: [0.3, 0.8, 0.5],
    transition: {
      duration: 1.2,
      ease: "easeOut",
    },
  },
};

export function RedeemModal({ feedback, onDismiss }: RedeemModalProps) {
  const accentColor = useThemeStore((state) => state.accentColor);
  const borderRadius = useThemeStore((state) => state.borderRadius);

  return (
    <AnimatePresence mode="wait">
      {feedback && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-6"
          initial="hidden"
          animate="visible"
          exit="exit"
          variants={backdropVariants}
          style={{
            backgroundColor: "rgba(0, 0, 0, 0.75)",
          }}
        >
          <motion.div
            className="relative max-w-md w-full"
            variants={modalVariants}
            onClick={(e) => e.stopPropagation()}
            style={{ perspective: "1200px" }}
          >
            <motion.div
              className="absolute inset-0 -z-10 rounded-3xl blur-3xl"
              style={{
                background: accentColor.shadowValue,
              }}
              variants={glowVariants}
              animate="animate"
              aria-hidden="true"
            />

            <Card
              variant="flat-no-hover"
              className="relative overflow-hidden p-8 flex flex-col items-center gap-6 shadow-[0_0_40px_rgba(0,0,0,0.6)]"
            >
              <div
                className="absolute inset-0 opacity-10"
                style={{
                  background: `radial-gradient(circle at 50% 50%, ${accentColor.value}, transparent 70%)`,
                }}
                aria-hidden="true"
              />

              <div className="relative flex flex-col items-center gap-5 z-10">
                <motion.div
                  className="relative"
                  variants={iconVariants}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                >
                  {/* Particle effects */}
                  {[...Array(8)].map((_, i) => (
                    <motion.div
                      key={i}
                      className="absolute w-2 h-2 rounded-full"
                      style={{
                        backgroundColor: accentColor.value,
                        left: '50%',
                        top: '50%',
                      }}
                      initial={{ scale: 0, x: 0, y: 0, opacity: 1 }}
                      animate={{
                        scale: [0, 1, 0.5],
                        x: [0, Math.cos(i * Math.PI / 4) * 80],
                        y: [0, Math.sin(i * Math.PI / 4) * 80],
                        opacity: [1, 0.8, 0],
                      }}
                      transition={{
                        duration: 1.2,
                        delay: 0.3 + i * 0.05,
                        ease: "easeOut",
                      }}
                    />
                  ))}
                  
                  <Icon
                    icon="solar:gift-bold"
                    className="w-24 h-24 drop-shadow-[0_6px_20px_rgba(0,0,0,0.5)]"
                    style={{ color: accentColor.value }}
                  />
                </motion.div>

                <motion.div 
                  className="flex flex-col items-center gap-2 text-center"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20, transition: { duration: 0.3 } }}
                  transition={{ delay: 0.2, duration: 0.4 }}
                >
                  <h2 className="font-minecraft text-5xl lowercase text-white drop-shadow-[0_4px_12px_rgba(0,0,0,0.5)]">
                    türchen {feedback.day.toString().padStart(2, "0")}
                  </h2>
                  <p
                    className="font-minecraft-ten text-base text-white/85 normal-case"
                    role="status"
                    aria-live="polite"
                  >
                    erfolgreich geöffnet!
                  </p>
                </motion.div>

                <motion.div
                  className="w-full max-w-xs p-5 rounded-xl text-center"
                  style={{
                    backgroundColor: `${accentColor.value}15`,
                    border: `2px solid ${accentColor.value}40`,
                    ...createRadiusStyle(borderRadius, 0.8),
                  }}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8, transition: { duration: 0.35 } }}
                  transition={{ delay: 0.4, duration: 0.35 }}
                >
                  <span className="font-minecraft-ten text-lg text-white normal-case leading-relaxed">
                    {feedback.reward}
                  </span>
                </motion.div>
              </div>

              <motion.div
                className="w-full flex justify-center pt-2 z-10"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ 
                  opacity: 0, 
                  scale: 2.5,
                  y: -150,
                  rotate: 720,
                  filter: "blur(20px)",
                  transition: { duration: 0.8, ease: [0.68, -0.55, 0.27, 1.55] } 
                }}
                transition={{ delay: 0.5, duration: 0.35 }}
              >
                <motion.div
                  whileHover={{ scale: 1.08, y: -3 }}
                  whileTap={{ scale: 0.92 }}
                  transition={{ type: "spring", stiffness: 400, damping: 20 }}
                >
                  <Button
                    variant="3d"
                    size="md"
                    onClick={onDismiss}
                    className="min-w-[140px]"
                    icon={
                      <Icon icon="solar:check-circle-bold" className="w-5 h-5" />
                    }
                  >
                    claim
                  </Button>
                </motion.div>
              </motion.div>
            </Card>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
