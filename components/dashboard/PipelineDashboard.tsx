'use client';

import Image from 'next/image';
import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  BriefcaseBusiness,
  Building2,
  DollarSign,
  Globe2,
  MapPin,
  TrendingUp,
} from 'lucide-react';
import { GlobeMap } from '@/components/map/GlobeMap';
import { geocodeOpportunities, geocodeRecordsByLocation } from '@/lib/geocoding';
import { parsePipelineCsvFile } from '@/lib/pipeline-data';
import { groupOpportunitiesByCity } from '@/lib/pipeline-groups';
import { fetchTamCompanies } from '@/lib/tam-data';
import {
  CapturedTamCompany,
  CityOpportunityGroup,
  GeocodedPipelineOpportunity,
  GeocodedTamCompany,
  PipelineOpportunity,
} from '@/types';

const MAPBOX_TOKEN =
  process.env.NEXT_PUBLIC_MAPBOX_TOKEN ??
  process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;

const HIGH_PROBABILITY_THRESHOLD = 30;

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

const compactCurrencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  notation: 'compact',
  maximumFractionDigits: 1,
});

const formatCurrency = (value: number) => currencyFormatter.format(value);
const formatCompactCurrency = (value: number) =>
  compactCurrencyFormatter.format(value);

const sortText = (values: string[]) =>
  values.filter(Boolean).sort((a, b) => a.localeCompare(b));

const stageColorMap = {
  'Contract Signed': {
    border: 'border-l-emerald-400',
    badge: 'bg-emerald-400/10 text-emerald-200 ring-emerald-400/30',
  },
  'Verbal Mandate': {
    border: 'border-l-blue-400',
    badge: 'bg-blue-400/10 text-blue-200 ring-blue-400/30',
  },
  Propose: {
    border: 'border-l-purple-400',
    badge: 'bg-purple-400/10 text-purple-200 ring-purple-400/30',
  },
  Solution: {
    border: 'border-l-amber-300',
    badge: 'bg-amber-300/10 text-amber-100 ring-amber-300/30',
  },
  'Qualify originate': {
    border: 'border-l-slate-300',
    badge: 'bg-slate-300/10 text-slate-200 ring-slate-300/30',
  },
} as const;

const defaultStageColors = {
  border: 'border-l-white/25',
  badge: 'bg-white/10 text-white/75 ring-white/20',
};

const getStageColors = (stage: string) =>
  stageColorMap[stage as keyof typeof stageColorMap] ?? defaultStageColors;

type ViewMode = 'pipeline' | 'tam';

