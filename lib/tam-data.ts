import Papa from 'papaparse';
import { TamCompany } from '@/types';

const TAM_CSV_PATH = '/data/tam_top_150.csv';

type TamCsvRow = Record<keyof TamCompany, string | number | undefined>;

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

const toTamCompany = (row: TamCsvRow): TamCompany => ({
  'Company Name': asText(row['Company Name']),
  City: asText(row.City),
  Country: asText(row.Country),
  'Crypto Holdings Value': parseNumber(row['Crypto Holdings Value']),
});

export async function fetchTamCompanies(): Promise<TamCompany[]> {
  const response = await fetch(encodeURI(TAM_CSV_PATH), {
    cache: 'force-cache',
  });

  if (!response.ok) {
    return [];
  }

  const csv = await response.text();
  const parsed = Papa.parse<TamCsvRow>(csv, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header) => header.trim(),
  });

  if (parsed.errors.length > 0) {
    throw new Error(parsed.errors[0].message);
  }

  return parsed.data
    .map(toTamCompany)
    .filter((company) => company['Company Name'] && company.City && company.Country);
}
