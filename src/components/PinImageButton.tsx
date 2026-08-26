/**
 * PinImageButton – Runder, roter Pinterest-"Pin"-Button
 *
 * Overlay-Button (weißes "P" auf Pinterest-Rot) zur Platzierung über
 * einem Bild. Öffnet die Pinterest-"Pin erstellen"-Seite für das
 * jeweilige Bild in einem neuen Tab. Die Positionierung erfolgt NICHT
 * hier, sondern durch den aufrufenden Elterncontainer via `className`.
 */

import { buildPinterestDescription } from '@/config/pinterest';

interface PinImageButtonProps {
  imageUrl: string;
  pageUrl: string;
  title: string;
  /** Kurzbeschreibung (Summary/Content) für maximale Sichtbarkeit in der Pinterest-Suche. */
  description?: string;
  /** Hashtags (ohne #) für maximale Sichtbarkeit in der Pinterest-Suche. */
  hashtags?: string[];
  className?: string;
}

// Offizielles Pinterest-"P"-Logo als Inline-SVG.
// Eigenständige, kleine SVG-Funktion – kein gemeinsamer Import mit
// ShareButtons.tsx, um Kopplung zwischen beiden Dateien zu vermeiden.
function PinterestPIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path d="M12.017 0C5.396 0 .029 5.367.029 11.987c0 5.079 3.158 9.417 7.618 11.162-.105-.949-.199-2.403.041-3.439.219-.937 1.406-5.957 1.406-5.957s-.359-.72-.359-1.781c0-1.663.967-2.911 2.168-2.911 1.024 0 1.518.769 1.518 1.688 0 1.029-.653 2.567-.992 3.992-.285 1.193.6 2.165 1.775 2.165 2.128 0 3.768-2.245 3.768-5.487 0-2.861-2.063-4.869-5.008-4.869-3.41 0-5.409 2.562-5.409 5.199 0 1.033.394 2.143.889 2.741.099.12.112.225.085.345-.09.375-.293 1.199-.334 1.363-.053.225-.172.271-.401.165-1.495-.69-2.433-2.878-2.433-4.646 0-3.776 2.748-7.252 7.92-7.252 4.158 0 7.392 2.967 7.392 6.923 0 4.135-2.607 7.462-6.233 7.462-1.214 0-2.354-.629-2.758-1.379l-.749 2.848c-.269 1.045-1.004 2.352-1.498 3.146 1.123.345 2.306.535 3.55.535 6.607 0 11.985-5.365 11.985-11.987C23.97 5.39 18.592.026 11.985.026L12.017 0z" />
    </svg>
  );
}

export function PinImageButton({ imageUrl, pageUrl, title, description, hashtags, className }: PinImageButtonProps) {
  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    const pinDescription = buildPinterestDescription({ title, description, hashtags });
    const pinUrl = `https://pinterest.com/pin/create/button/?url=${encodeURIComponent(pageUrl)}&media=${encodeURIComponent(imageUrl)}&description=${encodeURIComponent(pinDescription)}`;
    window.open(pinUrl, '_blank');
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label="Auf Pinterest pinnen"
      className={
        className ??
        'absolute bottom-2 right-2 z-10 h-8 w-8 rounded-full bg-[#E60023] opacity-80 hover:opacity-100 flex items-center justify-center'
      }
    >
      <PinterestPIcon className="h-4 w-4 text-white" />
    </button>
  );
}