export function PipelineDashboard() {
  const [opportunities, setOpportunities] = useState<PipelineOpportunity[]>([]);
  const [geocodedOpportunities, setGeocodedOpportunities] = useState<
    GeocodedPipelineOpportunity[]
  >([]);
  const [tamData, setTamData] = useState<GeocodedTamCompany[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>('pipeline');
  const [statusFilter, setStatusFilter] = useState('All');
  const [ownerFilter, setOwnerFilter] = useState('All');
  const [minimumProbability, setMinimumProbability] = useState(0);
  const [selectedLocationKey, setSelectedLocationKey] = useState<string | null>(
    null
  );
  const [selectedOpportunity, setSelectedOpportunity] =
    useState<GeocodedPipelineOpportunity | null>(null);
  const [loading, setLoading] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [tamLoading, setTamLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;

    async function loadTamData() {
      try {
        setTamLoading(true);
        const companies = await fetchTamCompanies();
        const geocodedTam = await geocodeRecordsByLocation(
          companies,
          MAPBOX_TOKEN,
          (company) => company.City,
          (company) => company.Country
        );

        if (isActive) {
          setTamData(geocodedTam);
        }
      } catch (loadError) {
        if (isActive) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : 'Unable to load TAM data'
          );
        }
      } finally {
        if (isActive) {
          setTamLoading(false);
        }
      }
    }

    loadTamData();

    return () => {
      isActive = false;
    };
  }, []);

  const handlePipelineUpload = async (file: File) => {
    try {
      setLoading(true);
      setGeocoding(false);
      setError(null);
      setSelectedLocationKey(null);
      setSelectedOpportunity(null);

      const data = await parsePipelineCsvFile(file);
      setOpportunities(data);

      setGeocoding(true);
      const geocoded = await geocodeOpportunities(data, MAPBOX_TOKEN);
      setGeocodedOpportunities(geocoded);
    } catch (loadError) {
      setOpportunities([]);
      setGeocodedOpportunities([]);
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Unable to parse pipeline CSV'
      );
    } finally {
      setLoading(false);
      setGeocoding(false);
    }
  };

  const handleClearData = () => {
    setOpportunities([]);
    setGeocodedOpportunities([]);
    setSelectedLocationKey(null);
    setSelectedOpportunity(null);
    setStatusFilter('All');
    setOwnerFilter('All');
    setMinimumProbability(0);
    setError(null);
  };

  const statuses = useMemo(
    () => sortText(Array.from(new Set(opportunities.map((item) => item.Status)))),
    [opportunities]
  );

  const owners = useMemo(
    () => sortText(Array.from(new Set(opportunities.map((item) => item.Owner)))),
    [opportunities]
  );

  const filteredOpportunities = useMemo(
    () =>
      opportunities.filter((opportunity) => {
        const matchesStatus =
          statusFilter === 'All' || opportunity.Status === statusFilter;
        const matchesOwner =
          ownerFilter === 'All' || opportunity.Owner === ownerFilter;
        const matchesProbability =
          opportunity.Probability >= minimumProbability;

        return matchesStatus && matchesOwner && matchesProbability;
      }),
    [minimumProbability, opportunities, ownerFilter, statusFilter]
  );

  const filteredGeocodedOpportunities = useMemo(() => {
    const filteredIds = new Set(
      filteredOpportunities.map((opportunity) => opportunity['Oppty ID'])
    );

    return geocodedOpportunities.filter((opportunity) =>
      filteredIds.has(opportunity['Oppty ID'])
    );
  }, [filteredOpportunities, geocodedOpportunities]);

  const cityGroups = useMemo(
    () => groupOpportunitiesByCity(filteredGeocodedOpportunities),
    [filteredGeocodedOpportunities]
  );

  const capturedTamData = useMemo<CapturedTamCompany[]>(() => {
    const pipelineClients = new Set(
      opportunities.map((opportunity) => opportunity.Client.trim().toLowerCase())
    );

    return tamData.map((company) => ({
      ...company,
      isCaptured: pipelineClients.has(
        company['Company Name'].trim().toLowerCase()
      ),
    }));
  }, [opportunities, tamData]);

  const capturedTamCount = useMemo(
    () => capturedTamData.filter((company) => company.isCaptured).length,
    [capturedTamData]
  );

  const selectedCity = useMemo(
    () =>
      cityGroups.find((group) =>
        group.opportunities.some(
          (opportunity) => opportunity.locationKey === selectedLocationKey
        )
      ) ?? null,
    [cityGroups, selectedLocationKey]
  );

  const selectedWhitespaceCompanies = useMemo(
    () =>
      viewMode === 'tam' && selectedLocationKey
        ? capturedTamData.filter(
            (company) =>
              !company.isCaptured && company.locationKey === selectedLocationKey
          )
        : [],
    [capturedTamData, selectedLocationKey, viewMode]
  );

  const kpis = useMemo(() => {
    const totalPipelineValue = filteredOpportunities.reduce(
      (sum, opportunity) => sum + opportunity['Total Bid Value'],
      0
    );
    const highProbabilityValue = filteredOpportunities
      .filter((opportunity) => opportunity.Probability > HIGH_PROBABILITY_THRESHOLD)
      .reduce((sum, opportunity) => sum + opportunity['Total Bid Value'], 0);

    return {
      totalPipelineValue,
      activeOpportunities: filteredOpportunities.length,
      highProbabilityValue,
    };
  }, [filteredOpportunities]);

  useEffect(() => {
    if (
      selectedLocationKey &&
      !selectedCity &&
      selectedWhitespaceCompanies.length === 0
    ) {
      setSelectedLocationKey(null);
      setSelectedOpportunity(null);
    }
  }, [selectedCity, selectedLocationKey, selectedWhitespaceCompanies.length]);

  useEffect(() => {
    if (!selectedOpportunity) return;

    const selectedStillVisible = filteredGeocodedOpportunities.some(
      (opportunity) => opportunity['Oppty ID'] === selectedOpportunity['Oppty ID']
    );

    if (!selectedStillVisible) {
      setSelectedOpportunity(null);
    }
  }, [filteredGeocodedOpportunities, selectedOpportunity]);

  const handleCitySelect = (cityGroup: CityOpportunityGroup) => {
    setSelectedLocationKey(cityGroup.opportunities[0]?.locationKey ?? cityGroup.id);
    setSelectedOpportunity(null);
  };

  const handleBackToGlobal = () => {
    setSelectedLocationKey(null);
    setSelectedOpportunity(null);
  };

  const handleViewModeChange = (mode: ViewMode) => {
    setViewMode(mode);
    setSelectedLocationKey(null);
    setSelectedOpportunity(null);
  };

  const handleTamCitySelect = (locationKey: string) => {
    setSelectedLocationKey(locationKey);
    setSelectedOpportunity(null);
  };

  return (
    <main className="h-screen w-screen overflow-hidden bg-bny-navy text-white">
      <div className="grid h-full min-h-0 lg:grid-cols-[420px_minmax(0,1fr)] xl:grid-cols-[460px_minmax(0,1fr)]">
        <aside className="flex min-h-0 flex-col border-r border-bny-astronaut bg-bny-navy">
          <SidebarHeader
            hasData={opportunities.length > 0}
            onFileUpload={handlePipelineUpload}
            onClearData={handleClearData}
          />

          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
            {error && (
              <div className="mb-4 flex items-center gap-3 rounded-xl border border-bny-accent/50 bg-bny-accent/15 px-4 py-3 text-sm text-white">
                <AlertCircle className="h-5 w-5 text-bny-accent" />
                <span>
                  {error}. Upload a valid D365 pipeline export CSV and try
                  again.
                </span>
              </div>
            )}

            {opportunities.length === 0 && viewMode === 'pipeline' ? (
              <UploadEmptyState
                loading={loading}
                geocoding={geocoding}
                onFileUpload={handlePipelineUpload}
                viewMode={viewMode}
                onViewModeChange={handleViewModeChange}
              />
            ) : selectedOpportunity ? (
              <OpportunityDetailView
                opportunity={selectedOpportunity}
                city={selectedCity}
                onBack={() => setSelectedOpportunity(null)}
                onGlobal={handleBackToGlobal}
              />
            ) : selectedCity || selectedWhitespaceCompanies.length > 0 ? (
              <CityView
                city={selectedCity}
                whitespaceCompanies={selectedWhitespaceCompanies}
                viewMode={viewMode}
                onBack={handleBackToGlobal}
                onOpportunitySelect={setSelectedOpportunity}
              />
            ) : (
              <GlobalView
                statuses={statuses}
                owners={owners}
                statusFilter={statusFilter}
                ownerFilter={ownerFilter}
                minimumProbability={minimumProbability}
                onStatusChange={setStatusFilter}
                onOwnerChange={setOwnerFilter}
                onProbabilityChange={setMinimumProbability}
                cityGroups={cityGroups}
                kpis={kpis}
                loading={loading}
                geocoding={geocoding}
                mappedCount={filteredGeocodedOpportunities.length}
                viewMode={viewMode}
                onViewModeChange={handleViewModeChange}
                tamCount={capturedTamData.length}
                capturedTamCount={capturedTamCount}
                tamLoading={tamLoading}
              />
            )}
          </div>
        </aside>

        <section className="min-h-0">
          <GlobeMap
            cityGroups={cityGroups}
            selectedCityId={selectedCity?.id ?? null}
            onCitySelect={handleCitySelect}
            onTamCitySelect={handleTamCitySelect}
            viewMode={viewMode}
            tamData={capturedTamData}
          />
        </section>
      </div>
    </main>
  );
}

