"use client";

interface SkeletonProps {
  className?: string;
  width?: string | number;
  height?: string | number;
  rounded?: string;
}

export default function Skeleton({
  className = "",
  width,
  height,
  rounded = "rounded-md",
}: SkeletonProps) {
  return (
    <div
      className={`animate-pulse bg-neutral-800/60 ${rounded} ${className}`}
      style={{ width, height }}
    />
  );
}
