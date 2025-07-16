"use client";

import { useEffect, useRef } from "react";
import { useThemeStore } from "../../../store/useThemeStore";
import { Icon } from "@iconify/react";
import { Card } from "../../ui/Card";
import { gsap } from "gsap";
import { Button } from "../../ui/buttons/Button";
import { cn } from "../../../lib/utils";

interface WizardSidebarProps {
  currentStep: number;
  totalSteps: number;
  stepTitles: string[];
  stepIcons: string[];
  onStepClick: (step: number) => void;
  isStepValid: (step: number) => boolean;
}

export function WizardSidebar({
  currentStep,
  totalSteps,
  stepTitles,
  stepIcons,
  onStepClick,
  isStepValid,
}: WizardSidebarProps) {
  const accentColor = useThemeStore((state) => state.accentColor);
  const isBackgroundAnimationEnabled = useThemeStore(
    (state) => state.isBackgroundAnimationEnabled,
  );
  const sidebarRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const stepsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isBackgroundAnimationEnabled) {
      if (sidebarRef.current) {
        gsap.fromTo(
          sidebarRef.current,
          { opacity: 0, x: -20 },
          {
            opacity: 1,
            x: 0,
            duration: 0.4,
            ease: "power2.out",
          },
        );
      }

      if (headerRef.current) {
        gsap.fromTo(
          headerRef.current,
          { opacity: 0, y: -10 },
          {
            opacity: 1,
            y: 0,
            duration: 0.4,
            delay: 0.1,
            ease: "power2.out",
          },
        );
      }

      if (stepsRef.current) {
        gsap.fromTo(
          stepsRef.current.children,
          { opacity: 0, x: -10 },
          {
            opacity: 1,
            x: 0,
            duration: 0.3,
            stagger: 0.1,
            delay: 0.2,
            ease: "power2.out",
          },
        );
      }
    }
  }, [isBackgroundAnimationEnabled]);

  return (
    <Card
      ref={sidebarRef}
      className="w-64 overflow-y-auto custom-scrollbar bg-black/20 border border-white/10 p-4"
      variant="flat"
    >
      <div className="space-y-3">
        <Card
          ref={headerRef}
          variant="flat"
          className="mb-6 p-3 bg-black/30 border border-white/10"
        >
          <div className="flex items-center gap-2">
            <Icon
              icon="solar:magic-stick-bold"
              className="w-5 h-5 text-white"
            />
            <span className="text-xl font-minecraft text-white lowercase">
              profile creation
            </span>
          </div>
        </Card>

        <div ref={stepsRef} className="space-y-3">
          {Array.from({ length: totalSteps }).map((_, index) => {
            const stepNumber = index + 1;
            const isActive = currentStep === stepNumber;
            const isPast = stepNumber < currentStep;
            const isClickable =
              stepNumber <= currentStep || isStepValid(currentStep);
            const isValid = isStepValid(stepNumber);
            const isCompleted = isPast && isValid;

            return (
              <div key={`step-${stepNumber}`} className="w-full">
                <Button
                  variant={isActive ? "default" : "ghost"}
                  size="lg"
                  className={cn(
                    "w-full text-left justify-start p-3 transition-all duration-200",
                    isActive
                      ? "bg-black/30 border-accent border-b-[3px] hover:bg-black/30"
                      : "bg-transparent hover:bg-black/20 border-transparent",
                    !isClickable && "opacity-50 cursor-not-allowed",
                  )}
                  onClick={() => {
                    if (isClickable && stepNumber !== currentStep) {
                      onStepClick(stepNumber);
                    }
                  }}
                  disabled={!isClickable}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 flex items-center justify-center">
                      {isCompleted ? (
                        <Icon
                          icon="solar:check-circle-bold"
                          className="w-6 h-6 text-green-500"
                        />
                      ) : (
                        <Icon
                          icon={stepIcons[index]}
                          className={cn(
                            "w-6 h-6",
                            isActive ? "text-accent" : "text-white/70",
                          )}
                        />
                      )}
                    </div>
                    <span className="font-minecraft text-3xl lowercase">
                      {stepTitles[index]}
                    </span>
                  </div>
                </Button>
              </div>
            );
          })}
        </div>
      </div>
    </Card>
  );
}