interface SidebarHeaderProps {
  hasData: boolean;
  onFileUpload: (file: File) => void;
  onClearData: () => void;
}

function SidebarHeader({
  hasData,
  onFileUpload,
  onClearData,
}: SidebarHeaderProps) {
  return (
    <div className="border-b border-bny-astronaut px-6 py-6">
      <Image
        src="/bny-logo.svg"
        alt="BNY"
        width={240}
        height={69}
        priority
        className="h-auto w-[240px] max-w-full object-contain"
      />
      <div className="mt-6 text-xs font-semibold uppercase tracking-[0.32em] text-bny-teal">
        Stablecoin
      </div>
      <div className="mt-2 text-[11px] font-semibold uppercase tracking-[0.26em] text-white/70">
        Global Stablecoin Pipeline
      </div>
      {hasData && (
        <div className="mt-5 flex gap-2">
          <UploadButton onFileUpload={onFileUpload} compact />
          <button
            type="button"
            onClick={onClearData}
            className="rounded-full border border-white/15 px-4 py-2 text-xs font-semibold text-white/70 transition hover:bg-white/10 hover:text-white"
          >
            Clear Data
          </button>
        </div>
      )}
    </div>
  );
}

interface UploadButtonProps {
  onFileUpload: (file: File) => void;
  compact?: boolean;
}

