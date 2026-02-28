'use client'

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { useAuthStore } from '@/stores/auth-store'
import { useRouter } from 'next/navigation'
import {
  Moon,
  Sun,
  Keyboard,
  Bell,
  Database,
  Trash2,
  ArrowLeft,
  Save,
  Loader2,
  AlertTriangle,
  MessageSquare,
  Zap,
  FileText,
  Shield
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

// Settings schema
const settingsSchema = z.object({
  theme: z.enum(['light', 'dark', 'system']),
  defaultResponseStyle: z.enum(['short', 'star', 'detailed', 'technical', 'custom']),
  notifications: z.object({
    emailNotifications: z.boolean(),
    sessionReminders: z.boolean(),
    weeklySummary: z.boolean(),
    productUpdates: z.boolean(),
  }),
  dataRetention: z.object({
    transcripts: z.enum(['7', '30', '90', '365', 'forever']),
    answers: z.enum(['7', '30', '90', '365', 'forever']),
    uploads: z.enum(['7', '30', '90', '365', 'forever']),
  }),
})

type SettingsFormValues = z.infer<typeof settingsSchema>

// Keyboard shortcuts data
const keyboardShortcuts = [
  { keys: ['Space'], description: 'Pause/Resume listening' },
  { keys: ['Escape'], description: 'Cancel current answer' },
  { keys: ['Ctrl', 'Enter'], description: 'Force answer now' },
  { keys: ['Ctrl', 'S'], description: 'Toggle style menu' },
  { keys: ['Ctrl', 'Shift', 'O'], description: 'Toggle stealth mode' },
  { keys: ['Ctrl', 'M'], description: 'Mute/Unmute microphone' },
  { keys: ['Ctrl', 'H'], description: 'Toggle history panel' },
]

// Update settings API call
async function updateSettings(data: SettingsFormValues) {
  const response = await fetch('/api/profile', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ settings: data })
  })
  if (!response.ok) throw new Error('Failed to update settings')
  return response.json()
}

// Delete account API call
async function deleteAccount() {
  const response = await fetch('/api/auth/me', {
    method: 'DELETE'
  })
  if (!response.ok) throw new Error('Failed to delete account')
  return response.json()
}

