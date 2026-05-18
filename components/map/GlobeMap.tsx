'use client';

import { useMemo, useRef, useState } from 'react';
import ReactMap, {
  Marker,
  NavigationControl,
  Popup,
  MapRef,
} from 'react-map-gl/mapbox';
import 'mapbox-gl/dist/mapbox-gl.css';
import { CapturedTamCompany, CityOpportunityGroup } from '@/types';

const MAPBOX_TOKEN =
  process.env.NEXT_PUBLIC_MAPBOX_TOKEN ??
  process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;

interface GlobeMapProps {
  cityGroups: CityOpportunityGroup[];
  selectedCityId?: string | null;
  onCitySelect: (cityGroup: CityOpportunityGroup) => void;
  onTamCitySelect: (locationKey: string) => void;
  viewMode: 'pipeline' | 'tam';
  tamData: CapturedTamCompany[];
}

type DisplayWhitespaceCompany = CapturedTamCompany & {
  displayLatitude: number;
  displayLongitude: number;
};

export function GlobeMap({
  cityGroups,
  selectedCityId,
  onCitySelect,
  onTamCitySelect,
  viewMode,
  tamData,
}: GlobeMapProps) {
  const mapRef = useRef<MapRef>(null);
  const [selectedTamCompany, setSelectedTamCompany] =
    useState<DisplayWhitespaceCompany | null>(null);
  const [hoveredTamCompany, setHoveredTamCompany] =
    useState<DisplayWhitespaceCompany | null>(null);

  const pipelineLocationKeys = useMemo(
    () =>
      new Set(
        cityGroups.flatMap((cityGroup) =>
          cityGroup.opportunities.map((opportunity) => opportunity.locationKey)
        )
      ),
    [cityGroups]
  );

  const visibleWhitespace = useMemo<DisplayWhitespaceCompany[]>(() => {
    const locationCounts = new Map<string, number>();

    return tamData
      .filter((company) => !company.isCaptured)
      .map((company) => {
        const index = locationCounts.get(company.locationKey) ?? 0;
        locationCounts.set(company.locationKey, index + 1);

        const hasPipelineAtLocation = pipelineLocationKeys.has(company.locationKey);
        const columnOffset = hasPipelineAtLocation ? 0.42 : 0;
        const stackOffset = index * 0.08;

        return {
          ...company,
          displayLongitude: company.longitude + columnOffset + stackOffset,
          displayLatitude: company.latitude + (index % 2 === 0 ? 0.05 : -0.05),
        };
      });
  }, [pipelineLocationKeys, tamData]);
  const activeTamCompany = hoveredTamCompany ?? selectedTamCompany;

  const handleCityClick = (cityGroup: CityOpportunityGroup) => {
    onCitySelect(cityGroup);
    setSelectedTamCompany(null);
    mapRef.current?.flyTo({
      center: [cityGroup.longitude, cityGroup.latitude],
      zoom: cityGroup.opportunities.length > 1 ? 4.6 : 3.7,
      duration: 900,
    });
  };

  const handleTamClick = (company: DisplayWhitespaceCompany) => {
    setSelectedTamCompany(company);
    onTamCitySelect(company.locationKey);
    mapRef.current?.flyTo({
      center: [company.longitude + 0.25, company.latitude],
      zoom: 4,
      duration: 900,
    });
  };

  if (!MAPBOX_TOKEN) {
    return (
      <div className="flex h-full min-h-[420px] items-center justify-center bg-bny-navy p-8 text-center">
        <div>
          <div className="text-sm font-semibold uppercase tracking-[0.3em] text-bny-primary">
            Mapbox Token Required
          </div>
          <p className="mt-3 max-w-md text-sm text-white/75">
            Add NEXT_PUBLIC_MAPBOX_TOKEN to .env.local to enable globe rendering
            and city-level pipeline markers.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-full min-h-[420px] overflow-hidden bg-black">
      <div className="pointer-events-none absolute inset-0 z-10 bg-[radial-gradient(circle_at_50%_45%,transparent_0%,rgba(0,36,61,0.22)_45%,rgba(0,0,0,0.68)_100%)]" />
      <ReactMap
        ref={mapRef}
        mapboxAccessToken={MAPBOX_TOKEN}
        initialViewState={{
          longitude: 10,
          latitude: 18,
          zoom: 1.35,
        }}
        mapStyle="mapbox://styles/mapbox/dark-v11"
        projection="globe"
        style={{ width: '100%', height: '100%' }}
        onLoad={(event) => {
          event.target.setFog({
            color: 'rgb(0, 36, 61)',
            'high-color': 'rgb(45, 155, 173)',
            'horizon-blend': 0.16,
            'space-color': 'rgb(0, 8, 14)',
            'star-intensity': 0.1,
          });
        }}
      >
        <NavigationControl position="bottom-right" showCompass showZoom />
        {cityGroups.map((cityGroup) => {
          const isSelected = selectedCityId === cityGroup.id;
          const count = cityGroup.opportunities.length;
          const isTamMode = viewMode === 'tam';

          return (
            <Marker
              key={cityGroup.id}
              longitude={cityGroup.longitude}
              latitude={cityGroup.latitude}
              anchor="center"
            >
              <button
                type="button"
                aria-label={`View ${cityGroup.label} opportunities`}
                onClick={() => handleCityClick(cityGroup)}
                className="group relative grid place-items-center rounded-full transition-transform hover:scale-110"
              >
                <span
                  className={`absolute rounded-full blur-md transition-opacity ${
                    isSelected || isTamMode
                      ? 'opacity-65'
                      : 'opacity-35 group-hover:opacity-55'
                  }`}
                  style={{
                    width: isTamMode ? 42 : 32,
                    height: isTamMode ? 42 : 32,
                    backgroundColor: '#2D9BAD',
                  }}
                />
                {isTamMode && (
                  <span className="absolute h-8 w-8 rounded-full border border-bny-teal/80 shadow-[0_0_22px_rgba(106,189,198,0.65)]" />
                )}
                <span
                  className={`relative grid h-4 w-4 place-items-center rounded-full border-2 font-bold text-white shadow-glow ${
                    isSelected
                      ? 'border-white bg-bny-primary'
                      : 'border-white/70 bg-bny-primary'
                  }`}
                >
                  <span className="sr-only">{cityGroup.label}</span>
                </span>
                {count > 1 && (
                  <span className="absolute left-full top-1/2 z-10 ml-1.5 grid h-5 min-w-5 -translate-y-1/2 place-items-center rounded-full border border-white/80 bg-bny-accent px-1.5 text-[10px] font-black text-white shadow-lg">
                    {count}
                  </span>
                )}
              </button>
            </Marker>
          );
        })}
        {viewMode === 'tam' &&
          visibleWhitespace.map((company) => (
            <Marker
              key={`${company['Company Name']}-${company.locationKey}`}
              longitude={company.displayLongitude}
              latitude={company.displayLatitude}
              anchor="center"
            >
              <button
                type="button"
                aria-label={`View TAM whitespace company ${company['Company Name']}`}
                onClick={() => handleTamClick(company)}
                onMouseEnter={() => setHoveredTamCompany(company)}
                onMouseLeave={() => setHoveredTamCompany(null)}
                className="group relative grid place-items-center rounded-full transition-transform hover:scale-125"
              >
                <span className="absolute h-5 w-5 rounded-full bg-[#FFBF00]/30 blur-md opacity-70 transition group-hover:opacity-100" />
                <span className="relative h-2.5 w-2.5 rounded-full border border-white/80 bg-[#FFBF00] shadow-[0_0_18px_rgba(255,191,0,0.65)]" />
              </button>
            </Marker>
          ))}
        {viewMode === 'tam' && activeTamCompany && (
          <Popup
            longitude={activeTamCompany.displayLongitude}
            latitude={activeTamCompany.displayLatitude}
            anchor="top"
            closeButton={Boolean(selectedTamCompany)}
            closeOnClick={false}
            onClose={() => setSelectedTamCompany(null)}
            offset={16}
            className="bny-map-popup"
          >
            <div className="min-w-48 rounded-xl border border-bny-primary/30 bg-bny-navy/95 p-3 text-white shadow-2xl backdrop-blur-xl">
              <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#FFBF00]">
                Market Whitespace
              </div>
              <div className="mt-2 text-sm font-semibold">
                {activeTamCompany['Company Name']}
              </div>
              <div className="mt-1 text-xs text-white/65">
                {activeTamCompany.City}, {activeTamCompany.Country}
              </div>
              <div className="mt-3 rounded-lg bg-white/10 px-3 py-2">
                <div className="text-[10px] uppercase tracking-[0.18em] text-white/50">
                  Crypto Holdings
                </div>
                <div className="mt-1 text-sm font-bold text-white">
                  {new Intl.NumberFormat('en-US', {
                    style: 'currency',
                    currency: 'USD',
                    notation: 'compact',
                    maximumFractionDigits: 1,
                  }).format(activeTamCompany['Crypto Holdings Value'])}
                </div>
              </div>
            </div>
          </Popup>
        )}
      </ReactMap>

      <div className="pointer-events-none absolute left-6 top-6 z-20 rounded-2xl border border-bny-primary/25 bg-bny-navy/85 px-5 py-4 backdrop-blur-xl">
        <div className="text-xs font-semibold uppercase tracking-[0.28em] text-bny-primary">
          {viewMode === 'tam' ? 'Market Whitespace Map' : 'City Pipeline Map'}
        </div>
        <div className="mt-1 text-sm text-white/75">
          {viewMode === 'tam'
            ? `${visibleWhitespace.length} whitespace companies`
            : `${cityGroups.length} cities mapped`}
        </div>
      </div>
    </div>
  );
}
