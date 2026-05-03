export interface State {
  id: string;
  name: string;
}

export interface City {
  id: string;
  name: string;
  state: State;
}