export default function SettingsPage() {
  const { user, isAuthenticated, isLoading: authLoading, logout } = useAuthStore()
  const router = useRouter()
  const { toast } = useToast()
  const [deleteConfirmation, setDeleteConfirmation] = useState('')
  const [currentTheme, setCurrentTheme] = useState<'light' | 'dark' | 'system'>('dark')

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login')
    }
  }, [authLoading, isAuthenticated, router])

  // Form setup
  const form = useForm<SettingsFormValues>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      theme: 'dark',
      defaultResponseStyle: 'short',
      notifications: {
        emailNotifications: true,
        sessionReminders: true,
        weeklySummary: false,
        productUpdates: true,
      },
      dataRetention: {
        transcripts: '30',
        answers: '90',
        uploads: '90',
      },
    },
  })

  // Watch form values
  const watchedTheme = form.watch('theme')
  const watchedResponseStyle = form.watch('defaultResponseStyle')
  const watchedNotifications = form.watch('notifications')
  const watchedDataRetention = form.watch('dataRetention')

  // Update theme
  useEffect(() => {
    setCurrentTheme(watchedTheme)
    // Apply theme to document
    const root = document.documentElement
    if (watchedTheme === 'system') {
      const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
      root.classList.toggle('dark', systemTheme === 'dark')
    } else {
      root.classList.toggle('dark', watchedTheme === 'dark')
    }
  }, [watchedTheme])

  // Update settings mutation
  const updateMutation = useMutation({
    mutationFn: updateSettings,
    onSuccess: () => {
      toast({
        title: 'Settings saved',
        description: 'Your preferences have been updated.'
      })
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to save settings',
        variant: 'destructive'
      })
    }
  })

  // Delete account mutation
  const deleteMutation = useMutation({
    mutationFn: deleteAccount,
    onSuccess: () => {
      logout()
      router.push('/login')
      toast({
        title: 'Account deleted',
        description: 'Your account has been permanently deleted.'
      })
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to delete account',
        variant: 'destructive'
      })
    }
  })

  // Handle form submit
  const onSubmit = (values: SettingsFormValues) => {
    updateMutation.mutate(values)
  }

  // Loading state
  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 text-violet-500 animate-spin" />
          <p className="text-gray-400">Loading settings...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-950">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-gray-900/80 backdrop-blur-xl border-b border-gray-800">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                className="text-gray-400 hover:text-white"
                onClick={() => router.push('/')}
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div>
                <h1 className="text-xl font-bold text-white">Settings</h1>
                <p className="text-sm text-gray-500">Manage your preferences</p>
              </div>
            </div>
            <Button
              onClick={form.handleSubmit(onSubmit)}
              disabled={updateMutation.isPending}
              className="bg-violet-600 hover:bg-violet-700"
            >
              {updateMutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              Save Settings
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        {/* Theme Settings */}
        <Card className="bg-gray-900/50 border-gray-800">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <div className="p-2 rounded-lg bg-violet-500/20">
                {currentTheme === 'dark' ? (
                  <Moon className="w-4 h-4 text-violet-400" />
                ) : (
                  <Sun className="w-4 h-4 text-violet-400" />
                )}
              </div>
              Theme
            </CardTitle>
            <CardDescription className="text-gray-500">
              Choose your preferred color theme
            </CardDescription>
          </CardHeader>
          <CardContent>
            <RadioGroup
              value={watchedTheme}
              onValueChange={(value) => form.setValue('theme', value as 'light' | 'dark' | 'system')}
              className="grid grid-cols-3 gap-4"
            >
              {[
                { value: 'light', label: 'Light', icon: Sun, desc: 'Light background' },
                { value: 'dark', label: 'Dark', icon: Moon, desc: 'Dark background' },
                { value: 'system', label: 'System', icon: Shield, desc: 'Follow system' },
              ].map(({ value, label, icon: Icon, desc }) => (
                <Label
                  key={value}
                  htmlFor={value}
                  className={`flex flex-col items-center gap-2 p-4 rounded-lg border cursor-pointer transition-all ${
                    watchedTheme === value
                      ? 'border-violet-500 bg-violet-500/10'
                      : 'border-gray-700 hover:border-gray-600'
                  }`}
                >
                  <RadioGroupItem value={value} id={value} className="sr-only" />
                  <Icon className={`w-5 h-5 ${watchedTheme === value ? 'text-violet-400' : 'text-gray-400'}`} />
                  <span className={`text-sm font-medium ${watchedTheme === value ? 'text-white' : 'text-gray-300'}`}>
                    {label}
                  </span>
                  <span className="text-xs text-gray-500">{desc}</span>
                </Label>
              ))}
            </RadioGroup>
          </CardContent>
        </Card>

        {/* Response Style Settings */}
        <Card className="bg-gray-900/50 border-gray-800">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <div className="p-2 rounded-lg bg-emerald-500/20">
                <Zap className="w-4 h-4 text-emerald-400" />
              </div>
              Default Response Style
            </CardTitle>
            <CardDescription className="text-gray-500">
              Set your preferred answer format for AI responses
            </CardDescription>
          </CardHeader>
          <CardContent>
            <RadioGroup
              value={watchedResponseStyle}
              onValueChange={(value) => form.setValue('defaultResponseStyle', value as SettingsFormValues['defaultResponseStyle'])}
              className="space-y-3"
            >
              {[
                { value: 'short', label: 'Short & Concise', desc: 'Brief answers, 1-2 sentences', icon: MessageSquare },
                { value: 'star', label: 'STAR Method', desc: 'Structured: Situation, Task, Action, Result', icon: FileText },
                { value: 'detailed', label: 'Detailed', desc: 'Comprehensive answers with examples', icon: FileText },
                { value: 'technical', label: 'Technical', desc: 'Technical language with code snippets', icon: FileText },
                { value: 'custom', label: 'Custom', desc: 'Use your own prompt style', icon: FileText },
              ].map(({ value, label, desc, icon: Icon }) => (
                <Label
                  key={value}
                  htmlFor={`style-${value}`}
                  className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                    watchedResponseStyle === value
                      ? 'border-violet-500 bg-violet-500/10'
                      : 'border-gray-700 hover:border-gray-600'
                  }`}
                >
                  <RadioGroupItem value={value} id={`style-${value}`} className="sr-only" />
                  <Icon className={`w-4 h-4 ${watchedResponseStyle === value ? 'text-violet-400' : 'text-gray-400'}`} />
                  <div className="flex-1">
                    <span className={`text-sm font-medium ${watchedResponseStyle === value ? 'text-white' : 'text-gray-300'}`}>
                      {label}
                    </span>
                    <p className="text-xs text-gray-500">{desc}</p>
                  </div>
                </Label>
              ))}
            </RadioGroup>
          </CardContent>
        </Card>

        {/* Notification Preferences */}
        <Card className="bg-gray-900/50 border-gray-800">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <div className="p-2 rounded-lg bg-amber-500/20">
                <Bell className="w-4 h-4 text-amber-400" />
              </div>
              Notifications
            </CardTitle>
            <CardDescription className="text-gray-500">
              Manage how you receive updates and alerts
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {[
              { key: 'emailNotifications', label: 'Email Notifications', desc: 'Receive important updates via email' },
              { key: 'sessionReminders', label: 'Session Reminders', desc: 'Get reminded about upcoming sessions' },
              { key: 'weeklySummary', label: 'Weekly Summary', desc: 'Receive a weekly digest of your activity' },
              { key: 'productUpdates', label: 'Product Updates', desc: 'Learn about new features and improvements' },
            ].map(({ key, label, desc }) => (
              <div key={key} className="flex items-center justify-between">
                <div>
                  <Label className="text-gray-300">{label}</Label>
                  <p className="text-xs text-gray-500">{desc}</p>
                </div>
                <Switch
                  checked={watchedNotifications[key as keyof typeof watchedNotifications]}
                  onCheckedChange={(checked) =>
                    form.setValue(`notifications.${key}`, checked)
                  }
                  className="data-[state=checked]:bg-violet-600"
                />
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Keyboard Shortcuts */}
        <Card className="bg-gray-900/50 border-gray-800">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <div className="p-2 rounded-lg bg-blue-500/20">
                <Keyboard className="w-4 h-4 text-blue-400" />
              </div>
              Keyboard Shortcuts
            </CardTitle>
            <CardDescription className="text-gray-500">
              Quick keys to speed up your workflow
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {keyboardShortcuts.map(({ keys, description }) => (
                <div key={description} className="flex items-center justify-between">
                  <span className="text-sm text-gray-300">{description}</span>
                  <div className="flex items-center gap-1">
                    {keys.map((key, index) => (
                      <span key={key}>
                        <Badge variant="outline" className="px-2 py-0.5 text-xs font-mono border-gray-600 text-gray-300">
                          {key}
                        </Badge>
                        {index < keys.length - 1 && <span className="text-gray-500 mx-0.5">+</span>}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Data Retention */}
        <Card className="bg-gray-900/50 border-gray-800">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <div className="p-2 rounded-lg bg-purple-500/20">
                <Database className="w-4 h-4 text-purple-400" />
              </div>
              Data Retention
            </CardTitle>
            <CardDescription className="text-gray-500">
              Control how long your data is stored
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {[
              { key: 'transcripts', label: 'Transcripts', desc: 'Session transcripts and audio logs' },
              { key: 'answers', label: 'Answers', desc: 'AI-generated answers and responses' },
              { key: 'uploads', label: 'Uploads', desc: 'Uploaded files and extracted text' },
            ].map(({ key, label, desc }) => (
              <div key={key} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-gray-300">{label}</Label>
                    <p className="text-xs text-gray-500">{desc}</p>
                  </div>
                  <select
                    value={watchedDataRetention[key as keyof typeof watchedDataRetention]}
                    onChange={(e) => form.setValue(`dataRetention.${key}`, e.target.value)}
                    className="bg-gray-800 border border-gray-700 rounded-md px-3 py-1.5 text-sm text-gray-300 focus:outline-none focus:border-violet-500"
                  >
                    <option value="7">7 days</option>
                    <option value="30">30 days</option>
                    <option value="90">90 days</option>
                    <option value="365">1 year</option>
                    <option value="forever">Forever</option>
                  </select>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Danger Zone */}
        <Card className="bg-gray-900/50 border-gray-800 border-red-900/50">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2 text-red-400">
              <div className="p-2 rounded-lg bg-red-500/20">
                <AlertTriangle className="w-4 h-4 text-red-400" />
              </div>
              Danger Zone
            </CardTitle>
            <CardDescription className="text-gray-500">
              Irreversible actions that affect your account
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" className="bg-red-600 hover:bg-red-700">
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete Account
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="bg-gray-900 border-gray-800">
                <AlertDialogHeader>
                  <AlertDialogTitle className="text-white">Delete Account</AlertDialogTitle>
                  <AlertDialogDescription className="text-gray-400">
                    This action cannot be undone. This will permanently delete your account,
                    all sessions, transcripts, and uploaded files.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <div className="py-4">
                  <Label className="text-gray-300 text-sm">
                    Type <span className="text-red-400 font-mono">{user?.email}</span> to confirm
                  </Label>
                  <input
                    type="text"
                    value={deleteConfirmation}
                    onChange={(e) => setDeleteConfirmation(e.target.value)}
                    placeholder={user?.email}
                    className="w-full mt-2 px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-gray-300 focus:outline-none focus:border-red-500"
                  />
                </div>
                <AlertDialogFooter>
                  <AlertDialogCancel className="bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700">
                    Cancel
                  </AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-red-600 hover:bg-red-700"
                    disabled={deleteConfirmation !== user?.email || deleteMutation.isPending}
                    onClick={() => deleteMutation.mutate()}
                  >
                    {deleteMutation.isPending ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4 mr-2" />
                    )}
                    Delete Forever
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardContent>
        </Card>

        {/* Account Info */}
        <Card className="bg-gray-900/50 border-gray-800">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <div className="p-2 rounded-lg bg-gray-500/20">
                <Shield className="w-4 h-4 text-gray-400" />
              </div>
              Account Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-400">Email</span>
              <span className="text-sm text-gray-300">{user?.email}</span>
            </div>
            <Separator className="bg-gray-800" />
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-400">Role</span>
              <Badge variant="outline" className="border-violet-500/50 text-violet-400">
                {user?.role}
              </Badge>
            </div>
            <Separator className="bg-gray-800" />
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-400">Account Created</span>
              <span className="text-sm text-gray-300">
                {user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A'}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