function UploadButton({ onFileUpload, compact = false }: UploadButtonProps) {
  return (
    <label
      className={`inline-flex cursor-pointer items-center justify-center rounded-full bg-bny-primary font-semibold text-white shadow-lg shadow-black/20 transition hover:bg-bny-teal ${
        compact ? 'px-4 py-2 text-xs' : 'px-6 py-3 text-sm'
      }`}
    >
      Upload New Pipeline
      <input
        type="file"
        accept=".csv,text/csv"
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) {
            onFileUpload(file);
          }
          event.target.value = '';
        }}
      />
    </label>
  );
}

interface UploadEmptyStateProps {
  loading: boolean;
  geocoding: boolean;
  onFileUpload: (file: File) => void;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
}

function UploadEmptyState({
  loading,
  geocoding,
  onFileUpload,
  viewMode,
  onViewModeChange,
}: UploadEmptyStateProps) {
  return (
    <div>
      <ViewModeToggle viewMode={viewMode} onViewModeChange={onViewModeChange} />

      <div className="mt-6 rounded-2xl border border-dashed border-bny-primary/60 bg-bny-surface/70 p-6 text-center">
        <div className="text-xs font-semibold uppercase tracking-[0.28em] text-bny-teal">
          Runtime Data Upload
        </div>
        <h1 className="mt-4 text-2xl font-semibold tracking-tight text-white">
          Upload D365 Pipeline Export (CSV)
        </h1>
        <p className="mt-3 text-sm leading-6 text-white/70">
          This public shell does not store or fetch pipeline data. Select a CSV
          from your machine and it will be parsed in this browser session only.
        </p>
        <div className="mt-6">
          <UploadButton onFileUpload={onFileUpload} />
        </div>
        <div className="mt-5 rounded-xl border border-white/10 bg-bny-navy/40 px-4 py-3 text-xs text-white/60">
          {loading
            ? geocoding
              ? 'Geocoding uploaded opportunities...'
              : 'Parsing CSV...'
            : 'Expected format: Client, Opportunity, Owner, Total Bid Value, Probability, Opportunity Country, Opportunity City, Current Situation, Status, Oppty ID'}
        </div>
      </div>
    </div>
  );
}

