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
  /** Customer support contact (single place to change). */
  supportEmail: 'support@chatloora.com',
  /** Privacy / data-protection requests (single place to change). */
  privacyEmail: 'support@chatloora.com',
} as const;

export const SUPPORT_EMAIL = COMPANY_LEGAL.supportEmail;
export const PRIVACY_EMAIL = COMPANY_LEGAL.privacyEmail;

/** Public legal pages (no auth). */
export const LEGAL_ROUTES = {
  privacy: '/privacy',
  terms: '/terms',
  accountDeletion: '/account-deletion',
} as const;

export const LEGAL_LAST_UPDATED = '2026-10-27';

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
    email: COMPANY_LEGAL.supportEmail,
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
