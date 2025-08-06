'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Avatar, AvatarFallback, AvatarInitials } from '@/components/ui/avatar'
import { Search, Plus, Users, TrendingUp, Home, Phone, Mail, MapPin, DollarSign, Building, Sparkles, Bot, MessageSquare, FileText } from 'lucide-react'
import { Textarea } from '@/components/ui/textarea'
import { AssistantChat } from '@/components/AssistantChat'
import { PropertySearch } from '@/components/PropertySearch'
import { TransactionManagement } from '@/components/TransactionManagement'
import { DealCommand, SmartAlerts } from '@/components/DealSummary'

export default function RealEstateCRM() {
  const [activeTab, setActiveTab] = useState('dashboard')
  const [leads, setLeads] = useState([])
  const [filteredLeads, setFilteredLeads] = useState([])
  const [searchTerm, setSearchTerm] = useState('')
  const [filterType, setFilterType] = useState('all')
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [selectedLead, setSelectedLead] = useState(null)
  const [dashboardStats, setDashboardStats] = useState({})
  const [loading, setLoading] = useState(false)
  const [propertyMatches, setPropertyMatches] = useState(null)
  const [newLead, setNewLead] = useState({
    name: '',
    email: '',
    phone: '',
    lead_type: 'buyer',
    preferences: {
      zipcode: '',
      min_price: '',
      max_price: '',
      bedrooms: '',
      bathrooms: ''
    },
    assigned_agent: '',
    tags: []
  })

  useEffect(() => {
    if (activeTab === 'dashboard') {
      fetchLeads()
      fetchDashboardStats()
    }
  }, [activeTab])

  useEffect(() => {
    if (activeTab === 'dashboard') {
      filterLeads()
    }
  }, [leads, searchTerm, filterType, activeTab])

  const fetchLeads = async () => {
    try {
      const response = await fetch('/api/leads')
      const data = await response.json()
      setLeads(data)
    } catch (error) {
      console.error('Error fetching leads:', error)
    }
  }

  const fetchDashboardStats = async () => {
    try {
      const response = await fetch('/api/analytics/dashboard')
      const data = await response.json()
      setDashboardStats(data)
    } catch (error) {
      console.error('Error fetching dashboard stats:', error)
    }
  }

  const filterLeads = () => {
    let filtered = leads

    if (searchTerm) {
      filtered = filtered.filter(lead =>
        lead.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        lead.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        lead.phone.includes(searchTerm)
      )
    }

    if (filterType !== 'all') {
      filtered = filtered.filter(lead => lead.lead_type === filterType)
    }

    setFilteredLeads(filtered)
  }

  const handleAddLead = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newLead)
      })
      
      if (response.ok) {
        const createdLead = await response.json()
        setLeads([createdLead, ...leads])
        setNewLead({
          name: '',
          email: '',
          phone: '',
          lead_type: 'buyer',
          preferences: {
            zipcode: '',
            min_price: '',
            max_price: '',
            bedrooms: '',
            bathrooms: ''
          },
          assigned_agent: '',
          tags: []
        })
        setIsAddDialogOpen(false)
        fetchDashboardStats() // Refresh stats
      } else {
        const error = await response.json()
        alert(error.error)
      }
    } catch (error) {
      console.error('Error adding lead:', error)
      alert('Error adding lead')
    }
    setLoading(false)
  }

  const handleUpdateLead = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/leads/${selectedLead.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(selectedLead)
      })
      
      if (response.ok) {
        const updatedLead = await response.json()
        setLeads(leads.map(lead => lead.id === updatedLead.id ? updatedLead : lead))
        setIsEditDialogOpen(false)
        setSelectedLead(null)
        fetchDashboardStats() // Refresh stats
      }
    } catch (error) {
      console.error('Error updating lead:', error)
    }
    setLoading(false)
  }

  const handleFindMatches = async (leadId) => {
    setLoading(true)
    try {
      const response = await fetch(`/api/leads/${leadId}/match`, {
        method: 'POST'
      })
      const data = await response.json()
      setPropertyMatches(data)
    } catch (error) {
      console.error('Error finding property matches:', error)
    }
    setLoading(false)
  }

  const getInitials = (name) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase()
  }

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
    }).format(amount)
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-8 px-4">
        <div className="flex flex-col space-y-8">
          {/* Header */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h1 className="text-4xl font-bold text-foreground">Real Estate CRM</h1>
              <p className="text-muted-foreground">AI-powered lead management and property matching</p>
            </div>
            <div className="flex gap-2">
              <Button 
                onClick={() => setActiveTab('assistant')} 
                variant={activeTab === 'assistant' ? 'default' : 'outline'}
                className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white border-0"
              >
                <Bot className="mr-2 h-4 w-4" />
                AI Assistant
              </Button>
              <Button onClick={() => setIsAddDialogOpen(true)} className="bg-primary hover:bg-primary/90">
                <Plus className="mr-2 h-4 w-4" />
                Add Lead
              </Button>
            </div>
          </div>

          {/* Main Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="dashboard" className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                Leads
              </TabsTrigger>
              <TabsTrigger value="properties" className="flex items-center gap-2">
                <Home className="h-4 w-4" />
                Properties
              </TabsTrigger>
              <TabsTrigger value="transactions" className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Transactions
              </TabsTrigger>
              <TabsTrigger value="commands" className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                Commands
              </TabsTrigger>
              <TabsTrigger value="assistant" className="flex items-center gap-2">
                <Bot className="h-4 w-4" />
                Assistant
              </TabsTrigger>
            </TabsList>

            {/* Dashboard Tab */}
            <TabsContent value="dashboard" className="space-y-6">
              {/* Dashboard Stats */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Leads</CardTitle>
                    <Users className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{dashboardStats.total_leads || 0}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Active Leads</CardTitle>
                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{dashboardStats.active_leads || 0}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Buyers</CardTitle>
                    <Home className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{dashboardStats.buyer_leads || 0}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Sellers</CardTitle>
                    <Building className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{dashboardStats.seller_leads || 0}</div>
                  </CardContent>
                </Card>
              </div>

              {/* Search and Filters */}
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search leads by name, email, or phone..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
                <Select value={filterType} onValueChange={setFilterType}>
                  <SelectTrigger className="w-full sm:w-48">
                    <SelectValue placeholder="Filter by type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Leads</SelectItem>
                    <SelectItem value="buyer">Buyers</SelectItem>
                    <SelectItem value="seller">Sellers</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Leads List */}
              <div className="grid gap-6">
                {filteredLeads.map((lead) => (
                  <Card key={lead.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-6">
                      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                        <div className="flex items-center space-x-4">
                          <Avatar className="h-12 w-12">
                            <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                              {getInitials(lead.name)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="space-y-1">
                            <h3 className="text-lg font-semibold">{lead.name}</h3>
                            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                              <Badge variant={lead.lead_type === 'buyer' ? 'default' : 'secondary'}>
                                {lead.lead_type}
                              </Badge>
                              {lead.source === 'assistant' && (
                                <Badge variant="outline" className="text-purple-600 border-purple-600">
                                  <Bot className="mr-1 h-3 w-3" />
                                  AI Created
                                </Badge>
                              )}
                              <span className="text-sm text-muted-foreground">
                                Added {new Date(lead.created_at).toLocaleDateString()}
                              </span>
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex flex-col sm:flex-row gap-3">
                          <div className="flex flex-col space-y-1 text-sm">
                            <div className="flex items-center text-muted-foreground">
                              <Mail className="mr-2 h-4 w-4" />
                              {lead.email}
                            </div>
                            <div className="flex items-center text-muted-foreground">
                              <Phone className="mr-2 h-4 w-4" />
                              {lead.phone}
                            </div>
                            {lead.preferences?.zipcode && (
                              <div className="flex items-center text-muted-foreground">
                                <MapPin className="mr-2 h-4 w-4" />
                                {lead.preferences.zipcode}
                              </div>
                            )}
                          </div>
                          
                          <div className="flex flex-col sm:flex-row gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSelectedLead(lead)
                                setIsEditDialogOpen(true)
                              }}
                            >
                              Edit
                            </Button>
                            <Button
                              variant="default"
                              size="sm"
                              onClick={() => handleFindMatches(lead.id)}
                              disabled={loading}
                            >
                              <Sparkles className="mr-2 h-4 w-4" />
                              AI Match
                            </Button>
                          </div>
                        </div>
                      </div>
                      
                      {lead.ai_insights && (
                        <div className="mt-4 p-3 bg-muted rounded-lg">
                          <p className="text-sm font-medium text-muted-foreground mb-1">AI Insights:</p>
                          <p className="text-sm">{lead.ai_insights}</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>

              {filteredLeads.length === 0 && (
                <Card>
                  <CardContent className="p-12 text-center">
                    <Users className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-semibold mb-2">No leads found</h3>
                    <p className="text-muted-foreground mb-4">
                      {searchTerm || filterType !== 'all' 
                        ? 'Try adjusting your search or filters'
                        : 'Get started by adding your first lead or using the AI Assistant'
                      }
                    </p>
                    <div className="flex gap-2 justify-center">
                      <Button onClick={() => setIsAddDialogOpen(true)}>
                        <Plus className="mr-2 h-4 w-4" />
                        Add Lead
                      </Button>
                      <Button variant="outline" onClick={() => setActiveTab('assistant')}>
                        <Bot className="mr-2 h-4 w-4" />
                        Try AI Assistant
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* Commands Tab */}
            <TabsContent value="commands" className="space-y-6">
              <DealCommand />
            </TabsContent>

            {/* Transactions Tab */}
            <TabsContent value="transactions" className="space-y-6">
              <div className="grid gap-6 lg:grid-cols-3">
                <div className="lg:col-span-2">
                  <TransactionManagement />
                </div>
                <div>
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Smart Alerts</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <SmartAlerts />
                    </CardContent>
                  </Card>
                </div>
              </div>
            </TabsContent>

            {/* Property Search Tab */}
            <TabsContent value="properties" className="space-y-6">
              <PropertySearch />
            </TabsContent>

            {/* Assistant Tab */}
            <TabsContent value="assistant" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Bot className="h-5 w-5 text-purple-600" />
                    AI Real Estate Assistant
                  </CardTitle>
                  <CardDescription>
                    Use natural language to create leads and find matching properties. 
                    Try: "Just met Priya Sharma. 2BHK in Frisco under $500K."
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <AssistantChat />
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* All existing dialogs remain the same... */}
      {/* Add Lead Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add New Lead</DialogTitle>
            <DialogDescription>
              Create a new lead and let AI provide insights and property matches.
            </DialogDescription>
          </DialogHeader>
          <Tabs defaultValue="basic" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="basic">Basic Info</TabsTrigger>
              <TabsTrigger value="preferences">Preferences</TabsTrigger>
            </TabsList>
            <TabsContent value="basic" className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Full Name</Label>
                  <Input
                    id="name"
                    value={newLead.name}
                    onChange={(e) => setNewLead({...newLead, name: e.target.value})}
                    placeholder="John Doe"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lead_type">Lead Type</Label>
                  <Select value={newLead.lead_type} onValueChange={(value) => setNewLead({...newLead, lead_type: value})}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="buyer">Buyer</SelectItem>
                      <SelectItem value="seller">Seller</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={newLead.email}
                    onChange={(e) => setNewLead({...newLead, email: e.target.value})}
                    placeholder="john@example.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    value={newLead.phone}
                    onChange={(e) => setNewLead({...newLead, phone: e.target.value})}
                    placeholder="(555) 123-4567"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="assigned_agent">Assigned Agent (Optional)</Label>
                <Input
                  id="assigned_agent"
                  value={newLead.assigned_agent}
                  onChange={(e) => setNewLead({...newLead, assigned_agent: e.target.value})}
                  placeholder="Agent Name"
                />
              </div>
            </TabsContent>
            <TabsContent value="preferences" className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="zipcode">Preferred Zipcode</Label>
                  <Input
                    id="zipcode"
                    value={newLead.preferences.zipcode}
                    onChange={(e) => setNewLead({
                      ...newLead,
                      preferences: {...newLead.preferences, zipcode: e.target.value}
                    })}
                    placeholder="90210"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bedrooms">Bedrooms</Label>
                  <Input
                    id="bedrooms"
                    type="number"
                    value={newLead.preferences.bedrooms}
                    onChange={(e) => setNewLead({
                      ...newLead,
                      preferences: {...newLead.preferences, bedrooms: e.target.value}
                    })}
                    placeholder="3"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="min_price">Min Price</Label>
                  <Input
                    id="min_price"
                    type="number"
                    value={newLead.preferences.min_price}
                    onChange={(e) => setNewLead({
                      ...newLead,
                      preferences: {...newLead.preferences, min_price: e.target.value}
                    })}
                    placeholder="300000"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="max_price">Max Price</Label>
                  <Input
                    id="max_price"
                    type="number"
                    value={newLead.preferences.max_price}
                    onChange={(e) => setNewLead({
                      ...newLead,
                      preferences: {...newLead.preferences, max_price: e.target.value}
                    })}
                    placeholder="500000"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="bathrooms">Bathrooms</Label>
                <Input
                  id="bathrooms"
                  type="number"
                  step="0.5"
                  value={newLead.preferences.bathrooms}
                  onChange={(e) => setNewLead({
                    ...newLead,
                    preferences: {...newLead.preferences, bathrooms: e.target.value}
                  })}
                  placeholder="2"
                />
              </div>
            </TabsContent>
          </Tabs>
          <div className="flex justify-end space-x-2">
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddLead} disabled={loading}>
              {loading ? 'Creating...' : 'Create Lead'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Lead Dialog */}
      {selectedLead && (
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Edit Lead</DialogTitle>
              <DialogDescription>
                Update lead information and preferences.
              </DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-name">Full Name</Label>
                <Input
                  id="edit-name"
                  value={selectedLead.name}
                  onChange={(e) => setSelectedLead({...selectedLead, name: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-lead_type">Lead Type</Label>
                <Select value={selectedLead.lead_type} onValueChange={(value) => setSelectedLead({...selectedLead, lead_type: value})}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="buyer">Buyer</SelectItem>
                    <SelectItem value="seller">Seller</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-email">Email</Label>
                <Input
                  id="edit-email"
                  type="email"
                  value={selectedLead.email}
                  onChange={(e) => setSelectedLead({...selectedLead, email: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-phone">Phone</Label>
                <Input
                  id="edit-phone"
                  value={selectedLead.phone}
                  onChange={(e) => setSelectedLead({...selectedLead, phone: e.target.value})}
                />
              </div>
            </div>
            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleUpdateLead} disabled={loading}>
                {loading ? 'Updating...' : 'Update Lead'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Property Matches Dialog */}
      {propertyMatches && (
        <Dialog open={!!propertyMatches} onOpenChange={() => setPropertyMatches(null)}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>AI Property Matches</DialogTitle>
              <DialogDescription>
                Found {propertyMatches.total_found} properties. Here are the top matches:
              </DialogDescription>
            </DialogHeader>
            
            {propertyMatches.ai_recommendations && (
              <div className="mb-6 p-4 bg-muted rounded-lg">
                <h4 className="font-semibold mb-2 flex items-center">
                  <Sparkles className="mr-2 h-4 w-4" />
                  AI Recommendations
                </h4>
                <p className="text-sm whitespace-pre-line">{propertyMatches.ai_recommendations}</p>
              </div>
            )}
            
            <div className="grid gap-4">
              {propertyMatches.properties.slice(0, 5).map((property, index) => (
                <Card key={index}>
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-semibold">{property.address || `Property #${index + 1}`}</h4>
                        <p className="text-sm text-muted-foreground">{property.city}, {property.state} {property.zipcode}</p>
                        <div className="flex gap-4 mt-2">
                          {property.bedrooms && <span className="text-sm">🛏️ {property.bedrooms} bed</span>}
                          {property.bathrooms && <span className="text-sm">🛁 {property.bathrooms} bath</span>}
                          {property.square_feet && <span className="text-sm">📐 {property.square_feet} sq ft</span>}
                        </div>
                      </div>
                      {property.price && (
                        <div className="text-right">
                          <p className="text-lg font-bold text-primary">{formatCurrency(property.price)}</p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}