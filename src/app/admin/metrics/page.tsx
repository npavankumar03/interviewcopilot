'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useAuthStore } from '@/stores/auth-store'
import {
  Users,
  Calendar,
  Zap,
  Clock,
  TrendingUp,
  Activity,
} from 'lucide-react'

interface MetricsData {
  users: {
    total: number
    active: number
    disabled: number
    byRole: { role: string; count: number }[]
  }
  sessions: {
    total: number
    active: number
    ended: number
    byType: { type: string; count: number }[]
  }
  uploads: {
    total: number
  }
  messages: {
    total: number
  }
  credits: {
    totalUsed: number
  }
  activity: {
    daily: Record<string, number>
  }
  llm: {
    totalRequests: number
    avgTtftMs: number | null
    avgTotalMs: number | null
    totalPromptTokens: number | null
    totalCompletionTokens: number | null
  }
}

async function fetchMetrics(): Promise<MetricsData> {
  const token = useAuthStore.getState().token
  const res = await fetch('/api/admin/metrics', {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })

  if (!res.ok) {
    throw new Error('Failed to fetch metrics')
  }

  const data = await res.json()
  return data.data
}

const COLORS = ['#8b5cf6', '#06b6d4', '#22c55e', '#f59e0b', '#ef4444', '#ec4899']

