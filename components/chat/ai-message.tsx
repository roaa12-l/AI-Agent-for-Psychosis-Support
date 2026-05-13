type Props = {
  text: string;
  timeLabel?: string;
};

export function AIMessage({ text, timeLabel }: Props) {
  return (
    <div className="flex justify-start">
      <div className="max-w-[82%] flex flex-col items-start gap-1">
        <div className="bg-card border border-line text-ink rounded-2xl rounded-bl-md px-4 py-2.5 text-[15px] leading-relaxed whitespace-pre-wrap">
          {text}
        </div>
        {timeLabel ? (
          <span className="text-[11px] text-muted px-1">{timeLabel}</span>
        ) : null}
      </div>
    </div>
  );
}
