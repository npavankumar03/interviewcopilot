'use client'

import { useState, useRef, useEffect } from 'react'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { useAuthStore } from '@/stores/auth-store'
import { useRouter } from 'next/navigation'
import {
  User,
  Briefcase,
  Code2,
  Trophy,
  FolderGit2,
  FileText,
  Plus,
  X,
  Save,
  Loader2,
  Upload,
  ArrowLeft
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

// Profile form schema
const profileSchema = z.object({
  fullName: z.string().min(2, 'Name must be at least 2 characters').max(100).optional().or(z.literal('')),
  headline: z.string().max(200).optional().or(z.literal('')),
  roleTitles: z.array(z.string().min(1).max(100)).max(10),
  techStack: z.array(z.string().min(1).max(50)).max(30),
  achievements: z.array(z.string().min(1).max(200)).max(20),
  projects: z.array(z.string().min(1).max(300)).max(15),
})

type ProfileFormValues = z.infer<typeof profileSchema>

interface ProfileData {
  userId: string
  fullName: string | null
  headline: string | null
  roleTitles: string[] | null
  techStack: string[] | null
  achievements: string[] | null
  projects: string[] | null
  resumeText: string | null
  updatedAt: string
}

// Fetch profile data
async function fetchProfile(): Promise<ProfileData> {
  const response = await fetch('/api/profile')
  if (!response.ok) throw new Error('Failed to fetch profile')
  return response.json()
}

// Update profile data
async function updateProfile(data: ProfileFormValues): Promise<ProfileData> {
  const response = await fetch('/api/profile', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  })
  if (!response.ok) throw new Error('Failed to update profile')
  return response.json()
}

// Extract text from resume file
async function extractResumeText(file: File): Promise<string> {
  const formData = new FormData()
  formData.append('file', file)

  const response = await fetch('/api/uploads', {
    method: 'POST',
    body: formData
  })

  if (!response.ok) throw new Error('Failed to upload resume')
  const data = await response.json()
  return data.extractedText || ''
}