export default function AdminMetricsPage() {
  const [dateRange, setDateRange] = useState('7d')

  const { data: metrics, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin-metrics', dateRange],
    queryFn: fetchMetrics,
  })

  // Prepare chart data
  const dailyActivityData = metrics?.activity.daily
    ? Object.entries(metrics.activity.daily).map(([date, count]) => ({
        date: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        sessions: count,
      }))
    : []

  const sessionTypeData = metrics?.sessions.byType.map((item, index) => ({
    name: item.type.charAt(0).toUpperCase() + item.type.slice(1),
    value: item.count,
    color: COLORS[index % COLORS.length],
  })) || []

  const userRoleData = metrics?.users.byRole.map((item, index) => ({
    name: item.role.charAt(0).toUpperCase() + item.role.slice(1),
    value: item.count,
    color: COLORS[index % COLORS.length],
  })) || []

  const latencyData = metrics?.llm.avgTtftMs || metrics?.llm.avgTotalMs
    ? [
        { name: 'TTFT', value: metrics.llm.avgTtftMs || 0, color: '#8b5cf6' },
        { name: 'Total', value: metrics.llm.avgTotalMs || 0, color: '#06b6d4' },
      ]
    : []

  const statsCards = [
    {
      title: 'Total Users',
      value: metrics?.users.total || 0,
      subtitle: `${metrics?.users.active || 0} active`,
      icon: Users,
      color: 'text-violet-600',
      bgColor: 'bg-violet-100',
    },
    {
      title: 'Total Sessions',
      value: metrics?.sessions.total || 0,
      subtitle: `${metrics?.sessions.active || 0} active`,
      icon: Calendar,
      color: 'text-cyan-600',
      bgColor: 'bg-cyan-100',
    },
    {
      title: 'LLM Requests',
      value: metrics?.llm.totalRequests || 0,
      subtitle: `${metrics?.messages.total || 0} messages`,
      icon: Zap,
      color: 'text-amber-600',
      bgColor: 'bg-amber-100',
    },
    {
      title: 'Avg Latency',
      value: metrics?.llm.avgTotalMs ? `${Math.round(metrics.llm.avgTotalMs)}ms` : 'N/A',
      subtitle: metrics?.llm.avgTtftMs ? `TTFT: ${Math.round(metrics.llm.avgTtftMs)}ms` : '',
      icon: Clock,
      color: 'text-green-600',
      bgColor: 'bg-green-100',
    },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Metrics</h2>
          <p className="text-gray-500">System performance and usage analytics</p>
        </div>
        <Select value={dateRange} onValueChange={setDateRange}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Select range" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="24h">Last 24 hours</SelectItem>
            <SelectItem value="7d">Last 7 days</SelectItem>
            <SelectItem value="30d">Last 30 days</SelectItem>
            <SelectItem value="90d">Last 90 days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {statsCards.map((stat, index) => (
          <Card key={index}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500">{stat.title}</p>
                  <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                  {stat.subtitle && (
                    <p className="text-sm text-gray-500 mt-1">{stat.subtitle}</p>
                  )}
                </div>
                <div className={`flex h-12 w-12 items-center justify-center rounded-full ${stat.bgColor}`}>
                  <stat.icon className={`h-6 w-6 ${stat.color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardContent className="p-6">
              <Skeleton className="h-64 w-full" />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <Skeleton className="h-64 w-full" />
            </CardContent>
          </Card>
        </div>
      ) : isError ? (
        <div className="py-8 text-center">
          <p className="text-gray-500">Failed to load metrics</p>
          <button
            onClick={() => refetch()}
            className="mt-4 text-violet-600 hover:text-violet-700"
          >
            Try again
          </button>
        </div>
      ) : (
        <>
          {/* Charts Row 1 */}
          <div className="grid gap-4 md:grid-cols-2">
            {/* Daily Activity */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5" />
                  Daily Activity
                </CardTitle>
                <CardDescription>Sessions created over time</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={dailyActivityData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis
                        dataKey="date"
                        stroke="#6b7280"
                        fontSize={12}
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis
                        stroke="#6b7280"
                        fontSize={12}
                        tickLine={false}
                        axisLine={false}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#fff',
                          border: '1px solid #e5e7eb',
                          borderRadius: '8px',
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey="sessions"
                        stroke="#8b5cf6"
                        strokeWidth={2}
                        dot={{ fill: '#8b5cf6', strokeWidth: 2 }}
                        activeDot={{ r: 6 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Latency */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Response Latency
                </CardTitle>
                <CardDescription>Average response times (ms)</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  {latencyData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={latencyData} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis type="number" stroke="#6b7280" fontSize={12} />
                        <YAxis
                          type="category"
                          dataKey="name"
                          stroke="#6b7280"
                          fontSize={12}
                          width={60}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: '#fff',
                            border: '1px solid #e5e7eb',
                            borderRadius: '8px',
                          }}
                        />
                        <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                          {latencyData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex h-full items-center justify-center text-gray-500">
                      No latency data available
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Charts Row 2 */}
          <div className="grid gap-4 md:grid-cols-2">
            {/* Sessions by Type */}
            <Card>
              <CardHeader>
                <CardTitle>Sessions by Type</CardTitle>
                <CardDescription>Distribution of session types</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  {sessionTypeData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={sessionTypeData}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={80}
                          paddingAngle={2}
                          dataKey="value"
                        >
                          {sessionTypeData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{
                            backgroundColor: '#fff',
                            border: '1px solid #e5e7eb',
                            borderRadius: '8px',
                          }}
                        />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex h-full items-center justify-center text-gray-500">
                      No session data available
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Users by Role */}
            <Card>
              <CardHeader>
                <CardTitle>Users by Role</CardTitle>
                <CardDescription>Distribution of user roles</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  {userRoleData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={userRoleData}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={80}
                          paddingAngle={2}
                          dataKey="value"
                        >
                          {userRoleData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{
                            backgroundColor: '#fff',
                            border: '1px solid #e5e7eb',
                            borderRadius: '8px',
                          }}
                        />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex h-full items-center justify-center text-gray-500">
                      No user data available
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Token Usage */}
          <Card>
            <CardHeader>
              <CardTitle>Token Usage</CardTitle>
              <CardDescription>Total tokens processed by LLM</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-lg border p-4">
                  <p className="text-sm text-gray-500">Prompt Tokens</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {metrics?.llm.totalPromptTokens?.toLocaleString() || 0}
                  </p>
                </div>
                <div className="rounded-lg border p-4">
                  <p className="text-sm text-gray-500">Completion Tokens</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {metrics?.llm.totalCompletionTokens?.toLocaleString() || 0}
                  </p>
                </div>
                <div className="rounded-lg border p-4">
                  <p className="text-sm text-gray-500">Total Tokens</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {((metrics?.llm.totalPromptTokens || 0) + (metrics?.llm.totalCompletionTokens || 0)).toLocaleString()}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Credits Usage */}
          <Card>
            <CardHeader>
              <CardTitle>Credits Usage</CardTitle>
              <CardDescription>Total credits consumed across all users</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-amber-100">
                  <Zap className="h-8 w-8 text-amber-600" />
                </div>
                <div>
                  <p className="text-3xl font-bold text-gray-900">
                    {metrics?.credits.totalUsed.toLocaleString() || 0}
                  </p>
                  <p className="text-gray-500">Total credits used</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
