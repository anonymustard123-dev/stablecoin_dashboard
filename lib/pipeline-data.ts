import Papa from 'papaparse';
import { PipelineOpportunity } from '@/types';

type PipelineCsvRow = Record<keyof PipelineOpportunity, string | number | undefined>;

const parseNumber = (value: string | number | undefined): number => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }

  if (!value) {
    return 0;
  }

  const normalized = value.replace(/[$,%\s,]/g, '');
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
};

const asText = (value: string | number | undefined): string =>
  typeof value === 'number' ? String(value) : value?.trim() ?? '';

const toPipelineOpportunity = (row: PipelineCsvRow): PipelineOpportunity => ({
  Client: asText(row.Client),
  Opportunity: asText(row.Opportunity),
  Owner: asText(row.Owner),
  'Total Bid Value': parseNumber(row['Total Bid Value']),
  Probability: parseNumber(row.Probability),
  'Opportunity Country': asText(row['Opportunity Country']),
  'Opportunity City': asText(row['Opportunity City']),
  'Current Situation': asText(row['Current Situation']),
  Status: asText(row.Status),
  'Oppty ID': asText(row['Oppty ID']),
});

export function parsePipelineCsvFile(file: File): Promise<PipelineOpportunity[]> {
  return new Promise((resolve, reject) => {
    Papa.parse<PipelineCsvRow>(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => header.trim(),
      complete: (results) => {
        if (results.errors.length > 0) {
          reject(new Error(results.errors[0].message));
          return;
        }

        resolve(
          results.data
            .map(toPipelineOpportunity)
            .filter((opportunity) => opportunity.Client || opportunity.Opportunity)
        );
      },
      error: (error) => {
        reject(error);
      },
    });
  });
}
