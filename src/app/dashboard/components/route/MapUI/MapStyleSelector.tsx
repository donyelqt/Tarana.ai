'use client';

import React from 'react';
import { MAP_STYLES, MapStyle } from '@/lib/tomtomMapUtils';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { MapIcon, Loader2 } from 'lucide-react';

interface MapStyleSelectorProps {
  currentMapStyle: MapStyle;
  isChangingStyle: boolean;
  onStyleChange: (style: MapStyle) => void;
}

export default function MapStyleSelector({ currentMapStyle, isChangingStyle, onStyleChange }: MapStyleSelectorProps) {
  return (
    <div className="absolute bottom-4 right-4 sm:bottom-6 sm:right-6 z-20">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button 
            variant="outline" 
            size="icon" 
            disabled={isChangingStyle}
            className="shadow-lg backdrop-blur-sm bg-white/90 hover:bg-white/95 border-gray-200/80"
          >
            {isChangingStyle ? <Loader2 className="h-4 w-4 animate-spin" /> : <MapIcon className="h-4 w-4" />}
            <span className="sr-only">Change Map Style</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" side="top" className="mb-2">
          <DropdownMenuRadioGroup value={currentMapStyle} onValueChange={(value) => onStyleChange(value as MapStyle)}>
            {Object.entries(MAP_STYLES).map(([styleKey, styleInfo]) => (
              <DropdownMenuRadioItem key={styleKey} value={styleKey}>
                {styleInfo.name}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
