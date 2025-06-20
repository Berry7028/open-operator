"use client";

import React from 'react';
import * as LucideIcons from 'lucide-react';

// Create a wrapper that adds suppressHydrationWarning to any lucide icon
const createHydrationSafeIcon = (Icon: React.ComponentType<any>) => {
  const WrappedIcon = React.forwardRef<any, any>((props, ref) => (
    <Icon {...props} ref={ref} suppressHydrationWarning />
  ));
  
  // Preserve display name for debugging
  if (Icon.displayName) {
    WrappedIcon.displayName = `HydrationSafe${Icon.displayName}`;
  }
  
  return WrappedIcon;
};

// Export all lucide icons with hydration safety
export const MessageSquare = createHydrationSafeIcon(LucideIcons.MessageSquare);
export const History = createHydrationSafeIcon(LucideIcons.History);
export const Settings = createHydrationSafeIcon(LucideIcons.Settings);
export const Trash2 = createHydrationSafeIcon(LucideIcons.Trash2);
export const Menu = createHydrationSafeIcon(LucideIcons.Menu);
export const X = createHydrationSafeIcon(LucideIcons.X);
export const Plus = createHydrationSafeIcon(LucideIcons.Plus);
export const Send = createHydrationSafeIcon(LucideIcons.Send);
export const Bot = createHydrationSafeIcon(LucideIcons.Bot);
export const User = createHydrationSafeIcon(LucideIcons.User);
export const PenSquare = createHydrationSafeIcon(LucideIcons.PenSquare);
export const Clock = createHydrationSafeIcon(LucideIcons.Clock);
export const Archive = createHydrationSafeIcon(LucideIcons.Archive);
export const Loader2 = createHydrationSafeIcon(LucideIcons.Loader2);
export const Globe = createHydrationSafeIcon(LucideIcons.Globe);
export const Check = createHydrationSafeIcon(LucideIcons.Check);
export const AlertCircle = createHydrationSafeIcon(LucideIcons.AlertCircle);
export const Navigation = createHydrationSafeIcon(LucideIcons.Navigation);
export const FileText = createHydrationSafeIcon(LucideIcons.FileText);
export const Eye = createHydrationSafeIcon(LucideIcons.Eye);
export const Brain = createHydrationSafeIcon(LucideIcons.Brain);
export const Sparkles = createHydrationSafeIcon(LucideIcons.Sparkles);
export const ExternalLink = createHydrationSafeIcon(LucideIcons.ExternalLink);
export const SquarePen = createHydrationSafeIcon(LucideIcons.SquarePen);
export const Search = createHydrationSafeIcon(LucideIcons.Search);
export const Activity = createHydrationSafeIcon(LucideIcons.Activity);
export const ArrowRight = createHydrationSafeIcon(LucideIcons.ArrowRight);

// Re-export the wrapper function for custom icons
export { createHydrationSafeIcon }; 