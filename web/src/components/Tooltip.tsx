export function Term({ children, tip }: { children: string; tip: string }) {
  return (
    <span className="term" title={tip}>
      {children}
    </span>
  );
}
