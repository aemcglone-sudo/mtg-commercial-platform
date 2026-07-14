export interface ShopSite {
  shop: {
    id: string;
    name: string;
    slug: string;
    siteStatus: string;
    template: string;
    themePrimaryHex: string;
    themeAccentHex: string;
    themeMode: string;
    fontPairing: string;
    aboutText: string | null;
    address: string;
    phone: string | null;
    email: string | null;
    websiteUrl: string | null;
    logoUrl: string | null;
    bannerUrl: string | null;
    hours: Record<string, string> | null;
    specialties: string[];
    socialLinks: Record<string, string>;
    lat: number | null;
    lng: number | null;
  };
  sections: {
    id: string;
    type: string;
    visible: boolean;
    sortOrder: number;
    config: Record<string, unknown>;
  }[];
  products: {
    id: string;
    name: string;
    category: string;
    imageUrl: string | null;
    priceCents: number;
    quantity: number;
    notes: string | null;
  }[];
  inventory: {
    id: string;
    scryfallId: string;
    cardName: string;
    condition: string;
    foil: boolean;
    priceCents: number;
    quantity: number;
    imageUrl: string | null;
  }[];
  events: {
    id: string;
    title: string;
    description: string | null;
    eventType: string | null;
    startsAt: string;
    endsAt: string | null;
    isRecurring: boolean;
    recurrenceRule: string | null;
  }[];
  gallery: {
    id: string;
    imageUrl: string;
    thumbnailUrl: string;
    caption: string | null;
    displayOrder: number;
  }[];
}
