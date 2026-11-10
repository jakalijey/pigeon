/** A Nimiq address in user-friendly format, for example "NQ44 XGY3 ...". */
export type NimAddress = string;

export interface NimNamesOptions {
  /** Your own .nim name (needed for login and sub-names). */
  app?: string | null;
  /** Pigeon server URL. */
  pigeon?: string;
  /** Hive server URL. */
  hive?: string;
  /** Cache time for name lookups in milliseconds (default 60000). */
  cacheMs?: number;
  /** Registry address. Fixed in code so no server answer can redirect a payment. */
  registry?: NimAddress;
}

export interface ResolvedName {
  name: string;
  address: NimAddress;
}

export interface NamePrice {
  free: boolean;
  /** Price in NIM, present when the name is free. */
  price?: number;
}

export interface LoginResult {
  address: NimAddress;
  name: string | null;
  /** Session key for your app. */
  key: string;
}

export interface NameLabel {
  /** The user's own part, for example "mert". */
  own: string;
  /** The parent name for a sub-name, for example "sunset.nim", else null. */
  parent: string | null;
  /** The full name, for example "mert.sunset.nim". */
  full: string;
}

export interface BadgeOptions {
  /** Your own text from the label. */
  format?: (label: NameLabel) => string;
  className?: string;
  /** false hides the parent name. */
  small?: boolean;
}

export interface NimNamesClient {
  /** Name or sub-name to address. null when the name is not registered. */
  resolve(name: string): Promise<ResolvedName | null>;
  /** The primary name of an address (also the owner of a Nimiq Pay vault), or null. */
  nameOf(address: NimAddress): Promise<string | null>;
  /** Whether a name is free and its price in NIM. */
  price(name: string): Promise<NamePrice>;
  /** Asks the wallet to sign a one-time message for your app. */
  login(): Promise<LoginResult>;
  /** Sends NIM to a name or an address from the user's wallet. The note is cut to 64 bytes. */
  pay(to: string, amountNim: number, note?: string): Promise<unknown>;
  label(name: string): NameLabel;
  /** Writes the name of the address into the element. */
  badge(el: Element, address: NimAddress, options?: BadgeOptions): Promise<void>;
  /** The player's own .nim name and their sub-name under app, if any. */
  names(address: NimAddress): Promise<{ own: string | null; sub: string | null }>;
  /** The name the address shows now and every name it owns. */
  allNames(address: NimAddress): Promise<{ main: string | null; names: string[] }>;
  /** The owner chooses which of their names shows for their address (1 luna to the registry). */
  setMainName(name: string): Promise<unknown>;
  /** true when the owner of app lets players claim their own sub-name. */
  subsOpen(): Promise<boolean>;
  /** The player takes sub.app for their own wallet (only while sub-names are open). */
  claimSub(sub: string): Promise<unknown>;
  /** The owner of app gives sub.app to an address or a name.nim. */
  giveSub(sub: string, to: string): Promise<unknown>;
  /** The wallet provider, or null if there is none. */
  wallet(): Promise<unknown | null>;
}

export function NimNames(options?: NimNamesOptions): NimNamesClient;
