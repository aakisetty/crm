'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { Card, CardHeader, CardContent, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Checkbox } from '@/components/ui/checkbox'
import { Separator } from '@/components/ui/separator'
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu'
import { toast as showToast } from '@/hooks/use-toast'
import { PlanDayGrid } from '@/components/PlanDayGrid'

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || ''
const apiUrl = (path) => `${API_BASE}${path}`

// Stable date formatter (MM/DD/YYYY) using UTC to avoid SSR/CSR locale mismatches
function formatDateMDY(input) {
  try {
    const dt = new Date(input)
    if (isNaN(dt)) return '—'
    const [y, m, d] = dt.toISOString().slice(0, 10).split('-')
    return `${Number(m)}/${Number(d)}/${y}`
  } catch { return '—' }
}
function formatTime(d) {
  try { return new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) } catch { return '—' }
}

export default function PlanPage() {
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [tasks, setTasks] = useState([]) // feed
  const [selectedIds, setSelectedIds] = useState([]) // ordered
  const [error, setError] = useState(null)
  const [mounted, setMounted] = useState(false)
  const [dateKey, setDateKey] = useState(() => new Date().toISOString().slice(0,10))
  const [viewMode, setViewMode] = useState('list') // 'list' | 'grid'

  useEffect(() => { setMounted(true) }, [])

  // Live updates via SSE so changes in Transactions page reflect here
  const sseTimerRef = useRef(null)
  useEffect(() => {
    let es
    try {
      es = new EventSource(apiUrl('/api/assistant/stream'))
      const scheduleReload = () => {
        if (sseTimerRef.current) clearTimeout(sseTimerRef.current)
        sseTimerRef.current = setTimeout(() => { loadData() }, 300)
      }
      es.addEventListener('ready', scheduleReload)
      es.addEventListener('tasks:changed', scheduleReload)
      es.addEventListener('suggestions:update', scheduleReload)
      es.onerror = () => {
        try { es.close() } catch {}
      }
    } catch (_) { /* ignore SSE failures */ }
    return () => {
      if (sseTimerRef.current) clearTimeout(sseTimerRef.current)
      try { es && es.close() } catch {}
    }
  }, [dateKey])

  const loadData = async () => {
    setLoading(true); setError(null)
    try {
      const [tasksRes, planRes] = await Promise.all([
        fetch(apiUrl(`/api/pmd/tasks?date=${dateKey}`)),
        fetch(apiUrl(`/api/pmd/plans/latest?date=${dateKey}`))
      ])
      const tasksJson = await tasksRes.json().catch(() => ({}))
      if (!tasksRes.ok || tasksJson?.success === false) throw new Error(tasksJson?.error || 'Failed tasks')
      setTasks(Array.isArray(tasksJson.tasks) ? tasksJson.tasks : [])

      const planJson = await planRes.json().catch(() => ({}))
      if (planRes.ok && planJson?.plan?.items) {
        const ids = planJson.plan.items.map((it) => (typeof it === 'string' ? it : it.id)).filter(Boolean)
        setSelectedIds(ids)
      } else {
        setSelectedIds([])
      }
    } catch (e) {
      setError(e.message || 'Failed to load')
    }
    setLoading(false)
  }

  useEffect(() => { loadData() }, [dateKey])

  const suggested = useMemo(() => tasks.filter(t => !selectedIds.includes(t.id)), [tasks, selectedIds])
  const selected = useMemo(() => selectedIds.map(id => tasks.find(t => t.id === id)).filter(Boolean), [tasks, selectedIds])
  const selectedGridItems = useMemo(() => selected.map((t) => ({
    key: t.id,
    id: t.id,
    type: 'task',
    label: t.title || 'Task',
    client_name: t.client_name,
    property_address: t.property_address,
    scheduled_start: t.scheduled_start || null,
    scheduled_end: t.scheduled_end || null,
    est_duration_min: t.est_duration_min || 30,
  })), [selected])

  const toggleSelect = (id) => {
    setSelectedIds((prev) => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  const moveSelected = (id, dir) => {
    setSelectedIds((prev) => {
      const idx = prev.indexOf(id)
      if (idx < 0) return prev
      const arr = [...prev]
      const swapIdx = dir === 'up' ? idx - 1 : idx + 1
      if (swapIdx < 0 || swapIdx >= arr.length) return prev
      ;[arr[idx], arr[swapIdx]] = [arr[swapIdx], arr[idx]]
      return arr
    })
  }

  const snoozeOptions = [
    { label: 'Today afternoon (3 PM)', until: () => { const d = new Date(); d.setHours(15,0,0,0); return d } },
    { label: 'Tomorrow 9 AM', until: () => { const d = new Date(); d.setDate(d.getDate()+1); d.setHours(9,0,0,0); return d } },
    { label: 'Next weekday 9 AM', until: () => { const d = new Date(); let add=1; while([0,6].includes(new Date(d.getFullYear(), d.getMonth(), d.getDate()+add).getDay())) add++; d.setDate(d.getDate()+add); d.setHours(9,0,0,0); return d } },
  ]

  const snoozeTask = async (taskId, untilDate) => {
    try {
      await fetch(apiUrl(`/api/tasks/${taskId}/snooze`), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ until: untilDate.toISOString() }) })
      // Refresh feed after snooze
      await loadData()
      try { showToast({ title: 'Task snoozed', description: `Snoozed until ${formatTime(untilDate)}` }) } catch {}
    } catch (e) { /* keep UI light; we can add toast later */ }
  }

  const dismissTask = async (taskId) => {
    try {
      await fetch(apiUrl(`/api/tasks/${taskId}/dismiss`), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ date: dateKey }) })
      // Refresh feed after dismiss
      await loadData()
      try { showToast({ title: 'Task dismissed', description: 'Hidden from today\'s suggestions.' }) } catch {}
    } catch (e) { /* optional toast */ }
  }

  const savePlan = async () => {
    setSaving(true)
    try {
      const items = selectedIds.map((id, order) => ({ id, order }))
      const res = await fetch(apiUrl('/api/pmd/plans'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ date: dateKey, items }) })
      if (!res.ok) throw new Error('Save failed')
      try { showToast({ title: 'Plan saved', description: 'Your selections were saved for today.' }) } catch {}
    } catch (e) { /* optional toast */ }
    setSaving(false)
  }

  // Persist schedule changes from Grid view to checklist and update local state
  const onEditGridTime = async (gridItem, startISO, endISO) => {
    if (!gridItem?.id) return
    try {
      const res = await fetch(apiUrl(`/api/checklist/${gridItem.id}`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scheduled_start: startISO,
          scheduled_end: endISO,
          due_date: startISO
        })
      })
      if (!res.ok) throw new Error('Failed to save schedule')
      setTasks((prev) => prev.map((t) => t.id === gridItem.id ? { ...t, scheduled_start: startISO, scheduled_end: endISO, due_date: startISO } : t))
      try { showToast({ title: 'Scheduled', description: 'Time updated' }) } catch {}
    } catch (e) {
      try { showToast({ title: 'Save failed', description: e.message || 'Could not save schedule', variant: 'destructive' }) } catch {}
    }
  }

  return (
    <div className="min-h-screen w-full flex items-start justify-center p-4 bg-background">
      <div className="w-[min(1024px,90vw)] h-[85vh] rounded-lg border shadow bg-card overflow-hidden">
        {/* Header */}
        <div className="px-4 py-3 border-b flex items-center justify-between">
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="text-lg font-semibold" suppressHydrationWarning>Plan • {formatDateMDY(dateKey)}</h2>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const d = new Date(dateKey); d.setDate(d.getDate() - 1); setDateKey(d.toISOString().slice(0,10))
                }}
              >Prev</Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDateKey(new Date().toISOString().slice(0,10))}
              >Today</Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const d = new Date(dateKey); d.setDate(d.getDate() + 1); setDateKey(d.toISOString().slice(0,10))
                }}
              >Next</Button>
              <input
                type="date"
                className="border rounded px-2 py-1 text-sm bg-background"
                value={dateKey}
                onChange={(e) => { const v = e.target.value; if (v) setDateKey(v) }}
              />
            </div>
            {loading && <Badge variant="outline">Loading…</Badge>}
            {error && <Badge variant="destructive">{error}</Badge>}
          </div>
          <div className="flex items-center gap-2">
            <Link href="/" className="text-sm"><Button variant="outline" size="sm">Close</Button></Link>
            <div className="hidden md:flex items-center gap-1 mr-2">
              <Button variant={viewMode === 'list' ? 'default' : 'outline'} size="sm" onClick={() => setViewMode('list')}>List</Button>
              <Button variant={viewMode === 'grid' ? 'default' : 'outline'} size="sm" onClick={() => setViewMode('grid')}>Grid</Button>
            </div>
            <Button size="sm" onClick={savePlan} disabled={saving || selectedIds.length === 0}>{saving ? 'Saving…' : `Save (${selectedIds.length})`}</Button>
          </div>
        </div>
        {/* Body */}
        {viewMode === 'list' ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-0 h-[calc(85vh-52px)]">
          {/* Suggested */}
          <div className="border-r h-full flex flex-col">
            <div className="px-4 py-2 flex items-center justify-between">
              <div className="text-sm text-muted-foreground">Suggested for Today</div>
              <div className="text-xs text-muted-foreground">{suggested.length} tasks</div>
            </div>
            <Separator />
            <ScrollArea className="flex-1 px-3 py-2">
              <div className="space-y-2">
                {suggested.map((t) => (
                  <Card key={t.id} className="p-3">
                    <div className="flex items-start gap-3">
                      <Checkbox checked={selectedIds.includes(t.id)} onCheckedChange={() => toggleSelect(t.id)} className="mt-1" />
                      <div className="flex-1 text-sm">
                        <div className="font-medium truncate">{t.title || 'Task'}</div>
                        <div className="text-xs text-muted-foreground truncate">
                          {t.client_name ? `Client: ${t.client_name}` : (t.property_address || '—')}
                          {t.stage ? ` • ${t.stage}` : ''}
                          {t.due_date ? ` • Due ${formatDateMDY(t.due_date)}` : ''}
                          {t.est_duration_min ? ` • ~${t.est_duration_min} min` : ''}
                        </div>
                        {(t.scheduled_start && t.scheduled_end) && (
                          <div className="text-[11px] text-muted-foreground" suppressHydrationWarning>
                            Scheduled: {formatTime(t.scheduled_start)}–{formatTime(t.scheduled_end)}
                          </div>
                        )}
                      </div>
                      <div className="shrink-0 flex items-center gap-1">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button size="sm" variant="outline">Snooze</Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {snoozeOptions.map((opt, idx) => (
                              <DropdownMenuItem key={idx} onClick={() => snoozeTask(t.id, opt.until())}>{opt.label}</DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                        <Button size="sm" variant="ghost" onClick={() => dismissTask(t.id)}>Dismiss</Button>
                      </div>
                    </div>
                  </Card>
                ))}
                {suggested.length === 0 && (
                  <div className="text-xs text-muted-foreground px-2">Nothing to suggest. You’re all set!</div>
                )}
              </div>
            </ScrollArea>
          </div>

          {/* Selected */}
          <div className="h-full flex flex-col">
            <div className="px-4 py-2 flex items-center justify-between">
              <div className="text-sm text-muted-foreground">Selected for Today</div>
              <div className="text-xs text-muted-foreground">{selected.length} selected</div>
            </div>
            <Separator />
            <ScrollArea className="flex-1 px-3 py-2">
              <div className="space-y-2">
                {selected.map((t) => (
                  <Card key={t.id} className="p-3">
                    <div className="flex items-start gap-3">
                      <Checkbox checked onCheckedChange={() => toggleSelect(t.id)} className="mt-1" />
                      <div className="flex-1 text-sm">
                        <div className="font-medium truncate">{t.title || 'Task'}</div>
                        <div className="text-xs text-muted-foreground truncate">
                          {t.client_name ? `Client: ${t.client_name}` : (t.property_address || '—')}
                          {t.stage ? ` • ${t.stage}` : ''}
                          {t.due_date ? ` • Due ${formatDateMDY(t.due_date)}` : ''}
                          {t.est_duration_min ? ` • ~${t.est_duration_min} min` : ''}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap justify-end">
                        <Button size="sm" variant="outline" className="whitespace-nowrap" onClick={() => moveSelected(t.id, 'up')}>Up</Button>
                        <Button size="sm" variant="outline" className="whitespace-nowrap" onClick={() => moveSelected(t.id, 'down')}>Down</Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="whitespace-nowrap min-w-[84px] px-3 text-red-600 border-red-200 hover:bg-red-50"
                          onClick={() => toggleSelect(t.id)}
                          title="Remove from Selected"
                        >
                          Remove
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
                {selected.length === 0 && (
                  <div className="text-xs text-muted-foreground px-2">Pick items from the left to plan your day.</div>
                )}
              </div>
            </ScrollArea>
          </div>
        </div>
      ) : (
        <div className="h-[calc(85vh-52px)] p-3">
          <PlanDayGrid
            items={selectedGridItems}
            planMeta={{ started_at: `${dateKey}T09:00:00`, ends_at: `${dateKey}T17:00:00`, date: dateKey }}
            workdayStartHour={9}
            workdayEndHour={17}
            onEditTime={onEditGridTime}
          />
        </div>
      )}
    </div>
  </div>
)

}
