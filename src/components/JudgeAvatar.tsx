"use client";

import Image from "next/image";
import {
  Avatar,
  AvatarFallback,
} from "@/components/ui/avatar";

interface JudgeAvatarProps {
  photoUrl: string | null;
  fullName: string;
  size?: "sm" | "lg";
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

export default function JudgeAvatar({
  photoUrl,
  fullName,
  size = "lg",
}: JudgeAvatarProps) {
  const dimensions = size === "lg"
    ? "w-[150px] h-[180px]"
    : "w-11 h-11";

  const textSize = size === "lg" ? "text-3xl" : "text-lg";

  if (photoUrl) {
    return (
      <div className={`${dimensions} shrink-0 rounded-lg overflow-hidden`}>
        <Image
          src={photoUrl}
          alt={`Photo of Judge ${fullName}`}
          width={size === "lg" ? 150 : 44}
          height={size === "lg" ? 180 : 44}
          className="object-cover w-full h-full rounded-lg"
        />
      </div>
    );
  }

  return (
    <Avatar className={`${dimensions} rounded-lg shrink-0`}>
      <AvatarFallback className={`rounded-lg ${textSize} font-semibold bg-muted text-muted-foreground`}>
        {getInitials(fullName)}
      </AvatarFallback>
    </Avatar>
  );
}
