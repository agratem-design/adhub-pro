import { memo } from 'react'
import { MapProvider } from '@/types/map'
import { Map, Globe } from 'lucide-react'

interface MapProviderToggleProps {
  provider: MapProvider
  onToggle: () => void
  disabled?: boolean
  className?: string
}

function MapProviderToggleComponent({ provider, onToggle, disabled, className = '' }: MapProviderToggleProps) {
  return (
    <button
      onClick={onToggle}
      disabled={disabled}
      className={`
        flex items-center gap-2 px-3 py-2 rounded-xl 
        bg-[#1a1a2e]/95 backdrop-blur-md border border-[#d4af37]/30 
        shadow-lg transition-all duration-300
        text-sm font-medium
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-[#d4af37]/10 hover:border-[#d4af37]/50'}
        ${className}
      `}
      title={provider === 'google' ? 'التبديل إلى OpenStreetMap' : 'التبديل إلى Google Maps'}
    >
      <div className="relative flex items-center justify-center w-8 h-8">
        {/* Google Maps Icon */}
        <div className={`absolute transition-all duration-300 ${provider === 'google' ? 'opacity-100 scale-100' : 'opacity-0 scale-75'}`}>
          <Map className="w-5 h-5 text-[#d4af37]" />
        </div>
        
        {/* OSM Icon */}
        <div className={`absolute transition-all duration-300 ${provider === 'openstreetmap' ? 'opacity-100 scale-100' : 'opacity-0 scale-75'}`}>
          <Globe className="w-5 h-5 text-emerald-400" />
        </div>
      </div>
      
      <div className="flex flex-col items-start">
        <span className={`text-xs transition-colors duration-300 ${provider === 'google' ? 'text-[#d4af37]' : 'text-emerald-400'}`}>
          {provider === 'google' ? 'Google Maps' : 'OpenStreetMap'}
        </span>
        <span className="text-[10px] text-white/60">
          {provider === 'google' ? 'انقر للتبديل' : 'أسرع'}
        </span>
      </div>
      
      {/* Status indicator */}
      <div className={`w-2.5 h-2.5 rounded-full ${provider === 'google' ? 'bg-[#d4af37]' : 'bg-emerald-400'} ${disabled ? '' : 'animate-pulse'}`} />
    </button>
  )
}

export default memo(MapProviderToggleComponent)