interface GlobalViewProps {
  statuses: string[];
  owners: string[];
  statusFilter: string;
  ownerFilter: string;
  minimumProbability: number;
  onStatusChange: (value: string) => void;
  onOwnerChange: (value: string) => void;
  onProbabilityChange: (value: number) => void;
  cityGroups: CityOpportunityGroup[];
  kpis: {
    totalPipelineValue: number;
    activeOpportunities: number;
    highProbabilityValue: number;
  };
  loading: boolean;
  geocoding: boolean;
  mappedCount: number;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  tamCount: number;
  capturedTamCount: number;
  tamLoading: boolean;
}

function GlobalView({
  statuses,
  owners,
  statusFilter,
  ownerFilter,
  minimumProbability,
  onStatusChange,
  onOwnerChange,
  onProbabilityChange,
  cityGroups,
  kpis,
  loading,
  geocoding,
  mappedCount,
  viewMode,
  onViewModeChange,
  tamCount,
  capturedTamCount,
  tamLoading,
}: GlobalViewProps) {
  const whitespaceCount = Math.max(tamCount - capturedTamCount, 0);

  return (
    <div>
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.28em] text-bny-teal">
        <Globe2 className="h-4 w-4" />
        Command Center
      </div>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight">
        Global Pipeline
      </h1>
      <p className="mt-3 text-sm leading-6 text-white/70">
        City markers summarize pipeline concentration. Click a teal marker to
        drill into the opportunities in that market.
      </p>

      <div className="mt-6">
        <ViewModeToggle viewMode={viewMode} onViewModeChange={onViewModeChange} />
      </div>

      <section className="mt-6 space-y-3">
        <FilterSelect
          label="Status"
          value={statusFilter}
          options={statuses}
          onChange={onStatusChange}
        />
        <FilterSelect
          label="Owner"
          value={ownerFilter}
          options={owners}
          onChange={onOwnerChange}
        />
        <div className="rounded-xl border border-bny-astronaut bg-bny-surface px-4 py-3">
          <div className="flex items-center justify-between text-xs uppercase tracking-[0.2em] text-white/55">
            <span>Probability</span>
            <span className="font-mono text-bny-teal">{minimumProbability}%+</span>
          </div>
          <input
            type="range"
            min="0"
            max="100"
            step="5"
            value={minimumProbability}
            onChange={(event) => onProbabilityChange(Number(event.target.value))}
            className="mt-3 w-full accent-bny-primary"
          />
        </div>
      </section>

      <section className="mt-6 grid gap-3">
        <KpiCard
          icon={<DollarSign className="h-5 w-5" />}
          label="Total Pipeline Value"
          value={formatCompactCurrency(kpis.totalPipelineValue)}
          detail={formatCurrency(kpis.totalPipelineValue)}
        />
        <KpiCard
          icon={<BriefcaseBusiness className="h-5 w-5" />}
          label="Active Opportunities"
          value={String(kpis.activeOpportunities)}
          detail={`${mappedCount} mapped opportunities`}
        />
        <KpiCard
          icon={<TrendingUp className="h-5 w-5" />}
          label="High Probability Value"
          value={formatCompactCurrency(kpis.highProbabilityValue)}
          detail={`Probability above ${HIGH_PROBABILITY_THRESHOLD}%`}
        />
      </section>

      <section className="mt-6 rounded-xl border border-bny-astronaut bg-bny-surface p-4">
        <div className="text-xs font-semibold uppercase tracking-[0.24em] text-bny-teal">
          Map Status
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
          <StatusMetric label="Cities" value={String(cityGroups.length)} />
          <StatusMetric
            label={viewMode === 'tam' ? 'Whitespace' : 'Records'}
            value={
              viewMode === 'tam'
                ? tamLoading
                  ? 'Loading'
                  : String(whitespaceCount)
                : loading
                ? 'Loading'
                : geocoding
                  ? 'Geocoding'
                  : String(kpis.activeOpportunities)
            }
          />
        </div>
      </section>
    </div>
  );
}

