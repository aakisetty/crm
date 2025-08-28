'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { 
  CheckCircle, 
  Circle, 
  Clock, 
  AlertTriangle,
  Calendar,
  User,
  FileText,
  ArrowRight,
  Plus,
  Edit,
  Trash2,
  AlertCircle,
  PlayCircle,
  PauseCircle,
  RotateCcw,
  Check,
  X,
  ChevronRight,
  ChevronDown
} from 'lucide-react'

// Stage configurations for seller (sale) and buyer (purchase) transactions
const STAGE_CONFIGS = {
  sale: {
    pre_listing: {
      name: 'Pre-Listing',
      description: 'Property preparation and market analysis',
      color: 'bg-blue-500',
      icon: FileText
    },
    listing: {
      name: 'Active Listing',
      description: 'Marketing and showing the property',
      color: 'bg-yellow-500',
      icon: PlayCircle
    },
    under_contract: {
      name: 'Under Contract',
      description: 'Inspections and closing preparations',
      color: 'bg-orange-500',
      icon: Clock
    },
    escrow_closing: {
      name: 'Escrow & Closing',
      description: 'Final steps and transaction completion',
      color: 'bg-green-500',
      icon: CheckCircle
    }
  },
  purchase: {
    pre_approval: {
      name: 'Pre-Approval',
      description: 'Get pre-approved and define budget',
      color: 'bg-blue-500',
      icon: FileText
    },
    home_search: {
      name: 'Home Search',
      description: 'Tour properties and shortlist favorites',
      color: 'bg-purple-500',
      icon: PlayCircle
    },
    offer: {
      name: 'Offer',
      description: 'Prepare and submit purchase offer',
      color: 'bg-yellow-500',
      icon: FileText
    },
    under_contract: {
      name: 'Under Contract',
      description: 'Inspections, appraisal, and financing',
      color: 'bg-orange-500',
      icon: Clock
    },
    escrow_closing: {
      name: 'Escrow & Closing',
      description: 'Final steps and transaction completion',
      color: 'bg-green-500',
      icon: CheckCircle
    }
  }
}

const firstStageForType = (type = 'sale') => Object.keys(STAGE_CONFIGS[type] || STAGE_CONFIGS.sale)[0]

const STATUS_CONFIG = {
  not_started: { label: 'Not Started', color: 'bg-gray-500', icon: Circle },
  in_progress: { label: 'In Progress', color: 'bg-blue-500', icon: PlayCircle },
  completed: { label: 'Completed', color: 'bg-green-500', icon: CheckCircle },
  blocked: { label: 'Blocked', color: 'bg-red-500', icon: AlertTriangle }
}

const PRIORITY_CONFIG = {
  low: { label: 'Low', color: 'text-gray-600' },
  medium: { label: 'Medium', color: 'text-blue-600' },
  high: { label: 'High', color: 'text-orange-600' },
  urgent: { label: 'Urgent', color: 'text-red-600' }
}

