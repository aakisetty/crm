'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Checkbox } from '@/components/ui/checkbox'
import { Separator } from '@/components/ui/separator'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  Bot,
  RefreshCw,
  AlertTriangle,
  Bell,
  Clock,
  Calendar,
  Users,
  FileText,
  Activity,
  Check,
  X,
  Home,
  User,
  ChevronRight,
  Sparkles
} from 'lucide-react'

import { MarkdownText } from '@/components/ui/markdown'
import { PlanDayGrid } from '@/components/PlanDayGrid'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { useReminders, requestNotificationPermission } from '@/hooks/use-reminders'
import { toast as showToast } from '@/hooks/use-toast'
// Helper to target API whether UI and API are on same host or different ports/domains
// Set NEXT_PUBLIC_API_BASE_URL in .env.local if your API is not on the same origin as the UI
const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || ''
const apiUrl = (path) => `${API_BASE}${path}`

function formatDate(d) {
  if (!d) return '—'
  const date = new Date(d)
  if (isNaN(date.getTime())) return '—'
  return date.toLocaleDateString()
}

function formatTime(d) {
  if (!d) return '—'
  const date = new Date(d)
  if (isNaN(date.getTime())) return '—'
  try {
    return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  } catch {
    return date.toLocaleTimeString()
  }
}

function formatPlanWindow(meta) {
  if (!meta) return ''
  const dateStr = new Date(meta.started_at).toLocaleDateString()
  const start = formatTime(meta.started_at)
  const end = formatTime(meta.ends_at)
  return `${dateStr} ${start}–${end}`
}

function daysDiff(from, to = new Date()) {
  try {
    const a = new Date(from), b = new Date(to)
    if (isNaN(a) || isNaN(b)) return null
    return Math.ceil((b - a) / (1000 * 60 * 60 * 24))
  } catch { return null }
}

function SectionHeader({ icon: Icon, title, count, right }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        {Icon && <Icon className="h-4 w-4" />}
        <h4 className="font-semibold">{title}{typeof count === 'number' ? ` (${count})` : ''}</h4>
      </div>
      <div>{right}</div>
    </div>
  )
}

