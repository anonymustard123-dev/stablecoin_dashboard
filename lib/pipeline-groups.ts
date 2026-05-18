import {
  CityOpportunityGroup,
  GeocodedPipelineOpportunity,
} from '@/types';

const normalizeGroupKey = (city: string, country: string): string =>
  [city.trim(), country.trim()]
    .filter(Boolean)
    .join('|')
    .toLowerCase()
    .replace(/\s+/g, ' ');

export function groupOpportunitiesByCity(
  opportunities: GeocodedPipelineOpportunity[]
): CityOpportunityGroup[] {
  const groups = opportunities.reduce((acc, opportunity) => {
    const city = opportunity['Opportunity City'] || 'Unknown City';
    const country = opportunity['Opportunity Country'] || 'Unknown Country';
    const id = normalizeGroupKey(city, country);
    const group = acc.get(id) ?? {
      id,
      city,
      country,
      label: `${city}, ${country}`,
      latitude: opportunity.latitude,
      longitude: opportunity.longitude,
      opportunities: [],
      totalBidValue: 0,
      averageProbability: 0,
    };

    group.opportunities.push(opportunity);
    group.totalBidValue += opportunity['Total Bid Value'];
    group.averageProbability =
      group.opportunities.reduce((sum, item) => sum + item.Probability, 0) /
      group.opportunities.length;
    acc.set(id, group);

    return acc;
  }, new Map<string, CityOpportunityGroup>());

  return Array.from(groups.values()).sort(
    (a, b) => b.totalBidValue - a.totalBidValue
  );
}
