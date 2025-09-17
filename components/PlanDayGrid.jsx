"use client"

import React, { useMemo, useState } from "react"
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

// A simple day grid for working hours with positioned task blocks.
// Props:
// - items: [{ key, label, scheduled_start, scheduled_end, est_duration_min, type, id }]
// - planMeta: { started_at, ends_at, date }
// - workdayStartHour?: number (fallback from planMeta)
// - workdayEndHour?: number (fallback from planMeta)
// - onEditTime: (item, startISO, endISO) => void
export function PlanDayGrid({
  items = [],
  planMeta = null,
  workdayStartHour,
  workdayEndHour,
  onEditTime,
  onAddTask,
}) {
  const dayRef = useMemo(() => {
    const base = planMeta?.started_at ? new Date(planMeta.started_at) : new Date()
    const d = new Date(base)
    d.setHours(0, 0, 0, 0)
    return d
  }, [planMeta])

  const wdStartHour = useMemo(() => {
    if (typeof workdayStartHour === 'number') return workdayStartHour
    if (planMeta?.started_at) return new Date(planMeta.started_at).getHours()
    return 9
  }, [workdayStartHour, planMeta])

  const wdEndHour = useMemo(() => {
    if (typeof workdayEndHour === 'number') return workdayEndHour
    if (planMeta?.ends_at) return new Date(planMeta.ends_at).getHours()
    return 17
  }, [workdayEndHour, planMeta])

  const hours = Math.max(1, wdEndHour - wdStartHour)
  const hourHeight = 64 // px per hour (more breathing room)
  const pxPerMin = hourHeight / 60
  const labelWidth = 80

  // Removed inline Add Task UI; scheduling/editing for existing items remains

  const timeLabel = (h) => {
    try {
      const d = new Date(dayRef)
      d.setHours(h, 0, 0, 0)
      return d.toLocaleTimeString([], { hour: 'numeric' })
    } catch {
      return `${h}:00`
    }
  }

  const toMinutesFromStart = (dt) => {
    const d = new Date(dt)
    const startOfGrid = new Date(dayRef)
    startOfGrid.setHours(wdStartHour, 0, 0, 0)
    return (d - startOfGrid) / 60000
  }

  const clampToGrid = (date) => {
    const d = new Date(date)
    const min = new Date(dayRef)
    min.setHours(wdStartHour, 0, 0, 0)
    const max = new Date(dayRef)
    max.setHours(wdEndHour, 0, 0, 0)
    if (d < min) return min
    if (d > max) return max
    return d
  }

  const toISOAtDate = (base, hm) => {
    const [hh, mm] = String(hm || '').split(':').map((s) => parseInt(s, 10))
    const d = new Date(base)
    if (Number.isFinite(hh)) d.setHours(hh)
    if (Number.isFinite(mm)) d.setMinutes(mm)
    d.setSeconds(0, 0)
    return d.toISOString()
  }

  const fmtHM = (date) => {
    const d = new Date(date)
    const hh = String(d.getHours()).padStart(2, '0')
    const mm = String(d.getMinutes()).padStart(2, '0')
    return `${hh}:${mm}`
  }

  const scheduled = items.filter((i) => i.scheduled_start && i.scheduled_end)
  const unscheduled = items.filter((i) => !i.scheduled_start)

  return (
    <div className="space-y-3">

      <div className="relative border rounded-md" style={{ paddingBottom: hourHeight }}>
        {/* Time labels column */}
        <div className="absolute left-0 top-0 bottom-0 bg-muted/40 border-r" style={{ width: labelWidth }}>
          {Array.from({ length: hours + 1 }, (_, idx) => (
            <div key={idx} className="text-xs text-muted-foreground pr-2 flex items-center justify-end" style={{ height: hourHeight }}>
              <div>{timeLabel(wdStartHour + idx)}</div>
            </div>
          ))}
        </div>
        {/* Grid body */}
        <div className="relative" style={{ marginLeft: labelWidth, height: hours * hourHeight }}>
          {Array.from({ length: hours }, (_, idx) => (
            <div key={idx} className="absolute left-0 right-0 border-b border-dashed" style={{ top: idx * hourHeight, height: hourHeight }} />
          ))}
          {/* Scheduled task blocks */}
          {scheduled.map((it) => {
            const startMin = toMinutesFromStart(clampToGrid(it.scheduled_start))
            const endMin = toMinutesFromStart(clampToGrid(it.scheduled_end))
            const top = Math.max(0, startMin * pxPerMin)
            const height = Math.max(32, (endMin - startMin) * pxPerMin)
            return (
              <Popover key={it.key}>
                <PopoverTrigger asChild>
                  <div className="absolute left-2 right-2 rounded-md bg-primary/10 hover:bg-primary/20 border border-primary/30 cursor-pointer" style={{ top, height, padding: 8 }}>
                    <div className="text-xs font-medium truncate">{it.label}</div>
                    {(it.client_name || it.property_address) && (
                      <div className="text-[10px] text-muted-foreground truncate">{it.client_name || it.property_address}</div>
                    )}
                    <div className="text-[10px] text-muted-foreground">{fmtHM(it.scheduled_start)} – {fmtHM(it.scheduled_end)}</div>
                  </div>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-80">
                  <div className="space-y-2">
                    <div className="text-sm font-medium">Edit time</div>
                    {(it.client_name || it.property_address) && (
                      <div className="text-xs text-muted-foreground">{it.client_name || it.property_address}</div>
                    )}
                    <div className="grid grid-cols-2 gap-2 items-center">
                      <label className="text-xs text-muted-foreground">Start</label>
                      <Input type="time" defaultValue={fmtHM(it.scheduled_start)} onChange={(e) => {
                        const startISO = toISOAtDate(it.scheduled_start, e.target.value)
                        const endISO = it.scheduled_end
                        onEditTime && onEditTime(it, startISO, endISO)
                      }} />
                      <label className="text-xs text-muted-foreground">End</label>
                      <Input type="time" defaultValue={fmtHM(it.scheduled_end)} onChange={(e) => {
                        const endISO = toISOAtDate(it.scheduled_end, e.target.value)
                        const startISO = it.scheduled_start
                        onEditTime && onEditTime(it, startISO, endISO)
                      }} />
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => {
                        const start = new Date(it.scheduled_start)
                        const end = new Date(it.scheduled_end)
                        start.setMinutes(start.getMinutes() - 15)
                        end.setMinutes(end.getMinutes() - 15)
                        onEditTime && onEditTime(it, start.toISOString(), end.toISOString())
                      }}>-15m</Button>
                      <Button size="sm" variant="outline" onClick={() => {
                        const start = new Date(it.scheduled_start)
                        const end = new Date(it.scheduled_end)
                        start.setMinutes(start.getMinutes() + 15)
                        end.setMinutes(end.getMinutes() + 15)
                        onEditTime && onEditTime(it, start.toISOString(), end.toISOString())
                      }}>+15m</Button>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            )
          })}
        </div>
      </div>

      {unscheduled.length > 0 && (
        <div className="border rounded-md p-2">
          <div className="text-xs font-medium mb-1">Unscheduled</div>
          <div className="space-y-1">
            {unscheduled.map((it) => (
              <div key={it.key} className="flex items-center justify-between text-xs text-muted-foreground">
                <div className="truncate pr-2">
                  <div className="truncate">{it.label}{it.est_duration_min ? ` • ~${it.est_duration_min} min` : ''}</div>
                  {(it.client_name || it.property_address) && (
                    <div className="text-[10px] text-muted-foreground truncate">{it.client_name || it.property_address}</div>
                  )}
                </div>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button size="sm" variant="outline">Schedule</Button>
                  </PopoverTrigger>
                  <PopoverContent align="end" className="w-64">
                    <div className="grid grid-cols-2 gap-2 items-center">
                      <label className="text-xs text-muted-foreground">Start</label>
                      <Input type="time" defaultValue={(() => { const d = new Date(dayRef); d.setHours(wdStartHour, 0, 0, 0); return fmtHM(d) })()} onChange={(e) => {
                        const dur = Math.max(5, Number(it.est_duration_min) || 30)
                        const startISO = toISOAtDate(dayRef, e.target.value)
                        const end = new Date(startISO)
                        end.setMinutes(end.getMinutes() + dur)
                        onEditTime && onEditTime(it, startISO, end.toISOString())
                      }} />
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
