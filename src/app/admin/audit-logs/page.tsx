'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuthStore } from '@/stores/auth-store'
import {
  ChevronLeft,
  ChevronRight,
  FileText,
  User,
  Settings,
  CreditCard,
  Shield,
  Activity,
} from 'lucide-react'

interface AuditLogActor {
  id: string
  email: string
  profile: {
    fullName: string | null
  } | null
}

interface AuditLog {
  id: string
  actorUserId: string | null
  actor: AuditLogActor | null
  action: string
  targetType: string | null
  targetId: string | null
  meta: Record<string, unknown> | null
  createdAt: string
}

interface AuditLogsResponse {
  logs: AuditLog[]
  total: number
  limit: number
  offset: number
}

async function fetchAuditLogs(params: {
  limit: number
  offset: number
  action?: string
  targetType?: string
}): Promise<AuditLogsResponse> {
  const searchParams = new URLSearchParams()
  searchParams.set('limit', params.limit.toString())
  searchParams.set('offset', params.offset.toString())
  if (params.action) searchParams.set('action', params.action)
  if (params.targetType) searchParams.set('targetType', params.targetType)

  const token = useAuthStore.getState().token
  const res = await fetch(`/api/admin/audit-logs?${searchParams}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })

  if (!res.ok) {
    throw new Error('Failed to fetch audit logs')
  }

  const data = await res.json()
  return data.data
}

const ACTION_LABELS: Record<string, { label: string; color: string }> = {
  user_update: { label: 'User Updated', color: 'bg-blue-100 text-blue-800' },
  setting_update: { label: 'Setting Updated', color: 'bg-amber-100 text-amber-800' },
  plan_create: { label: 'Plan Created', color: 'bg-green-100 text-green-800' },
  plan_update: { label: 'Plan Updated', color: 'bg-blue-100 text-blue-800' },
  plan_delete: { label: 'Plan Deleted', color: 'bg-red-100 text-red-800' },
  credit_adjust: { label: 'Credit Adjusted', color: 'bg-purple-100 text-purple-800' },
}

const TARGET_TYPE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  user: User,
  api_setting: Settings,
  plan: CreditCard,
  session: Activity,
  default: FileText,
}

export default function AdminAuditLogsPage() {
  const [actionFilter, setActionFilter] = useState<string>('all')
  const [targetTypeFilter, setTargetTypeFilter] = useState<string>('all')
  const [page, setPage] = useState(0)

  const limit = 20
  const offset = page * limit

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin-audit-logs', actionFilter, targetTypeFilter, page],
    queryFn: () =>
      fetchAuditLogs({
        limit,
        offset,
        action: actionFilter === 'all' ? undefined : actionFilter,
        targetType: targetTypeFilter === 'all' ? undefined : targetTypeFilter,
      }),
  })

  const totalPages = data ? Math.ceil(data.total / limit) : 0

  const getActionBadge = (action: string) => {
    const config = ACTION_LABELS[action] || { label: action, color: 'bg-gray-100 text-gray-800' }
    return (
      <Badge variant="secondary" className={config.color}>
        {config.label}
      </Badge>
    )
  }

  const getTargetIcon = (targetType: string | null) => {
    const Icon = TARGET_TYPE_ICONS[targetType || 'default'] || FileText
    return <Icon className="h-4 w-4 text-gray-500" />
  }

  const renderMetadata = (meta: Record<string, unknown> | null) => {
    if (!meta) return <span className="text-gray-400">-</span>

    const metaStr = JSON.stringify(meta, null, 2)
    if (metaStr.length > 100) {
      return (
        <code className="text-xs bg-gray-50 p-1 rounded block max-w-xs truncate" title={metaStr}>
          {metaStr.slice(0, 100)}...
        </code>
      )
    }
    return (
      <code className="text-xs bg-gray-50 p-1 rounded">
        {metaStr}
      </code>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Audit Logs</h2>
        <p className="text-gray-500">Track all administrative actions and changes</p>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500">Action:</span>
              <Select value={actionFilter} onValueChange={setActionFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="All Actions" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Actions</SelectItem>
                  <SelectItem value="user_update">User Updates</SelectItem>
                  <SelectItem value="setting_update">Setting Updates</SelectItem>
                  <SelectItem value="plan_create">Plan Created</SelectItem>
                  <SelectItem value="plan_update">Plan Updated</SelectItem>
                  <SelectItem value="plan_delete">Plan Deleted</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500">Target Type:</span>
              <Select value={targetTypeFilter} onValueChange={setTargetTypeFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="All Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="user">User</SelectItem>
                  <SelectItem value="api_setting">API Setting</SelectItem>
                  <SelectItem value="plan">Plan</SelectItem>
                  <SelectItem value="session">Session</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Logs</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data?.total || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">User Actions</CardTitle>
            <User className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {data?.logs.filter((l) => l.action.includes('user')).length || 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Setting Changes</CardTitle>
            <Settings className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {data?.logs.filter((l) => l.action.includes('setting')).length || 0}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Logs Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-4">
              {Array.from({ length: 10 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : isError ? (
            <div className="p-8 text-center">
              <p className="text-gray-500">Failed to load audit logs</p>
              <Button variant="outline" onClick={() => refetch()} className="mt-4">
                Try again
              </Button>
            </div>
          ) : data?.logs.length === 0 ? (
            <div className="p-8 text-center">
              <Shield className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">No audit logs found</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Timestamp</TableHead>
                  <TableHead>Actor</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Target</TableHead>
                  <TableHead>Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell>
                      <div className="text-sm">
                        <p className="font-medium text-gray-900">
                          {format(new Date(log.createdAt), 'MMM d, yyyy')}
                        </p>
                        <p className="text-gray-500">
                          {format(new Date(log.createdAt), 'h:mm:ss a')}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      {log.actor ? (
                        <div className="flex items-center gap-2">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-violet-100 text-violet-700 text-sm font-medium">
                            {log.actor.email.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-900">
                              {log.actor.profile?.fullName || log.actor.email.split('@')[0]}
                            </p>
                            <p className="text-xs text-gray-500">{log.actor.email}</p>
                          </div>
                        </div>
                      ) : (
                        <span className="text-gray-400">System</span>
                      )}
                    </TableCell>
                    <TableCell>{getActionBadge(log.action)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getTargetIcon(log.targetType)}
                        <div>
                          <p className="text-sm text-gray-900">
                            {log.targetType || 'Unknown'}
                          </p>
                          {log.targetId && (
                            <p className="text-xs text-gray-500 font-mono truncate max-w-[100px]">
                              {log.targetId}
                            </p>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{renderMetadata(log.meta)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {data && data.total > limit && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">
            Showing {offset + 1} to {Math.min(offset + limit, data.total)} of {data.total} logs
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              disabled={page === 0}
              onClick={() => setPage(page - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              const pageNum = Math.max(0, Math.min(totalPages - 5, page - 2)) + i
              return (
                <Button
                  key={pageNum}
                  variant={page === pageNum ? 'default' : 'outline'}
                  size="icon"
                  onClick={() => setPage(pageNum)}
                  className={page === pageNum ? 'bg-violet-600' : ''}
                >
                  {pageNum + 1}
                </Button>
              )
            })}
            <Button
              variant="outline"
              size="icon"
              disabled={page >= totalPages - 1}
              onClick={() => setPage(page + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
