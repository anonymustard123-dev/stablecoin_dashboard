export interface PipelineOpportunity {
  Client: string;
  Opportunity: string;
  Owner: string;
  'Total Bid Value': number;
  Probability: number;
  'Opportunity Country': string;
  'Opportunity City': string;
  'Current Situation': string;
  Status: string;
  'Oppty ID': string;
}

export interface GeocodedPipelineOpportunity extends PipelineOpportunity {
  latitude: number;
  longitude: number;
  locationKey: string;
}

export interface CityOpportunityGroup {
  id: string;
  city: string;
  country: string;
  label: string;
  latitude: number;
  longitude: number;
  opportunities: GeocodedPipelineOpportunity[];
  totalBidValue: number;
  averageProbability: number;
}

export interface TamCompany {
  'Company Name': string;
  City: string;
  Country: string;
  'Crypto Holdings Value': number;
}

export interface GeocodedTamCompany extends TamCompany {
  latitude: number;
  longitude: number;
  locationKey: string;
}

export interface CapturedTamCompany extends GeocodedTamCompany {
  isCaptured: boolean;
}
