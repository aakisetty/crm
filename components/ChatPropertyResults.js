'use client'

import React from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from '@/components/ui/carousel'
import { Bed, Bath, Square, Image as ImageIcon, Maximize2 } from 'lucide-react'

function formatCurrency(amount) {
  if (amount === undefined || amount === null || amount === '' || Number.isNaN(Number(amount))) return 'N/A'
  const num = typeof amount === 'string' ? Number(amount) : amount
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(num)
  } catch {
    return `$${num}`
  }
}

function getThumb(p) {
  // Try common normalized keys first
  const candidates = [
    p.thumbnail,
    p.thumbnail_url,
    p.primary_image,
    p.primary_photo_url,
    p.image_url,
    p.photo_url,
    Array.isArray(p.images) && p.images[0],
    Array.isArray(p.photos) && p.photos[0]?.url,
    Array.isArray(p.photos) && p.photos[0],
  ].filter(Boolean)
  return candidates.length ? candidates[0] : null
}

function PropertyLine({ property }) {
  const thumb = getThumb(property)
  return (
    <div className="flex items-start justify-between gap-3 p-2 rounded hover:bg-muted/50">
      <div className="flex items-center gap-3 min-w-0">
        <div className="h-16 w-16 rounded overflow-hidden bg-muted flex items-center justify-center">
          {thumb ? (
            // using img for simplicity/compat in chat context
            <img src={thumb} alt={property.address || 'Property'} className="h-full w-full object-cover" />
          ) : (
            <ImageIcon className="h-5 w-5 text-muted-foreground" />
          )}
        </div>
        <div className="min-w-0">
          <div className="font-medium text-sm truncate">{
            typeof property.address === 'object'
              ? (property.address.street || property.address.address || 'Property')
              : (property.address || 'Property')
          }</div>
          <div className="text-xs text-muted-foreground truncate">
            {[property.city, property.state, property.zipcode].filter(Boolean).join(', ')}
          </div>
          <div className="flex gap-3 text-xs text-muted-foreground mt-1">
            {property.bedrooms ? (
              <span className="flex items-center"><Bed className="mr-1 h-3 w-3" />{property.bedrooms}</span>
            ) : null}
            {property.bathrooms ? (
              <span className="flex items-center"><Bath className="mr-1 h-3 w-3" />{property.bathrooms}</span>
            ) : null}
            {property.square_feet ? (
              <span className="flex items-center"><Square className="mr-1 h-3 w-3" />{property.square_feet} sq ft</span>
            ) : null}
          </div>
        </div>
      </div>
      <div className="text-right shrink-0">
        {property.price ? (
          <div className="font-bold text-primary text-sm">{formatCurrency(property.price)}</div>
        ) : null}
        {/* Placeholder quick actions */}
        <div className="mt-2 flex items-center gap-1 justify-end">
          <Button size="sm" variant="outline">Save</Button>
          <Button size="sm" variant="ghost">Compare</Button>
        </div>
      </div>
    </div>
  )
}

export default function ChatPropertyResults({ properties = [], totalCount }) {
  const count = totalCount ?? properties.length
  const topPicks = properties.slice(0, 3)
  const remaining = Math.max(0, count - topPicks.length)

  return (
    <div className="space-y-2 w-full pr-6 md:pr-8">
      {/* Summary line */}
      <div className="flex items-center justify-between gap-2 pr-2 min-w-0">
        <p className="text-sm font-medium truncate">Found {count} properties • Top picks</p>
        <div className="flex items-center gap-2 shrink-0">
          <Badge variant="outline">{topPicks.length} shown</Badge>
          {remaining > 0 && (
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="sm" className="h-7 px-2 shrink-0">Show all ({remaining})</Button>
              </SheetTrigger>
              <SheetContent side="right" className="sm:max-w-xl w-full">
                <SheetHeader>
                  <SheetTitle>All results ({count})</SheetTitle>
                </SheetHeader>
                <div className="py-3 pr-2">
                  <ScrollArea className="h-[78vh] pr-4">
                    <div className="space-y-2">
                      {properties.map((p, i) => (
                        <Card key={i} className="bg-background">
                          <CardContent className="p-2">
                            <PropertyLine property={p} />
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              </SheetContent>
            </Sheet>
          )}
        </div>
      </div>

      {/* Top picks carousel */}
      <Card className="bg-background overflow-visible">
        <CardContent className="p-3 pr-6">
          <div className="relative overflow-visible">
            <Carousel className="w-full overflow-visible">
              <CarouselContent>
                {topPicks.map((p, idx) => (
                  <CarouselItem key={idx} className="basis-full sm:basis-1/2 lg:basis-1/3">
                    <div className="p-1">
                      <Card className="bg-muted/30">
                        <CardContent className="p-3">
                          <PropertyLine property={p} />
                        </CardContent>
                      </Card>
                    </div>
                  </CarouselItem>
                ))}
              </CarouselContent>
              <CarouselPrevious className="left-2" />
              <CarouselNext className="right-2" />
            </Carousel>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
