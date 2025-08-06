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

const STAGE_CONFIG = {
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
}

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
  const [activeStage, setActiveStage] = useState('pre_listing')
  const [expandedStages, setExpandedStages] = useState({'pre_listing': true})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [editingItem, setEditingItem] = useState(null)
  const [isAddingTask, setIsAddingTask] = useState(false)
  const [addTaskStage, setAddTaskStage] = useState('')
  const [transitionDialog, setTransitionDialog] = useState({ open: false, targetStage: null })

  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    priority: 'medium',
    assignee: '',
    due_date: '',
    notes: ''
  })

  useEffect(() => {
    if (transactionId) {
      fetchTransaction()
      fetchChecklist()
    }
  }, [transactionId])

  const fetchTransaction = async () => {
    try {
      const response = await fetch(`/api/transactions/${transactionId}`)
      const data = await response.json()
      if (data.success) {
        setTransaction(data.transaction)
        setActiveStage(data.transaction.current_stage)
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
          notes: ''
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
        setTransaction(data.transaction)
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
    const completedItems = stageItems.filter(item => item.status === 'completed')
    return Math.round((completedItems.length / stageItems.length) * 100)
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
    const stages = Object.keys(STAGE_CONFIG)
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

  const TaskItem = ({ item }) => {
    const StatusIcon = STATUS_CONFIG[item.status]?.icon || Circle
    
    return (
      <Card className="mb-3 hover:shadow-sm transition-shadow">
        <CardContent className="p-4">
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
              
              <div className="flex-1">
                <h4 className={`font-medium ${item.status === 'completed' ? 'line-through text-muted-foreground' : ''}`}>
                  {item.title}
                </h4>
                {item.description && (
                  <p className="text-sm text-muted-foreground mt-1">{item.description}</p>
                )}
                
                <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                  <Badge variant="outline" className={PRIORITY_CONFIG[item.priority]?.color}>
                    {PRIORITY_CONFIG[item.priority]?.label}
                  </Badge>
                  
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
              {STAGE_CONFIG[activeStage]?.name}
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
            {Object.entries(STAGE_CONFIG).map(([stageKey, stage], index) => {
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

                      {/* Checklist Items */}
                      <div className="space-y-2">
                        {stageItems.map(item => (
                          <TaskItem key={item.id} item={item} />
                        ))}
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
            <DialogTitle>Add Task to {STAGE_CONFIG[addTaskStage]?.name}</DialogTitle>
            <DialogDescription>Create a new checklist item for this transaction stage</DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="task-title">Title</Label>
              <Input
                id="task-title"
                value={newTask.title}
                onChange={(e) => setNewTask({...newTask, title: e.target.value})}
                placeholder="Task title"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="task-description">Description</Label>
              <Textarea
                id="task-description"
                value={newTask.description}
                onChange={(e) => setNewTask({...newTask, description: e.target.value})}
                placeholder="Task description"
                rows={3}
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="task-priority">Priority</Label>
                <Select value={newTask.priority} onValueChange={(value) => setNewTask({...newTask, priority: value})}>
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
                  onChange={(e) => setNewTask({...newTask, assignee: e.target.value})}
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
                onChange={(e) => setNewTask({...newTask, due_date: e.target.value})}
              />
            </div>
          </div>
          
          <div className="flex justify-end space-x-2 pt-4">
            <Button variant="outline" onClick={() => setIsAddingTask(false)}>Cancel</Button>
            <Button onClick={() => addChecklistItem(addTaskStage)} disabled={!newTask.title || loading}>
              {loading ? 'Creating...' : 'Create Task'}
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