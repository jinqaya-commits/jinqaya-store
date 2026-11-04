export const categories = [
  { slug: "walk-travel", number: "01", name: "WALK & TRAVEL", description: "Thoughtful essentials for walks, outings and adventures." },
  { slug: "home-comfort", number: "02", name: "HOME & COMFORT", description: "Comfort-minded pieces for the spaces you share." },
  { slug: "play-discover", number: "03", name: "PLAY & DISCOVER", description: "Inviting ways to play, explore and stay curious." },
  { slug: "care-grooming", number: "04", name: "CARE & GROOMING", description: "Considered essentials for everyday care routines." },
  { slug: "style-accessories", number: "05", name: "STYLE & ACCESSORIES", description: "Finishing touches for life with cats and dogs." },
  { slug: "smart-living", number: "06", name: "SMART LIVING", description: "Useful ideas for a more thoughtful daily routine." },
] as const;

export function getCategory(slug: string) {
  return categories.find((category) => category.slug === slug);
}
