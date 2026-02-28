'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/stores/auth-store'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination'
import {
  Video,
  Briefcase,
  MessageSquare,
  Mic2,
  Settings,
  LogOut,
  History,
  Calendar,
  Search,
  AlertCircle,
  Loader2,
  ChevronRight,
  ChevronLeft,
  LayoutDashboard,
  X,
} from 'lucide-react'

interface Session {
  id: string
  title: string | null
  type: string
  status: string
  responseStyle: string
  createdAt: string
  endedAt: string | null
  _count: {
    transcriptTurns: number
    assistantMessages: number
  }
}

interface SessionsResponse {
  sessions: Session[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

const sessionTypeConfig: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  interview: { label: 'Interview', icon: Briefcase, color: 'bg-blue-500' },
  sales: { label: 'Sales', icon: MessageSquare, color: 'bg-green-500' },
  trivia: { label: 'Trivia', icon: Mic2, color: 'bg-yellow-500' },
  meeting: { label: 'Meeting', icon: Video, color: 'bg-violet-500' },
  custom: { label: 'Custom', icon: Settings, color: 'bg-slate-500' },
}

const formatDate = (dateString: string) => {
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export default function HistoryPage() {
  const router = useRouter()
  const { user, token, isAuthenticated, isLoading: authLoading, logout } = useAuthStore()
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [page, setPage] = useState(1)

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login')
    }
  }, [authLoading, isAuthenticated, router])

  // Build query params
  const queryParams = new URLSearchParams()
  queryParams.set('page', page.toString())
  queryParams.set('limit', '10')
  if (search) queryParams.set('search', search)
  if (typeFilter !== 'all') queryParams.set('type', typeFilter)
  if (statusFilter !== 'all') queryParams.set('status', statusFilter)

  // Fetch sessions
  const { data, isLoading, error, isFetching } = useQuery<SessionsResponse>({
    queryKey: ['sessions', 'history', search, typeFilter, statusFilter, page],
    queryFn: async () => {
      const response = await fetch(`/api/sessions?${queryParams.toString()}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
      if (!response.ok) throw new Error('Failed to fetch sessions')
      return response.json()
    },
    enabled: !!token && isAuthenticated,
  })

  const handleSearch = () => {
    setSearch(searchInput)
    setPage(1)
  }

  const handleClearSearch = () => {
    setSearch('')
    setSearchInput('')
    setPage(1)
  }

  const handleLogout = () => {
    logout()
    router.push('/login')
  }

  // Show loading state
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-violet-500" />
      </div>
    )
  }

  // Don't render anything if not authenticated (will redirect)
  if (!isAuthenticated) {
    return null
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
                <Video className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="font-semibold text-lg">Meeting Copilot</h1>
                <p className="text-xs text-muted-foreground">AI-powered meeting assistant</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="sm" asChild>
                <Link href="/">
                  <LayoutDashboard className="w-4 h-4 mr-2" />
                  Dashboard
                </Link>
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-10 w-10 rounded-full">
                    <Avatar className="h-10 w-10">
                      <AvatarFallback className="bg-gradient-to-br from-violet-500 to-purple-600 text-white">
                        {user?.email?.charAt(0).toUpperCase() || 'U'}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56" align="end" forceMount>
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium leading-none">Account</p>
                      <p className="text-xs leading-none text-muted-foreground">
                        {user?.email}
                      </p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleLogout}>
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Log out</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Header */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold mb-2 flex items-center gap-2">
            <History className="w-7 h-7" />
            Session History
          </h2>
          <p className="text-muted-foreground">
            View and search through all your past sessions.
          </p>
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row gap-4">
              {/* Search */}
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search sessions..."
                  className="pl-10 pr-10"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSearch()
                  }}
                />
                {searchInput && (
                  <button
                    onClick={handleClearSearch}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              
              {/* Type Filter */}
              <Select value={typeFilter} onValueChange={(value) => { setTypeFilter(value); setPage(1) }}>
                <SelectTrigger className="w-full sm:w-[150px]">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="meeting">Meeting</SelectItem>
                  <SelectItem value="interview">Interview</SelectItem>
                  <SelectItem value="sales">Sales</SelectItem>
                  <SelectItem value="trivia">Trivia</SelectItem>
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select>

              {/* Status Filter */}
              <Select value={statusFilter} onValueChange={(value) => { setStatusFilter(value); setPage(1) }}>
                <SelectTrigger className="w-full sm:w-[150px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="ended">Ended</SelectItem>
                </SelectContent>
              </Select>

              <Button onClick={handleSearch} variant="secondary">
                Search
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Results */}
        {isLoading ? (
          <div className="grid gap-4">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i}>
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between">
                    <div className="space-y-2 flex-1">
                      <Skeleton className="h-5 w-1/3" />
                      <Skeleton className="h-4 w-1/4" />
                    </div>
                    <Skeleton className="h-6 w-20" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : error ? (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Failed to load sessions. Please try again.
            </AlertDescription>
          </Alert>
        ) : data?.sessions.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="pt-6 pb-6 text-center">
              <div className="flex flex-col items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                  <Search className="w-8 h-8 text-muted-foreground" />
                </div>
                <div>
                  <h4 className="font-medium mb-1">No sessions found</h4>
                  <p className="text-sm text-muted-foreground">
                    {search || typeFilter !== 'all' || statusFilter !== 'all'
                      ? 'Try adjusting your filters or search query.'
                      : 'Start a new session from the dashboard.'}
                  </p>
                </div>
                {(search || typeFilter !== 'all' || statusFilter !== 'all') && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      handleClearSearch()
                      setTypeFilter('all')
                      setStatusFilter('all')
                    }}
                  >
                    Clear Filters
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-muted-foreground">
                Showing {data?.sessions.length} of {data?.pagination.total} sessions
              </p>
              {isFetching && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
            </div>
            <div className="grid gap-4">
              {data?.sessions.map((session) => {
                const typeConfig = sessionTypeConfig[session.type] || sessionTypeConfig.custom
                const TypeIcon = typeConfig.icon
                return (
                  <Card
                    key={session.id}
                    className="hover:shadow-md transition-shadow cursor-pointer group"
                    onClick={() => router.push(`/session/${session.id}`)}
                  >
                    <CardContent className="pt-6">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-4">
                          <div className={`w-10 h-10 rounded-lg ${typeConfig.color} flex items-center justify-center flex-shrink-0`}>
                            <TypeIcon className="w-5 h-5 text-white" />
                          </div>
                          <div>
                            <h4 className="font-medium group-hover:text-violet-600 transition-colors">
                              {session.title || `Untitled ${typeConfig.label}`}
                            </h4>
                            <div className="flex flex-wrap items-center gap-4 mt-1 text-sm text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Calendar className="w-3.5 h-3.5" />
                                {formatDate(session.createdAt)}
                              </span>
                              <span className="flex items-center gap-1">
                                <MessageSquare className="w-3.5 h-3.5" />
                                {session._count.transcriptTurns} turns
                              </span>
                              <Badge variant="outline" className="text-xs">
                                {typeConfig.label}
                              </Badge>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge
                            variant={session.status === 'active' ? 'default' : 'secondary'}
                            className={session.status === 'active' ? 'bg-green-500 hover:bg-green-600' : ''}
                          >
                            {session.status}
                          </Badge>
                          <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-violet-600 transition-colors" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>

            {/* Pagination */}
            {data && data.pagination.totalPages > 1 && (
              <div className="mt-6">
                <Pagination>
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        className={page === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                      />
                    </PaginationItem>
                    
                    {Array.from({ length: Math.min(5, data.pagination.totalPages) }, (_, i) => {
                      let pageNum: number
                      if (data.pagination.totalPages <= 5) {
                        pageNum = i + 1
                      } else if (page <= 3) {
                        pageNum = i + 1
                      } else if (page >= data.pagination.totalPages - 2) {
                        pageNum = data.pagination.totalPages - 4 + i
                      } else {
                        pageNum = page - 2 + i
                      }
                      
                      return (
                        <PaginationItem key={pageNum}>
                          <PaginationLink
                            onClick={() => setPage(pageNum)}
                            isActive={page === pageNum}
                            className="cursor-pointer"
                          >
                            {pageNum}
                          </PaginationLink>
                        </PaginationItem>
                      )
                    })}
                    
                    {data.pagination.totalPages > 5 && page < data.pagination.totalPages - 2 && (
                      <PaginationItem>
                        <PaginationEllipsis />
                      </PaginationItem>
                    )}
                    
                    <PaginationItem>
                      <PaginationNext
                        onClick={() => setPage((p) => Math.min(data.pagination.totalPages, p + 1))}
                        className={page === data.pagination.totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  )
}
