"use client";

import { useEffect, useMemo, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bell, RefreshCcw, Check, Clock, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || ''
const apiUrl = (path) => `${API_BASE}${path}`

async function fetchJSON(url, opts) {
  const res = await fetch(url, opts)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return await res.json()
}

export function NotificationBell() {
  const [open, setOpen] = useState(false)
  const [counts, setCounts] = useState({ total: 0, unread: 0 })
  const { toast } = useToast()

  const loadCount = async () => {
    try {
      const data = await fetchJSON(apiUrl('/api/notifications?countOnly=1'))
      setCounts({ total: data.total || 0, unread: data.unread || 0 })
    } catch {}
  }

  useEffect(() => {
    loadCount()
    const t = setInterval(loadCount, 30000)
    return () => clearInterval(t)
  }, [])

  // Listen globally for reminders so user gets a toast even if drawer is closed
  useEffect(() => {
    let es
    try {
      es = new EventSource(apiUrl('/api/assistant/stream'))
      es.addEventListener('notifications:remind', (e) => {
        try {
          const p = JSON.parse(e.data || '{}')
          toast({ title: p.title || 'Reminder', description: p.message || '' })
          // Try browser notification too
          if (typeof window !== 'undefined' && 'Notification' in window) {
            if (Notification.permission === 'granted') {
              new Notification(p.title || 'Reminder', { body: p.message || '', icon: '/snaphomz-logo.svg' })
            }
          }
        } catch {}
        setTimeout(loadCount, 250)
      })
    } catch {}
    return () => { try { es && es.close() } catch {} }
  }, [])

  // When sheet closes, refresh counters (in case actions happened)
  const onOpenChange = (v) => { setOpen(v); if (!v) setTimeout(loadCount, 500) }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetTrigger asChild>
        <button className="relative inline-flex h-9 w-9 items-center justify-center rounded-md border bg-background hover:bg-muted">
          <Bell className="h-4 w-4" />
          {counts.unread > 0 && (
            <span className="absolute -top-1 -right-1 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-destructive px-1 text-[11px] font-medium text-destructive-foreground">
              {counts.unread}
            </span>
          )}
          <span className="sr-only">Notifications</span>
        </button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-lg">
        <SheetHeader>
          <SheetTitle className="flex items-center justify-between">
            <span>Notifications</span>
            <Button variant="ghost" size="icon" onClick={() => setOpen(false)}>
              <Check className="h-4 w-4" />
            </Button>
          </SheetTitle>
        </SheetHeader>
        <div className="mt-3">
          <NotificationCenter onAnyAction={loadCount} />
        </div>
      </SheetContent>
    </Sheet>
  )
}

