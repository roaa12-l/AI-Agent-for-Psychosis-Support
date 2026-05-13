type Props = {
  text: string;
  /** Display-only label like "2:14 AM" */
  timeLabel?: string;
};

export function UserMessage({ text, timeLabel }: Props) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[78%] flex flex-col items-end gap-1">
        <div className="bg-accent-soft text-ink rounded-2xl rounded-br-md px-4 py-2.5 text-[15px] leading-snug whitespace-pre-wrap">
          {text}
        </div>
        {timeLabel ? (
          <span className="text-[11px] text-muted px-1">{timeLabel}</span>
        ) : null}
      </div>
    </div>
  );
}
