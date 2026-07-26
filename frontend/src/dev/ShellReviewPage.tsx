import Icon from '../components/icons/Icon'

/** R1-only review content. The surrounding AppShell is the product component. */
export default function ShellReviewPage() {
  return <main className="shell-review" data-testid="shell-review">
    <section className="shell-review__lead glass-surface">
      <div><span>Shell review · representative content</span><h2>Navigation stays quiet while the work stays visible.</h2><p>This route deliberately validates the real rail, header, material layers, focus states, and mobile navigation without standing in for Today, Study, Reader, or Shadowing.</p></div>
      <div className="shell-review__status"><Icon name="today" /><b>Ready</b><small>Shell online</small></div>
    </section>
    <section className="shell-review__cards" aria-label="Representative shell content">
      {[['Focus block', 'A compact content surface preserves the hierarchy of a learning route.'], ['System signal', 'Theme, sound, and navigation controls remain visible and reachable.'], ['Next checkpoint', 'Owner visual approval is required before any experience surface proceeds.']].map(([title, copy], index) => <article key={title} className="glass-surface"><span>0{index + 1}</span><h3>{title}</h3><p>{copy}</p><button type="button" aria-label={`Inspect ${title}`}><Icon name={index === 1 ? 'sound' : 'play'} /></button></article>)}
    </section>
  </main>
}
