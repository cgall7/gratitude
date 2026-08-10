// Security-audit follow-up (2026-08-10): we collect emails + private
// journal entries with no privacy policy or ToS anywhere in the app.
// This is the in-app scaffold — Deezine drafts the real legal copy below,
// Colin/Sage confirm the Supabase project region for the data-residency
// line. Until that lands, LAST_UPDATED and both bodies are clearly marked
// placeholder so nobody mistakes them for reviewed legal text.
export const LEGAL_LAST_UPDATED = 'TODO — set on first real draft';

export const PRIVACY_POLICY = {
  title: 'Privacy Policy',
  sections: [
    {
      heading: 'TODO — Deezine to draft',
      body:
        'Placeholder only. Needs: what we collect (email, journal entries, ' +
        'display name, optional avatar, hashed phone number for contact ' +
        'discovery), why, who can see shared entries (accepted honeycomb ' +
        'connections only), where data is hosted (Supabase project region — ' +
        'TBD, confirm before publishing), retention, and how to request deletion.',
    },
  ],
};

export const TERMS_OF_SERVICE = {
  title: 'Terms of Service',
  sections: [
    {
      heading: 'TODO — Deezine to draft',
      body:
        'Placeholder only. Needs: acceptable use, account termination, ' +
        'content ownership (users own their journal entries), and liability terms.',
    },
  ],
};
