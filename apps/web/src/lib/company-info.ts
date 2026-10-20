/** Public legal entity details for Meta / business verification. */
export const COMPANY_LEGAL = {
  legalName: 'Mey Architects, PC',
  tradeName: 'ChatLoora',
  entityType: 'Professional Corporation (PC)',
  ein: '82-0346631',
  dateOfIncorporation: '2001-05-26',
  dateOfIncorporationDisplay: 'May 26, 2001',
  address: {
    street: '1420 Glascor Ave',
    city: 'Juneau',
    state: 'AK',
    postalCode: '99801',
    country: 'United States',
    countryCode: 'US',
  },
  officerTitle: 'President',
} as const;

export function companyFullAddress() {
  const { street, city, state, postalCode, country } = COMPANY_LEGAL.address;
  return `${street}, ${city}, ${state} ${postalCode}, ${country}`;
}

export function companyJsonLd(baseUrl: string) {
  const { legalName, tradeName, ein, dateOfIncorporation, address } = COMPANY_LEGAL;
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: legalName,
    legalName,
    alternateName: tradeName,
    url: baseUrl,
    taxID: ein,
    foundingDate: dateOfIncorporation,
    address: {
      '@type': 'PostalAddress',
      streetAddress: address.street,
      addressLocality: address.city,
      addressRegion: address.state,
      postalCode: address.postalCode,
      addressCountry: address.countryCode,
    },
  };
}
