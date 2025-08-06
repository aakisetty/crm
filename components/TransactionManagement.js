'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { 
  Plus, 
  Home, 
  User, 
  Calendar, 
  DollarSign, 
  ArrowRight,
  FileText,
  Clock,
  CheckCircle,
  PlayCircle,
  Search
} from 'lucide-react'
import { TransactionTimeline } from '@/components/TransactionTimeline'

const STAGE_CONFIG = {
  pre_listing: { name: 'Pre-Listing', color: 'bg-blue-500', icon: FileText },
  listing: { name: 'Active Listing', color: 'bg-yellow-500', icon: PlayCircle },
  under_contract: { name: 'Under Contract', color: 'bg-orange-500', icon: Clock },
  escrow_closing: { name: 'Escrow & Closing', color: 'bg-green-500', icon: CheckCircle }
}

export function TransactionManagement() {
  const [transactions, setTransactions] = useState([])
  const [filteredTransactions, setFilteredTransactions] = useState([])
  const [selectedTransaction, setSelectedTransaction] = useState(null)
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [stageFilter, setStageFilter] = useState('all')

  const [newTransaction, setNewTransaction] = useState({
    property_address: '',
    client_name: '',
    client_email: '',
    client_phone: '',
    transaction_type: 'sale',
    assigned_agent: '',
    listing_price: '',
    closing_date: ''
  })

  useEffect(() => {
    fetchTransactions()
  }, [])

  useEffect(() => {
    filterTransactions()
  }, [transactions, searchTerm, stageFilter])

  const fetchTransactions = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/transactions')
      const data = await response.json()
      if (data.success) {
        setTransactions(data.transactions)
      }
    } catch (error) {
      console.error('Error fetching transactions:', error)
    }
    setLoading(false)
  }

  const filterTransactions = () => {
    let filtered = transactions

    if (searchTerm) {
      filtered = filtered.filter(transaction =>
        transaction.property_address.toLowerCase().includes(searchTerm.toLowerCase()) ||
        transaction.client_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        transaction.assigned_agent?.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    if (stageFilter !== 'all') {
      filtered = filtered.filter(transaction => transaction.current_stage === stageFilter)
    }

    setFilteredTransactions(filtered)
  }

  const createTransaction = async () => {
    if (!newTransaction.property_address || !newTransaction.client_name) {
      alert('Property address and client name are required')
      return
    }

    setLoading(true)
    try {
      const response = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newTransaction)
      })

      const data = await response.json()
      if (data.success) {
        setTransactions([data.transaction, ...transactions])
        setNewTransaction({
          property_address: '',
          client_name: '',
          client_email: '',
          client_phone: '',
          transaction_type: 'sale',
          assigned_agent: '',
          listing_price: '',
          closing_date: ''
        })
        setIsAddDialogOpen(false)
      } else {
        alert(data.error || 'Failed to create transaction')
      }
    } catch (error) {
      console.error('Error creating transaction:', error)
      alert('Failed to create transaction')
    }
    setLoading(false)
  }

  const formatCurrency = (amount) => {
    if (!amount) return ''
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
    }).format(amount)
  }

  const formatDate = (date) => {
    if (!date) return ''
    return new Date(date).toLocaleDateString()
  }

  if (selectedTransaction) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Button 
            variant="outline" 
            onClick={() => setSelectedTransaction(null)}
          >
            ← Back to Transactions
          </Button>
          <h2 className="text-2xl font-bold">Transaction Timeline</h2>
        </div>
        <TransactionTimeline transactionId={selectedTransaction.id} />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold">Transaction Management</h2>
          <p className="text-muted-foreground">Manage your real estate transactions with timeline checklists</p>
        </div>
        <Button onClick={() => setIsAddDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          New Transaction
        </Button>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by property address, client, or agent..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
        <Select value={stageFilter} onValueChange={setStageFilter}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="Filter by stage" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Stages</SelectItem>
            {Object.entries(STAGE_CONFIG).map(([key, stage]) => (
              <SelectItem key={key} value={key}>{stage.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Transactions Grid */}
      {loading && transactions.length === 0 ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p>Loading transactions...</p>
          </div>
        </div>
      ) : filteredTransactions.length > 0 ? (
        <div className="grid gap-6">
          {filteredTransactions.map((transaction) => {
            const stageConfig = STAGE_CONFIG[transaction.current_stage] || {}
            const StageIcon = stageConfig.icon || FileText
            
            return (
              <Card key={transaction.id} className="hover:shadow-md transition-shadow cursor-pointer"
                    onClick={() => setSelectedTransaction(transaction)}>
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="space-y-3 flex-1">
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="text-lg font-semibold">{transaction.property_address}</h3>
                          <p className="text-muted-foreground">Client: {transaction.client_name}</p>
                        </div>
                        <Badge className={`${stageConfig.color} text-white`}>
                          <StageIcon className="mr-1 h-3 w-3" />
                          {stageConfig.name}
                        </Badge>
                      </div>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <span>Agent: {transaction.assigned_agent || 'Unassigned'}</span>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <Home className="h-4 w-4 text-muted-foreground" />
                          <span>Type: {transaction.transaction_type}</span>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <span>Created: {formatDate(transaction.created_at)}</span>
                        </div>
                      </div>
                      
                      {(transaction.listing_price || transaction.contract_price) && (
                        <div className="flex items-center gap-4 text-sm">
                          {transaction.listing_price && (
                            <div className="flex items-center gap-1">
                              <DollarSign className="h-4 w-4 text-muted-foreground" />
                              <span>Listed: {formatCurrency(transaction.listing_price)}</span>
                            </div>
                          )}
                          {transaction.contract_price && (
                            <div className="flex items-center gap-1">
                              <DollarSign className="h-4 w-4 text-muted-foreground" />
                              <span>Contract: {formatCurrency(transaction.contract_price)}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    
                    <Button variant="ghost" size="sm">
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      ) : (
        <Card>
          <CardContent className="p-12 text-center">
            <FileText className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No transactions found</h3>
            <p className="text-muted-foreground mb-4">
              {searchTerm || stageFilter !== 'all' 
                ? 'Try adjusting your search or filters'
                : 'Create your first transaction to get started with timeline management'
              }
            </p>
            <Button onClick={() => setIsAddDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              New Transaction
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Add Transaction Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create New Transaction</DialogTitle>
            <DialogDescription>
              Set up a new real estate transaction with timeline tracking
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4">
              <div className="space-y-2">
                <Label htmlFor="property-address">Property Address *</Label>
                <Input
                  id="property-address"
                  value={newTransaction.property_address}
                  onChange={(e) => setNewTransaction({...newTransaction, property_address: e.target.value})}
                  placeholder="123 Main Street, City, State, ZIP"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="client-name">Client Name *</Label>
                  <Input
                    id="client-name"
                    value={newTransaction.client_name}
                    onChange={(e) => setNewTransaction({...newTransaction, client_name: e.target.value})}
                    placeholder="John Smith"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="transaction-type">Transaction Type</Label>
                  <Select 
                    value={newTransaction.transaction_type} 
                    onValueChange={(value) => setNewTransaction({...newTransaction, transaction_type: value})}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sale">Sale</SelectItem>
                      <SelectItem value="purchase">Purchase</SelectItem>
                      <SelectItem value="lease">Lease</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="client-email">Client Email</Label>
                  <Input
                    id="client-email"
                    type="email"
                    value={newTransaction.client_email}
                    onChange={(e) => setNewTransaction({...newTransaction, client_email: e.target.value})}
                    placeholder="client@email.com"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="client-phone">Client Phone</Label>
                  <Input
                    id="client-phone"
                    value={newTransaction.client_phone}
                    onChange={(e) => setNewTransaction({...newTransaction, client_phone: e.target.value})}
                    placeholder="(555) 123-4567"
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="assigned-agent">Assigned Agent</Label>
                  <Input
                    id="assigned-agent"
                    value={newTransaction.assigned_agent}
                    onChange={(e) => setNewTransaction({...newTransaction, assigned_agent: e.target.value})}
                    placeholder="Agent Name"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="listing-price">Listing Price</Label>
                  <Input
                    id="listing-price"
                    type="number"
                    value={newTransaction.listing_price}
                    onChange={(e) => setNewTransaction({...newTransaction, listing_price: e.target.value})}
                    placeholder="500000"
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="closing-date">Expected Closing Date</Label>
                <Input
                  id="closing-date"
                  type="date"
                  value={newTransaction.closing_date}
                  onChange={(e) => setNewTransaction({...newTransaction, closing_date: e.target.value})}
                />
              </div>
            </div>
          </div>
          
          <div className="flex justify-end space-x-2 pt-4">
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={createTransaction} 
              disabled={!newTransaction.property_address || !newTransaction.client_name || loading}
            >
              {loading ? 'Creating...' : 'Create Transaction'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}