export default function NotificationCenter({ onAnyAction }) {
  const [loading, setLoading] = useState(false)
  const [tab, setTab] = useState('nudges')
  const [nudges, setNudges] = useState([])
  const [reminders, setReminders] = useState([])
  const [alerts, setAlerts] = useState([])
  const { toast } = useToast()

  const loadAll = async () => {
    setLoading(true)
    try {
      const [notifs, alertsRes] = await Promise.all([
        fetchJSON(apiUrl('/api/notifications?limit=100')),
        fetchJSON(apiUrl('/api/alerts/smart'))
      ])
      const items = Array.isArray(notifs?.items) ? notifs.items : []
      setNudges(items.filter(x => x.type === 'nudge'))
      setReminders(items.filter(x => x.type === 'reminder'))
      setAlerts(Array.isArray(alertsRes?.alerts) ? alertsRes.alerts : [])
    } catch (e) {
      console.warn('Load notifications error', e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadAll() }, [])
  useEffect(() => {
    let es
    try {
      es = new EventSource(apiUrl('/api/assistant/stream'))
      const onBump = () => { loadAll(); onAnyAction && onAnyAction() }
      es.addEventListener('notifications:changed', onBump)
      es.addEventListener('alerts:changed', onBump)
      es.addEventListener('nudge', onBump)
      es.addEventListener('notifications:remind', (e) => {
        try {
          const p = JSON.parse(e.data || '{}')
          // In-app toast
          toast({ title: p.title || 'Reminder', description: p.message || '' })
          // Browser notification (if permitted)
          if (typeof window !== 'undefined' && 'Notification' in window) {
            if (Notification.permission === 'granted') {
              new Notification(p.title || 'Reminder', { body: p.message || '', icon: '/snaphomz-logo.svg' })
            } else if (Notification.permission === 'default') {
              Notification.requestPermission().then((perm) => {
                if (perm === 'granted') new Notification(p.title || 'Reminder', { body: p.message || '', icon: '/snaphomz-logo.svg' })
              })
            }
          }
        } catch {}
        loadAll(); onAnyAction && onAnyAction()
      })
    } catch {}
    return () => { try { es && es.close() } catch {} }
  }, [])

  const markRead = async (id) => {
    try { await fetchJSON(apiUrl(`/api/notifications/${id}/read`), { method: 'POST' }); await loadAll(); onAnyAction && onAnyAction() } catch {}
  }
  const snooze = async (id, minutes) => {
    try { await fetchJSON(apiUrl(`/api/notifications/${id}/snooze`), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ minutes }) }); await loadAll(); onAnyAction && onAnyAction() } catch {}
  }
  const clearRead = async () => {
    try { await fetchJSON(apiUrl('/api/notifications/clear-read'), { method: 'POST' }); await loadAll(); onAnyAction && onAnyAction() } catch {}
  }
  const dismissAlert = async (id) => {
    try { await fetchJSON(apiUrl(`/api/alerts/dismiss/${id}`), { method: 'POST' }); await loadAll(); onAnyAction && onAnyAction() } catch {}
  }

  const renderList = (items, kind) => (
    <div className="mt-3 space-y-2 max-h-[70vh] overflow-y-auto pr-1">
      {items.length === 0 && (
        <div className="text-sm text-muted-foreground py-6 text-center">No {kind} yet</div>
      )}
      {items.map((it) => (
        <div key={it.id} className="rounded-md border p-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium truncate">{it.title || kind === 'alerts' ? (it.alert_type || it.type) : (it.type || 'Notification')}</span>
              {it.status === 'unread' && <Badge>New</Badge>}
              {it.status === 'snoozed' && (
                <Badge variant="secondary">
                  Snoozed until {it.snooze_until ? new Date(it.snooze_until).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : 'later'}
                </Badge>
              )}
              {it.status === 'read' && <Badge variant="outline">Read</Badge>}
            </div>
            <div className="text-sm text-muted-foreground mt-1 break-words">
              {it.message || it.description || it.summary || it.title}
            </div>
            <div className="text-[11px] text-muted-foreground mt-1">
              {new Date(it.created_at || it.updated_at || Date.now()).toLocaleString()}
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {kind !== 'alerts' ? (
              <>
                <Button variant="ghost" size="icon" title="Mark read" onClick={() => markRead(it.id)}>
                  <Check className="h-4 w-4" />
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" title="Snooze">
                      <Clock className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => snooze(it.id, 5)}>Snooze 5m</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => snooze(it.id, 15)}>Snooze 15m</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => snooze(it.id, 30)}>Snooze 30m</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            ) : (
              <Button variant="ghost" size="icon" title="Dismiss" onClick={() => dismissAlert(it.id)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      ))}
    </div>
  )

  return (
    <div>
      <div className="flex items-center justify-between">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="nudges">Nudges</TabsTrigger>
            <TabsTrigger value="reminders">Reminders</TabsTrigger>
            <TabsTrigger value="alerts">Alerts</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={loadAll} disabled={loading} title="Refresh">
            <RefreshCcw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          <Button variant="ghost" size="sm" onClick={clearRead}>Clear Read</Button>
        </div>
      </div>
      <div>
        {tab === 'nudges' && renderList(nudges, 'nudges')}
        {tab === 'reminders' && renderList(reminders, 'reminders')}
        {tab === 'alerts' && renderList(alerts, 'alerts')}
      </div>
    </div>
  )
}
