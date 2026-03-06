import React from 'react';
import { ICONS } from '../constants';

type LocationSuggestion = {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
};

type OnsiteLocationAssistantProps = {
  value: string;
  onChange: (nextValue: string) => void;
};

const DEFAULT_MAP_QUERY = 'Philippines';

export const OnsiteLocationAssistant: React.FC<OnsiteLocationAssistantProps> = ({ value, onChange }) => {
  const [query, setQuery] = React.useState(value || '');
  const [loading, setLoading] = React.useState(false);
  const [suggestions, setSuggestions] = React.useState<LocationSuggestion[]>([]);
  const [selectedMarker, setSelectedMarker] = React.useState<{ lat: number; lon: number } | null>(null);

  React.useEffect(() => {
    setQuery(value || '');
  }, [value]);

  React.useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 3) {
      setSuggestions([]);
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        setLoading(true);
        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&q=${encodeURIComponent(trimmed)}`,
          { signal: controller.signal, headers: { Accept: 'application/json' } }
        );
        if (!response.ok) {
          setSuggestions([]);
          return;
        }
        const data = await response.json().catch(() => []);
        if (Array.isArray(data)) {
          setSuggestions(
            data
              .filter((item: any) => item?.display_name && item?.lat && item?.lon)
              .map((item: any) => ({
                place_id: Number(item.place_id),
                display_name: String(item.display_name),
                lat: String(item.lat),
                lon: String(item.lon)
              }))
          );
        } else {
          setSuggestions([]);
        }
      } catch {
        setSuggestions([]);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [query]);

  const handleSelectSuggestion = (suggestion: LocationSuggestion) => {
    const lat = Number(suggestion.lat);
    const lon = Number(suggestion.lon);
    setSelectedMarker(Number.isFinite(lat) && Number.isFinite(lon) ? { lat, lon } : null);
    onChange(suggestion.display_name);
    setQuery(suggestion.display_name);
    setSuggestions([]);
  };

  const mapSrc = React.useMemo(() => {
    if (selectedMarker) {
      const lat = selectedMarker.lat;
      const lon = selectedMarker.lon;
      const delta = 0.015;
      const bbox = `${lon - delta}%2C${lat - delta}%2C${lon + delta}%2C${lat + delta}`;
      return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat}%2C${lon}`;
    }

    const mapQuery = (value || query || DEFAULT_MAP_QUERY).trim();
    return `https://maps.google.com/maps?q=${encodeURIComponent(mapQuery)}&z=14&output=embed`;
  }, [query, selectedMarker, value]);

  const openMapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent((value || query || DEFAULT_MAP_QUERY).trim())}`;

  return (
    <div className="rounded-2xl border border-[#2E2E2F]/10 bg-[#F2F2F2] p-4 md:p-5 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] font-black uppercase tracking-widest text-[#2E2E2F]/60">Add location details</p>
        <a
          href={openMapUrl}
          target="_blank"
          rel="noreferrer"
          className="text-[10px] font-black uppercase tracking-widest text-[#38BDF2] hover:text-[#2E2E2F] transition-colors"
        >
          Open in Maps
        </a>
      </div>

      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#2E2E2F]/50">
          <ICONS.Search className="w-4 h-4" strokeWidth={2.5} />
        </div>
        <input
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            if (!event.target.value.trim()) {
              setSelectedMarker(null);
            }
          }}
          placeholder="Search a venue or address"
          className="w-full pl-10 pr-10 py-3 bg-[#F2F2F2] border border-[#2E2E2F]/20 rounded-xl text-sm outline-none focus:ring-2 focus:ring-[#38BDF2]/30 focus:border-[#38BDF2] transition-colors"
        />
        {loading && (
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
            <div className="w-4 h-4 border-2 border-[#2E2E2F]/30 border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </div>

      {suggestions.length > 0 && (
        <div className="rounded-xl border border-[#2E2E2F]/10 bg-[#F2F2F2] max-h-52 overflow-auto">
          {suggestions.map((suggestion) => (
            <button
              key={suggestion.place_id}
              type="button"
              className="w-full text-left px-4 py-3 text-xs text-[#2E2E2F]/80 hover:bg-[#38BDF2]/10 transition-colors border-b border-[#2E2E2F]/5 last:border-b-0"
              onClick={() => handleSelectSuggestion(suggestion)}
            >
              {suggestion.display_name}
            </button>
          ))}
        </div>
      )}

      <div className="rounded-xl overflow-hidden border border-[#2E2E2F]/10 bg-[#F2F2F2]">
        <iframe
          src={mapSrc}
          title="Location preview map"
          className="w-full h-64"
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
        />
      </div>

      <p className="text-[11px] text-[#2E2E2F]/60">
        Selecting a result from map search automatically fills the location field.
      </p>
    </div>
  );
};
