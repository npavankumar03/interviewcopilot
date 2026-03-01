'use client'

import { useEffect, useCallback } from 'react'

interface KeyboardShortcut {
  key: string
  ctrlKey?: boolean
  shiftKey?: boolean
  altKey?: boolean
  action: () => void
  description: string
}

interface UseKeyboardShortcutsOptions {
  onPauseResume?: () => void
  onCancelAnswer?: () => void
  onForceAnswer?: () => void
  onToggleStyleMenu?: () => void
  enabled?: boolean
}

export function useKeyboardShortcuts({
  onPauseResume,
  onCancelAnswer,
  onForceAnswer,
  onToggleStyleMenu,
  enabled = true
}: UseKeyboardShortcutsOptions) {
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (!enabled) return

    // Ignore if user is typing in an input
    const target = event.target as HTMLElement
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
      return
    }

    const shortcuts: KeyboardShortcut[] = [
      {
        key: ' ',
        action: () => {
          event.preventDefault()
          onPauseResume?.()
        },
        description: 'Pause/Resume listening'
      },
      {
        key: 'Escape',
        action: () => onCancelAnswer?.(),
        description: 'Cancel current answer'
      },
      {
        key: 'Enter',
        ctrlKey: true,
        action: () => onForceAnswer?.(),
        description: 'Force answer now'
      },
      {
        key: 's',
        ctrlKey: true,
        action: () => {
          event.preventDefault()
          onToggleStyleMenu?.()
        },
        description: 'Toggle style menu'
      }
    ]

    const matchingShortcut = shortcuts.find(shortcut => {
      const keyMatch = event.key.toLowerCase() === shortcut.key.toLowerCase()
      const ctrlMatch = shortcut.ctrlKey ? event.ctrlKey || event.metaKey : !event.ctrlKey && !event.metaKey
      const shiftMatch = shortcut.shiftKey ? event.shiftKey : !event.shiftKey
      const altMatch = shortcut.altKey ? event.altKey : !event.altKey

      return keyMatch && ctrlMatch && shiftMatch && altMatch
    })

    if (matchingShortcut) {
      matchingShortcut.action()
    }
  }, [enabled, onPauseResume, onCancelAnswer, onForceAnswer, onToggleStyleMenu])

  useEffect(() => {
    if (enabled) {
      window.addEventListener('keydown', handleKeyDown)
      return () => window.removeEventListener('keydown', handleKeyDown)
    }
  }, [enabled, handleKeyDown])

  return {
    shortcuts: [
      { key: 'Space', description: 'Pause/Resume listening' },
      { key: 'Escape', description: 'Cancel current answer' },
      { key: 'Ctrl+Enter', description: 'Force answer now' },
      { key: 'Ctrl+S', description: 'Toggle style menu' }
    ]
  }
}