interface ViewModeToggleProps {
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
}

function ViewModeToggle({ viewMode, onViewModeChange }: ViewModeToggleProps) {
  const options: Array<{ value: ViewMode; label: string }> = [
    { value: 'pipeline', label: 'Active Pipeline' },
    { value: 'tam', label: 'Market Whitespace (TAM)' },
  ];

  return (
    <section className="rounded-xl border border-bny-primary/35 bg-bny-surface p-4">
      <div className="text-xs font-semibold uppercase tracking-[0.24em] text-bny-teal">
        View Mode
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 rounded-full border border-white/10 bg-bny-navy/70 p-1">
        {options.map((option) => {
          const isActive = viewMode === option.value;

          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onViewModeChange(option.value)}
              className={`rounded-full px-3 py-2 text-xs font-bold uppercase tracking-[0.12em] transition ${
                isActive
                  ? 'bg-bny-primary text-white shadow-glow'
                  : 'text-white/55 hover:bg-white/10 hover:text-white'
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </section>
  );
}

interface CityViewProps {
  city: CityOpportunityGroup | null;
  whitespaceCompanies: CapturedTamCompany[];
  viewMode: ViewMode;
  onBack: () => void;
  onOpportunitySelect: (opportunity: GeocodedPipelineOpportunity) => void;
}

function CityView({
  city,
  whitespaceCompanies,
  viewMode,
  onBack,
  onOpportunitySelect,
}: CityViewProps) {
  const firstWhitespaceCompany = whitespaceCompanies[0];
  const locationLabel =
    city?.label ??
    (firstWhitespaceCompany
      ? `${firstWhitespaceCompany.City}, ${firstWhitespaceCompany.Country}`
      : 'Selected Market');
  const pipelineOpportunities = city?.opportunities ?? [];
  const totalBidValue = city?.totalBidValue ?? 0;
  const showSplitView = viewMode === 'tam';

  return (
    <div>
      <BackButton onClick={onBack}>Back to Global Pipeline</BackButton>

      <div className="mt-6">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.28em] text-bny-teal">
          <MapPin className="h-4 w-4" />
          City View
        </div>
        <h2 className="mt-3 text-3xl font-semibold tracking-tight">
          {locationLabel}
        </h2>
        <p className="mt-3 text-sm text-white/70">
          {pipelineOpportunities.length} active opportunities
          {totalBidValue > 0 ? ` totaling ${formatCurrency(totalBidValue)}` : ''}
          {showSplitView
            ? ` and ${whitespaceCompanies.length} whitespace companies.`
            : '.'}
        </p>
      </div>

      <div className="mt-6 space-y-6">
        <section>
          {showSplitView && (
            <SectionHeading
              title="Active Pipeline"
              detail={`${pipelineOpportunities.length} opportunities`}
            />
          )}
          <div className="mt-3 space-y-3">
            {pipelineOpportunities.length === 0 ? (
              <EmptyCitySection message="No active pipeline opportunities in this market." />
            ) : (
              pipelineOpportunities.map((opportunity) => {
          const stageColors = getStageColors(opportunity.Status);

          return (
            <button
              key={opportunity['Oppty ID']}
              type="button"
              onClick={() => onOpportunitySelect(opportunity)}
              className={`w-full rounded-xl border border-l-4 border-bny-astronaut ${stageColors.border} bg-bny-surface p-4 text-left transition hover:border-bny-primary hover:bg-bny-astronaut`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="truncate text-base font-semibold text-white">
                    {opportunity.Opportunity || 'Untitled Opportunity'}
                  </div>
                  <div className="mt-1 truncate text-sm text-white/60">
                    {opportunity.Client} - {opportunity.Owner || 'Unassigned'}
                  </div>
                </div>
                <div
                  className={`shrink-0 rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em] ring-1 ${stageColors.badge}`}
                >
                  {opportunity.Status || 'Unknown'}
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <StatusMetric
                  label="Bid"
                  value={formatCompactCurrency(opportunity['Total Bid Value'])}
                />
                <StatusMetric
                  label="Probability"
                  value={`${opportunity.Probability}%`}
                />
              </div>
            </button>
          );
              })
            )}
          </div>
        </section>

        {showSplitView && (
          <section>
            <SectionHeading
              title="Market Whitespace"
              detail={`${whitespaceCompanies.length} uncaptured companies`}
            />
            <div className="mt-3 space-y-3">
              {whitespaceCompanies.length === 0 ? (
                <EmptyCitySection message="No uncaptured TAM companies in this market." />
              ) : (
                whitespaceCompanies.map((company) => (
                  <WhitespaceCard
                    key={`${company['Company Name']}-${company.locationKey}`}
                    company={company}
                  />
                ))
              )}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

interface SectionHeadingProps {
  title: string;
  detail: string;
}

function SectionHeading({ title, detail }: SectionHeadingProps) {
  return (
    <div className="flex items-center justify-between gap-3">
      <h3 className="text-xs font-bold uppercase tracking-[0.24em] text-white">
        {title}
      </h3>
      <span className="text-xs text-white/50">{detail}</span>
    </div>
  );
}

function EmptyCitySection({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-bny-surface/70 px-4 py-3 text-sm text-white/55">
      {message}
    </div>
  );
}

function WhitespaceCard({ company }: { company: CapturedTamCompany }) {
  return (
    <div className="w-full rounded-xl border border-l-4 border-bny-astronaut border-l-amber-500 bg-bny-surface p-4 text-left shadow-lg shadow-black/10">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="truncate text-base font-semibold text-white">
            {company['Company Name']}
          </div>
          <div className="mt-1 truncate text-sm text-white/60">
            {company.City}, {company.Country}
          </div>
        </div>
        <div className="shrink-0 rounded-full bg-amber-400/15 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-amber-100 ring-1 ring-amber-400/35">
          {formatCompactCurrency(company['Crypto Holdings Value'])}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <StatusMetric
          label="Crypto Holdings"
          value={formatCompactCurrency(company['Crypto Holdings Value'])}
        />
        <StatusMetric label="Status" value="Whitespace" />
      </div>
    </div>
  );
}

interface OpportunityDetailViewProps {
  opportunity: GeocodedPipelineOpportunity;
  city: CityOpportunityGroup | null;
  onBack: () => void;
  onGlobal: () => void;
}

function OpportunityDetailView({
  opportunity,
  city,
  onBack,
  onGlobal,
}: OpportunityDetailViewProps) {
  return (
    <div>
      <div className="flex flex-wrap gap-2">
        <BackButton onClick={onBack}>{city ? 'Back to City' : 'Back'}</BackButton>
        <button
          type="button"
          onClick={onGlobal}
          className="rounded-full border border-white/15 px-4 py-2 text-sm font-semibold text-white/70 transition hover:bg-white/10 hover:text-white"
        >
          Back to Global Pipeline
        </button>
      </div>

      <div className="mt-6">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.28em] text-bny-teal">
          <Building2 className="h-4 w-4" />
          Opportunity Detail
        </div>
        <h2 className="mt-3 text-3xl font-semibold leading-tight tracking-tight">
          {opportunity.Opportunity || 'Untitled Opportunity'}
        </h2>
        <p className="mt-3 text-sm text-white/70">{opportunity.Client}</p>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3">
        <DetailMetric
          label="Total Bid Value"
          value={formatCurrency(opportunity['Total Bid Value'])}
          featured
        />
        <DetailMetric
          label="Probability"
          value={`${opportunity.Probability}%`}
          featured
        />
        <DetailMetric label="Owner" value={opportunity.Owner || 'Unassigned'} />
        <DetailMetric label="Status" value={opportunity.Status || 'Unknown'} />
        <DetailMetric
          label="City"
          value={opportunity['Opportunity City'] || '-'}
        />
        <DetailMetric
          label="Country"
          value={opportunity['Opportunity Country'] || '-'}
        />
        <DetailMetric label="Oppty ID" value={opportunity['Oppty ID'] || '-'} />
      </div>

      <div className="mt-6 rounded-xl border border-bny-astronaut bg-bny-surface p-4">
        <div className="text-xs font-semibold uppercase tracking-[0.24em] text-bny-teal">
          Current Situation
        </div>
        <p className="mt-3 text-sm leading-6 text-white/75">
          {opportunity['Current Situation'] || 'No current situation provided.'}
        </p>
      </div>
    </div>
  );
}

interface BackButtonProps {
  children: React.ReactNode;
  onClick: () => void;
}

function BackButton({ children, onClick }: BackButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-2 rounded-full border border-bny-primary/40 px-4 py-2 text-sm font-semibold text-bny-teal transition hover:bg-bny-primary/15"
    >
      <ArrowLeft className="h-4 w-4" />
      {children}
    </button>
  );
}

interface FilterSelectProps {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}

function FilterSelect({ label, value, options, onChange }: FilterSelectProps) {
  return (
    <label className="block rounded-xl border border-bny-astronaut bg-bny-surface px-4 py-3">
      <span className="text-xs uppercase tracking-[0.2em] text-white/55">
        {label}
      </span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 w-full bg-transparent text-sm font-semibold text-white outline-none"
      >
        <option value="All" className="bg-bny-navy">
          All
        </option>
        {options.map((option) => (
          <option key={option} value={option} className="bg-bny-navy">
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

interface KpiCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  detail: string;
}

function KpiCard({ icon, label, value, detail }: KpiCardProps) {
  return (
    <div className="rounded-xl border border-bny-astronaut bg-bny-surface p-4 shadow-xl shadow-black/20">
      <div className="flex items-center justify-between">
        <div className="rounded-xl border border-bny-primary/35 bg-bny-primary/15 p-3 text-bny-teal">
          {icon}
        </div>
        <div className="text-xs uppercase tracking-[0.24em] text-white/35">
          KPI
        </div>
      </div>
      <div className="mt-4 text-xs uppercase tracking-[0.2em] text-white/55">
        {label}
      </div>
      <div className="mt-2 text-2xl font-semibold tracking-tight text-white">
        {value}
      </div>
      <div className="mt-2 font-mono text-xs text-bny-teal">{detail}</div>
    </div>
  );
}

interface StatusMetricProps {
  label: string;
  value: string;
}

function StatusMetric({ label, value }: StatusMetricProps) {
  return (
    <div className="min-w-0 rounded-lg border border-white/10 bg-bny-navy/35 px-3 py-2">
      <div className="text-[10px] uppercase tracking-[0.18em] text-white/45">
        {label}
      </div>
      <div className="mt-1 truncate text-xs font-semibold text-white">
        {value || '-'}
      </div>
    </div>
  );
}

interface DetailMetricProps {
  label: string;
  value: string;
  featured?: boolean;
}

function DetailMetric({ label, value, featured = false }: DetailMetricProps) {
  return (
    <div
      className={`rounded-xl border p-3 ${
        featured
          ? 'border-bny-primary/40 bg-bny-primary/15'
          : 'border-bny-astronaut bg-bny-surface'
      }`}
    >
      <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/45">
        {label}
      </div>
      <div className="mt-2 truncate text-sm font-semibold text-white">{value}</div>
    </div>
  );
}
