export interface ModelBibleFieldDef {
  path: string;
  label: string;
  category: string;
  type: 'string' | 'string[]' | 'boolean';
}

export const CATEGORY_ORDER = [
  'Basic Info',
  'Identity',
  'Backstory',
  'Personality',
  'Content',
  'Boundaries',
  'Restrictions',
  'Communication',
  'Platforms',
  'Clothing Sizes',
  'Notes',
] as const;

export const MODEL_BIBLE_FIELDS: ModelBibleFieldDef[] = [
  // Basic Info (Overview → Basic Info card)
  { path: 'birthday', label: 'Birthday', category: 'Basic Info', type: 'string' },
  { path: 'height', label: 'Height', category: 'Basic Info', type: 'string' },
  { path: 'weight', label: 'Weight', category: 'Basic Info', type: 'string' },
  { path: 'ethnicity', label: 'Ethnicity', category: 'Basic Info', type: 'string' },
  { path: 'timezone', label: 'Timezone', category: 'Basic Info', type: 'string' },
  { path: 'location', label: 'Location', category: 'Basic Info', type: 'string' },
  { path: 'city', label: 'City', category: 'Basic Info', type: 'string' },
  { path: 'nationality', label: 'Nationality', category: 'Basic Info', type: 'string' },
  { path: 'hair', label: 'Hair', category: 'Basic Info', type: 'string' },
  { path: 'eyes', label: 'Eyes', category: 'Basic Info', type: 'string' },
  { path: 'bodyType', label: 'Body Type', category: 'Basic Info', type: 'string' },
  { path: 'tattoosPiercings', label: 'Tattoos & Piercings', category: 'Basic Info', type: 'string' },

  // Identity (Overview → Contact & Identity card)
  { path: 'fullName', label: 'Full Name', category: 'Identity', type: 'string' },
  { path: 'contactEmail', label: 'Contact Email', category: 'Identity', type: 'string' },
  { path: 'preferredEmail', label: 'Preferred Email', category: 'Identity', type: 'string' },
  { path: 'birthplace', label: 'Birthplace', category: 'Identity', type: 'string' },
  { path: 'occupation', label: 'Occupation', category: 'Identity', type: 'string' },
  { path: 'relationshipStatus', label: 'Relationship Status', category: 'Identity', type: 'string' },

  // Backstory (Overview → Persona card)
  { path: 'backstory', label: 'Backstory', category: 'Backstory', type: 'string' },
  { path: 'family', label: 'Family', category: 'Backstory', type: 'string' },
  { path: 'pets', label: 'Pets', category: 'Backstory', type: 'string' },
  { path: 'education', label: 'Education', category: 'Backstory', type: 'string' },
  { path: 'pastJobs', label: 'Past Jobs', category: 'Backstory', type: 'string' },
  { path: 'contentCreationOrigin', label: 'Content Creation Origin', category: 'Backstory', type: 'string' },
  { path: 'livingSituation', label: 'Living Situation', category: 'Backstory', type: 'string' },

  // Personality (Overview → Persona card)
  { path: 'coreTraits', label: 'Core Traits', category: 'Personality', type: 'string[]' },
  { path: 'personalityDescription', label: 'Personality Description', category: 'Personality', type: 'string' },
  { path: 'personalityInsight', label: 'Personality Insight', category: 'Personality', type: 'string' },
  { path: 'morningVibe', label: 'Morning Vibe', category: 'Personality', type: 'string' },
  { path: 'afternoonVibe', label: 'Afternoon Vibe', category: 'Personality', type: 'string' },
  { path: 'nightVibe', label: 'Night Vibe', category: 'Personality', type: 'string' },
  { path: 'interests', label: 'Interests', category: 'Personality', type: 'string[]' },
  { path: 'favoriteColors', label: 'Favorite Colors', category: 'Personality', type: 'string[]' },
  { path: 'lingoKeywords', label: 'Lingo Keywords', category: 'Personality', type: 'string[]' },
  { path: 'preferredEmojis', label: 'Preferred Emojis', category: 'Personality', type: 'string[]' },

  // Content (Overview → Content card)
  { path: 'primaryNiche', label: 'Primary Niche', category: 'Content', type: 'string' },
  { path: 'feedAesthetic', label: 'Feed Aesthetic', category: 'Content', type: 'string' },
  { path: 'commonThemes', label: 'Common Themes', category: 'Content', type: 'string' },
  { path: 'signatureLook', label: 'Signature Look', category: 'Content', type: 'string' },
  { path: 'uniqueHook', label: 'Unique Hook', category: 'Content', type: 'string' },
  { path: 'signatureVisualLook', label: 'Signature Visual Look', category: 'Content', type: 'string' },
  { path: 'explicitContentOk', label: 'Explicit Content OK', category: 'Content', type: 'boolean' },

  // Boundaries (Content & Restrictions tab)
  { path: 'willDo', label: 'Will Do', category: 'Boundaries', type: 'string[]' },
  { path: 'wontDo', label: "Won't Do", category: 'Boundaries', type: 'string[]' },
  { path: 'maybeOrPremium', label: 'Maybe / Premium', category: 'Boundaries', type: 'string[]' },

  // Restrictions (Content & Restrictions tab)
  { path: 'restrictions.contentLimitations', label: 'Content Limitations', category: 'Restrictions', type: 'string' },
  { path: 'restrictions.wallRestrictions', label: 'Wall Restrictions', category: 'Restrictions', type: 'string' },
  { path: 'restrictions.mmExclusions', label: 'Mass Message Exclusions', category: 'Restrictions', type: 'string' },
  { path: 'restrictions.wordingToAvoid', label: 'Wording to Avoid', category: 'Restrictions', type: 'string[]' },
  { path: 'restrictions.customsToAvoid', label: 'Customs to Avoid', category: 'Restrictions', type: 'string' },

  // Communication
  { path: 'tone', label: 'Tone', category: 'Communication', type: 'string' },
  { path: 'messageLength', label: 'Message Length', category: 'Communication', type: 'string' },
  { path: 'signaturePhrases', label: 'Signature Phrases', category: 'Communication', type: 'string[]' },

  // Platforms (Overview → Platforms card)
  { path: 'platforms.onlyFansFree', label: 'OnlyFans Free', category: 'Platforms', type: 'string' },
  { path: 'platforms.onlyFansPaid', label: 'OnlyFans Paid', category: 'Platforms', type: 'string' },
  { path: 'platforms.oftv', label: 'OFTV', category: 'Platforms', type: 'string' },
  { path: 'platforms.fansly', label: 'Fansly', category: 'Platforms', type: 'string' },

  // Clothing Sizes (Overview → Basic Info card)
  { path: 'clothingSizes.bra', label: 'Bra Size', category: 'Clothing Sizes', type: 'string' },
  { path: 'clothingSizes.top', label: 'Top Size', category: 'Clothing Sizes', type: 'string' },
  { path: 'clothingSizes.bottom', label: 'Bottom Size', category: 'Clothing Sizes', type: 'string' },
  { path: 'clothingSizes.shoes', label: 'Shoe Size', category: 'Clothing Sizes', type: 'string' },

  // Notes
  { path: 'internalNotes', label: 'Internal Notes', category: 'Notes', type: 'string' },
  { path: 'captionOperatorNotes', label: 'Caption Operator Notes', category: 'Notes', type: 'string' },
];

export function getFieldsByCategory(): Record<string, ModelBibleFieldDef[]> {
  const grouped: Record<string, ModelBibleFieldDef[]> = {};
  for (const cat of CATEGORY_ORDER) {
    grouped[cat] = [];
  }
  for (const field of MODEL_BIBLE_FIELDS) {
    if (!grouped[field.category]) {
      grouped[field.category] = [];
    }
    grouped[field.category].push(field);
  }
  return grouped;
}

export const VALID_PATHS = new Set(MODEL_BIBLE_FIELDS.map((f) => f.path));
