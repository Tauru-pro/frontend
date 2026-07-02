export interface State {
  id: string;
  name: string;
  countryId?: string;
}

export interface City {
  id: string;
  name: string;
  state: { id: string; name: string };
}
