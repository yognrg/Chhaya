import { ICONS } from "../icons/icons.generated";

/**
 * Line icons from Lucide (ISC), drawn on a 24 grid at a 1.5 stroke.
 * The set lives in src/chhaya/icons: map.json picks a Lucide icon for each
 * name, and `npm run icons` regenerates icons.generated.ts.
 */
export type IconName = keyof typeof ICONS;

export const STROKE = 1.5;

export function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  return (
    <svg
      className="ch-icon"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={STROKE}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      dangerouslySetInnerHTML={{ __html: ICONS[name] }}
    />
  );
}
