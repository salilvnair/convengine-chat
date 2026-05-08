/**
 * LandingChips — suggestion chips shown below the landing avatar.
 *
 * Accepts either:
 *   chips: string[]                         → each string is the message text
 *   chips: { chipText: string, chatText: string }[]
 *                                           → chipText is the display label,
 *                                             chatText is the sent message
 *
 * Props
 *   chips            string[] | { chipText, chatText }[]
 *   orientation      'row' | 'column'  (default: 'row')
 *   shape            'round' | 'rect'  (default: 'round')
 *   onChipClick      (text: string) => void   — called with the message to send
 */
export function LandingChips({
  chips = [],
  orientation = 'row',
  shape = 'round',
  onChipClick,
}) {
  if (!chips || chips.length === 0) return null;

  function resolveChip(chip) {
    if (typeof chip === 'string') return { label: chip, message: chip };
    return { label: chip.chipText ?? '', message: chip.chatText ?? chip.chipText ?? '' };
  }

  return (
    <div
      className={[
        'ce-landing-chips',
        `ce-landing-chips--${orientation}`,
        `ce-landing-chips--${shape}`,
      ].join(' ')}
    >
      {chips.map((chip, i) => {
        const { label, message } = resolveChip(chip);
        return (
          <button
            key={i}
            type="button"
            className={`ce-landing-chip ce-landing-chip--${shape}`}
            onClick={() => onChipClick?.(message)}
            title={message !== label ? message : undefined}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
