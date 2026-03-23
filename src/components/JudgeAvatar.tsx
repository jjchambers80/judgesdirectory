"use client";

import Image from "next/image";
import {
  Avatar,
  AvatarFallback,
} from "@/components/ui/avatar";

interface JudgeAvatarProps {
  photoUrl: string | null;
  fullName: string;
  size?: "xs" | "sm" | "lg";
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

const sizeConfig = {
  xs: { dimensions: "w-8 h-8", px: 32, text: "text-xs", rounding: "rounded-full" },
  sm: { dimensions: "w-11 h-11", px: 44, text: "text-sm", rounding: "rounded-full" },
  lg: { dimensions: "w-[150px] h-[180px]", px: 150, pxH: 180, text: "text-3xl", rounding: "rounded-lg" },
} as const;

export default function JudgeAvatar({
  photoUrl,
  fullName,
  size = "lg",
}: JudgeAvatarProps) {
  const cfg = sizeConfig[size];
  const w = cfg.px;
  const h = "pxH" in cfg ? cfg.pxH : cfg.px;

  if (photoUrl) {
    return (
      <div className={`${cfg.dimensions} shrink-0 ${cfg.rounding} overflow-hidden`}>
        <Image
          src={photoUrl}
          alt={`Photo of Judge ${fullName}`}
          width={w}
          height={h}
          className={`object-cover w-full h-full ${cfg.rounding}`}
        />
      </div>
    );
  }

  return (
    <Avatar className={`${cfg.dimensions} ${cfg.rounding} shrink-0`}>
      <AvatarFallback className={`${cfg.rounding} ${cfg.text} font-semibold bg-muted text-muted-foreground`}>
        {getInitials(fullName)}
      </AvatarFallback>
    </Avatar>
  );
}
