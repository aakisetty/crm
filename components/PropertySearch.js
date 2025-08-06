'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { 
  Search, 
  Filter,
  Bed, 
  Bath,
  Square,
  MapPin,
  DollarSign,
  Calendar,
  Home,
  Building,
  Car,
  Droplets,
  Flame,
  Loader2,
  AlertCircle,
  RefreshCw,
  SlidersHorizontal
} from 'lucide-react'

// Debounce hook for search optimization
function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value)

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    return () => {
      clearTimeout(handler)
    }
  }, [value, delay])

  return debouncedValue
}

export function PropertySearch() {
  const [filters, setFilters] = useState({
    location: '',
    beds: '',
    baths: '',
    min_price: '',
    max_price: '',
    property_type: '',
    sort_by: 'price_asc'
  })
  
  const [properties, setProperties] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [totalResults, setTotalResults] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [showFilters, setShowFilters] = useState(true)
  const [searchPerformed, setSearchPerformed] = useState(false)

  // Debounced search for better UX
  const debouncedFilters = useDebounce(filters, 500)

  const formatCurrency = (amount) => {
    if (!amount) return 'N/A'
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
    }).format(amount)
  }

  const formatNumber = (num) => {
    if (!num) return 'N/A'
    return new Intl.NumberFormat('en-US').format(num)
  }

  const performSearch = useCallback(async (searchFilters, resetResults = true) => {
    if (!searchFilters.location && !searchFilters.beds && !searchFilters.baths && 
        !searchFilters.min_price && !searchFilters.max_price) {
      // Don't search with completely empty filters
      return
    }

    setLoading(true)
    setError(null)

    try {
      const queryParams = new URLSearchParams()
      
      Object.entries(searchFilters).forEach(([key, value]) => {
        if (value && value !== '') {
          queryParams.append(key, value.toString())
        }
      })

      const response = await fetch(`/api/properties?${queryParams.toString()}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      })

      if (!response.ok) {
        throw new Error(`Search failed: ${response.status}`)
      }

      const data = await response.json()

      if (data.success) {
        if (resetResults) {
          setProperties(data.properties)
        } else {
          setProperties(prev => [...prev, ...data.properties])
        }
        setTotalResults(data.total)
        setHasMore(data.has_more)
        setSearchPerformed(true)
      } else {
        throw new Error(data.error || 'Search failed')
      }
    } catch (error) {
      console.error('Property search error:', error)
      setError(error.message)
      if (resetResults) {
        setProperties([])
        setTotalResults(0)
        setHasMore(false)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  // Auto-search when filters change (debounced)
  useEffect(() => {
    if (searchPerformed) {
      performSearch(debouncedFilters, true)
    }
  }, [debouncedFilters, performSearch, searchPerformed])

  const handleManualSearch = () => {
    setSearchPerformed(true)
    performSearch(filters, true)
  }

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({
      ...prev,
      [key]: value
    }))
  }

  const clearFilters = () => {
    setFilters({
      location: '',
      beds: '',
      baths: '',
      min_price: '',
      max_price: '',
      property_type: '',
      sort_by: 'price_asc'
    })
    setProperties([])
    setTotalResults(0)
    setSearchPerformed(false)
    setError(null)
  }

  const PropertyCard = ({ property }) => (
    <Card className="hover:shadow-lg transition-shadow cursor-pointer">
      <CardContent className="p-6">
        <div className="flex justify-between items-start mb-4">
          <div className="flex-1">
            <h3 className="text-lg font-semibold mb-1">{property.address}</h3>
            <div className="flex items-center text-muted-foreground text-sm mb-2">
              <MapPin className="h-4 w-4 mr-1" />
              {property.city}, {property.state} {property.zipcode}
            </div>
            <div className="flex items-center gap-4 text-sm">
              {property.bedrooms && (
                <div className="flex items-center">
                  <Bed className="h-4 w-4 mr-1" />
                  {property.bedrooms} bed
                </div>
              )}
              {property.bathrooms && (
                <div className="flex items-center">
                  <Bath className="h-4 w-4 mr-1" />
                  {property.bathrooms} bath
                </div>
              )}
              {property.square_feet && (
                <div className="flex items-center">
                  <Square className="h-4 w-4 mr-1" />
                  {formatNumber(property.square_feet)} sq ft
                </div>
              )}
            </div>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-primary mb-1">
              {formatCurrency(property.price)}
            </p>
            {property.days_on_market && (
              <p className="text-sm text-muted-foreground">
                {property.days_on_market} days on market
              </p>
            )}
          </div>
        </div>

        {property.description && (
          <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
            {property.description}
          </p>
        )}

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <Badge variant="outline">{property.property_type}</Badge>
            {property.year_built && (
              <div className="flex items-center">
                <Calendar className="h-4 w-4 mr-1" />
                Built {property.year_built}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            {property.garage > 0 && (
              <div className="flex items-center">
                <Car className="h-4 w-4 mr-1" />
                {property.garage}
              </div>
            )}
            {property.pool && (
              <div className="flex items-center">
                <Droplets className="h-4 w-4" title="Pool" />
              </div>
            )}
            {property.fireplace && (
              <div className="flex items-center">
                <Flame className="h-4 w-4" title="Fireplace" />
              </div>
            )}
          </div>
        </div>

        {property.mls_number && (
          <div className="mt-3 pt-3 border-t">
            <p className="text-xs text-muted-foreground">MLS: {property.mls_number}</p>
          </div>
        )}
      </CardContent>
    </Card>
  )

  return (
    <div className="space-y-6">
      {/* Search Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Property Search</h2>
          <p className="text-muted-foreground">Find properties with advanced filters</p>
        </div>
        <Button
          variant="outline"
          onClick={() => setShowFilters(!showFilters)}
          className="flex items-center gap-2"
        >
          <SlidersHorizontal className="h-4 w-4" />
          {showFilters ? 'Hide' : 'Show'} Filters
        </Button>
      </div>

      {/* Search Filters */}
      {showFilters && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Search Filters
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Location */}
              <div className="space-y-2">
                <Label htmlFor="location">Location</Label>
                <Input
                  id="location"
                  placeholder="City, State, or ZIP"
                  value={filters.location}
                  onChange={(e) => handleFilterChange('location', e.target.value)}
                />
              </div>

              {/* Bedrooms */}
              <div className="space-y-2">
                <Label htmlFor="beds">Bedrooms</Label>
                <Select value={filters.beds} onValueChange={(value) => handleFilterChange('beds', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Any" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Any</SelectItem>
                    <SelectItem value="1">1+</SelectItem>
                    <SelectItem value="2">2+</SelectItem>
                    <SelectItem value="3">3+</SelectItem>
                    <SelectItem value="4">4+</SelectItem>
                    <SelectItem value="5">5+</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Bathrooms */}
              <div className="space-y-2">
                <Label htmlFor="baths">Bathrooms</Label>
                <Select value={filters.baths} onValueChange={(value) => handleFilterChange('baths', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Any" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Any</SelectItem>
                    <SelectItem value="1">1+</SelectItem>
                    <SelectItem value="1.5">1.5+</SelectItem>
                    <SelectItem value="2">2+</SelectItem>
                    <SelectItem value="2.5">2.5+</SelectItem>
                    <SelectItem value="3">3+</SelectItem>
                    <SelectItem value="4">4+</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Min Price */}
              <div className="space-y-2">
                <Label htmlFor="min_price">Min Price</Label>
                <Input
                  id="min_price"
                  type="number"
                  placeholder="$0"
                  value={filters.min_price}
                  onChange={(e) => handleFilterChange('min_price', e.target.value)}
                />
              </div>

              {/* Max Price */}
              <div className="space-y-2">
                <Label htmlFor="max_price">Max Price</Label>
                <Input
                  id="max_price"
                  type="number"
                  placeholder="No limit"
                  value={filters.max_price}
                  onChange={(e) => handleFilterChange('max_price', e.target.value)}
                />
              </div>

              {/* Property Type */}
              <div className="space-y-2">
                <Label htmlFor="property_type">Property Type</Label>
                <Select value={filters.property_type} onValueChange={(value) => handleFilterChange('property_type', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Any" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Any</SelectItem>
                    <SelectItem value="Single Family">Single Family</SelectItem>
                    <SelectItem value="Condo">Condo</SelectItem>
                    <SelectItem value="Townhouse">Townhouse</SelectItem>
                    <SelectItem value="Multi Family">Multi Family</SelectItem>
                    <SelectItem value="Land">Land</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Sort By */}
            <div className="space-y-2">
              <Label htmlFor="sort_by">Sort By</Label>
              <Select value={filters.sort_by} onValueChange={(value) => handleFilterChange('sort_by', value)}>
                <SelectTrigger className="w-full md:w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="price_asc">Price: Low to High</SelectItem>
                  <SelectItem value="price_desc">Price: High to Low</SelectItem>
                  <SelectItem value="date_desc">Newest First</SelectItem>
                  <SelectItem value="beds_desc">Most Bedrooms</SelectItem>
                  <SelectItem value="sqft_desc">Largest First</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Separator />

            {/* Action Buttons */}
            <div className="flex gap-2">
              <Button 
                onClick={handleManualSearch} 
                disabled={loading}
                className="flex items-center gap-2"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Search className="h-4 w-4" />
                )}
                Search Properties
              </Button>
              <Button variant="outline" onClick={clearFilters}>
                Clear Filters
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Search Results */}
      {searchPerformed && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Search Results</CardTitle>
                <CardDescription>
                  {loading ? 'Searching...' : `${totalResults} properties found`}
                </CardDescription>
              </div>
              {!loading && properties.length > 0 && (
                <Button
                  variant="outline" 
                  size="sm"
                  onClick={() => performSearch(filters, true)}
                  className="flex items-center gap-2"
                >
                  <RefreshCw className="h-4 w-4" />
                  Refresh
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {loading && (
              <div className="flex items-center justify-center py-12">
                <div className="text-center">
                  <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
                  <p className="text-muted-foreground">Searching properties...</p>
                </div>
              </div>
            )}

            {error && (
              <div className="flex items-center justify-center py-12">
                <div className="text-center">
                  <AlertCircle className="h-8 w-8 text-destructive mx-auto mb-4" />
                  <p className="text-destructive mb-2">Search Error</p>
                  <p className="text-muted-foreground text-sm mb-4">{error}</p>
                  <Button variant="outline" onClick={() => performSearch(filters, true)}>
                    Try Again
                  </Button>
                </div>
              </div>
            )}

            {!loading && !error && properties.length === 0 && searchPerformed && (
              <div className="flex items-center justify-center py-12">
                <div className="text-center">
                  <Home className="h-8 w-8 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground mb-2">No properties found</p>
                  <p className="text-sm text-muted-foreground mb-4">
                    Try adjusting your search criteria
                  </p>
                  <Button variant="outline" onClick={clearFilters}>
                    Clear Filters
                  </Button>
                </div>
              </div>
            )}

            {!loading && !error && properties.length > 0 && (
              <div className="space-y-4">
                <div className="grid gap-6">
                  {properties.map((property, index) => (
                    <PropertyCard key={property.id || index} property={property} />
                  ))}
                </div>

                {hasMore && (
                  <div className="text-center pt-4">
                    <Button
                      variant="outline"
                      onClick={() => performSearch({...filters, offset: properties.length}, false)}
                      disabled={loading}
                    >
                      Load More Properties
                    </Button>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {!searchPerformed && (
        <Card>
          <CardContent className="p-12 text-center">
            <Search className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Find Your Perfect Property</h3>
            <p className="text-muted-foreground mb-4">
              Enter your search criteria and click "Search Properties" to get started
            </p>
            <Button onClick={handleManualSearch}>
              <Search className="mr-2 h-4 w-4" />
              Start Searching
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}