export function TransactionTimeline({ transactionId }) {
  const [transaction, setTransaction] = useState(null)
  const [checklistItems, setChecklistItems] = useState([])
  const [activeStage, setActiveStage] = useState(firstStageForType('sale'))
  const [expandedStages, setExpandedStages] = useState({ [firstStageForType('sale')]: true })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [editingItem, setEditingItem] = useState(null)
  const [isAddingTask, setIsAddingTask] = useState(false)
  const [addTaskStage, setAddTaskStage] = useState('')
  const [transitionDialog, setTransitionDialog] = useState({ open: false, targetStage: null })
  const [editForm, setEditForm] = useState(null)

  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    priority: 'medium',
    assignee: '',
    due_date: '',
    notes: '',
    weight: 1,
    parent_id: null
  })

  useEffect(() => {
    if (transactionId) {
      fetchTransaction()
      fetchChecklist()
    }
  }, [transactionId])

  useEffect(() => {
    if (editingItem) {
      setEditForm({ ...editingItem })
    } else {
      setEditForm(null)
    }
  }, [editingItem])

  const fetchTransaction = async () => {
    try {
      const response = await fetch(`/api/transactions/${transactionId}`)
      const data = await response.json()
      if (data.success) {
        setTransaction(data.transaction)
        const nextActive = data.transaction.current_stage
        setActiveStage(nextActive)
        setExpandedStages({ [nextActive]: true })
      }
    } catch (error) {
      console.error('Error fetching transaction:', error)
      setError('Failed to fetch transaction')
    }
  }

  const fetchChecklist = async () => {
    try {
      const response = await fetch(`/api/transactions/${transactionId}/checklist`)
      const data = await response.json()
      if (data.success) {
        setChecklistItems(data.checklist_items)
      }
    } catch (error) {
      console.error('Error fetching checklist:', error)
      setError('Failed to fetch checklist')
    }
  }

  const updateChecklistItem = async (itemId, updates) => {
    setLoading(true)
    try {
      const response = await fetch(`/api/checklist/${itemId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      })
      
      const data = await response.json()
      if (data.success) {
        setChecklistItems(items =>
          items.map(item =>
            item.id === itemId ? { ...item, ...updates } : item
          )
        )
      }
    } catch (error) {
      console.error('Error updating checklist item:', error)
    }
    setLoading(false)
  }

  const addChecklistItem = async (stage) => {
    if (!newTask.title) return

    setLoading(true)
    try {
      const response = await fetch(`/api/transactions/${transactionId}/checklist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...newTask, stage })
      })
      
      const data = await response.json()
      if (data.success) {
        setChecklistItems(items => [...items, data.checklist_item])
        setNewTask({
          title: '',
          description: '',
          priority: 'medium',
          assignee: '',
          due_date: '',
          notes: '',
          weight: 1,
          parent_id: null
        })
        setIsAddingTask(false)
      }
    } catch (error) {
      console.error('Error adding checklist item:', error)
    }
    setLoading(false)
  }

  const deleteChecklistItem = async (itemId) => {
    if (!confirm('Are you sure you want to delete this task?')) return

    setLoading(true)
    try {
      const response = await fetch(`/api/checklist/${itemId}`, {
        method: 'DELETE'
      })
      
      if (response.ok) {
        setChecklistItems(items => items.filter(item => item.id !== itemId))
      }
    } catch (error) {
      console.error('Error deleting checklist item:', error)
    }
    setLoading(false)
  }

  const transitionStage = async (targetStage, force = false) => {
    setLoading(true)
    try {
      const response = await fetch(`/api/transactions/${transactionId}/stage-transition`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target_stage: targetStage, force })
      })
      
      const data = await response.json()
      
      if (data.success) {
        // Backend does not return the full updated transaction; update locally
        setTransaction(prev => prev ? { ...prev, current_stage: targetStage } : prev)
        setActiveStage(targetStage)
        fetchChecklist() // Refresh to get new default tasks
        setTransitionDialog({ open: false, targetStage: null })
      } else {
        // Show validation errors
        setTransitionDialog({
          open: true,
          targetStage,
          validation: data,
          canForce: data.can_force
        })
      }
    } catch (error) {
      console.error('Error transitioning stage:', error)
    }
    setLoading(false)
  }

  const getStageProgress = (stage) => {
    const stageItems = checklistItems.filter(item => item.stage === stage)
    if (stageItems.length === 0) return 0

    // Build map of items by parent
    const byParent = new Map()
    stageItems.forEach(it => {
      const pid = it.parent_id || null
      if (!byParent.has(pid)) byParent.set(pid, [])
      byParent.get(pid).push(it)
    })

    const parents = byParent.get(null) || []
    let totalWeight = 0
    let completedWeight = 0

    parents.forEach(parent => {
      const children = byParent.get(parent.id) || []
      if (children.length > 0) {
        children.forEach(ch => {
          const w = Number(ch.weight) || 1
          totalWeight += w
          if (ch.status === 'completed') completedWeight += w
        })
      } else {
        const w = Number(parent.weight) || 1
        totalWeight += w
        if (parent.status === 'completed') completedWeight += w
      }
    })

    // Include orphaned children (if any) whose parent isn't present
    stageItems.forEach(it => {
      if (it.parent_id && !parents.find(p => p.id === it.parent_id)) {
        const w = Number(it.weight) || 1
        totalWeight += w
        if (it.status === 'completed') completedWeight += w
      }
    })

    if (totalWeight === 0) return 0
    return Math.round((completedWeight / totalWeight) * 100)
  }

  const getStageStats = (stage) => {
    const stageItems = checklistItems.filter(item => item.stage === stage)
    return {
      total: stageItems.length,
      completed: stageItems.filter(item => item.status === 'completed').length,
      inProgress: stageItems.filter(item => item.status === 'in_progress').length,
      blocked: stageItems.filter(item => item.status === 'blocked').length
    }
  }

  const isStageCompleted = (stage) => {
    const progress = getStageProgress(stage)
    return progress === 100
  }

  const canTransitionToStage = (stage) => {
    const stages = Object.keys(STAGE_CONFIGS[(transaction?.transaction_type || 'sale')])
    const currentIndex = stages.indexOf(activeStage)
    const targetIndex = stages.indexOf(stage)
    return targetIndex <= currentIndex + 1
  }

  const toggleStageExpanded = (stage) => {
    setExpandedStages(prev => ({
      ...prev,
      [stage]: !prev[stage]
    }))
  }

  const formatDate = (date) => {
    if (!date) return ''
    return new Date(date).toLocaleDateString()
  }

  const TaskItem = ({ item, indent = 0, isChild = false }) => {
    const StatusIcon = STATUS_CONFIG[item.status]?.icon || Circle
    
    return (
      <Card className={`mb-3 hover:shadow-sm transition-shadow ${isChild ? 'bg-muted/30' : ''}`}>
        <CardContent className={`p-4 ${isChild ? 'py-3' : ''}`}>
          <div className="flex items-start justify-between">
            <div className="flex items-start space-x-3 flex-1">
              <Button
                variant="ghost"
                size="sm"
                className="p-1 h-auto"
                onClick={() => updateChecklistItem(item.id, {
                  status: item.status === 'completed' ? 'not_started' : 'completed'
                })}
              >
                <StatusIcon className={`h-5 w-5 ${STATUS_CONFIG[item.status]?.color?.replace('bg-', 'text-')}`} />
              </Button>
              
              <div className="flex-1" style={{ paddingLeft: indent }}>
                <h4 className={`font-medium ${isChild ? 'text-sm' : ''} ${item.status === 'completed' ? 'line-through text-muted-foreground' : ''}`}>
                  {item.title}
                </h4>
                {item.description && (
                  <p className={`text-sm text-muted-foreground mt-1 ${isChild ? 'text-xs' : ''}`}>{item.description}</p>
                )}
                
                <div className={`flex items-center gap-4 mt-2 text-sm text-muted-foreground ${isChild ? 'text-xs' : ''}`}>
                  <Badge variant="outline" className={PRIORITY_CONFIG[item.priority]?.color}>
                    {PRIORITY_CONFIG[item.priority]?.label}
                  </Badge>
                  <Badge variant="outline">w: {Number(item.weight ?? 1)}</Badge>
                  
                  {item.assignee && (
                    <div className="flex items-center gap-1">
                      <User className="h-3 w-3" />
                      {item.assignee}
                    </div>
                  )}
                  
                  {item.due_date && (
                    <div className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      Due {formatDate(item.due_date)}
                    </div>
                  )}
                  
                  {item.notes && (
                    <div className="flex items-center gap-1">
                      <FileText className="h-3 w-3" />
                      Notes
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-1">
              {!item.parent_id && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setAddTaskStage(item.stage)
                    setNewTask(nt => ({ ...nt, parent_id: item.id }))
                    setIsAddingTask(true)
                  }}
                  title="Add subtask"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setEditingItem(item)}
              >
                <Edit className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => deleteChecklistItem(item.id)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!transaction) {
    return <div className="flex items-center justify-center py-12">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
        <p>Loading transaction...</p>
      </div>
    </div>
  }

  // Resolve stage config based on transaction type (defaults to seller flow until loaded)
  const stageConfig = STAGE_CONFIGS[(transaction?.transaction_type || 'sale')]

  return (
    <div className="space-y-6">
      {/* Transaction Header */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <CardTitle className="text-xl">{transaction.property_address}</CardTitle>
              <CardDescription>
                Client: {transaction.client_name} | 
                Type: {transaction.transaction_type} | 
                Agent: {transaction.assigned_agent}
              </CardDescription>
            </div>
            <Badge variant="outline" className="text-lg px-3 py-1">
              {stageConfig[activeStage]?.name}
            </Badge>
          </div>
        </CardHeader>
      </Card>

      {/* Stage Timeline */}
      <Card>
        <CardHeader>
          <CardTitle>Transaction Timeline</CardTitle>
          <CardDescription>Track progress through each stage of the transaction</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {Object.entries(stageConfig).map(([stageKey, stage], index) => {
              const isActive = stageKey === activeStage
              const isCompleted = isStageCompleted(stageKey)
              const progress = getStageProgress(stageKey)
              const stats = getStageStats(stageKey)
              const isExpanded = expandedStages[stageKey]
              const stageItems = checklistItems.filter(item => item.stage === stageKey)

              return (
                <div key={stageKey} className={`border rounded-lg p-4 ${isActive ? 'border-primary bg-primary/5' : ''}`}>
                  <div 
                    className="flex items-center justify-between cursor-pointer"
                    onClick={() => toggleStageExpanded(stageKey)}
                  >
                    <div className="flex items-center space-x-4">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                        isCompleted ? 'bg-green-500 text-white' : 
                        isActive ? 'bg-primary text-primary-foreground' : 
                        'bg-muted'
                      }`}>
                        {isCompleted ? (
                          <Check className="h-4 w-4" />
                        ) : (
                          <span className="text-sm font-medium">{index + 1}</span>
                        )}
                      </div>
                      
                      <div>
                        <h3 className="font-semibold">{stage.name}</h3>
                        <p className="text-sm text-muted-foreground">{stage.description}</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-4">
                      <div className="text-right">
                        <div className="text-sm font-medium">{progress}% Complete</div>
                        <div className="text-xs text-muted-foreground">
                          {stats.completed}/{stats.total} tasks
                        </div>
                      </div>
                      
                      {canTransitionToStage(stageKey) && !isActive && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            transitionStage(stageKey)
                          }}
                          disabled={loading}
                        >
                          <ArrowRight className="h-4 w-4 mr-1" />
                          Advance
                        </Button>
                      )}
                      
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </div>
                  </div>

                  <div className="mt-3">
                    <Progress value={progress} className="h-2" />
                  </div>

                  {/* Expanded Stage Content */}
                  {isExpanded && (
                    <div className="mt-6 space-y-4">
                      {/* Stage Stats */}
                      <div className="flex gap-4 text-sm">
                        {stats.inProgress > 0 && (
                          <Badge variant="outline" className="text-blue-600">
                            {stats.inProgress} In Progress
                          </Badge>
                        )}
                        {stats.blocked > 0 && (
                          <Badge variant="outline" className="text-red-600">
                            {stats.blocked} Blocked
                          </Badge>
                        )}
                      </div>

                      {/* Checklist Items (parents with nested subtasks) */}
                      <div className="space-y-2">
                        {stageItems
                          .filter(item => !item.parent_id)
                          .map(parent => {
                            const children = checklistItems.filter(c => c.parent_id === parent.id && c.stage === stageKey)
                            return (
                              <div key={parent.id}>
                                <TaskItem item={parent} />
                                {children.length > 0 && (
                                  <div className="mt-2 ml-6 pl-4 space-y-2 border-l border-muted-foreground/20">
                                    {children.map(child => (
                                      <TaskItem key={child.id} item={child} indent={0} isChild={true} />
                                    ))}
                                  </div>
                                )}
                              </div>
                            )
                          })}
                      </div>

                      {/* Add Task Button */}
                      <Button
                        variant="outline"
                        onClick={() => {
                          setAddTaskStage(stageKey)
                          setIsAddingTask(true)
                        }}
                        className="w-full"
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Add Task to {stage.name}
                      </Button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Add Task Dialog */}
      <Dialog open={isAddingTask} onOpenChange={setIsAddingTask}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Task to {stageConfig[addTaskStage]?.name}</DialogTitle>
            <DialogDescription>Create a new checklist item for this transaction stage</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="task-title">Title</Label>
              <Input
                id="task-title"
                value={newTask.title}
                onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                placeholder="Task title"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="task-description">Description</Label>
              <Textarea
                id="task-description"
                value={newTask.description}
                onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                placeholder="Task description"
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="task-priority">Priority</Label>
                <Select value={newTask.priority} onValueChange={(value) => setNewTask({ ...newTask, priority: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="task-assignee">Assignee</Label>
                <Input
                  id="task-assignee"
                  value={newTask.assignee}
                  onChange={(e) => setNewTask({ ...newTask, assignee: e.target.value })}
                  placeholder="Assigned to"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="task-due-date">Due Date</Label>
              <Input
                id="task-due-date"
                type="date"
                value={newTask.due_date}
                onChange={(e) => setNewTask({ ...newTask, due_date: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="task-weight">Weight</Label>
                <Input
                  id="task-weight"
                  type="number"
                  step="0.1"
                  min="0"
                  value={newTask.weight}
                  onChange={(e) => setNewTask({ ...newTask, weight: Number(e.target.value) })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="task-parent">Parent Task (optional)</Label>
                <Select
                  value={newTask.parent_id ?? '__none__'}
                  onValueChange={(value) => setNewTask({ ...newTask, parent_id: value === '__none__' ? null : value })}
                >
                  <SelectTrigger id="task-parent">
                    <SelectValue placeholder="None (Top-level)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">None (Top-level)</SelectItem>
                    {checklistItems
                      .filter(i => i.stage === addTaskStage && !i.parent_id)
                      .map(p => (
                        <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-4">
              <Button variant="outline" onClick={() => setIsAddingTask(false)}>Cancel</Button>
              <Button onClick={() => addChecklistItem(addTaskStage)} disabled={!newTask.title || loading}>
                {loading ? 'Creating...' : 'Create Task'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Task Dialog */}
      <Dialog open={!!editingItem} onOpenChange={(open) => !open && setEditingItem(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Task</DialogTitle>
            <DialogDescription>Update task details, weight, and parent</DialogDescription>
          </DialogHeader>

          {editForm && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="edit-title">Title</Label>
                <Input
                  id="edit-title"
                  value={editForm.title || ''}
                  onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-description">Description</Label>
                <Textarea
                  id="edit-description"
                  rows={3}
                  value={editForm.description || ''}
                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-priority">Priority</Label>
                  <Select value={editForm.priority || 'medium'} onValueChange={(value) => setEditForm({ ...editForm, priority: value })}>
                    <SelectTrigger id="edit-priority">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="urgent">Urgent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-status">Status</Label>
                  <Select value={editForm.status || 'not_started'} onValueChange={(value) => setEditForm({ ...editForm, status: value })}>
                    <SelectTrigger id="edit-status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="not_started">Not Started</SelectItem>
                      <SelectItem value="in_progress">In Progress</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="blocked">Blocked</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-assignee">Assignee</Label>
                  <Input
                    id="edit-assignee"
                    value={editForm.assignee || ''}
                    onChange={(e) => setEditForm({ ...editForm, assignee: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-due-date">Due Date</Label>
                  <Input
                    id="edit-due-date"
                    type="date"
                    value={editForm.due_date ? new Date(editForm.due_date).toISOString().slice(0,10) : ''}
                    onChange={(e) => setEditForm({ ...editForm, due_date: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-notes">Notes</Label>
                <Textarea
                  id="edit-notes"
                  rows={3}
                  value={editForm.notes || ''}
                  onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-weight">Weight</Label>
                  <Input
                    id="edit-weight"
                    type="number"
                    step="0.1"
                    min="0"
                    value={Number(editForm.weight ?? 1)}
                    onChange={(e) => setEditForm({ ...editForm, weight: Number(e.target.value) })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-parent">Parent Task</Label>
                  <Select
                    value={editForm.parent_id ?? '__none__'}
                    onValueChange={(value) => setEditForm({ ...editForm, parent_id: value === '__none__' ? null : value })}
                  >
                    <SelectTrigger id="edit-parent">
                      <SelectValue placeholder="None (Top-level)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">None (Top-level)</SelectItem>
                      {checklistItems
                        .filter(i => !i.parent_id && i.id !== editForm.id)
                        .map(p => (
                          <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-end space-x-2 pt-4">
            <Button variant="outline" onClick={() => setEditingItem(null)}>Cancel</Button>
            <Button
              onClick={async () => {
                if (!editForm || !editingItem) return
                const updates = {
                  title: editForm.title || '',
                  description: editForm.description || '',
                  priority: editForm.priority || 'medium',
                  assignee: editForm.assignee || '',
                  due_date: editForm.due_date || '',
                  notes: editForm.notes || '',
                  status: editForm.status || 'not_started',
                  weight: Number(editForm.weight) || 1,
                  parent_id: editForm.parent_id || null
                }
                await updateChecklistItem(editingItem.id, updates)
                await fetchChecklist()
                setEditingItem(null)
              }}
              disabled={loading}
            >
              {loading ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Stage Transition Dialog */}
      <Dialog open={transitionDialog.open} onOpenChange={(open) => !open && setTransitionDialog({ open: false, targetStage: null })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-orange-500" />
              Stage Transition Validation
            </DialogTitle>
          </DialogHeader>
          
          {transitionDialog.validation && (
            <div className="space-y-4">
              {transitionDialog.validation.errors?.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-medium text-red-600">Errors:</h4>
                  <ul className="text-sm space-y-1">
                    {transitionDialog.validation.errors.map((error, index) => (
                      <li key={index} className="flex items-start gap-2">
                        <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
                        {error}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              
              {transitionDialog.validation.missing_tasks?.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-medium text-orange-600">Incomplete Tasks:</h4>
                  <ul className="text-sm space-y-1">
                    {transitionDialog.validation.missing_tasks.map((task, index) => (
                      <li key={index} className="flex items-start gap-2">
                        <Clock className="h-4 w-4 text-orange-500 mt-0.5 flex-shrink-0" />
                        {task.title} ({task.priority} priority)
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              
              {transitionDialog.validation.recommendations?.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-medium text-blue-600">Recommendations:</h4>
                  <ul className="text-sm space-y-1">
                    {transitionDialog.validation.recommendations.map((rec, index) => (
                      <li key={index} className="flex items-start gap-2">
                        <CheckCircle className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
                        {rec}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
          
          <div className="flex justify-end space-x-2 pt-4">
            <Button variant="outline" onClick={() => setTransitionDialog({ open: false, targetStage: null })}>
              Cancel
            </Button>
            {transitionDialog.canForce && (
              <Button 
                variant="destructive"
                onClick={() => transitionStage(transitionDialog.targetStage, true)}
                disabled={loading}
              >
                Force Transition
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}