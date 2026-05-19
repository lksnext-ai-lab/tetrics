'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { AdminOnlyButton } from '@/components/ui/admin-only-button';
import { PlusCircle, ChevronLeft, LogOut, User } from 'lucide-react';

interface HeaderProps {
  onAddMeasure?: () => void;
  /** Optional handler to navigate back to goals listing */
  onBack?: () => void;
  /** Optional handler when clicking logo/title */
  onLogoClick?: () => void;
  /** Whether to show the Add Measure button */
  showActionButtons?: boolean;
  /** Whether admin-only actions are allowed */
  canManage?: boolean;
  /** Current authenticated user info */
  username?: string;
  onLogout?: () => void;
}

export function Header({ onAddMeasure, onBack, onLogoClick, showActionButtons = true, canManage = true, username, onLogout }: Readonly<HeaderProps>) {
  return (
    <header className="flex items-center justify-between p-4 border-b bg-card shadow-sm sticky top-0 z-10">
      <div className="flex items-center gap-3">
        {onBack && (
          <Button variant="ghost" onClick={onBack} className="mr-2">
            <ChevronLeft className="mr-2 h-4 w-4" />
            <span className="hidden sm:inline">Back to goals</span>
          </Button>
        )}
        <button
          onClick={onLogoClick}
          aria-label="Go to home"
          className="flex items-center gap-3 bg-transparent border-0 p-0"
        >
          <div className="flex items-center h-12 w-12">
            <img src="/Tetrics_logo.svg" alt="Tetrics Logo" className="object-contain h-full w-full" />
          </div>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight font-headline">Tetrics</h1>
        </button>
      </div>
      <div className="flex items-center gap-2">
        {showActionButtons && onAddMeasure && (
          <AdminOnlyButton
            allowed={canManage}
            tooltip="Admin role required to add LLM tools."
            onClick={onAddMeasure}
          >
            <PlusCircle className="mr-2 h-4 w-4" />
            <span className="hidden sm:inline">Add New Measure</span>
          </AdminOnlyButton>
        )}
        {username && (
          <div className="flex items-center gap-2 ml-2 pl-2 border-l">
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <User className="h-4 w-4" />
              <span className="hidden md:inline">{username}</span>
            </div>
            {onLogout && (
              <Button variant="ghost" size="sm" onClick={onLogout} title="Sign out">
                <LogOut className="h-4 w-4" />
                <span className="sr-only">Sign out</span>
              </Button>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
