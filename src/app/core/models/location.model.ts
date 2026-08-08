export interface Country {
  id: string;
  name: string;
  iso2: string;
  iso3?: string;
  phonecode: string;
  emoji: string;
}

export interface State {
  id: string;
  name: string;
  countryId: string;
}

export interface City {
  id: string;
  name: string;
  stateId?: string;
  /** Only present when the row was fetched with its state embedded (branch / seller listings). */
  state?: { id: string; name: string };
}

/** Where a city sits in the catalog — used to preselect the combos when editing. */
export interface CityLocation {
  cityId: string;
  stateId: string;
  countryId: string;
}