export function AssistantPanel() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [data, setData] = useState(null)
  const [agent, setAgent] = useState('')
  const [leadOpen, setLeadOpen] = useState(false)
  const [leadLoading, setLeadLoading] = useState(false)
  const [selectedLead, setSelectedLead] = useState(null)
  const [activityOpen, setActivityOpen] = useState(false)
  const [selectedActivity, setSelectedActivity] = useState(null)
  // Plan My Day state
  const [planOpen, setPlanOpen] = useState(false)
  const [proposedPlan, setProposedPlan] = useState([]) // [{ key, type: 'task'|'alert', id, label }]
  const [selectedPlanKeys, setSelectedPlanKeys] = useState(new Set())
  const [runningPlan, setRunningPlan] = useState(false)
  const [planResults, setPlanResults] = useState([]) // [{ key, status, message }]
  const [planMeta, setPlanMeta] = useState(null) // { started_at, ends_at, ... }
  const [planContext, setPlanContext] = useState(null) // 'guided' | 'schedule' | null
  const [planView, setPlanView] = useState('list') // 'list' | 'grid'
  const [guidedActive, setGuidedActive] = useState(false)
  const [guidedIndex, setGuidedIndex] = useState(0)
  const [lastSavedPlanId, setLastSavedPlanId] = useState(null)
  // NBA selection state
  const [nbaSelectedKeys, setNbaSelectedKeys] = useState(new Set())
  // Plan B state
  const [lastBatch, setLastBatch] = useState([]) // [{ key, type, id }]
  const [showUndo, setShowUndo] = useState(false)
  const [undoRunning, setUndoRunning] = useState(false)
  const undoTimerRef = useRef(null)
  // Nudges state
  const [nudges, setNudges] = useState([])
  const esRef = useRef(null)
  const sseRefreshTimerRef = useRef(null)

  // Manually trigger a persisted Nudge notification for a stalled deal
  const triggerNudge = async (deal) => {
    try {
      const title = 'Stalled deal'
      const label = deal?.title || deal?.property_address || 'Untitled'
      const days = deal?.days_inactive ?? '?'
      const message = `Deal "${label}" stalled for ${days} days.`
      const res = await fetch(apiUrl('/api/notifications'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'nudge',
          title,
          message,
          meta: { kind: 'stalled_deal', deal_id: deal?.id || deal?._id, days_inactive: deal?.days_inactive }
        })
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || json?.success === false) throw new Error(json?.error || 'Failed to create nudge')
      try { showToast({ title: 'Nudge sent', description: message }) } catch {}
      // NotificationCenter listens via SSE; no extra state update required here
    } catch (e) {
      try { showToast({ title: 'Nudge failed', description: e.message || 'Could not send nudge', variant: 'destructive' }) } catch { alert(e.message || 'Nudge failed') }
    }
  }

  const fetchSuggestions = async () => {
    setLoading(true); setError(null)
    try {
      const qs = new URLSearchParams()
      if (agent) qs.set('agent', agent)
      qs.set('limit', '5')
      const res = await fetch(apiUrl(`/api/assistant/suggestions?${qs.toString()}`))
      const json = await res.json()
      if (!res.ok || json?.success === false) throw new Error(json?.error || 'Failed to fetch suggestions')
      setData(json)
    } catch (e) {
      setError(e.message || 'Failed to load')
    }
    setLoading(false)
  }
  const scheduleSuggestionsRefresh = () => {
    if (sseRefreshTimerRef.current) clearTimeout(sseRefreshTimerRef.current)
    sseRefreshTimerRef.current = setTimeout(() => {
      if (typeof document === 'undefined' || document.visibilityState === 'visible') {
        fetchSuggestions()
      }
    }, 400)
  }

  useEffect(() => { fetchSuggestions() }, [])

  // Light polling (every 30s) while page is visible
  useEffect(() => {
    const tick = () => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return
      if (!loading) fetchSuggestions()
    }
    const id = setInterval(tick, 30000)
    return () => clearInterval(id)
  }, [agent, loading])

  // Refresh when tab becomes visible
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === 'visible') fetchSuggestions()
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [agent])

  // Request browser notification permission (non-intrusive; prompts only if default)
  useEffect(() => {
    requestNotificationPermission()
  }, [])

  // Real-time updates via SSE
  useEffect(() => {
    const url = apiUrl('/api/assistant/stream')
    let es
    try {
      es = new EventSource(url)
      esRef.current = es
      es.addEventListener('ready', () => scheduleSuggestionsRefresh())
      es.addEventListener('suggestions:update', () => scheduleSuggestionsRefresh())
      es.addEventListener('tasks:changed', () => scheduleSuggestionsRefresh())
      es.addEventListener('alerts:changed', () => scheduleSuggestionsRefresh())
      // Proactive nudges
      es.addEventListener('nudge', (ev) => {
        try {
          const data = JSON.parse(ev.data || '{}')
          if (data && data.message) {
            try { showToast({ title: 'Nudge', description: data.message }) } catch {}
            setNudges((prev) => [data, ...prev.slice(0, 4)]) // keep last 5
          }
        } catch (_) { /* ignore */ }
      })
      es.onerror = () => {
        try { es.close() } catch {}
        esRef.current = null
        scheduleSuggestionsRefresh()
      }
    } catch (_) { /* ignore */ }
    return () => {
      if (sseRefreshTimerRef.current) clearTimeout(sseRefreshTimerRef.current)
      try { esRef.current && esRef.current.close() } catch {}
      esRef.current = null
    }
  }, [agent])

  const summary = data?.summary || {}

  // Aggregate scheduled tasks from backend lists and current plan to schedule reminders
  const scheduledTasks = useMemo(() => {
    const list = []
    const add = (t) => {
      if (!t) return
      const start = t.scheduled_start || t.scheduledStart || t.start_time
      if (!start) return
      list.push({ id: t.id || t.key, label: t.title || t.label || 'Task', scheduled_start: start })
    }
    ;(data?.today_tasks || []).forEach(add)
    ;(data?.upcoming_tasks || []).forEach(add)
    ;(proposedPlan || []).forEach((it) => { if (it.type === 'task') add(it) })
    return list
  }, [data, proposedPlan])

  // In-app reminders: 10 minutes before and at start time
  useReminders(scheduledTasks, { leadMinutes: [10, 0], category: 'plan' })

  // Default the plan dialog view based on context
  useEffect(() => {
    if (planOpen) setPlanView(planContext === 'schedule' ? 'grid' : 'list')
  }, [planOpen, planContext])

  const onEditPlanTime = (item, startISO, endISO) => {
    setProposedPlan(prev => prev.map((it) => it.key === item.key ? { ...it, scheduled_start: startISO, scheduled_end: endISO } : it))
  }

  // Add a custom ad-hoc task into the current plan (local; persisted with plan save)
  const onAddPlanTask = ({ title, startISO, endISO, duration }) => {
    const key = `custom-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    setProposedPlan(prev => [
      ...prev,
      {
        key,
        type: 'task',
        id: null,
        label: title || 'Custom Task',
        scheduled_start: startISO,
        scheduled_end: endISO,
        est_duration_min: duration || 30,
        source: 'custom'
      }
    ])
  }

  const completeTask = async (itemId, opts = {}) => {
    try {
      const res = await fetch(apiUrl(`/api/checklist/${itemId}`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'completed' })
      })
      if (!res.ok) throw new Error('Failed to complete task')
      if (!opts.silent) fetchSuggestions()
    } catch (e) {
      alert(e.message)
    }
  }

  const dismissAlert = async (alertId, opts = {}) => {
    try {
      const res = await fetch(apiUrl(`/api/alerts/dismiss/${alertId}`), { method: 'POST' })
      if (!res.ok) throw new Error('Failed to dismiss alert')
      if (!opts.silent) fetchSuggestions()
    } catch (e) { alert(e.message) }
  }

  const openLeadDetails = async (leadOrId) => {
    // Prefill with what we have, then enrich
    if (leadOrId && typeof leadOrId === 'object') {
      setSelectedLead(leadOrId)
    } else {
      setSelectedLead(null)
    }
    setLeadOpen(true)
    const leadId = typeof leadOrId === 'object' ? leadOrId.id : leadOrId
    if (!leadId) return
    setLeadLoading(true)
    try {
      const res = await fetch(apiUrl(`/api/leads/${leadId}`))
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || 'Failed to load lead')
      setSelectedLead(json?.lead || json)
    } catch (e) {
      // keep prefilled data but surface error subtly
      setSelectedLead(prev => ({ ...(prev || {}), _fetch_error: e.message }))
    }
    setLeadLoading(false)
  }

  const sectionBox = useMemo(() => ({
    base: 'rounded-lg border p-3 bg-muted/30',
    item: 'flex items-start justify-between rounded-md p-3 bg-background hover:bg-muted/40 transition'
  }), [])

  const openActivityDetails = (activity) => {
    setSelectedActivity(activity || null)
    setActivityOpen(true)
  }

  // Greeting + Plan helpers
  const getGreeting = () => {
    const h = new Date().getHours()
    if (h < 12) return 'Good morning'
    if (h < 18) return 'Good afternoon'
    return 'Good evening'
  }

  const computePlanItems = () => {
    const items = []
    const usedTaskIds = new Set()
    const overdue = (data?.overdue_checklist || []).slice(0, 2)
    for (const t of overdue) {
      items.push({
        key: `task:${t.id}`,
        type: 'task',
        id: t.id,
        label: `Complete: ${t.title} (due ${formatDate(t.due_date)})`
      })
      usedTaskIds.add(t.id)
    }
    if (items.length < 3) {
      for (const t of (data?.today_tasks || [])) {
        if (items.length >= 3) break
        if (usedTaskIds.has(t.id)) continue
        items.push({ key: `task:${t.id}`, type: 'task', id: t.id, label: `Complete: ${t.title} (today)` })
      }
    }
    if (items.length < 3 && (data?.smart_alerts || []).length > 0) {
      const a = data.smart_alerts[0]
      items.push({ key: `alert:${a.id}`, type: 'alert', id: a.id, label: `Dismiss alert: ${(a.message || a.description || a.type || 'Alert')}` })
    }
    return items
  }

  // Prefer backend-provided Next Best Actions when available
  const getNBAItems = () => {
    const list = (data?.next_best_actions || []).map((i) => ({
      key: i.key,
      type: i.type,
      id: i.id,
      label: i.label,
      priority_score: i.priority_score,
      reason: i.reason,
      est_duration_min: i.est_duration_min,
      client_name: i.client_name,
      property_address: i.property_address
    }))
    if (list.length > 0) return list
    // Fallback to local heuristic
    return computePlanItems()
  }

  // Helpers to display the transaction/deal for a task in Next Best Actions
  const findTaskById = (id) => {
    const lists = [data?.overdue_checklist || [], data?.today_tasks || [], data?.upcoming_tasks || []]
    for (const lst of lists) {
      const m = lst.find(t => t.id === id)
      if (m) return m
    }
    return null
  }
  const getTaskTransactionLabel = (id) => {
    const t = findTaskById(id)
    if (!t) return ''
    const client = t.client_name || t.client?.name || t.lead_name || t.contact_name || t.clientFullName
    const listing =
      t.property_address || t.listing_address || t.listing_title || t.property || t.address ||
      ([t.street, t.city, t.state].filter(Boolean).join(', ') || '')
    if (client) return `Client: ${client}`
    if (listing) return listing
    const txn = t.transaction_title || t.transaction_name || t.deal_title || t.deal_name
    return txn || 'Client/Listing'
  }

  const openPlanDialog = () => {
    const items = getNBAItems()
    setProposedPlan(items)
    setSelectedPlanKeys(new Set(items.map(i => i.key)))
    setPlanResults([])
    setPlanMeta(null)
    setPlanContext(null)
    setGuidedActive(false)
    setGuidedIndex(0)
    setPlanOpen(true)
  }

  const openPlanWithItems = (items) => {
    const list = (items && items.length > 0) ? items : getNBAItems()
    setProposedPlan(list)
    setSelectedPlanKeys(new Set(list.map(i => i.key)))
    setPlanResults([])
    setPlanOpen(true)
  }

  // Build a plan on the backend using selected keys
  const requestPlan = async (keys, opts = {}) => {
    try {
      const payload = { selected_keys: Array.from(keys || []), agent, ...opts }
      const res = await fetch(apiUrl('/api/assistant/plan'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      const json = await res.json()
      if (!res.ok || json?.success === false) throw new Error(json?.error || 'Failed to build plan')
      const list = (json.items || []).map(i => ({
        key: i.key,
        type: i.type,
        id: i.id,
        label: i.label,
        priority_score: i.priority_score,
        reason: i.reason,
        est_duration_min: i.est_duration_min,
        client_name: i.client_name,
        property_address: i.property_address,
        scheduled_start: i.scheduled_start,
        scheduled_end: i.scheduled_end
      }))
      setProposedPlan(list)
      setSelectedPlanKeys(new Set(list.map(i => i.key)))
      setPlanResults([])
      setPlanMeta(json.plan || null)
      setPlanContext(opts.context || null)
      setGuidedActive(false)
      setGuidedIndex(0)
      setPlanOpen(true)
    } catch (e) {
      alert(e.message || 'Failed to create plan')
      // Fallback to local plan using selected keys
      const items = getNBAItems().filter(i => (keys || []).includes(i.key))
      openPlanWithItems(items)
    }
  }

  const toggleSelectPlanItem = (key) => {
    setSelectedPlanKeys(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const runPlan = async () => {
    setRunningPlan(true)
    const results = []
    for (const item of proposedPlan) {
      if (!selectedPlanKeys.has(item.key)) continue
      try {
        if (item.type === 'task') {
          await completeTask(item.id, { silent: true })
        } else if (item.type === 'alert') {
          await dismissAlert(item.id, { silent: true })
        }
        results.push({ key: item.key, status: 'ok', message: 'Done' })
      } catch (e) {
        results.push({ key: item.key, status: 'error', message: e.message || 'Failed' })
      }
    }
    setPlanResults(results)
    setRunningPlan(false)
    // Single refresh after batch
    fetchSuggestions()
    // Save batch for optional undo (tasks only are revertible)
    const executed = proposedPlan.filter(i => selectedPlanKeys.has(i.key))
    setLastBatch(executed)
    setShowUndo(true)
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current)
    undoTimerRef.current = setTimeout(() => setShowUndo(false), 7000)
  }

  // Quick batch without dialog (Next Best Actions > Run All)
  const runQuickBatch = async () => {
    const items = getNBAItems()
    if (items.length === 0) return
    // Execute similar to runPlan
    const executed = []
    for (const item of items) {
      try {
        if (item.type === 'task') await completeTask(item.id, { silent: true })
        else if (item.type === 'alert') await dismissAlert(item.id, { silent: true })
        executed.push(item)
      } catch (_) { /* ignore individual failures here */ }
    }
    setLastBatch(executed)
    setShowUndo(true)
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current)
    undoTimerRef.current = setTimeout(() => setShowUndo(false), 7000)
    fetchSuggestions()
  }

  // Batch Complete for selected NBA items
  const batchCompleteSelected = async () => {
    const items = getNBAItems().filter(i => nbaSelectedKeys.has(i.key))
    if (items.length === 0) return
    const executed = []
    for (const item of items) {
      try {
        if (item.type === 'task') await completeTask(item.id, { silent: true })
        else if (item.type === 'alert') await dismissAlert(item.id, { silent: true })
        executed.push(item)
      } catch (_) { /* continue */ }
    }
    setLastBatch(executed)
    setShowUndo(true)
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current)
    undoTimerRef.current = setTimeout(() => setShowUndo(false), 7000)
    fetchSuggestions()
  }

  const guidedRunSelected = async () => {
    const keys = getNBAItems().filter(i => nbaSelectedKeys.has(i.key)).map(i => i.key)
    if (keys.length === 0) return
    const now = new Date()
    const endHour = Math.min(23, now.getHours() + 3) // give a short runway for immediate run
    await requestPlan(keys, {
      start_time: now.toISOString(),
      workday_start_hour: now.getHours(),
      workday_end_hour: endHour,
      roll_to_next_workday: false,
      context: 'guided'
    })
  }

  const scheduleSelected = async () => {
    const keys = getNBAItems().filter(i => nbaSelectedKeys.has(i.key)).map(i => i.key)
    if (keys.length === 0) return
    await requestPlan(keys, { roll_to_next_workday: true, context: 'schedule' })
  }

  // Save plan to backend
  const handleSavePlan = async () => {
    try {
      // First, persist scheduled times to checklist tasks
      const updates = (proposedPlan || []).filter(it => it.type === 'task' && it.id && it.scheduled_start && it.scheduled_end)
      if (updates.length > 0) {
        await Promise.all(updates.map(async (it) => {
          try {
            const res = await fetch(apiUrl(`/api/checklist/${it.id}`), {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ scheduled_start: it.scheduled_start, scheduled_end: it.scheduled_end })
            })
            if (!res.ok) console.warn('Failed to update schedule for task', it.id)
          } catch (e) {
            console.warn('Error updating schedule for task', it.id, e)
          }
        }))
      }

      const res = await fetch(apiUrl('/api/assistant/plan/save'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agent,
          plan: { ...(planMeta || {}), context: planContext },
          items: proposedPlan,
          title: planContext ? `${planContext === 'guided' ? 'Guided' : 'Scheduled'} Plan ${new Date().toLocaleDateString()}` : undefined
        })
      })
      const json = await res.json()
      if (!res.ok || json?.success === false) throw new Error(json?.error || 'Failed to save plan')
      setLastSavedPlanId(json.plan_id)
      try { showToast({ title: 'Plan saved', description: 'Your schedule and items have been saved.' }) } catch {}
    } catch (e) {
      try { showToast({ title: 'Save failed', description: e.message || 'Failed to save plan', variant: 'destructive' }) } catch { alert(e.message || 'Failed to save plan') }
    }
  }

  // Generate ICS content and download
  const generateICS = (items, meta) => {
    const tz = (Intl.DateTimeFormat?.().resolvedOptions?.().timeZone) || 'UTC'
    const lines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//CRM Assistant//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      `X-WR-CALNAME:${meta?.title || 'Assistant Plan'}`,
      `X-WR-TIMEZONE:${tz}`
    ]
    const tzless = (d) => {
      const dt = new Date(d)
      const yyyy = dt.getUTCFullYear()
      const mm = String(dt.getUTCMonth() + 1).padStart(2, '0')
      const dd = String(dt.getUTCDate()).padStart(2, '0')
      const hh = String(dt.getUTCHours()).padStart(2, '0')
      const mi = String(dt.getUTCMinutes()).padStart(2, '0')
      const ss = String(dt.getUTCSeconds()).padStart(2, '0')
      return `${yyyy}${mm}${dd}T${hh}${mi}${ss}Z`
    }
    const fmtLocal = (d) => {
      const dt = new Date(d)
      const yyyy = dt.getFullYear()
      const mm = String(dt.getMonth() + 1).padStart(2, '0')
      const dd = String(dt.getDate()).padStart(2, '0')
      const hh = String(dt.getHours()).padStart(2, '0')
      const mi = String(dt.getMinutes()).padStart(2, '0')
      const ss = String(dt.getSeconds()).padStart(2, '0')
      return `${yyyy}${mm}${dd}T${hh}${mi}${ss}`
    }
    const makeUid = (it) => `${(it?.key || Date.now())}-${Math.random().toString(36).slice(2)}@assistant`
    ;(items || []).forEach((it) => {
      if (!it.scheduled_start || !it.scheduled_end) return
      lines.push('BEGIN:VEVENT')
      lines.push(`UID:${makeUid(it)}`)
      lines.push(`DTSTAMP:${tzless(new Date())}`)
      lines.push(`DTSTART;TZID=${tz}:${fmtLocal(it.scheduled_start)}`)
      lines.push(`DTEND;TZID=${tz}:${fmtLocal(it.scheduled_end)}`)
      const summary = (it.label || `${it.type} ${it.id}`).replace(/\n/g, ' ')
      lines.push(`SUMMARY:${summary}`)
      const desc = (it.reason || '').replace(/\n/g, ' ')
      if (desc) lines.push(`DESCRIPTION:${desc}`)
      // Default reminder 10 minutes before start
      lines.push('BEGIN:VALARM')
      lines.push('TRIGGER:-PT10M')
      lines.push('ACTION:DISPLAY')
      lines.push('DESCRIPTION:Reminder')
      lines.push('END:VALARM')
      lines.push('END:VEVENT')
    })
    lines.push('END:VCALENDAR')
    return lines.join('\r\n')
  }

  const handleExportICS = () => {
    try {
      const ics = generateICS(proposedPlan, planMeta)
      const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      const day = planMeta?.date || new Date().toISOString().slice(0,10)
      a.href = url
      a.download = `assistant-plan-${day}.ics`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (e) {
      alert('Failed to export ICS')
    }
  }

  // Guided run helpers
  const getSelectedPlanList = () => {
    const list = proposedPlan.filter(i => selectedPlanKeys.has(i.key))
    const withSched = list.filter(i => i.scheduled_start)
    const withoutSched = list.filter(i => !i.scheduled_start)
    withSched.sort((a, b) => new Date(a.scheduled_start) - new Date(b.scheduled_start))
    return [...withSched, ...withoutSched]
  }

  const startGuidedRun = () => {
    if (getSelectedPlanList().length === 0) return
    setGuidedActive(true)
    setGuidedIndex(0)
  }

  const advanceGuided = () => {
    const list = getSelectedPlanList()
    if (guidedIndex + 1 >= list.length) {
      setGuidedActive(false)
      setGuidedIndex(0)
      return
    }
    setGuidedIndex(guidedIndex + 1)
  }

  const completeCurrentGuided = async () => {
    const list = getSelectedPlanList()
    const item = list[guidedIndex]
    if (!item) return advanceGuided()
    try {
      if (item.type === 'task') await completeTask(item.id, { silent: true })
      else if (item.type === 'alert') await dismissAlert(item.id, { silent: true })
      setPlanResults(prev => ([...prev, { key: item.key, status: 'ok', message: 'Done' }]))
      setSelectedPlanKeys(prev => {
        const next = new Set(prev)
        next.delete(item.key)
        return next
      })
      advanceGuided()
    } catch (e) {
      setPlanResults(prev => ([...prev, { key: item.key, status: 'error', message: e.message || 'Failed' }]))
      advanceGuided()
    }
  }

  const skipCurrentGuided = () => {
    const list = getSelectedPlanList()
    const item = list[guidedIndex]
    if (item) setPlanResults(prev => ([...prev, { key: item.key, status: 'skipped', message: 'Skipped' }]))
    advanceGuided()
  }

  // Attempt to reopen a task (set status back to pending)
  const reopenTask = async (itemId) => {
    try {
      const res = await fetch(apiUrl(`/api/checklist/${itemId}`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'pending' })
      })
      return res.ok
    } catch {
      return false
    }
  }

  // Undo banner action: revert tasks; alerts may not be undoable
  const undoLastBatch = async () => {
    setUndoRunning(true)
    const tasks = lastBatch.filter(i => i.type === 'task')
    for (const t of tasks) {
      await reopenTask(t.id)
    }
    setUndoRunning(false)
    setShowUndo(false)
    fetchSuggestions()
  }

  // Clear snackbar timer on unmount
  useEffect(() => {
    return () => { if (undoTimerRef.current) clearTimeout(undoTimerRef.current) }
  }, [])

  return (
    <div className="space-y-6">
      {/* Greeting Snapshot */}
      {!loading && summary && (
        <Card className="bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800">
          <CardContent className="p-4 flex items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Bot className="h-5 w-5 text-purple-600" />
                <span className="font-semibold">{getGreeting()}, {agent || 'Agent'}.</span>
              </div>
              <p className="text-sm text-muted-foreground">
                {summary.active_deals ? `${summary.active_deals} active deals` : ''}
                {summary.overdue_tasks ? ` • ${summary.overdue_tasks} tasks overdue` : ''}
                {summary.new_leads ? ` • ${summary.new_leads} new leads` : ''}
              </p>
            </div>
            <Button size="sm" onClick={openPlanDialog} className="gap-1">
              <Sparkles className="h-4 w-4" />
              View Summary
            </Button>
          </CardContent>
        </Card>
      )}
      {/* Header & summary */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bot className="h-5 w-5 text-purple-600" />
          <div>
            <div className="font-semibold">My Assistant Panel</div>
            <div className="text-xs text-muted-foreground">Proactive suggestions and quick actions to manage your day</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={openPlanDialog} className="gap-2">
            <Sparkles className="h-4 w-4" />
            Plan My Day
          </Button>
          <Button variant="outline" size="sm" onClick={fetchSuggestions} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Undo snackbar */}
      {/* Proactive AI Nudges */}
      {nudges.length > 0 && (
        <div className="space-y-3">
          <SectionHeader icon={Bell} title="AI Nudges" count={nudges.length} />
          <div className="grid gap-3">
            {nudges.map((n, idx) => (
              <Card key={idx} className="bg-amber-50 dark:bg-amber-900/20 border-amber-300 dark:border-amber-800">
                <CardContent className="p-3 flex items-start justify-between gap-3">
                  <div className="text-sm flex-1">
                    {n.message}
                  </div>
                  {n.quickAction?.type === 'complete_task' && (
                    <Button size="sm" onClick={() => {
                      completeTask(n.quickAction.id)
                      setNudges((prev) => prev.filter((x) => x !== n))
                    }}>Mark Done</Button>
                  )}
                  {n.quickAction?.type === 'dismiss_alert' && (
                    <Button size="sm" onClick={() => {
                      dismissAlert(n.quickAction.id)
                      setNudges((prev) => prev.filter((x) => x !== n))
                    }}>Dismiss</Button>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {showUndo && (
        <div className="fixed bottom-6 right-6 z-50">
          <div className="flex items-center gap-3 px-3 py-2 rounded-md shadow-md bg-amber-100 dark:bg-amber-900/40 border border-amber-300 dark:border-amber-800">
            <div className="text-sm">Batch completed.</div>
            <Button size="sm" variant="outline" onClick={() => setShowUndo(false)} disabled={undoRunning}>Dismiss</Button>
            <Button size="sm" onClick={undoLastBatch} disabled={undoRunning}>{undoRunning ? 'Undoing…' : 'Undo'}</Button>
          </div>
        </div>
      )}

      {error && (
        <div className="text-sm text-red-600">{error}</div>
      )}

      {/* Greeting banner */}
      <div className="flex items-start gap-3 p-3 rounded-md bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-900">
        <Sparkles className="h-4 w-4 mt-0.5 text-purple-600" />
        <div className="text-sm">
          <div className="font-medium">{getGreeting()}!</div>
          <div className="text-muted-foreground mt-0.5">
            {`You have ${summary.overdue_tasks ?? 0} overdue and ${summary.due_today ?? 0} due today. Need a quick plan?`}
          </div>
        </div>
      </div>

      {/* Next Best Actions */}
      <Card>
        <CardHeader className="pb-2">
          <SectionHeader icon={Sparkles} title="Next Best Actions" count={getNBAItems().length}
            right={
              <div className="flex items-center gap-2">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="sm" className="gap-1">Run</Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuLabel>Selected</DropdownMenuLabel>
                    <DropdownMenuItem onClick={batchCompleteSelected}>Batch Complete</DropdownMenuItem>
                    <DropdownMenuItem onClick={guidedRunSelected}>Guided Run…</DropdownMenuItem>
                    <DropdownMenuItem onClick={scheduleSelected}>Schedule…</DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuLabel>Quick</DropdownMenuLabel>
                    <DropdownMenuItem onClick={runQuickBatch}>Run Top</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            }
          />
        </CardHeader>
        <CardContent>
          <div className={sectionBox.base}>
            {getNBAItems().length === 0 && (
              <div className="text-sm text-muted-foreground">No urgent actions right now.</div>
            )}
            {getNBAItems().map((item) => (
              <div key={item.key} className={`${sectionBox.item} mb-2 last:mb-0`}>
                <div className="flex items-start gap-3 pr-3">
                  <Checkbox
                    id={`nba-${item.key}`}
                    checked={nbaSelectedKeys.has(item.key)}
                    onCheckedChange={() => setNbaSelectedKeys(prev => {
                      const next = new Set(prev)
                      if (next.has(item.key)) next.delete(item.key)
                      else next.add(item.key)
                      return next
                    })}
                    className="mt-0.5"
                  />
                  <div>
                    <div className="font-medium text-sm flex items-center gap-2">
                      <span>{item.label}</span>
                      {typeof item.priority_score === 'number' && (
                        <Badge variant="outline">Score {Math.round(item.priority_score)}</Badge>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {(item.type === 'task' ? getTaskTransactionLabel(item.id) : 'Alert') || 'Client/Listing'}
                      {item.est_duration_min ? ` • ~${item.est_duration_min} min` : ''}
                    </div>
                    {item.reason && (
                      <div className="text-xs text-muted-foreground mt-0.5">{item.reason}</div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {item.type === 'task' ? (
                    <Button size="sm" variant="outline" onClick={() => completeTask(item.id)}>
                      <Check className="h-4 w-4" />
                    </Button>
                  ) : (
                    <Button size="sm" variant="outline" onClick={() => dismissAlert(item.id)}>
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Summary tiles */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-3">
        <Card>
          <CardHeader className="py-3">
            <CardDescription>Leads</CardDescription>
            <CardTitle className="text-2xl">{summary.leads_total ?? 0}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="py-3">
            <CardDescription>Active Deals</CardDescription>
            <CardTitle className="text-2xl">{summary.active_deals ?? 0}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="py-3">
            <CardDescription>Overdue</CardDescription>
            <CardTitle className="text-2xl text-orange-600">{summary.overdue_tasks ?? 0}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="py-3">
            <CardDescription>Due Today</CardDescription>
            <CardTitle className="text-2xl text-blue-600">{summary.due_today ?? 0}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="py-3">
            <CardDescription>Upcoming 7d</CardDescription>
            <CardTitle className="text-2xl">{summary.upcoming_week ?? 0}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="py-3">
            <CardDescription>Stalled</CardDescription>
            <CardTitle className="text-2xl text-red-600">{summary.stalled_deals ?? 0}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="py-3">
            <CardDescription>Smart Alerts</CardDescription>
            <CardTitle className="text-2xl">{summary.smart_alerts ?? 0}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Tasks sections */}
      <div className="grid lg:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <SectionHeader icon={Clock} title="Overdue Tasks" count={data?.overdue_checklist?.length || 0} />
          </CardHeader>
          <CardContent className="space-y-2">
            <div className={sectionBox.base}>
              {(data?.overdue_checklist || []).slice(0, 5).map((t) => (
                <div key={t.id} className={`${sectionBox.item} mb-2 last:mb-0`}>
                  <div className="pr-3">
                    <div className="font-medium text-sm">{t.title}</div>
                    <div className="text-xs text-muted-foreground">
                      {(getTaskTransactionLabel(t.id) || 'Client/Listing')} • Due {formatDate(t.due_date)} • Priority {t.priority || '—'} {t.stage ? `• ${t.stage}` : ''}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline" onClick={() => completeTask(t.id)}>
                      <Check className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
              {(!data?.overdue_checklist || data.overdue_checklist.length === 0) && (
                <div className="text-sm text-muted-foreground">No overdue tasks</div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <SectionHeader icon={Calendar} title="Due Today" count={data?.today_tasks?.length || 0} />
          </CardHeader>
          <CardContent className="space-y-2">
            <div className={sectionBox.base}>
              {(data?.today_tasks || []).slice(0, 5).map((t) => (
                <div key={t.id} className={`${sectionBox.item} mb-2 last:mb-0`}>
                  <div className="pr-3">
                    <div className="font-medium text-sm">{t.title}</div>
                    <div className="text-xs text-muted-foreground">
                      {(getTaskTransactionLabel(t.id) || 'Client/Listing')} • Due {formatDate(t.due_date)} {t.stage ? `• ${t.stage}` : ''}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline" onClick={() => completeTask(t.id)}>
                      <Check className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
              {(!data?.today_tasks || data.today_tasks.length === 0) && (
                <div className="text-sm text-muted-foreground">Nothing due today</div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <SectionHeader icon={Calendar} title="Upcoming (7 days)" count={data?.upcoming_tasks?.length || 0} />
          </CardHeader>
          <CardContent className="space-y-2">
            <div className={sectionBox.base}>
              {(data?.upcoming_tasks || []).slice(0, 5).map((t) => (
                <div key={t.id} className={`${sectionBox.item} mb-2 last:mb-0`}>
                  <div className="pr-3">
                    <div className="font-medium text-sm">{t.title}</div>
                    <div className="text-xs text-muted-foreground">
                      {(getTaskTransactionLabel(t.id) || 'Client/Listing')} • Due {formatDate(t.due_date)} {t.stage ? `• ${t.stage}` : ''}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline" onClick={() => completeTask(t.id)}>
                      <Check className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
              {(!data?.upcoming_tasks || data.upcoming_tasks.length === 0) && (
                <div className="text-sm text-muted-foreground">No upcoming tasks</div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Stalled deals and alerts */}
      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <SectionHeader icon={AlertTriangle} title="Stalled Deals" count={data?.stalled_deals?.length || 0} />
          </CardHeader>
          <CardContent>
            <div className={sectionBox.base}>
              {(data?.stalled_deals || []).slice(0, 6).map((d) => (
                <div key={d.id} className={`${sectionBox.item} mb-2 last:mb-0`}>
                  <div className="pr-3">
                    <div className="font-medium text-sm flex items-center gap-2">
                      <Home className="h-4 w-4" /> {d.property_address || 'TBD'}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {d.client_name ? `Client: ${d.client_name} • ` : ''}Stage: {d.current_stage} • {d.days_inactive ?? '?'} days inactive
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline" onClick={() => triggerNudge(d)}>
                      Nudge
                    </Button>
                  </div>
                </div>
              ))}
              {(!data?.stalled_deals || data.stalled_deals.length === 0) && (
                <div className="text-sm text-muted-foreground">No stalled deals</div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <SectionHeader icon={Bell} title="Smart Alerts" count={data?.smart_alerts?.length || 0} />
          </CardHeader>
          <CardContent>
            <div className={sectionBox.base}>
              {(data?.smart_alerts || []).slice(0, 6).map((a) => (
                <div key={a.id} className={`${sectionBox.item} mb-2 last:mb-0`}>
                  <div className="pr-3">
                    <div className="font-medium text-sm flex items-center gap-2">
                      <Badge variant="outline">{a.alert_type || 'alert'}</Badge>
                      <span className={`text-xs ${a.priority === 'urgent' ? 'text-red-600' : a.priority === 'high' ? 'text-orange-600' : 'text-muted-foreground'}`}>{a.priority || 'medium'}</span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">{a.message || a.description || 'Alert'}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline" onClick={() => dismissAlert(a.id)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
              {(!data?.smart_alerts || data.smart_alerts.length === 0) && (
                <div className="text-sm text-muted-foreground">No alerts</div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Leads and recent activity */}
      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <SectionHeader icon={Users} title="Recent Leads" count={data?.recent_leads?.length || 0} />
          </CardHeader>
          <CardContent>
            <div className={sectionBox.base}>
              {(data?.recent_leads || []).slice(0, 6).map((l) => (
                <div key={l.id} className={`${sectionBox.item} mb-2 last:mb-0`}>
                  <div className="pr-3">
                    <div className="font-medium text-sm flex items-center gap-2">
                      <User className="h-4 w-4" /> {l.name || 'Unnamed Lead'}
                      {l.lead_type && <Badge variant={l.lead_type === 'buyer' ? 'default' : 'secondary'}>{l.lead_type}</Badge>}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {l.email || '—'} {l.phone ? `• ${l.phone}` : ''} • Added {formatDate(l.created_at)}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline" onClick={() => openLeadDetails(l)}>
                      View
                    </Button>
                  </div>
                </div>
              ))}
              {(!data?.recent_leads || data.recent_leads.length === 0) && (
                <div className="text-sm text-muted-foreground">No recent leads</div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <SectionHeader icon={Activity} title="Recent Assistant Activity" count={data?.recent_activity?.length || 0} />
          </CardHeader>
          <CardContent>
            <div className={sectionBox.base}>
              {(data?.recent_activity || []).slice(0, 6).map((c) => (
                <div key={c.id} className={`${sectionBox.item} mb-2 last:mb-0`}>
                  <div className="pr-3">
                    <div className="font-medium text-sm">{c.ai_response ? String(c.ai_response).slice(0, 80) + (String(c.ai_response).length > 80 ? '…' : '') : 'Conversation'}</div>
                    <div className="text-xs text-muted-foreground">{formatDate(c.created_at)} • Properties: {c.properties_found ?? 0}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline" onClick={() => openActivityDetails(c)}>
                      Open
                    </Button>
                  </div>
                </div>
              ))}
              {(!data?.recent_activity || data.recent_activity.length === 0) && (
                <div className="text-sm text-muted-foreground">No recent activity</div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="text-xs text-muted-foreground">Updated {data?.generated_at ? new Date(data.generated_at).toLocaleString() : '—'}</div>

      {/* Plan My Day Dialog */}
      <Dialog open={planOpen} onOpenChange={setPlanOpen}>
        <DialogContent className="max-w-3xl w-[min(100vw-2rem,900px)]">
          <DialogHeader>
            <DialogTitle>
              Plan
              {planMeta ? ` • ${formatPlanWindow(planMeta)}` : ''}
            </DialogTitle>
            <DialogDescription>
              {planContext === 'guided' && 'Guided Run window. Step through each action below.'}
              {planContext === 'schedule' && 'Scheduled within your work hours. You can save or export this plan.'}
              {!planContext && 'Select actions and let me handle them.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-xs text-muted-foreground">View</div>
              <ToggleGroup type="single" value={planView} onValueChange={(v) => v && setPlanView(v)}>
                <ToggleGroupItem value="list" aria-label="List view">List</ToggleGroupItem>
                <ToggleGroupItem value="grid" aria-label="Grid view">Grid</ToggleGroupItem>
              </ToggleGroup>
            </div>
            {proposedPlan.length === 0 && (
              <div className="text-sm text-muted-foreground">Nothing urgent right now. You’re all set!</div>
            )}
            {planView === 'grid' ? (
              <div className="max-h-[60vh] overflow-auto pr-1">
                <PlanDayGrid
                  items={proposedPlan}
                  planMeta={planMeta}
                  onEditTime={onEditPlanTime}
                  onAddTask={onAddPlanTask}
                />
              </div>
            ) : (
              <ScrollArea className="max-h-80 pr-2">
                <div className="space-y-2">
                  {proposedPlan.map(item => (
                    <label key={item.key} className="flex items-start gap-3 p-3 rounded-md border bg-background hover:bg-muted/40 transition">
                      <Checkbox
                        id={`plan-${item.key}`}
                        checked={selectedPlanKeys.has(item.key)}
                        onCheckedChange={() => toggleSelectPlanItem(item.key)}
                        className="mt-0.5"
                      />
                      <div className="text-sm">
                        <div className="font-medium">{item.label}</div>
                        <div className="text-xs text-muted-foreground">
                          {(item.type === 'task' ? getTaskTransactionLabel(item.id) : 'Alert') || 'Client/Listing'}
                          {item.est_duration_min ? ` • ~${item.est_duration_min} min` : ''}
                        </div>
                        {(item.scheduled_start && item.scheduled_end) && (
                          <div className="text-xs text-muted-foreground">Scheduled: {formatTime(item.scheduled_start)}–{formatTime(item.scheduled_end)}</div>
                        )}
                      </div>
                    </label>
                  ))}
                </div>
              </ScrollArea>
            )}

            {guidedActive && (
              <div className="p-3 rounded-md bg-muted">
                <div className="text-xs font-medium mb-2">Guided Run</div>
                {(() => {
                  const list = getSelectedPlanList()
                  const item = list[guidedIndex]
                  if (!item) return <div className="text-sm">All done.</div>
                  return (
                    <div className="space-y-2">
                      <div className="text-sm font-medium">{item.label}</div>
                      <div className="text-xs text-muted-foreground">
                        {item.scheduled_start ? `${formatTime(item.scheduled_start)}–${formatTime(item.scheduled_end)} • ` : ''}
                        {item.est_duration_min ? `~${item.est_duration_min} min` : ''}
                      </div>
                      <div className="flex items-center gap-2">
                        <Button size="sm" onClick={completeCurrentGuided}>Complete</Button>
                        <Button size="sm" variant="outline" onClick={skipCurrentGuided}>Skip</Button>
                        <Button size="sm" variant="ghost" onClick={advanceGuided}>Next</Button>
                      </div>
                    </div>
                  )
                })()}
              </div>
            )}

            {planResults.length > 0 && (
              <div className="p-2 rounded-md bg-muted">
                <div className="text-xs font-medium mb-1">Results</div>
                <ul className="text-xs space-y-1">
                  {planResults.map(r => (
                    <li key={r.key} className={r.status === 'ok' ? 'text-green-700 dark:text-green-400' : r.status === 'skipped' ? 'text-muted-foreground' : 'text-red-600'}>
                      {r.status === 'ok' ? '✓' : r.status === 'skipped' ? '↷' : '✗'} {proposedPlan.find(i => i.key === r.key)?.label} — {r.message}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          <div className="mt-4 flex items-center justify-between gap-2 border-t pt-3">
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={handleSavePlan} disabled={!proposedPlan.length}>Save</Button>
              <Button size="sm" variant="outline" onClick={handleExportICS} disabled={!proposedPlan.some(i => i.scheduled_start)}>Export .ics</Button>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="secondary" onClick={startGuidedRun} disabled={guidedActive || selectedPlanKeys.size === 0}>Start Guided Run</Button>
              <Button size="sm" variant="outline" onClick={() => setPlanOpen(false)} disabled={runningPlan}>Close</Button>
              <Button size="sm" onClick={runPlan} disabled={runningPlan || proposedPlan.length === 0 || selectedPlanKeys.size === 0}>
                {runningPlan ? 'Running…' : 'Run Selected'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Lead Details Modal */}
      <Dialog open={leadOpen} onOpenChange={setLeadOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Lead Details</DialogTitle>
            <DialogDescription>Full details for the selected lead.</DialogDescription>
          </DialogHeader>
          {!selectedLead && leadLoading && (
            <div className="text-sm text-muted-foreground">Loading…</div>
          )}
          {selectedLead && selectedLead.error && (
            <div className="text-sm text-red-600">{selectedLead.error}</div>
          )}
          {selectedLead && !selectedLead.error && (
            <div className="space-y-4">
              <div>
                <div className="text-lg font-semibold">{selectedLead.name || 'Unnamed Lead'}</div>
                <div className="flex items-center gap-2 mt-1">
                  {selectedLead.lead_type && (
                    <Badge variant={selectedLead.lead_type === 'buyer' ? 'default' : 'secondary'}>{selectedLead.lead_type}</Badge>
                  )}
                  {selectedLead.tags && selectedLead.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {selectedLead.tags.map((t, idx) => (
                        <Badge key={idx} variant="outline">{t}</Badge>
                      ))}
                    </div>
                  )}
                </div>
                <div className="text-xs text-muted-foreground mt-1">Added {formatDate(selectedLead.created_at)}</div>
              </div>

              <Separator />

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <div className="text-muted-foreground">Email</div>
                  <div>{selectedLead.email || '—'}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Phone</div>
                  <div>{selectedLead.phone || '—'}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Assigned Agent</div>
                  <div>{selectedLead.assigned_agent || '—'}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Source</div>
                  <div>{selectedLead.source || '—'}</div>
                </div>
              </div>

              {selectedLead.preferences && (
                <div>
                  <div className="font-medium mb-1">Preferences</div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    {Object.entries(selectedLead.preferences).map(([k, v]) => (
                      <div key={k} className="flex justify-between">
                        <div className="text-muted-foreground capitalize">{k.replace(/_/g, ' ')}</div>
                        <div>{String(v || '—')}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selectedLead.ai_insights && (
                <div className="p-3 bg-muted rounded-md text-sm">
                  <div className="font-medium mb-1">AI Insights</div>
                  <MarkdownText text={selectedLead.ai_insights} />
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Activity Details Modal */}
      <Dialog open={activityOpen} onOpenChange={setActivityOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Assistant Activity</DialogTitle>
            <DialogDescription>Details from a recent assistant conversation.</DialogDescription>
          </DialogHeader>
          {!selectedActivity && (
            <div className="text-sm text-muted-foreground">No activity selected.</div>
          )}
          {selectedActivity && (
            <div className="space-y-4">
              <div className="flex items-center justify-between text-sm">
                <div className="text-muted-foreground">When</div>
                <div>{formatDate(selectedActivity.created_at)}{selectedActivity.created_at ? ` • ${new Date(selectedActivity.created_at).toLocaleTimeString()}` : ''}</div>
              </div>

              <div className="flex items-center justify-between text-sm">
                <div className="text-muted-foreground">Properties Found</div>
                <div>{selectedActivity.properties_found ?? 0}</div>
              </div>

              {selectedActivity.lead_id && (
                <div className="flex items-center justify-between text-sm">
                  <div className="text-muted-foreground">Lead</div>
                  <div className="flex items-center gap-2">
                    <code className="text-xs">{selectedActivity.lead_id}</code>
                    <Button size="sm" variant="outline" onClick={() => openLeadDetails(selectedActivity.lead_id)}>View Lead</Button>
                  </div>
                </div>
              )}

              <Separator />

              {selectedActivity.agent_message && (
                <div>
                  <div className="font-medium mb-1">Agent Message</div>
                  <div className="p-3 bg-muted rounded-md text-sm whitespace-pre-line">{selectedActivity.agent_message}</div>
                </div>
              )}

              {selectedActivity.ai_response && (
                <div>
                  <div className="font-medium mb-1">AI Response</div>
                  <div className="p-3 bg-muted rounded-md text-sm whitespace-pre-line">{selectedActivity.ai_response}</div>
                </div>
              )}

              {selectedActivity.parsed_data && (
                <div>
                  <div className="font-medium mb-1">Parsed Data</div>
                  <pre className="p-3 bg-muted rounded-md text-xs overflow-auto max-h-64">{JSON.stringify(selectedActivity.parsed_data, null, 2)}</pre>
                </div>
              )}

              {selectedActivity.recommendations && (
                <div>
                  <div className="font-medium mb-1">Recommendations</div>
                  <pre className="p-3 bg-muted rounded-md text-xs overflow-auto max-h-64">{JSON.stringify(selectedActivity.recommendations, null, 2)}</pre>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
