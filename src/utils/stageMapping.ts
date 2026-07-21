/**
 * Stage mapping utilities for converting between DB display strings
 * and Rill language Stage union constructors.
 *
 * DB stores display strings with spaces (e.g., "Phone Screen")
 * Rill constructors use CamelCase without spaces (e.g., "PhoneScreen")
 */

// Mapping from DB display string to Rill constructor tag
const displayStringToTag: Record<string, string> = {
  'Research': 'Research',
  'Applied': 'Applied',
  'Phone Screen': 'PhoneScreen',
  'Interview': 'Interview',
  'Offer': 'Offer',
  'Rejected': 'Rejected',
};

// Reverse mapping from constructor tag to display string
const tagToDisplayString: Record<string, string> = {
  'Research': 'Research',
  'Applied': 'Applied',
  'PhoneScreen': 'Phone Screen',
  'Interview': 'Interview',
  'Offer': 'Offer',
  'Rejected': 'Rejected',
};

/**
 * Convert a DB stage display string to a Rill Stage tag object
 * Example: "Phone Screen" → { tag: "PhoneScreen" }
 */
export function stageToTag(displayString: string): Record<string, string> {
  const tag = displayStringToTag[displayString];
  if (!tag) {
    throw new Error(`Unknown stage: ${displayString}`);
  }
  return { tag };
}

/**
 * Convert a Rill Stage tag object back to a DB display string
 * Example: { tag: "PhoneScreen" } → "Phone Screen"
 */
export function tagToStageString(tagObj: Record<string, string>): string {
  const tag = tagObj.tag;
  const displayString = tagToDisplayString[tag];
  if (!displayString) {
    throw new Error(`Unknown stage tag: ${tag}`);
  }
  return displayString;
}
