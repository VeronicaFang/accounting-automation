export function Tabs({ tabs }: { tabs: string[] }) {
  return (
    <div className="tabs" role="tablist" aria-label="功能分頁">
      {tabs.map((tab, index) => (
        <button aria-selected={index === 0} key={tab} role="tab" type="button">
          {tab}
        </button>
      ))}
    </div>
  );
}
