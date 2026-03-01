'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/hooks/use-toast'
import { useAuthStore } from '@/stores/auth-store'
import {
  Key,
  Save,
  Eye,
  EyeOff,
  Loader2,
  CheckCircle,
  XCircle,
  Settings2,
} from 'lucide-react'

interface ApiSetting {
  key: string
  valueSet: boolean
  updatedAt: string | null
}

const SETTING_LABELS: Record<string, { label: string; description: string; placeholder: string }> = {
  openai_api_key: {
    label: 'OpenAI API Key',
    description: 'Your OpenAI API key for GPT models',
    placeholder: 'sk-...',
  },
  gemini_api_key: {
    label: 'Gemini API Key',
    description: 'Your Google Gemini API key',
    placeholder: 'AIza...',
  },
  azure_speech_key: {
    label: 'Azure Speech Key',
    description: 'Azure Cognitive Services Speech key',
    placeholder: 'Your Azure Speech key',
  },
  azure_region: {
    label: 'Azure Region',
    description: 'Azure region for Speech services',
    placeholder: 'e.g., eastus, westus2',
  },
  anthropic_api_key: {
    label: 'Anthropic API Key',
    description: 'Your Anthropic API key for Claude models',
    placeholder: 'sk-ant-...',
  },
}

const DEFAULT_MODELS = [
  { value: 'gpt-4o', label: 'GPT-4o (Recommended)' },
  { value: 'gpt-4-turbo', label: 'GPT-4 Turbo' },
  { value: 'gpt-4', label: 'GPT-4' },
  { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo' },
  { value: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro' },
  { value: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash' },
  { value: 'claude-3-5-sonnet-20241022', label: 'Claude 3.5 Sonnet' },
  { value: 'claude-3-opus-20240229', label: 'Claude 3 Opus' },
]

async function fetchSettings(): Promise<ApiSetting[]> {
  const token = useAuthStore.getState().token
  const res = await fetch('/api/admin/settings', {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })

  if (!res.ok) {
    throw new Error('Failed to fetch settings')
  }

  const data = await res.json()
  return data.data
}

async function updateSetting(key: string, value: string): Promise<ApiSetting> {
  const token = useAuthStore.getState().token
  const res = await fetch('/api/admin/settings', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ key, value }),
  })

  if (!res.ok) {
    const error = await res.json()
    throw new Error(error.error || 'Failed to update setting')
  }

  const data = await res.json()
  return data.data
}

export default function AdminSettingsPage() {
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const [settings, setSettings] = useState<Record<string, string>>({})
  const [showValues, setShowValues] = useState<Record<string, boolean>>({})
  const [defaultModel, setDefaultModel] = useState('gpt-4o')

  const { data: apiSettings, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin-settings'],
    queryFn: fetchSettings,
  })

  const updateMutation = useMutation({
    mutationFn: ({ key, value }: { key: string; value: string }) => updateSetting(key, value),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-settings'] })
      toast({
        title: 'Setting saved',
        description: 'The API setting has been saved successfully.',
      })
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      })
    },
  })

  const toggleShowValue = (key: string) => {
    setShowValues((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  const handleSave = (key: string) => {
    const value = settings[key]
    if (!value?.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter a value',
        variant: 'destructive',
      })
      return
    }
    updateMutation.mutate({ key, value })
  }

  const handleSaveDefaultModel = () => {
    // Save default model as a setting
    updateMutation.mutate({ key: 'default_model', value: defaultModel })
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Settings</h2>
        <p className="text-gray-500">Manage API keys and application settings</p>
      </div>

      {/* Default Model Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings2 className="h-5 w-5" />
            Default Model
          </CardTitle>
          <CardDescription>
            Select the default LLM model for generating responses
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-end gap-4">
            <div className="flex-1">
              <Label htmlFor="default-model">Model</Label>
              <Select value={defaultModel} onValueChange={setDefaultModel}>
                <SelectTrigger id="default-model">
                  <SelectValue placeholder="Select a model" />
                </SelectTrigger>
                <SelectContent>
                  {DEFAULT_MODELS.map((model) => (
                    <SelectItem key={model.value} value={model.value}>
                      {model.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              onClick={handleSaveDefaultModel}
              disabled={updateMutation.isPending}
              className="bg-violet-600 hover:bg-violet-700"
            >
              {updateMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              Save
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* API Keys */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            API Keys
          </CardTitle>
          <CardDescription>
            Configure your API keys for various services. Keys are encrypted before storage.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-6">
              {Object.keys(SETTING_LABELS).map((key) => (
                <div key={key} className="space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ))}
            </div>
          ) : isError ? (
            <div className="py-8 text-center">
              <p className="text-gray-500">Failed to load settings</p>
              <Button variant="outline" onClick={() => refetch()} className="mt-4">
                Try again
              </Button>
            </div>
          ) : (
            <div className="space-y-6">
              {Object.entries(SETTING_LABELS).map(([key, config]) => {
                const setting = apiSettings?.find((s) => s.key === key)
                const value = settings[key] || ''
                const showValue = showValues[key]
                const isSaving = updateMutation.isPending && updateMutation.variables?.key === key

                return (
                  <div key={key} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label htmlFor={key} className="text-base font-medium">
                          {config.label}
                        </Label>
                        <p className="text-sm text-gray-500">{config.description}</p>
                      </div>
                      {setting?.valueSet && (
                        <Badge variant="secondary" className="bg-green-100 text-green-800">
                          <CheckCircle className="mr-1 h-3 w-3" />
                          Set
                        </Badge>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Input
                          id={key}
                          type={showValue ? 'text' : 'password'}
                          value={value}
                          onChange={(e) =>
                            setSettings((prev) => ({ ...prev, [key]: e.target.value }))
                          }
                          placeholder={config.placeholder}
                          className="pr-10"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="absolute right-0 top-0 h-full"
                          onClick={() => toggleShowValue(key)}
                        >
                          {showValue ? (
                            <EyeOff className="h-4 w-4 text-gray-500" />
                          ) : (
                            <Eye className="h-4 w-4 text-gray-500" />
                          )}
                        </Button>
                      </div>
                      <Button
                        onClick={() => handleSave(key)}
                        disabled={isSaving || !value.trim()}
                        className="bg-violet-600 hover:bg-violet-700"
                      >
                        {isSaving ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Save className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                    {setting?.updatedAt && (
                      <p className="text-xs text-gray-400">
                        Last updated: {format(new Date(setting.updatedAt), 'MMM d, yyyy h:mm a')}
                      </p>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Security Notice */}
      <Card className="border-amber-200 bg-amber-50">
        <CardContent className="pt-6">
          <div className="flex items-start gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100">
              <Key className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <h3 className="font-medium text-amber-900">Security Notice</h3>
              <p className="text-sm text-amber-700 mt-1">
                API keys are encrypted before being stored in the database. Never share your API keys
                or commit them to version control. These keys will be used for all users of the
                application.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