// Memory slot section component
function MemorySlotSection({
  title,
  description,
  icon: Icon,
  accentColor,
  children
}: {
  title: string
  description: string
  icon: React.ElementType
  accentColor: string
  children: React.ReactNode
}) {
  return (
    <Card className="bg-gray-900/50 border-gray-800">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <div className={`p-2 rounded-lg ${accentColor}`}>
            <Icon className="w-4 h-4" />
          </div>
          {title}
        </CardTitle>
        <CardDescription className="text-gray-500">{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {children}
      </CardContent>
    </Card>
  )
}

export default function ProfilePage() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuthStore()
  const router = useRouter()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isUploadingResume, setIsUploadingResume] = useState(false)
  const [extractedResumeText, setExtractedResumeText] = useState<string | null>(null)

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login')
    }
  }, [authLoading, isAuthenticated, router])

  // Fetch profile data
  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ['profile'],
    queryFn: fetchProfile,
    enabled: isAuthenticated
  })

  // Form setup
  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      fullName: '',
      headline: '',
      roleTitles: [],
      techStack: [],
      achievements: [],
      projects: []
    }
  })

  // Update form when profile data loads
  useEffect(() => {
    if (profile) {
      form.reset({
        fullName: profile.fullName || '',
        headline: profile.headline || '',
        roleTitles: profile.roleTitles || [],
        techStack: profile.techStack || [],
        achievements: profile.achievements || [],
        projects: profile.projects || []
      })
      setExtractedResumeText(profile.resumeText)
    }
  }, [profile, form])

  // Field arrays for editable lists
  const roleTitlesArray = useFieldArray({
    control: form.control,
    name: 'roleTitles'
  })

  const techStackArray = useFieldArray({
    control: form.control,
    name: 'techStack'
  })

  const achievementsArray = useFieldArray({
    control: form.control,
    name: 'achievements'
  })

  const projectsArray = useFieldArray({
    control: form.control,
    name: 'projects'
  })

  // Update profile mutation
  const updateMutation = useMutation({
    mutationFn: updateProfile,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] })
      toast({
        title: 'Profile saved',
        description: 'Your profile has been updated successfully.'
      })
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to save profile',
        variant: 'destructive'
      })
    }
  })

  // Handle resume upload
  const handleResumeUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsUploadingResume(true)
    try {
      const text = await extractResumeText(file)
      setExtractedResumeText(text)
      toast({
        title: 'Resume uploaded',
        description: 'Text has been extracted from your resume.'
      })
    } catch (error) {
      toast({
        title: 'Upload failed',
        description: error instanceof Error ? error.message : 'Failed to upload resume',
        variant: 'destructive'
      })
    } finally {
      setIsUploadingResume(false)
    }
  }

  // Handle form submit
  const onSubmit = (values: ProfileFormValues) => {
    updateMutation.mutate(values)
  }

  // Loading state
  if (authLoading || profileLoading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 text-violet-500 animate-spin" />
          <p className="text-gray-400">Loading profile...</p>
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
                <h1 className="text-xl font-bold text-white">Profile</h1>
                <p className="text-sm text-gray-500">Manage your personal information</p>
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
              Save Changes
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <ScrollArea className="h-[calc(100vh-73px)]">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {/* Basic Info */}
              <Card className="bg-gray-900/50 border-gray-800">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <div className="p-2 rounded-lg bg-violet-500/20">
                      <User className="w-4 h-4 text-violet-400" />
                    </div>
                    Basic Information
                  </CardTitle>
                  <CardDescription className="text-gray-500">
                    Your personal details and professional headline
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <FormField
                    control={form.control}
                    name="fullName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-gray-300">Full Name</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            placeholder="John Doe"
                            className="bg-gray-800/50 border-gray-700 focus:border-violet-500"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="headline"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-gray-300">Headline</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            placeholder="Senior Software Engineer at TechCorp"
                            className="bg-gray-800/50 border-gray-700 focus:border-violet-500"
                          />
                        </FormControl>
                        <FormDescription className="text-gray-500">
                          A brief professional tagline
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="pt-2">
                    <p className="text-sm text-gray-400">
                      Email: <span className="text-gray-300">{user?.email}</span>
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Role Titles */}
              <MemorySlotSection
                title="Role Titles"
                description="Your professional roles and positions"
                icon={Briefcase}
                accentColor="bg-blue-500/20 text-blue-400"
              >
                <div className="space-y-2">
                  {roleTitlesArray.fields.map((field, index) => (
                    <motion.div
                      key={field.id}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className="flex items-center gap-2 group"
                    >
                      <div className="p-2 rounded-lg bg-blue-500/20">
                        <Briefcase className="w-4 h-4 text-blue-400" />
                      </div>
                      <FormField
                        control={form.control}
                        name={`roleTitles.${index}`}
                        render={({ field }) => (
                          <FormItem className="flex-1">
                            <FormControl>
                              <Input
                                {...field}
                                placeholder="Software Engineer"
                                className="bg-gray-800/50 border-gray-700 focus:border-violet-500"
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-gray-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => roleTitlesArray.remove(index)}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </motion.div>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-full border-dashed border-gray-700 text-gray-400 hover:text-white hover:border-violet-500"
                    onClick={() => roleTitlesArray.append('')}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Role
                  </Button>
                </div>
              </MemorySlotSection>

              {/* Tech Stack */}
              <MemorySlotSection
                title="Tech Stack"
                description="Technologies and tools you work with"
                icon={Code2}
                accentColor="bg-emerald-500/20 text-emerald-400"
              >
                <div className="space-y-2">
                  {techStackArray.fields.map((field, index) => (
                    <motion.div
                      key={field.id}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className="flex items-center gap-2 group"
                    >
                      <div className="p-2 rounded-lg bg-emerald-500/20">
                        <Code2 className="w-4 h-4 text-emerald-400" />
                      </div>
                      <FormField
                        control={form.control}
                        name={`techStack.${index}`}
                        render={({ field }) => (
                          <FormItem className="flex-1">
                            <FormControl>
                              <Input
                                {...field}
                                placeholder="React, Node.js, Python..."
                                className="bg-gray-800/50 border-gray-700 focus:border-violet-500"
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-gray-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => techStackArray.remove(index)}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </motion.div>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-full border-dashed border-gray-700 text-gray-400 hover:text-white hover:border-violet-500"
                    onClick={() => techStackArray.append('')}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Technology
                  </Button>
                </div>
              </MemorySlotSection>

              {/* Achievements */}
              <MemorySlotSection
                title="Achievements"
                description="Your notable accomplishments and awards"
                icon={Trophy}
                accentColor="bg-amber-500/20 text-amber-400"
              >
                <div className="space-y-2">
                  {achievementsArray.fields.map((field, index) => (
                    <motion.div
                      key={field.id}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className="flex items-center gap-2 group"
                    >
                      <div className="p-2 rounded-lg bg-amber-500/20">
                        <Trophy className="w-4 h-4 text-amber-400" />
                      </div>
                      <FormField
                        control={form.control}
                        name={`achievements.${index}`}
                        render={({ field }) => (
                          <FormItem className="flex-1">
                            <FormControl>
                              <Input
                                {...field}
                                placeholder="Won hackathon, Published paper..."
                                className="bg-gray-800/50 border-gray-700 focus:border-violet-500"
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-gray-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => achievementsArray.remove(index)}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </motion.div>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-full border-dashed border-gray-700 text-gray-400 hover:text-white hover:border-violet-500"
                    onClick={() => achievementsArray.append('')}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Achievement
                  </Button>
                </div>
              </MemorySlotSection>

              {/* Projects */}
              <MemorySlotSection
                title="Projects"
                description="Your notable projects and contributions"
                icon={FolderGit2}
                accentColor="bg-purple-500/20 text-purple-400"
              >
                <div className="space-y-2">
                  {projectsArray.fields.map((field, index) => (
                    <motion.div
                      key={field.id}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className="flex items-center gap-2 group"
                    >
                      <div className="p-2 rounded-lg bg-purple-500/20">
                        <FolderGit2 className="w-4 h-4 text-purple-400" />
                      </div>
                      <FormField
                        control={form.control}
                        name={`projects.${index}`}
                        render={({ field }) => (
                          <FormItem className="flex-1">
                            <FormControl>
                              <Input
                                {...field}
                                placeholder="Built an AI-powered dashboard..."
                                className="bg-gray-800/50 border-gray-700 focus:border-violet-500"
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-gray-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => projectsArray.remove(index)}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </motion.div>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-full border-dashed border-gray-700 text-gray-400 hover:text-white hover:border-violet-500"
                    onClick={() => projectsArray.append('')}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Project
                  </Button>
                </div>
              </MemorySlotSection>

              {/* Resume Upload */}
              <Card className="bg-gray-900/50 border-gray-800">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <div className="p-2 rounded-lg bg-rose-500/20">
                      <FileText className="w-4 h-4 text-rose-400" />
                    </div>
                    Resume
                  </CardTitle>
                  <CardDescription className="text-gray-500">
                    Upload your resume to extract and store text for AI context
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    accept=".pdf,.doc,.docx,.txt"
                    onChange={handleResumeUpload}
                  />
                  <div className="flex items-center gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      className="border-gray-700 text-gray-300 hover:text-white"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isUploadingResume}
                    >
                      {isUploadingResume ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Upload className="w-4 h-4 mr-2" />
                      )}
                      Upload Resume
                    </Button>
                    <span className="text-xs text-gray-500">
                      PDF, DOC, DOCX, TXT
                    </span>
                  </div>

                  {extractedResumeText && (
                    <div className="mt-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-gray-300">Extracted Text</span>
                        <Badge variant="outline" className="border-emerald-500/50 text-emerald-400">
                          {extractedResumeText.length} characters
                        </Badge>
                      </div>
                      <ScrollArea className="h-40 rounded-lg border border-gray-700 bg-gray-800/30">
                        <p className="p-3 text-xs text-gray-400 whitespace-pre-wrap">
                          {extractedResumeText}
                        </p>
                      </ScrollArea>
                    </div>
                  )}
                </CardContent>
              </Card>
            </form>
          </Form>
        </div>
      </ScrollArea>
    </div>
  )
}
