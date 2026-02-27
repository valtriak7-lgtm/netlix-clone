// File purpose: Application logic for this Netflix Clone module.
import { useMemo } from 'react';

function TrailerSlider({ trailers }) {
  const items = useMemo(() => trailers || [], [trailers]);
  const loopItems = useMemo(() => [...items, ...items], [items]);

  if (!items.length) {
    return null;
  }

  return (
    <section className="smooth-enter relative bg-black px-4 pb-6 pt-20 sm:px-8">
      <div className="mx-auto max-w-[1400px]">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-neutral-400">
              Preview Strip
            </p>
            <h3 className="text-2xl font-bold text-white sm:text-3xl">
              Keep browsing
            </h3>
          </div>
        </div>

        <div className="marquee-mask overflow-hidden">
          <div className="marquee-track flex items-center gap-4 py-3">
            {loopItems.map((item, index) => (
              <div
                key={`${item.id || item.title}-${index}`}
                className="marquee-card glass-panel relative h-32 min-w-[230px] overflow-hidden rounded-lg bg-neutral-900 shadow-sm sm:h-40 sm:min-w-[280px]"
              >
                <img
                  src={item.image}
                  alt={item.title}
                  className="h-full w-full object-cover"
                />
                <div className="absolute inset-0 flex items-end bg-gradient-to-t from-black/95 via-black/20 to-transparent p-3">
                  <p className="text-xs font-semibold text-white sm:text-sm">
                    {item.title}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export default TrailerSlider;
