export function DetailDrawer({
  title,
  children
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <aside className="surface detail-drawer">
      <div className="section-heading">
        <h2>{title}</h2>
      </div>
      {children}
    </aside>
  );
}
