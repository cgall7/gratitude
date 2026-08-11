// Privacy Policy + Terms of Service copy, drafted 2026-08-11 (Deezine).
//
// This replaces the `TODO — Deezine to draft` scaffold. It is plain-language
// copy written against what the app ACTUALLY does, verified in the schema and
// the client, not against the feature list we intended to build. Two things
// the scaffold's brief asked for are deliberately NOT in here because they do
// not happen:
//
//   * Phone numbers / contact discovery. `profiles.phone_hash` exists in
//     20260808000001 but has zero writers anywhere in src/ — real discovery is
//     an exact email match through `find_connectable_profile`. The app never
//     asks for contacts. Disclosing phone collection would be false.
//   * Avatar photo uploads. The `avatars` bucket exists (20260809000001) but
//     nothing in src/ uploads to it; Avatar.js only renders a URL if one is
//     present. No user can produce one today.
//
// Both are dead schema. If either is ever wired up, this file changes in the
// same commit — a privacy policy that lags the code is the failure mode here.
//
// NOT LEGAL ADVICE and not lawyer-reviewed. This is honest, specific,
// user-readable copy that describes real behaviour; it still wants a lawyer's
// pass before launch, particularly the liability and governing-law terms.
//
// Fill the four constants below to publish. `LEGAL_COPY_READY` is derived from
// them rather than hand-maintained, so the signup consent gate can key off
// something that cannot drift out of sync with the copy — see Onboarding's
// `agreedToTerms`, which must not require agreement to an unpublished document.

// --- The four things that must be filled before publishing ------------------
// Set each to a real value. This object is the only place to edit; everything
// below derives from it.
const FILL = {
  LEGAL_ENTITY: null, // 'Gratitude', or the registered company name
  CONTACT_EMAIL: null, // privacy requests + deletion + content removal
  HOSTING_REGION: null, // Supabase region for project vrpwodqtksjvirdvrqkv
  EFFECTIVE_DATE: null, // e.g. '11 August 2026'
};

// The Legal screen is allowed to ship before this copy is final, so an unfilled
// value has to read as a sentence rather than as developer debris — a user who
// opens the page early should see an honest gap, not the word TODO.
const PLACEHOLDER_TEXT = {
  LEGAL_ENTITY: '[the publisher of this app — to be named before launch]',
  CONTACT_EMAIL: '[our contact address — to be published before launch]',
  HOSTING_REGION: '[a region we will name here before launch]',
  EFFECTIVE_DATE: 'Draft — not yet published',
};

const filled = (key) => FILL[key] ?? PLACEHOLDER_TEXT[key];

const LEGAL_ENTITY = filled('LEGAL_ENTITY');
const CONTACT_EMAIL = filled('CONTACT_EMAIL');
const HOSTING_REGION = filled('HOSTING_REGION');

export const LEGAL_PLACEHOLDERS = FILL;

// True only once every value above is set. Gate the signup consent checkbox on
// this: requiring someone to affirmatively agree to a document that is still
// marked draft is worse than having no checkbox at all. Deriving the flag from
// FILL rather than maintaining it by hand means the gate cannot drift out of
// sync with the copy it is gating.
export const LEGAL_COPY_READY = Object.values(FILL).every((value) => value !== null);

export const LEGAL_LAST_UPDATED = filled('EFFECTIVE_DATE');

