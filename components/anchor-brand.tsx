type Props = {
  size?: "sm" | "md" | "lg";
  withWordmark?: boolean;
};

/**
 * Anchor brand mark — abstract anchor glyph + wordmark.
 * The mark is just an SVG, no external assets.
 */
export function AnchorBrand({ size = "md", withWordmark = true }: Props) {
  const dim = size === "sm" ? 18 : size === "md" ? 22 : 28;
  const textCls =
    size === "sm"
      ? "text-sm"
      : size === "md"
        ? "text-[15px]"
        : "text-lg";

  return (
    <div className="flex items-center gap-2">
      <svg
        width={dim}
        height={dim}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <circle cx="12" cy="5" r="2.2" stroke="currentColor" strokeWidth="1.8" />
        <path
          d="M12 7.5V20"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
        <path
          d="M8 11.5H16"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
        <path
          d="M5 14.5C5 18 8 20 12 20C16 20 19 18 19 14.5"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </svg>
      {withWordmark ? (
        <span className={`font-semibold tracking-tight ${textCls}`}>
          Anchor
        </span>
      ) : null}
    </div>
  );
}
