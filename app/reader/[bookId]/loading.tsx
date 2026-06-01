export default function ReaderLoadingPage() {
  return (
    <main className="app-shell">
      <header className="page-header">
        <div>
          <p className="page-eyebrow">Reader</p>
          <h1 className="page-title">Opening the book</h1>
          <p className="page-subtitle">
            Loading parsed chapter content and preparing the reading surface.
          </p>
        </div>
      </header>
      <section className="soft-card state-card">
        <h2 className="state-title">Loading reader content</h2>
        <p className="state-text">
          The book structure is being loaded from the persisted chapter and paragraph records.
        </p>
      </section>
    </main>
  );
}