export const PRIVACY_POLICY = {
  title: 'Privacy Policy',
  sections: [
    {
      heading: 'The short version',
      body:
        'What you write stays on your phone. We never receive an entry unless you tap Share, and when you do, only the people you have accepted into your honeycomb can read it.\n\n' +
        'There are no ads in this app. There is no analytics, crash-reporting or tracking code in it either — nothing here reports what you do back to us or to anyone else. We do not sell or share anything about you.\n\n' +
        'The rest of this page is the same thing said precisely.',
    },
    {
      heading: 'What we collect',
      body:
        'When you make an account we collect your email address, a password, and the display name you choose.\n\n' +
        'Your password is handled by our authentication provider and stored only as a cryptographic hash. We cannot read it, and neither can anyone who works on this app.\n\n' +
        'We do not ask for your phone number, and the app never requests access to your contacts, camera roll, location or microphone.',
    },
    {
      heading: 'Your journal entries',
      body:
        'Entries you write are saved in the app\'s own storage on your device. They are not uploaded to us, not backed up by us, and not readable by us.\n\n' +
        'The honest consequence: because we hold no copy, we cannot restore your entries. If you delete the app, or lose the phone, unshared entries are gone. Keep your own copy of anything you would be sorry to lose.',
    },
    {
      heading: 'When you share an entry',
      body:
        'Tapping Share is the one action that sends an entry to our servers. It sends the text of that single entry and the date you wrote it.\n\n' +
        'A shared entry can be read by you and by the people whose honeycomb connection you have accepted. Nobody else. That limit is enforced by the database itself, so a bug in the app cannot widen it.\n\n' +
        'Please know: there is currently no way to un-share an entry from inside the app. Until we add one, treat sharing as final. If you need something taken down, email us and we will remove it by hand.',
    },
    {
      heading: 'Finding people',
      body:
        'People are found by exact email address. If you search for one, you are told only whether an account exists and, if it does, that person\'s display name — nothing more.\n\n' +
        'There is no way to browse, list or search users generally, and a near-miss on an email returns nothing. We do this so the app cannot be used to work out who is on it.',
    },
    {
      heading: 'Likes and comments',
      body:
        'If you like or comment on a shared entry, we store that — the comment text, who wrote it, and when. Anyone who can already see that shared entry can see the likes and comments on it.',
    },
    {
      heading: 'What we do not do',
      body:
        'We do not show advertising. We do not include analytics, attribution or crash-reporting tools. We do not sell your information, share it with data brokers, or hand it to anyone for their own marketing.\n\n' +
        'We do not read your entries and we do not use them to train machine-learning models.\n\n' +
        'We would disclose information if the law genuinely required it of us, and we would tell you unless we were forbidden from doing so.',
    },
    {
      heading: 'Where your information is kept',
      body:
        `Accounts, shared entries, comments and connections are stored with our hosting provider, Supabase, in ${HOSTING_REGION}. They hold this data on our behalf and do not use it for their own purposes.\n\n` +
        'Unshared entries are not covered by any of this, because they never leave your phone.',
    },
    {
      heading: 'How long we keep it',
      body:
        'Shared entries, comments and likes are kept until you or we remove them. Account details are kept while your account exists.\n\n' +
        'When an account is deleted, the entries, shares, comments, likes and connections attached to it are deleted with it.',
    },
    {
      heading: 'Getting your data, or deleting it',
      body:
        `You can ask us for a copy of what we hold about you, ask us to correct it, or ask us to delete your account entirely. Email ${CONTACT_EMAIL} from the address on your account and we will act within 30 days.\n\n` +
        'We have not built these controls into the app yet, which is why this is an email rather than a button. That is a gap we intend to close.\n\n' +
        'Entries you never shared are not ours to delete — removing the app removes them.',
    },
    {
      heading: 'Children',
      body:
        'This app is not intended for children under 13, and we do not knowingly create accounts for them. If you believe a child has made an account, email us and we will remove it.',
    },
    {
      heading: 'Changes to this policy',
      body:
        `If we change how any of this works, we will change this page and the date at the top of it. For anything that meaningfully affects your privacy, we will tell you in the app rather than expecting you to re-read this.\n\n` +
        `Questions about any of it: ${CONTACT_EMAIL}.`,
    },
  ],
};

export const TERMS_OF_SERVICE = {
  title: 'Terms of Service',
  sections: [
    {
      heading: 'The short version',
      body:
        'Be decent to the people in your honeycomb. What you write belongs to you. This is young software, so please keep your own copy of anything precious.',
    },
    {
      heading: 'Using the app',
      body:
        `These terms are an agreement between you and ${LEGAL_ENTITY}. Using the app means you accept them.\n\n` +
        'You need to be at least 13 years old. Give us an email address that is really yours, keep your password to yourself, and understand that what happens under your account is your responsibility.',
    },
    {
      heading: 'Your writing is yours',
      body:
        'You own everything you write here. We claim no ownership of it.\n\n' +
        'When you share an entry, you give us permission to store it and show it to the honeycomb connections you chose — and nothing beyond that. We will not publish it, sell it, use it in marketing, or show it to anyone you did not share it with. That permission ends when the entry is removed.',
    },
    {
      heading: 'What other people share with you',
      body:
        'Entries in your honeycomb were written by someone who chose to show them to you specifically. Do not screenshot, repost, or repeat them elsewhere. Treat them the way you would something said to you in confidence.',
    },
    {
      heading: 'Things you agree not to do',
      body:
        'Do not harass, threaten or abuse anyone. Do not post anything unlawful, or anything you do not have the right to post. Do not post other people\'s private information. Do not pretend to be someone else.\n\n' +
        'Do not attempt to break, probe or work around the app\'s security, access accounts or entries that are not yours, or collect data from the service automatically.',
    },
    {
      heading: 'When we step in',
      body:
        'If content or an account breaks these terms, we may remove the content or suspend the account. We will tell you why where we are able to. Serious cases — anything unlawful, or a real risk to someone — may mean immediate removal without warning.',
    },
    {
      heading: 'This is early software',
      body:
        'The app is provided as it is. We do not promise it will always be available, always work correctly, or never lose data. Features may change or disappear.\n\n' +
        'Because unshared entries live only on your phone and we hold no copy, we cannot recover them for you.',
    },
    {
      heading: 'Limits of our responsibility',
      body:
        'To the fullest extent the law allows, we are not liable for indirect or consequential losses, for lost data, or for lost profits arising from your use of the app.\n\n' +
        'Nothing here limits any liability that cannot lawfully be limited.',
    },
    {
      heading: 'Ending your account',
      body:
        `You can stop using the app whenever you like. To have your account and its data deleted, email ${CONTACT_EMAIL}.\n\n` +
        'We may end an account that seriously or repeatedly breaks these terms.',
    },
    {
      heading: 'Changes to these terms',
      body:
        `We will post any changes here and update the date at the top. If a change is significant, we will tell you in the app.\n\n` +
        `Questions: ${CONTACT_EMAIL}.`,
    },
  ],
};
