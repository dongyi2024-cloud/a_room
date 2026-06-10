export default function Loading() {
  return (
    <main className="home-workbench" aria-label="Loading homepage">
      <section className="woolf-motion-column" aria-hidden="true">
        <div className="home-image-panel" />
        <div className="home-author-status">
          <article className="author-status-card">
            <p className="author-status-eyebrow">Woolf</p>
            <p className="author-status-thought">房间正在准备中。</p>
          </article>
        </div>
      </section>
      <section className="content-entry-column" aria-label="Loading entries">
        <div className="entry-column-header">
          <p className="workbench-kicker">Archive Index</p>
          <h2>A Room of One&apos;s Own</h2>
          <p>正在进入你的阅读房间。</p>
        </div>
        <div className="entry-card-list entry-card-split home-entry-shelf-layout">
          <section aria-label="首页书架加载中" className="home-bookshelf-shelf">
            <div className="home-bookshelf-stage">
              <div className="bookshelf-plank" />
              <div className="bookshelf-book-row">
                <span className="home-book-link home-book-empty" />
              </div>
            </div>
          </section>
          <article className="home-note-sticky" data-entry="notes">
            <div className="home-note-pin" aria-hidden="true" />
            <div className="home-note-sticky-header">
              <span>Notes / 笔记</span>
              <strong>Loading</strong>
            </div>
            <div className="home-note-sticky-body">
              <p className="home-note-preview">正在读取笔记。</p>
            </div>
          </article>
        </div>
      </section>
    </main>
  );
}
